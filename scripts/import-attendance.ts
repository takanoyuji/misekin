/**
 * 自社（SHISHA Exhale）の勤怠実績を取り込む
 *
 * `exhale_salary/materials/{YYMM}/概算人件費シミュレーション*.csv` は
 * 出勤・退勤・休憩・時給・通勤手当を持つ、人が検算済みの実績。これを
 *   - Staff / StaffStore（在籍と時給・交通費）
 *   - AttendanceEvent（打刻）と Attendance（1営業日の勤怠）
 * に落とす。
 *
 *   npx tsx scripts/import-attendance.ts --org "合同会社データロー" --store EXHALE
 *   npx tsx scripts/import-attendance.ts --dry-run          # DBに書かず件数だけ見る
 *
 * 注意:
 *   - 休憩は「合計分数」しか無く時刻が無い。勤務のまん中に1回取ったものとして復元する。
 *     深夜労働時間の算出に効くので、実運用の打刻とは別物であることを source で区別する。
 *   - 営業日は DB の Store.dayChangeHour を正とする。
 *   - 同じ (スタッフ, 営業日) が既にあれば飛ばす（何度流しても増えない）。
 */
import fs from "node:fs";
import path from "node:path";

import { getBusinessDate } from "../src/lib/business/business-day";
import {
  calculateNightMinutes,
  calculateWorkMinutes,
} from "../src/lib/business/attendance";

const MATERIALS = "/home/takan/projects/exhale_salary/materials";
const TZ = "Asia/Tokyo";

interface Row {
  month: string;
  name: string;
  date: string;
  inMin: number;
  outMin: number;
  breakMin: number;
  work: number;
  night: number;
  wage: number | null;
  commute: number | null;
}

const toMin = (s: string): number | null => {
  const m = (s ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const toNum = (s: string): number | null => {
  const n = Number((s ?? "").replace(/[,¥\s]/g, ""));
  return Number.isFinite(n) && n !== 0 ? Math.round(n) : null;
};

/** UTF-8(BOM可)のCSV。引用符内のカンマに対応する */
function readCsv(file: string): string[][] {
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
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
 * 表記ゆれの名寄せ
 *
 * 2503 だけ旧フォーマットで、本名や名前の重複表記になっている
 * （exhale_salary/RULES.md「2503のみ旧フォーマット」）。
 * 対応は推測ではなく、2503と2504で同じ時給が付いていることを確認して決めた。
 * 「三浦郁也 = うみ」は時給0（店長で時給を持たない）が一致することで特定した。
 */
const NAME_ALIASES: Record<string, string> = {
  // 2503 の旧表記 → 現行の表示名
  あおとあおと: "碧兎",
  めんまめんま: "めんま",
  烟烟: "烟",
  二ト: "にと", // 「二」は漢数字。カタカナの「ニ」ではない
  山ちゃん: "やまちゃん",
  渡瀬大地: "大地",
  田中美紅: "美紅",
  三浦郁也: "うみ",
  // RULES.md に載っている読み替え
  あおと: "碧兎",
  けむり: "烟",
  ニト: "にと",
  ガク: "がく",
};

function normalizeName(raw: string): string {
  const base = raw.trim().replace(/_+$/, "");
  return NAME_ALIASES[base] ?? base;
}

function load(): Row[] {
  const rows: Row[] = [];
  if (!fs.existsSync(MATERIALS)) return rows;

  for (const dir of fs.readdirSync(MATERIALS).sort()) {
    const d = path.join(MATERIALS, dir);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) {
      if (!f.startsWith("概算人件費") || !f.endsWith(".csv")) continue;
      const csv = readCsv(path.join(d, f));
      const h = csv[0];
      if (!h.includes("氏名")) continue;
      const c = (n: string) => h.indexOf(n);

      for (const r of csv.slice(1)) {
        if (r.length < h.length) continue;
        const name = normalizeName(r[c("氏名")] ?? "");
        if (!name) continue;
        const inMin = toMin(r[c("出勤")]);
        const outMin = toMin(r[c("退勤")]);
        const work = toMin(r[c("労働時間")]);
        const night = toMin(r[c("深夜労働時間")]);
        if (inMin === null || outMin === null || work === null || night === null) {
          continue;
        }
        rows.push({
          month: dir,
          name,
          date: (r[c("日付")] ?? "").trim(),
          inMin,
          outMin,
          breakMin: toMin(r[c("休憩")]) ?? 0,
          work,
          night,
          wage: c("時給") >= 0 ? toNum(r[c("時給")]) : null,
          commute: c("通勤手当") >= 0 ? toNum(r[c("通勤手当")]) : null,
        });
      }
    }
  }
  return rows;
}

/** "YYYY/M/D" + 経過分 → Date（JST基準） */
function at(dateStr: string, minutes: number): Date | null {
  const m = dateStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const base = new Date(
    `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00+09:00`
  );
  return new Date(base.getTime() + minutes * 60_000);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const orgName = args[args.indexOf("--org") + 1] ?? "合同会社データロー";
  const storeCode = args[args.indexOf("--store") + 1] ?? "EXHALE";

  const rows = load();
  const names = [...new Set(rows.map((r) => r.name))];
  console.log(
    `勤怠 ${rows.length}件 / ${names.length}名 / ${rows[0]?.month}〜${rows[rows.length - 1]?.month}`
  );

  if (dryRun) {
    console.log("名前:", names.join(", "));
    console.log("\n--dry-run のためDBには書き込んでいません");
    return;
  }

  const { PrismaClient } = await import("../src/generated/prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const org = await prisma.organization.findFirst({
      where: { name: orgName },
      select: { id: true, stores: { where: { code: storeCode }, select: { id: true, name: true, dayChangeHour: true } } },
    });
    if (!org) throw new Error(`組織「${orgName}」が見つかりません`);
    const store = org.stores[0];
    if (!store) throw new Error(`店舗コード ${storeCode} が見つかりません`);
    console.log(`取り込み先: ${store.name}（営業日切替 ${store.dayChangeHour}時）\n`);

    // --- スタッフと在籍 ---
    const staffByName = new Map<string, string>();
    const staffStoreByName = new Map<string, string>();
    for (const name of names) {
      let staff = await prisma.staff.findFirst({
        where: { organizationId: org.id, displayName: name },
        select: { id: true },
      });
      if (!staff) {
        staff = await prisma.staff.create({
          data: {
            organizationId: org.id,
            displayName: name,
            status: "ACTIVE",
            hireDate: at(rows.find((r) => r.name === name)!.date, 0) ?? undefined,
          },
          select: { id: true },
        });
      }
      staffByName.set(name, staff.id);

      let ss = await prisma.staffStore.findFirst({
        where: { staffId: staff.id, storeId: store.id },
        select: { id: true },
      });
      if (!ss) {
        ss = await prisma.staffStore.create({
          data: {
            staffId: staff.id,
            storeId: store.id,
            isPrimary: true,
            startDate: at(rows.find((r) => r.name === name)!.date, 0) ?? new Date(),
          },
          select: { id: true },
        });
      }
      staffStoreByName.set(name, ss.id);
    }
    console.log(`スタッフ ${names.length}名を用意`);

    // --- 時給（月ごとに変わるので、変わったときだけ履歴を足す） ---
    let wageCount = 0;
    for (const name of names) {
      const ssId = staffStoreByName.get(name)!;
      const hist = rows
        .filter((r) => r.name === name && r.wage)
        .sort((a, b) => a.date.localeCompare(b.date));
      let prev: number | null = null;
      for (const r of hist) {
        if (r.wage === prev) continue;
        const from = at(r.date, 0);
        if (!from) continue;
        const exists = await prisma.wageHistory.findFirst({
          where: { staffStoreId: ssId, effectiveFrom: from },
          select: { id: true },
        });
        if (!exists) {
          await prisma.wageHistory.create({
            data: {
              staffStoreId: ssId,
              amount: r.wage!,
              effectiveFrom: from,
              createdByUserId: (await prisma.user.findFirstOrThrow({ select: { id: true } })).id,
              reason: "実績CSVからの取り込み",
            },
          });
          wageCount++;
        }
        prev = r.wage;
      }
    }
    console.log(`時給履歴 ${wageCount}件`);

    // --- 勤怠 ---
    // 同じ営業日に2回出勤している日がある（中抜け）。みせ勤は1営業日1件なので、
    // 最初の出勤から最後の退勤までを1件にまとめ、間の空きを休憩として持たせる。
    interface Seg { inAt: Date; outAt: Date; breakMin: number; night: number }
    const byKey = new Map<string, { staffId: string; businessDate: string; segs: Seg[] }>();
    let unparsed = 0;

    for (const r of rows) {
      const outMin = r.outMin <= r.inMin ? r.outMin + 24 * 60 : r.outMin;
      const inAt = at(r.date, r.inMin);
      const outAt = at(r.date, outMin);
      if (!inAt || !outAt) {
        unparsed++;
        continue;
      }
      const businessDate = getBusinessDate(inAt, TZ, store.dayChangeHour, 0);
      const staffId = staffByName.get(r.name)!;
      const key = `${staffId}|${businessDate}`;
      const cur = byKey.get(key) ?? { staffId, businessDate, segs: [] };
      cur.segs.push({ inAt, outAt, breakMin: r.breakMin, night: r.night });
      byKey.set(key, cur);
    }

    let created = 0;
    let existed = 0;
    let merged = 0;
    let nightOk = 0;

    for (const entry of byKey.values()) {
      const segs = [...entry.segs].sort((a, b) => a.inAt.getTime() - b.inAt.getTime());
      if (segs.length > 1) merged++;

      const clockIn = segs[0].inAt;
      const clockOut = segs[segs.length - 1].outAt;

      // 各区間の休憩（時刻が無いので区間のまん中に置く）＋ 区間と区間の空き
      const breaks: { startAt: Date; endAt: Date }[] = [];
      for (const [i, sg] of segs.entries()) {
        if (sg.breakMin > 0) {
          const mid = (sg.inAt.getTime() + sg.outAt.getTime()) / 2;
          breaks.push({
            startAt: new Date(mid - (sg.breakMin * 60_000) / 2),
            endAt: new Date(mid + (sg.breakMin * 60_000) / 2),
          });
        }
        const next = segs[i + 1];
        if (next && next.inAt > sg.outAt) {
          breaks.push({ startAt: sg.outAt, endAt: next.inAt });
        }
      }

      const dup = await prisma.attendance.findFirst({
        where: { staffId: entry.staffId, storeId: store.id, businessDate: entry.businessDate },
        select: { id: true },
      });
      if (dup) {
        existed++;
        continue;
      }

      const workMinutes = calculateWorkMinutes(clockIn, clockOut, breaks);
      const nightMinutes = calculateNightMinutes(clockIn, clockOut, breaks, TZ);
      const expectedNight = segs.reduce((t, sg) => t + sg.night, 0);
      if (nightMinutes === expectedNight) nightOk++;

      const breakMinutes = breaks.reduce(
        (t, b) => t + Math.round((b.endAt.getTime() - b.startAt.getTime()) / 60_000),
        0
      );

      await prisma.attendance.create({
        data: {
          organizationId: org.id,
          storeId: store.id,
          staffId: entry.staffId,
          businessDate: entry.businessDate,
          clockInAt: clockIn,
          clockOutAt: clockOut,
          breakMinutes,
          workMinutes,
          status: "COMPLETED",
          breaks: breaks.length
            ? { create: breaks.map((b) => ({ startAt: b.startAt, endAt: b.endAt })) }
            : undefined,
        },
      });
      created++;
    }

    console.log(
      `勤怠 ${created}件を作成（うち中抜けをまとめた日 ${merged}件） / 既存 ${existed}件 / 日付が読めず ${unparsed}件`
    );
    if (created > 0) {
      const pct = ((nightOk / created) * 100).toFixed(1);
      console.log(
        `深夜労働時間が実績と一致: ${nightOk}/${created}件 (${pct}%) ※休憩時刻を復元しているぶんの誤差を含む`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
