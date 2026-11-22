/**
 * 日報（VLL: 退勤のときに売上とバック発生商品を書く）の純粋なロジック。
 *
 * - お客様名の照合キー（表記ゆれの吸収）
 * - 似た名前の候補（店長が「同じ人」としてまとめる候補）
 * - 同じ日に2人が同じお客様の売上を書いたときの数え方
 * - 集計（キャスト別・商品別・お客様別・日別）
 *
 * 売上は「同じお客様はどちらか1人が書く」運用。2人とも書いたら重複の疑いとして、
 * 店長が決めるまでは1人分（金額が大きい方の日報）だけを店の売上に数える。
 */

// ------------------------------------------------------------
// お客様名の照合キー
// ------------------------------------------------------------

/** 名前の末尾に付く敬称。照合のときだけ外す（表示は書いたまま） */
const HONORIFIC_SUFFIX = /(さん|さま|様|ちゃん|くん|君|氏|殿|たん|どの)$/;

function katakanaToHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  );
}

/**
 * 照合用のキーを作る。同じキーになる名前は同じお客様として自動で紐づける。
 * NFKC（全角英数→半角・半角カナ→全角）→ 小文字 → 空白を除く → カタカナをひらがなに → 末尾の敬称を外す。
 * 括弧の中（「ゆうと（常連）」の「常連」）は外さない。別人の区別に使われることがあるため、
 * 似た名前の候補として店長に出す。
 */
export function normalizeCustomerName(raw: string): string {
  const base = katakanaToHiragana(
    raw.normalize("NFKC").toLowerCase().replace(/\s+/g, "")
  );
  let s = base;
  // 「たけしさま様」のような重ね書きもあるので、外せるだけ外す。全部外れたら元に戻す
  while (HONORIFIC_SUFFIX.test(s)) {
    const next = s.replace(HONORIFIC_SUFFIX, "");
    if (next.length === 0) break;
    s = next;
  }
  return s.length > 0 ? s : base;
}

// ------------------------------------------------------------
// 似た名前の候補
// ------------------------------------------------------------

function withoutBrackets(s: string): string {
  return s.replace(/[(（[［【「].*?[)）\]］】」]/g, "");
}

function levenshtein(a: string, b: string): number {
  const ac = [...a];
  const bc = [...b];
  const prev = Array.from({ length: bc.length + 1 }, (_, i) => i);
  for (let i = 1; i <= ac.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= bc.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (ac[i - 1] === bc[j - 1] ? 0 : 1)
      );
      diag = tmp;
    }
  }
  return prev[bc.length];
}

export type SimilarReason = "BRACKET" | "CONTAINS" | "ONE_CHAR";

/**
 * 2つの照合キーが「同じ人かもしれない」か。同じキーなら既に自動で紐づいているので対象外。
 * - 括弧の中を除くと同じ（「ゆうと（常連）」と「ゆうと」）
 * - 片方がもう片方を含む（2文字以上。「たけし」と「たけしくん2」）
 * - 1文字違い（どちらも3文字以上。「ゆうと」と「ゆうと゛」の打ち間違い）
 */
export function similarReason(a: string, b: string): SimilarReason | null {
  if (a === b) return null;
  const ab = withoutBrackets(a);
  const bb = withoutBrackets(b);
  if (ab.length > 0 && ab === bb) return "BRACKET";
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if ([...short].length >= 2 && long.includes(short)) return "CONTAINS";
  if ([...a].length >= 3 && [...b].length >= 3 && levenshtein(a, b) <= 1)
    return "ONE_CHAR";
  return null;
}

export interface CustomerForMatch {
  id: string;
  normalizedName: string;
}

/** 代表のお客様どうしで、似た名前の組を返す（同じ組は1回だけ） */
export function findSimilarCustomerPairs<T extends CustomerForMatch>(
  customers: T[]
): { a: T; b: T; reason: SimilarReason }[] {
  const pairs: { a: T; b: T; reason: SimilarReason }[] = [];
  for (let i = 0; i < customers.length; i++) {
    for (let j = i + 1; j < customers.length; j++) {
      const reason = similarReason(
        customers[i].normalizedName,
        customers[j].normalizedName
      );
      if (reason) pairs.push({ a: customers[i], b: customers[j], reason });
    }
  }
  return pairs;
}

// ------------------------------------------------------------
// 同じ日に2人が同じお客様を書いたとき
// ------------------------------------------------------------

export type DuplicateDecision = "ADOPTED" | "EXCLUDED" | "SEPARATE";

export interface SaleRow {
  id: string;
  reportId: string;
  staffId: string;
  businessDate: string;
  /** まとめた先まで辿った代表のお客様ID */
  customerRootId: string;
  amount: number;
  decision: DuplicateDecision | null;
  /** 日報を送った時刻（同額のときに先に書いた方を採る） */
  submittedAt: Date;
}

export interface DuplicateGroup {
  businessDate: string;
  customerRootId: string;
  rows: SaleRow[];
  /** 全部の行に店長の判断が入っているか */
  resolved: boolean;
  /** 店の売上に数える額 */
  countedTotal: number;
  /** 未確認のときに仮で採っている日報 */
  provisionalReportId: string | null;
}

export interface CountedSales {
  /** 売上の行ごとに、店の売上に数える額 */
  counted: Map<string, number>;
  duplicates: DuplicateGroup[];
}

/**
 * 店の売上に数える額を決める。
 * 同じ営業日・同じお客様（代表）の行が2つ以上の日報にまたがっていたら重複の疑い。
 * - 全部の行に判断があれば、ADOPTED と SEPARATE を数え、EXCLUDED は数えない
 * - 判断が無い行が1つでもあれば未確認。日報ごとの合計が一番大きい日報（同額なら先に送った方）だけを数える
 * 1つの日報の中で同じお客様が2行あるのは、本人が分けて書いたものとして全部数える。
 */
export function countStoreSales(rows: SaleRow[]): CountedSales {
  const counted = new Map<string, number>();
  const groups = new Map<string, SaleRow[]>();
  for (const r of rows) {
    const key = `${r.businessDate}\u0000${r.customerRootId}`;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }

  const duplicates: DuplicateGroup[] = [];
  for (const g of groups.values()) {
    const reportIds = new Set(g.map((r) => r.reportId));
    if (reportIds.size < 2) {
      for (const r of g) counted.set(r.id, r.amount);
      continue;
    }

    const resolved = g.every((r) => r.decision !== null);
    let provisionalReportId: string | null = null;
    if (resolved) {
      for (const r of g) {
        counted.set(r.id, r.decision === "EXCLUDED" ? 0 : r.amount);
      }
    } else {
      const byReport = new Map<string, { total: number; submittedAt: Date }>();
      for (const r of g) {
        const cur = byReport.get(r.reportId);
        if (cur) cur.total += r.amount;
        else byReport.set(r.reportId, { total: r.amount, submittedAt: r.submittedAt });
      }
      const [best] = [...byReport.entries()].sort(
        ([, x], [, y]) =>
          y.total - x.total || x.submittedAt.getTime() - y.submittedAt.getTime()
      );
      provisionalReportId = best[0];
      for (const r of g) {
        counted.set(r.id, r.reportId === provisionalReportId ? r.amount : 0);
      }
    }
    duplicates.push({
      businessDate: g[0].businessDate,
      customerRootId: g[0].customerRootId,
      rows: [...g].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime()),
      resolved,
      countedTotal: g.reduce((s, r) => s + (counted.get(r.id) ?? 0), 0),
      provisionalReportId,
    });
  }
  duplicates.sort(
    (a, b) =>
      Number(a.resolved) - Number(b.resolved) ||
      b.businessDate.localeCompare(a.businessDate)
  );
  return { counted, duplicates };
}

/**
 * 重複の疑いの1組に店長の判断を当てたときの、行ごとの判断。
 * adoptReportId を渡すとその日報の行を ADOPTED、ほかを EXCLUDED。"SEPARATE" なら全部 SEPARATE。
 */
export function decideDuplicateGroup(
  rows: Pick<SaleRow, "id" | "reportId">[],
  choice: { adoptReportId: string } | "SEPARATE"
): Map<string, DuplicateDecision> {
  const out = new Map<string, DuplicateDecision>();
  for (const r of rows) {
    if (choice === "SEPARATE") out.set(r.id, "SEPARATE");
    else out.set(r.id, r.reportId === choice.adoptReportId ? "ADOPTED" : "EXCLUDED");
  }
  return out;
}

// ------------------------------------------------------------
// 集計
// ------------------------------------------------------------

export interface ReportForSummary {
  id: string;
  staffId: string;
  staffName: string;
  businessDate: string;
  noSales: boolean;
  submittedAt: Date;
  sales: {
    id: string;
    customerRootId: string;
    customerRootName: string;
    amount: number;
    decision: DuplicateDecision | null;
    /** どこの店の分か（店舗設定で選ばせていない店舗は null） */
    location?: string | null;
  }[];
  backItems: { productName: string; unitPrice: number; quantity: number; location?: string | null }[];
}

export interface DailyReportSummary {
  /** 店の売上（重複の疑いを1人分に数えたもの） */
  storeSales: number;
  /** 日報に書かれた売上の単純合計 */
  writtenSales: number;
  backTotal: number;
  backQuantity: number;
  reportCount: number;
  noSalesCount: number;
  customerCount: number;
  duplicates: DuplicateGroup[];
  unresolvedDuplicateCount: number;
  byCast: {
    staffId: string;
    staffName: string;
    reportCount: number;
    writtenSales: number;
    countedSales: number;
    backTotal: number;
    customerCount: number;
  }[];
  byItem: { productName: string; quantity: number; amount: number; staffNames: string[] }[];
  byCustomer: {
    customerRootId: string;
    name: string;
    amount: number;
    visitDays: number;
    staffNames: string[];
  }[];
  byDay: {
    businessDate: string;
    reportCount: number;
    sales: number;
    backTotal: number;
    staffNames: string[];
  }[];
  /** どこの店の分か別（null は店を選ばせていなかった行） */
  byLocation: {
    location: string | null;
    storeSales: number;
    writtenSales: number;
    backTotal: number;
    backQuantity: number;
    customerCount: number;
  }[];
}

/** 商品名の集計キー（全角半角・前後の空白の違いだけ吸収する） */
export function productKey(name: string): string {
  return name.normalize("NFKC").trim();
}

export function summarizeDailyReports(reports: ReportForSummary[]): DailyReportSummary {
  const rows: SaleRow[] = reports.flatMap((r) =>
    r.sales.map((s) => ({
      id: s.id,
      reportId: r.id,
      staffId: r.staffId,
      businessDate: r.businessDate,
      customerRootId: s.customerRootId,
      amount: s.amount,
      decision: s.decision,
      submittedAt: r.submittedAt,
    }))
  );
  const { counted, duplicates } = countStoreSales(rows);

  const castMap = new Map<string, DailyReportSummary["byCast"][number] & { customers: Set<string> }>();
  const itemMap = new Map<string, { productName: string; quantity: number; amount: number; staff: Set<string> }>();
  const custMap = new Map<string, { name: string; amount: number; days: Set<string>; staff: Set<string> }>();
  const dayMap = new Map<string, { reportCount: number; sales: number; backTotal: number; staff: Set<string> }>();
  const locMap = new Map<
    string | null,
    { storeSales: number; writtenSales: number; backTotal: number; backQuantity: number; customers: Set<string> }
  >();
  const locOf = (l: string | null | undefined) => {
    const k = l ?? null;
    return (
      locMap.get(k) ??
      locMap
        .set(k, { storeSales: 0, writtenSales: 0, backTotal: 0, backQuantity: 0, customers: new Set() })
        .get(k)!
    );
  };

  let writtenSales = 0;
  let storeSales = 0;
  let backTotal = 0;
  let backQuantity = 0;

  for (const r of reports) {
    const cast =
      castMap.get(r.staffId) ??
      castMap
        .set(r.staffId, {
          staffId: r.staffId,
          staffName: r.staffName,
          reportCount: 0,
          writtenSales: 0,
          countedSales: 0,
          backTotal: 0,
          customerCount: 0,
          customers: new Set(),
        })
        .get(r.staffId)!;
    const day =
      dayMap.get(r.businessDate) ??
      dayMap
        .set(r.businessDate, { reportCount: 0, sales: 0, backTotal: 0, staff: new Set() })
        .get(r.businessDate)!;
    cast.reportCount++;
    day.reportCount++;
    day.staff.add(r.staffName);

    for (const s of r.sales) {
      const c = counted.get(s.id) ?? 0;
      writtenSales += s.amount;
      storeSales += c;
      cast.writtenSales += s.amount;
      cast.countedSales += c;
      cast.customers.add(s.customerRootId);
      day.sales += c;
      const lo = locOf(s.location);
      lo.writtenSales += s.amount;
      lo.storeSales += c;
      lo.customers.add(s.customerRootId);
      const cu =
        custMap.get(s.customerRootId) ??
        custMap
          .set(s.customerRootId, { name: s.customerRootName, amount: 0, days: new Set(), staff: new Set() })
          .get(s.customerRootId)!;
      cu.amount += c;
      cu.days.add(r.businessDate);
      cu.staff.add(r.staffName);
    }
    for (const b of r.backItems) {
      const amt = b.unitPrice * b.quantity;
      backTotal += amt;
      backQuantity += b.quantity;
      cast.backTotal += amt;
      day.backTotal += amt;
      const lb = locOf(b.location);
      lb.backTotal += amt;
      lb.backQuantity += b.quantity;
      const k = productKey(b.productName);
      const it =
        itemMap.get(k) ??
        itemMap.set(k, { productName: k, quantity: 0, amount: 0, staff: new Set() }).get(k)!;
      it.quantity += b.quantity;
      it.amount += amt;
      it.staff.add(r.staffName);
    }
  }

  return {
    storeSales,
    writtenSales,
    backTotal,
    backQuantity,
    reportCount: reports.length,
    noSalesCount: reports.filter((r) => r.noSales).length,
    customerCount: custMap.size,
    duplicates,
    unresolvedDuplicateCount: duplicates.filter((d) => !d.resolved).length,
    byCast: [...castMap.values()]
      .map(({ customers, ...c }) => ({ ...c, customerCount: customers.size }))
      .sort((a, b) => b.writtenSales - a.writtenSales),
    byItem: [...itemMap.values()]
      .map(({ staff, ...i }) => ({ ...i, staffNames: [...staff] }))
      .sort((a, b) => b.amount - a.amount),
    byCustomer: [...custMap.entries()]
      .map(([id, c]) => ({
        customerRootId: id,
        name: c.name,
        amount: c.amount,
        visitDays: c.days.size,
        staffNames: [...c.staff],
      }))
      .sort((a, b) => b.amount - a.amount),
    byDay: [...dayMap.entries()]
      .map(([d, v]) => ({
        businessDate: d,
        reportCount: v.reportCount,
        sales: v.sales,
        backTotal: v.backTotal,
        staffNames: [...v.staff],
      }))
      .sort((a, b) => b.businessDate.localeCompare(a.businessDate)),
    byLocation: [...locMap.entries()]
      .map(([location, { customers, ...v }]) => ({ location, ...v, customerCount: customers.size }))
      .sort((a, b) => b.storeSales + b.backTotal - (a.storeSales + a.backTotal)),
  };
}
