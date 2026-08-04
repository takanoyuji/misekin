/**
 * Airレジの売上CSVを取り込む
 *
 * 取り込みは2段構えにしている。
 *   1. CSVの1会計を StoreSalesTxn（生の取引）としてそのまま保存する
 *   2. そこから StoreSalesDaily（営業日 × 1時間バケット）を生成する
 *
 * 2段にするのは、集計だけ持つと滞在時間や時間帯の区切りを変えたときに
 * CSVを探し直す羽目になるため。生の取引が残っていれば再集計だけで済む。
 *
 * 客は会計時刻の --stay 分前から滞在していたとみなし、その区間へ金額を按分する。
 * 人手が要るのは会計の瞬間ではなく滞在中なので、会計時刻の1点に寄せると
 * 滞在が重なる時間帯の人手を過小評価してしまう。
 *
 * 営業日の切替時刻は DB の Store.dayChangeHour を正とする（スクリプト側に持たない）。
 *
 * 使い方:
 *   # DBに入れずに集計結果だけ見る
 *   npx tsx scripts/import-sales.ts --dry-run
 *
 *   # 滞在時間を変えて試す
 *   npx tsx scripts/import-sales.ts --dry-run --stay 180
 *
 *   # DBへ取り込む（組織名で対象を特定。店舗は Store.code で照合する）
 *   npx tsx scripts/import-sales.ts --org "合同会社データロー"
 *
 *   # 滞在時間を変えて集計だけ作り直す（CSV不要。保存済みの取引から再計算する）
 *   npx tsx scripts/import-sales.ts --rebuild --stay 180 --org "合同会社データロー"
 *
 * 対応フォーマット:
 *   - ジャーナル履歴（商品明細行。取引Noで畳んでから集計する）
 *   - 会計明細（1行=1会計）
 * どちらも Shift_JIS(cp932)。
 */
import fs from "node:fs";
import path from "node:path";

import { getBusinessDate } from "../src/lib/business/business-day";
import {
  DEFAULT_HEADCOUNT_POLICY,
  salesPerPersonAt,
  suggestHeadcount,
  weekdayIndex,
} from "../src/lib/business/headcount";
import type { HeadcountPolicy, SalesPoint } from "../src/lib/business/headcount";

/* ------------------------------------------------------------------ */
/* 取り込み対象                                                        */
/* ------------------------------------------------------------------ */

const ACC = "/home/takan/projects/accounting/input/sales";
const EXH = "/home/takan/projects/exhale_salary/materials";

/** 滞在時間の既定（分）。会計時刻からこれだけ遡った区間に滞在していたとみなす */
const DEFAULT_STAY_MINUTES = 120;

/** DBに繋がないときの営業日切替時刻。DBがあるときは Store.dayChangeHour が優先される */
const FALLBACK_DAY_CHANGE_HOUR = 10;

interface SourceFile {
  /** みせ勤側の店舗コード */
  storeCode: string;
  storeName: string;
  file: string;
  /** ジャーナル履歴は明細行なので取引Noで畳む */
  kind: "journal" | "receipt";
}

function collectSources(): SourceFile[] {
  const out: SourceFile[] = [];

  // Exhale: 会計明細（16ヶ月ぶん）
  if (fs.existsSync(EXH)) {
    for (const dir of fs.readdirSync(EXH).sort()) {
      const d = path.join(EXH, dir);
      if (!fs.statSync(d).isDirectory()) continue;
      for (const f of fs.readdirSync(d)) {
        if (!f.startsWith("会計明細") || !f.endsWith(".csv")) continue;
        out.push({
          storeCode: "EXHALE",
          storeName: "SHISHA Exhale",
          file: path.join(d, f),
          kind: "receipt",
        });
      }
    }
  }

  // 星狼: ジャーナル履歴（2026-06 のみ）
  // ⚠️ ..._星狼.csv は中身が Exhale の複製（md5一致）なので取り込まない。
  //    星狼池袋の売上CSVは未取得。
  const journals: [string, string, string][] = [
    ["OSK_SEIRO", "星狼 大阪", "ジャーナル履歴_20260601-20260630_2606_星狼大阪.csv"],
    ["NGY_SEIRO", "星狼 名古屋", "ジャーナル履歴_20260601-20260630_星狼名古屋.csv"],
  ];
  for (const [code, name, f] of journals) {
    const p = path.join(ACC, f);
    if (fs.existsSync(p)) {
      out.push({ storeCode: code, storeName: name, file: p, kind: "journal" });
    }
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

/** cp932 のCSVを読む。引用符付きのカンマに対応する */
function readCsv(file: string): string[][] {
  const text = new TextDecoder("shift_jis").decode(fs.readFileSync(file));
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x !== ""));
}

/**
 * 本当のヘッダー行を探す。
 * 月によっては先頭にファイル名だけの行が入っている（2605の会計明細など）。
 */
function findHeader(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].some((c) => c === "来店日" || c === "取引日" || c === "会計日")) {
      return i;
    }
  }
  return 0;
}

/**
 * 日付を YYYY-MM-DD に揃える。
 * 月によって "2025/3/1" と "2025/05/01" が混在している。
 */
function normalizeDate(raw: string): string | null {
  const m = (raw ?? "").trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

const idx = (header: string[], ...names: string[]) => {
  for (const n of names) {
    const i = header.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
};

const toInt = (s: string) => {
  const n = Number((s ?? "").replace(/[,¥\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/** "HH:MM[:SS]" を分に直す */
function toMinutes(raw: string): number | null {
  const m = (raw ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
  return h * 60 + mi;
}

/* ------------------------------------------------------------------ */
/* 取引の読み取り                                                      */
/* ------------------------------------------------------------------ */

/** CSVから読んだ1会計 */
interface Txn {
  storeCode: string;
  storeName: string;
  /** 会計時刻（JST）。営業日もバケットもここから導出する */
  occurredAt: Date;
  amount: number;
  /** 取引No。再取り込みを冪等にするキー */
  externalId: string;
}

interface ParseStat {
  storeCode: string;
  storeName: string;
  files: number;
  skipped: number;
}

function parseTxns(sources: SourceFile[]): {
  txns: Txn[];
  stats: Map<string, ParseStat>;
} {
  const txns: Txn[] = [];
  const stats = new Map<string, ParseStat>();

  for (const src of sources) {
    const rows = readCsv(src.file);
    if (rows.length < 2) continue;
    const headerAt = findHeader(rows);
    const h = rows[headerAt];

    // 来店時刻の列はあるが、実データは97〜99%が会計時刻と同値だった
    // （レジが会計時に一括入力しているため）。使えないので会計時刻を基準にする。
    const dateC = idx(h, "会計日", "取引日", "来店日");
    const timeC = idx(h, "会計時間", "取引時間", "来店時間");
    const amtC = idx(h, "修正後合計", "合計");
    const keyC = idx(h, "取引No");
    if (dateC < 0 || timeC < 0 || amtC < 0) {
      console.warn(`  列が足りないため飛ばす: ${path.basename(src.file)}`);
      continue;
    }

    const stat =
      stats.get(src.storeCode) ??
      ({
        storeCode: src.storeCode,
        storeName: src.storeName,
        files: 0,
        skipped: 0,
      } satisfies ParseStat);
    stat.files++;

    const seen = new Set<string>();
    for (const r of rows.slice(headerAt + 1)) {
      if (r.length <= Math.max(dateC, timeC, amtC, keyC)) {
        stat.skipped++;
        continue;
      }
      // 会計明細は「1会計 = ヘッダー1行 + 明細N行」で、明細行は日付が空。
      // 会計単位で集計したいので、日付が入っている行だけを見る（エラーではない）
      if (!(r[dateC] ?? "").trim()) continue;
      // 明細行は取引単位に畳む
      if (keyC >= 0) {
        const k = r[keyC];
        if (!k || seen.has(k)) continue;
        seen.add(k);
      }

      const dateStr = normalizeDate(r[dateC]);
      const min = toMinutes(r[timeC]);
      const amount = toInt(r[amtC]);
      if (!dateStr || min === null) {
        stat.skipped++;
        continue;
      }
      if (amount <= 0) continue;

      const hh = String(Math.floor(min / 60)).padStart(2, "0");
      const mm = String(min % 60).padStart(2, "0");
      txns.push({
        storeCode: src.storeCode,
        storeName: src.storeName,
        occurredAt: new Date(`${dateStr}T${hh}:${mm}:00+09:00`),
        amount,
        // 取引Noが無いフォーマットに備えて、無ければ日時＋金額で代用する
        externalId: keyC >= 0 && r[keyC] ? r[keyC] : `${dateStr}T${hh}${mm}-${amount}`,
      });
    }

    stats.set(src.storeCode, stat);
  }

  return { txns, stats };
}

/* ------------------------------------------------------------------ */
/* 滞在区間への按分                                                    */
/* ------------------------------------------------------------------ */

/** 営業日 × 1時間バケットの売上 */
interface Bucketed {
  businessDate: string;
  /** "00"〜"23" */
  hourBucket: string;
  amount: number;
  /** 按分された客数（延べではなく重み） */
  customerWeight: number;
}

/**
 * 会計時刻から stayMinutes 遡った区間へ金額を按分する。
 *
 * 例: 22:00 会計・滞在120分なら、20:00〜21:00 と 21:00〜22:00 に半分ずつ。
 * バケットの帰属営業日は、その1時間の開始時刻を店舗の切替時刻で判定して決める
 * （深夜0時をまたいでも同じ営業日に載るようにするため）。
 */
function allocate(
  txns: Txn[],
  dayChangeHour: number,
  stayMinutes: number
): Map<string, Bucketed> {
  const cells = new Map<string, Bucketed>();

  for (const t of txns) {
    const endMs = t.occurredAt.getTime();
    const startMs = endMs - stayMinutes * 60_000;

    // 滞在区間が跨る1時間の枠をすべて拾う
    const firstHour = Math.floor(startMs / 3_600_000);
    const lastHour = Math.ceil(endMs / 3_600_000);
    for (let hb = firstHour; hb < lastHour; hb++) {
      const bs = hb * 3_600_000;
      const be = bs + 3_600_000;
      const overlap = Math.min(endMs, be) - Math.max(startMs, bs);
      if (overlap <= 0) continue;

      const at = new Date(bs);
      const businessDate = getBusinessDate(at, "Asia/Tokyo", dayChangeHour, 0);
      // JSTでの時刻を取る（実行環境のTZに左右されないようフォーマッタを使う）
      const hourBucket = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Tokyo",
        hour: "2-digit",
        hour12: false,
      }).format(at);

      const key = `${t.storeCode}|${businessDate}|${hourBucket}`;
      const cur =
        cells.get(key) ??
        ({ businessDate, hourBucket, amount: 0, customerWeight: 0 } satisfies Bucketed);
      const ratio = overlap / (stayMinutes * 60_000);
      cur.amount += t.amount * ratio;
      cur.customerWeight += ratio;
      cells.set(key, cur);
    }
  }

  // 円未満は最後に丸める（按分の途中で丸めると合計がずれる）
  for (const c of cells.values()) c.amount = Math.round(c.amount);
  return cells;
}

/* ------------------------------------------------------------------ */
/* 出力                                                                */
/* ------------------------------------------------------------------ */

const WD = ["月", "火", "水", "木", "金", "土", "日"];

function report(
  storeName: string,
  cells: Map<string, Bucketed>,
  stat: ParseStat | undefined,
  txnCount: number,
  policy: HeadcountPolicy,
  stayMinutes: number
) {
  const points: SalesPoint[] = [...cells.values()].map((c) => ({
    businessDate: c.businessDate,
    hourBucket: c.hourBucket,
    amount: c.amount,
  }));
  const days = new Set(points.map((p) => p.businessDate));
  const dates = [...days].sort();

  console.log(`\n■ ${storeName}`);
  console.log(
    `   取引 ${txnCount.toLocaleString()}件 / 営業日 ${days.size}日 / ` +
      `${dates[0]}〜${dates[dates.length - 1]} / ファイル ${stat?.files ?? 0}本` +
      (stat?.skipped ? ` / 読めず ${stat.skipped}行` : "")
  );
  console.log(`   滞在 ${stayMinutes}分 として按分`);

  const wi = weekdayIndex(points);
  console.log(
    "   曜日別指数: " +
      WD.map((w, i) => `${w}${String(wi[i as 0]).padStart(3)}`).join("  ")
  );

  const sug = suggestHeadcount(points, policy);
  const hours = [...new Set(sug.map((s) => s.hourBucket))].sort();
  console.log("   提案人数（時間帯別の係数を使用）:");
  for (const hb of hours) {
    const line = WD.map((w, i) => {
      const s = sug.find((x) => x.weekday === i && x.hourBucket === hb);
      if (!s) return `${w} -`;
      const mark = s.confidence === "low" ? "?" : "";
      return `${w}${s.suggested}${mark}`;
    }).join("  ");
    console.log(
      `     ${hb}時 (1人${salesPerPersonAt(policy, hb).toLocaleString()}円) ${line}`
    );
  }
  const lows = sug.filter((s) => s.confidence === "low").length;
  if (lows) {
    console.log(`     ? = 根拠にした営業日が4日未満（${lows}枠）。まだ当てにしない`);
  }

  const rated = sug.filter((s) => s.confidence !== "low");
  if (rated.length) {
    const top = [...rated].sort((a, b) => b.medianSales - a.medianSales)[0];
    const low = [...rated].sort((a, b) => a.medianSales - b.medianSales)[0];
    console.log(
      `   売上中央値: 最も忙しい枠 ${WD[top.weekday]}${top.hourBucket}時 ${top.medianSales.toLocaleString()}円 / ` +
        `最も静かな枠 ${WD[low.weekday]}${low.hourBucket}時 ${low.medianSales.toLocaleString()}円`
    );
  }
}

/* ------------------------------------------------------------------ */
/* DB                                                                  */
/* ------------------------------------------------------------------ */

async function writeToDb(
  txns: Txn[],
  orgName: string,
  stayMinutes: number,
  policy: HeadcountPolicy
) {
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const org = await prisma.organization.findFirst({
      where: { name: orgName },
      select: {
        id: true,
        stores: { select: { id: true, code: true, name: true, dayChangeHour: true } },
      },
    });
    if (!org) throw new Error(`組織「${orgName}」が見つかりません`);

    const byStore = new Map<string, Txn[]>();
    for (const t of txns) {
      if (!byStore.has(t.storeCode)) byStore.set(t.storeCode, []);
      byStore.get(t.storeCode)!.push(t);
    }

    let txnWritten = 0;
    let cellWritten = 0;

    for (const [storeCode, list] of byStore) {
      const store = org.stores.find((s) => s.code === storeCode);
      if (!store) {
        console.warn(
          `  店舗コード ${storeCode} が組織にありません。飛ばします` +
            `（Store.code を設定してください）`
        );
        continue;
      }

      // 1. 生の取引を保存する（取引Noで冪等）
      for (const t of list) {
        await prisma.storeSalesTxn.upsert({
          where: {
            storeId_externalId: { storeId: store.id, externalId: t.externalId },
          },
          update: { occurredAt: t.occurredAt, amount: t.amount },
          create: {
            organizationId: org.id,
            storeId: store.id,
            occurredAt: t.occurredAt,
            amount: t.amount,
            externalId: t.externalId,
            source: "CSV_AIRREGI",
          },
        });
        txnWritten++;
      }

      // 2. 営業日 × 1時間バケットを生成する。切替時刻はDBの店舗設定が正
      const cells = allocate(list, store.dayChangeHour, stayMinutes);
      for (const c of cells.values()) {
        await prisma.storeSalesDaily.upsert({
          where: {
            storeId_businessDate_hourBucket: {
              storeId: store.id,
              businessDate: c.businessDate,
              hourBucket: c.hourBucket,
            },
          },
          update: {
            amount: c.amount,
            customerCount: Math.round(c.customerWeight),
            source: "CSV_AIRREGI",
            stayMinutes,
          },
          create: {
            organizationId: org.id,
            storeId: store.id,
            businessDate: c.businessDate,
            hourBucket: c.hourBucket,
            amount: c.amount,
            customerCount: Math.round(c.customerWeight),
            source: "CSV_AIRREGI",
            stayMinutes,
          },
        });
        cellWritten++;
      }

      console.log(
        `  ${store.name}: 取引 ${list.length}件 → 営業日×時間帯 ${cells.size}セル` +
          `（切替 ${store.dayChangeHour}時）`
      );
    }

    console.log(
      `\nDBへ反映しました: 取引 ${txnWritten}件 / 集計 ${cellWritten}セル`
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * CSVを読まず、DBに保存済みの取引から StoreSalesDaily を作り直す。
 *
 * 滞在時間の仮定を変えたときはこれを回す。生の取引を持っている目的がこれで、
 * CSVを探し直さずに集計をやり直せる。
 */
async function rebuildFromTxns(orgName: string, stayMinutes: number) {
  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const org = await prisma.organization.findFirst({
      where: { name: orgName },
      select: {
        id: true,
        stores: { select: { id: true, code: true, name: true, dayChangeHour: true } },
      },
    });
    if (!org) throw new Error(`組織「${orgName}」が見つかりません`);

    for (const store of org.stores) {
      const rows = await prisma.storeSalesTxn.findMany({
        where: { storeId: store.id },
        select: { occurredAt: true, amount: true, externalId: true },
      });
      if (rows.length === 0) continue;

      const txns: Txn[] = rows.map((r) => ({
        storeCode: store.code ?? store.id,
        storeName: store.name,
        occurredAt: r.occurredAt,
        amount: r.amount,
        externalId: r.externalId,
      }));
      const cells = allocate(txns, store.dayChangeHour, stayMinutes);

      // 滞在時間を変えるとバケットの並びも変わるので、作り直す前に消す。
      // 消してから入れ直さないと、前の滞在時間で作った端のセルが残る。
      await prisma.storeSalesDaily.deleteMany({
        where: { storeId: store.id, source: "CSV_AIRREGI" },
      });
      for (const c of cells.values()) {
        await prisma.storeSalesDaily.create({
          data: {
            organizationId: org.id,
            storeId: store.id,
            businessDate: c.businessDate,
            hourBucket: c.hourBucket,
            amount: c.amount,
            customerCount: Math.round(c.customerWeight),
            source: "CSV_AIRREGI",
            stayMinutes,
          },
        });
      }
      console.log(
        `  ${store.name}: 取引 ${rows.length}件 → ${cells.size}セル（滞在${stayMinutes}分・切替${store.dayChangeHour}時）`
      );
    }
    console.log("\n再集計しました");
  } finally {
    await prisma.$disconnect();
  }
}

/** 店舗コード → 店舗ごとの設定 */
type StoreSettings = Map<string, { dayChangeHour: number; maxStaffPerSlot: number }>;

/** dry-run 用。DBがあれば店舗設定を読む（無ければ既定値で続行する） */
async function loadStoreSettings(orgName: string): Promise<StoreSettings | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { PrismaClient } = await import("../src/generated/prisma/client");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });
    try {
      const org = await prisma.organization.findFirst({
        where: { name: orgName },
        select: {
          stores: {
            select: { code: true, dayChangeHour: true, maxStaffPerSlot: true },
          },
        },
      });
      if (!org) return null;
      const m: StoreSettings = new Map();
      for (const s of org.stores) {
        if (s.code) {
          m.set(s.code, {
            dayChangeHour: s.dayChangeHour,
            maxStaffPerSlot: s.maxStaffPerSlot,
          });
        }
      }
      return m;
    } finally {
      await prisma.$disconnect();
    }
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const rebuild = args.includes("--rebuild");
  const orgName = args[args.indexOf("--org") + 1] ?? "合同会社データロー";
  const stayMinutes = args.includes("--stay")
    ? Number(args[args.indexOf("--stay") + 1])
    : DEFAULT_STAY_MINUTES;
  if (!Number.isFinite(stayMinutes) || stayMinutes <= 0) {
    throw new Error(`--stay の値が不正です: ${stayMinutes}`);
  }

  // 取り込み済みの取引から集計だけ作り直す（CSVは読まない）
  if (rebuild) {
    console.log(`保存済みの取引から再集計します / 滞在 ${stayMinutes}分`);
    await rebuildFromTxns(orgName, stayMinutes);
    return;
  }

  const sources = collectSources();
  console.log(`対象ファイル ${sources.length}本 / 滞在 ${stayMinutes}分`);

  const { txns, stats } = parseTxns(sources);

  const byStore = new Map<string, Txn[]>();
  for (const t of txns) {
    if (!byStore.has(t.storeCode)) byStore.set(t.storeCode, []);
    byStore.get(t.storeCode)!.push(t);
  }

  const settings = await loadStoreSettings(orgName);
  if (!settings) {
    console.log(
      `（DBを参照できないため切替時刻 ${FALLBACK_DAY_CHANGE_HOUR}時・上限 ${DEFAULT_HEADCOUNT_POLICY.maxPerSlot}人で計算します）`
    );
  }

  for (const [storeCode, list] of byStore) {
    const s = settings?.get(storeCode);
    const cells = allocate(
      list,
      s?.dayChangeHour ?? FALLBACK_DAY_CHANGE_HOUR,
      stayMinutes
    );
    report(
      list[0].storeName,
      cells,
      stats.get(storeCode),
      list.length,
      // 上限は店舗設定が正（箱の広さも回し方も店ごとに違うため）
      {
        ...DEFAULT_HEADCOUNT_POLICY,
        maxPerSlot: s?.maxStaffPerSlot ?? DEFAULT_HEADCOUNT_POLICY.maxPerSlot,
      },
      stayMinutes
    );
  }

  if (dryRun) {
    console.log("\n--dry-run のためDBには書き込んでいません");
    return;
  }
  await writeToDb(txns, orgName, stayMinutes, DEFAULT_HEADCOUNT_POLICY);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
