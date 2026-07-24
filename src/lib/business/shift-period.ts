/**
 * シフト希望の提出期間（店舗ごとに設定、既定は月次）
 *
 * 「切替タイミング＝期間の区切り日」として実装する。
 * - MONTHLY: 毎月 startDay 日を区切りに1区間（例 startDay=16 → 16日〜翌15日）
 * - WEEKLY: startDay 曜日(0=日〜6=土)を週の始まりに1区間
 *
 * すべて YYYY-MM-DD の営業日文字列で扱う（時刻・TZは持たない）。
 */

export type ShiftPeriodUnit = "MONTHLY" | "WEEKLY";

export interface ShiftPeriod {
  start: string; // YYYY-MM-DD（含む）
  end: string; // YYYY-MM-DD（含む）
  label: string; // 表示用（例「2026年3月分」「3/16の週」）
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parse(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

function addDays(dateStr: string, days: number): string {
  const d = parse(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

/** MONTHLY の startDay を月の日数に合わせて丸める（28日上限で月末問題を避ける） */
function clampMonthlyStartDay(startDay: number): number {
  if (!Number.isFinite(startDay)) return 1;
  return Math.min(28, Math.max(1, Math.floor(startDay)));
}

/**
 * 指定日を含む月次期間を返す（区切り日 startDay 基準）
 */
function monthlyPeriodContaining(dateStr: string, startDay: number): ShiftPeriod {
  const day = clampMonthlyStartDay(startDay);
  const d = parse(dateStr);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth(); // 0-11
  const dom = d.getUTCDate();

  // 区切り日を跨いでいるかで、期間の開始月を決める
  let startYear = year;
  let startMonth = month;
  if (dom < day) {
    // まだ今月の区切りに達していない → 前月区切りが開始
    startMonth = month - 1;
    if (startMonth < 0) {
      startMonth = 11;
      startYear = year - 1;
    }
  }

  const start = new Date(Date.UTC(startYear, startMonth, day));
  const end = new Date(Date.UTC(startYear, startMonth + 1, day));
  end.setUTCDate(end.getUTCDate() - 1); // 翌区切りの前日

  // ラベル: 区切り日が1なら「YYYY年M月分」、それ以外は範囲表記
  const label =
    day === 1
      ? `${startYear}年${startMonth + 1}月分`
      : `${start.getUTCMonth() + 1}/${start.getUTCDate()}〜${end.getUTCMonth() + 1}/${end.getUTCDate()}`;

  return { start: ymd(start), end: ymd(end), label };
}

/**
 * 指定日を含む週次期間を返す（週の始まり曜日 startDow 基準, 0=日〜6=土）
 */
function weeklyPeriodContaining(dateStr: string, startDow: number): ShiftPeriod {
  const dow = ((Math.floor(startDow) % 7) + 7) % 7;
  const d = parse(dateStr);
  const cur = d.getUTCDay(); // 0-6
  const back = (cur - dow + 7) % 7;
  const start = addDays(dateStr, -back);
  const end = addDays(start, 6);
  const s = parse(start);
  return {
    start,
    end,
    label: `${s.getUTCMonth() + 1}/${s.getUTCDate()}の週`,
  };
}

/** 指定日を含む期間を返す */
export function getPeriodContaining(
  unit: ShiftPeriodUnit,
  startDay: number,
  dateStr: string
): ShiftPeriod {
  return unit === "WEEKLY"
    ? weeklyPeriodContaining(dateStr, startDay)
    : monthlyPeriodContaining(dateStr, startDay);
}

/** 次の期間を返す */
export function getNextPeriod(
  unit: ShiftPeriodUnit,
  startDay: number,
  period: ShiftPeriod
): ShiftPeriod {
  return getPeriodContaining(unit, startDay, addDays(period.end, 1));
}

/**
 * 提出対象の期間を、指定日を含む期間から count 個返す
 * （既定で当期＋翌期の2つ）
 */
export function getSubmissionPeriods(
  unit: ShiftPeriodUnit,
  startDay: number,
  todayStr: string,
  count = 2
): ShiftPeriod[] {
  const periods: ShiftPeriod[] = [];
  let p = getPeriodContaining(unit, startDay, todayStr);
  for (let i = 0; i < count; i++) {
    periods.push(p);
    p = getNextPeriod(unit, startDay, p);
  }
  return periods;
}

/** 期間内の営業日リスト（YYYY-MM-DD） */
export function daysInPeriod(period: ShiftPeriod): string[] {
  const days: string[] = [];
  let cur = period.start;
  // 無限ループ防止（最大400日）
  for (let i = 0; i < 400 && cur <= period.end; i++) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}
