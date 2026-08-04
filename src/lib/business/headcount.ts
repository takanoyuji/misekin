/**
 * 売上から必要人数の目安を出す
 *
 * 「忙しい日に人が足りない」「静かな日に人が余る」を減らすための入力を作る部分。
 * 出すのはあくまで目安で、確定させるのは店長。ここで勝手にシフトは組まない。
 *
 * 考え方:
 *   1. 曜日 × 時間帯ごとに、過去の売上の中央値を取る（外れ値に引っ張られないため）
 *   2. 「1人がさばける売上」で割って人数にする
 *   3. 店舗ごとの下限・上限で丸める
 *
 * 平均ではなく中央値を使うのは、貸切やイベントの日が1回入るだけで
 * 平常時の目安が跳ね上がるのを避けるため。
 */

/** 売上の実績1件（営業日 × 1時間バケット） */
export interface SalesPoint {
  /** YYYY-MM-DD（営業日。切替時刻を適用済み） */
  businessDate: string;
  /** 営業日内の時刻バケット "00"〜"23" */
  hourBucket: string;
  /** 税込売上（滞在区間で按分済み） */
  amount: number;
}

export interface HeadcountPolicy {
  /**
   * 1人が1時間でさばける売上（円/人時）。"00"〜"23" をキーにする。
   *
   * 時間帯ごとに実績が大きく違う（Exhale では昼1,100円に対し深夜9,000円超）ため、
   * 一律の係数だと深夜帯で常に人数を多く見積もってしまう。
   */
  salesPerPersonByHour: Record<string, number>;
  /** byHour に無い時間帯のフォールバック */
  salesPerPersonDefault: number;
  /** 営業する以上は最低これだけ立てる */
  minPerSlot: number;
  /** 席数・箱の広さから来る上限 */
  maxPerSlot: number;
}

/**
 * 既定値は SHISHA Exhale の実績16ヶ月（2025-03〜2026-06、8,665取引 / 483営業日）から算出した
 * 時間帯別の中央値。会計時刻の120分前から滞在していたとみなして按分し、
 * 同じ時間帯の実在籍人数（勤怠実績）で割って求めた。
 *
 * 注意が2つある。
 * 1. これは「過去にその人数で回していた」という記録であって、適正水準の保証ではない。
 *    人手不足だった時間帯の値も平常として含まれるため、そのまま使うと現状を再生産する。
 *    深夜帯の高い値は「少人数で回していた」結果で、きつかったなら下げるべき。
 * 2. 1店舗のデータに由来する。他業態・他店舗ではあくまで初期値として扱い、
 *    実績が貯まったらその店舗の値に置き換える。
 */
export const DEFAULT_HEADCOUNT_POLICY: HeadcountPolicy = {
  salesPerPersonByHour: {
    "14": 2_939,
    "15": 1_100,
    "16": 2_035,
    "17": 2_952,
    "18": 3_187,
    "19": 3_231,
    "20": 3_527,
    "21": 4_099,
    "22": 5_923,
    "23": 4_919,
    "00": 3_362,
    "01": 3_460,
    "02": 4_029,
    "03": 7_411,
    "04": 5_870,
    "05": 3_737,
    "06": 10_194,
    "07": 8_319,
  },
  // 上記に無い時間帯（昼間など実績がほぼ無い枠）はこれで割る
  salesPerPersonDefault: 3_988,
  minPerSlot: 1,
  // 提案が上振れしても現実離れした人数を出さないための蓋。
  // 実際の上限は店舗ごとに違うので Store.maxStaffPerSlot で上書きする
  maxPerSlot: 2,
};

/** その時間帯の「1人がさばける売上」を引く */
export function salesPerPersonAt(
  policy: HeadcountPolicy,
  hourBucket: string
): number {
  const v = policy.salesPerPersonByHour[hourBucket];
  return v && v > 0 ? v : policy.salesPerPersonDefault;
}

/** 曜日 0=月 〜 6=日 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface HeadcountSuggestion {
  weekday: Weekday;
  /** 営業日内の時刻バケット "00"〜"23" */
  hourBucket: string;
  /** 中央値の売上 */
  medianSales: number;
  /** 提案する人数 */
  suggested: number;
  /** 根拠にした営業日の数。少ないほど当てにならない */
  sampleDays: number;
  /**
   * この提案を信用してよいか。
   * サンプルが少ないうちは店長が決めるべきなので、UI側で注意を出すために持つ。
   */
  confidence: "low" | "medium" | "high";
}

/** YYYY-MM-DD から曜日を出す（0=月）。タイムゾーンの影響を受けないよう素朴に計算する */
export function weekdayOf(businessDate: string): Weekday {
  const [y, m, d] = businessDate.split("-").map(Number);
  // UTC で作れば実行環境のタイムゾーンに左右されない
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=日
  return (((jsDay + 6) % 7) as Weekday); // 0=月 に寄せる
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function confidenceOf(sampleDays: number): HeadcountSuggestion["confidence"] {
  // 曜日ごとに見るので、4週=4日ぶんでようやく形が見え始める
  if (sampleDays >= 12) return "high";
  if (sampleDays >= 4) return "medium";
  return "low";
}

/**
 * 売上の実績から、曜日 × 時間帯の必要人数を提案する。
 *
 * 同じ営業日・同じ時間帯に複数件あれば合算してから中央値を取る
 * （取り込み側が明細のまま渡してきても壊れないように）。
 */
export function suggestHeadcount(
  points: SalesPoint[],
  policy: HeadcountPolicy = DEFAULT_HEADCOUNT_POLICY
): HeadcountSuggestion[] {
  // (曜日, hourBucket) → 営業日 → 合計売上
  const buckets = new Map<string, Map<string, number>>();

  for (const p of points) {
    if (!p.businessDate || !p.hourBucket) continue;
    const key = `${weekdayOf(p.businessDate)}|${p.hourBucket}`;
    const byDate = buckets.get(key) ?? new Map<string, number>();
    byDate.set(p.businessDate, (byDate.get(p.businessDate) ?? 0) + p.amount);
    buckets.set(key, byDate);
  }

  const out: HeadcountSuggestion[] = [];
  for (const [key, byDate] of buckets) {
    const [wd, hourBucket] = key.split("|");
    const daily = [...byDate.values()];
    const med = median(daily);
    // 1時間バケットなので「1人が1時間でさばける売上」で割る
    const raw = Math.ceil(med / salesPerPersonAt(policy, hourBucket));
    out.push({
      weekday: Number(wd) as Weekday,
      hourBucket,
      medianSales: med,
      suggested: Math.min(policy.maxPerSlot, Math.max(policy.minPerSlot, raw)),
      sampleDays: daily.length,
      confidence: confidenceOf(daily.length),
    });
  }

  return out.sort(
    (a, b) => a.weekday - b.weekday || a.hourBucket.localeCompare(b.hourBucket)
  );
}

/**
 * 曜日別の売上指数（最大=100）。LPやダッシュボードで傾向を見せるため。
 * 金額そのものを出さずに山を伝えられる。
 */
export function weekdayIndex(points: SalesPoint[]): Record<Weekday, number> {
  const sums = new Map<Weekday, number>();
  for (const p of points) {
    if (!p.businessDate) continue;
    const wd = weekdayOf(p.businessDate);
    sums.set(wd, (sums.get(wd) ?? 0) + p.amount);
  }
  const max = Math.max(...sums.values(), 0);
  const out = {} as Record<Weekday, number>;
  for (let i = 0 as Weekday; i < 7; i = ((i + 1) as Weekday)) {
    out[i] = max > 0 ? Math.round(((sums.get(i) ?? 0) / max) * 100) : 0;
  }
  return out;
}
