/**
 * シフトの法令由来チェック（戦略レポート §4/§5 の「楔」）
 *
 * 2027年施行見込みの労基法改正に対応する。ここではソルバーは持たず、
 * 作成済みシフトに対する「警告」を返す（ハード制約の単純チェック）。
 * - 勤務間インターバル: 退勤から次の出勤まで最低11時間
 * - 連続勤務日数: 13日を超える連続勤務を禁止
 *
 * いずれも法令由来のため HARD（警告として必ず出す）。営業判断のソフト制約は
 * 後続のソルバー段階で ShiftRule として扱う。
 */

/** インターバル下限（時間）。改正法の11時間。 */
export const MIN_INTERVAL_HOURS = 11;
/** 連続勤務日数の上限。 */
export const MAX_CONSECUTIVE_DAYS = 13;

export interface ShiftLike {
  id?: string;
  staffId: string;
  businessDate: string; // YYYY-MM-DD
  startAt: Date;
  endAt: Date;
}

export type ShiftWarningType = "SHORT_INTERVAL" | "TOO_MANY_CONSECUTIVE_DAYS";

export interface ShiftWarning {
  type: ShiftWarningType;
  staffId: string;
  message: string;
  /** 関係するシフトID（判明していれば） */
  shiftIds: string[];
}

const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * 勤務間インターバル違反を検出する
 *
 * 同一スタッフのシフトを時刻順に並べ、退勤→次の出勤が11時間未満の組を返す。
 */
export function findShortIntervals(shifts: ShiftLike[]): ShiftWarning[] {
  const warnings: ShiftWarning[] = [];
  const byStaff = groupByStaff(shifts);

  for (const [staffId, staffShifts] of byStaff) {
    const sorted = [...staffShifts].sort(
      (a, b) => a.startAt.getTime() - b.startAt.getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      const gapHours = (cur.startAt.getTime() - prev.endAt.getTime()) / MS_PER_HOUR;
      // 重複（マイナス）も間隔不足として扱う
      if (gapHours < MIN_INTERVAL_HOURS) {
        const rounded = Math.max(0, Math.floor(gapHours * 10) / 10);
        warnings.push({
          type: "SHORT_INTERVAL",
          staffId,
          message: `${prev.businessDate}の退勤から${cur.businessDate}の出勤までが約${rounded}時間で、インターバル${MIN_INTERVAL_HOURS}時間を下回ります`,
          shiftIds: [prev.id, cur.id].filter((x): x is string => !!x),
        });
      }
    }
  }
  return warnings;
}

/**
 * 連続勤務日数の上限超過を検出する
 *
 * 営業日（YYYY-MM-DD）の連続を数え、MAX_CONSECUTIVE_DAYS を超えたら警告。
 * 同一日に複数シフトがあっても1日として数える。
 */
export function findTooManyConsecutiveDays(shifts: ShiftLike[]): ShiftWarning[] {
  const warnings: ShiftWarning[] = [];
  const byStaff = groupByStaff(shifts);

  for (const [staffId, staffShifts] of byStaff) {
    const days = [...new Set(staffShifts.map((s) => s.businessDate))].sort();
    if (days.length === 0) continue;

    let runStart = days[0];
    let runLen = 1;
    let prev = days[0];

    const flush = (endDay: string, len: number, start: string) => {
      if (len > MAX_CONSECUTIVE_DAYS) {
        const ids = staffShifts
          .filter((s) => s.businessDate >= start && s.businessDate <= endDay)
          .map((s) => s.id)
          .filter((x): x is string => !!x);
        warnings.push({
          type: "TOO_MANY_CONSECUTIVE_DAYS",
          staffId,
          message: `${start}〜${endDay}が${len}連勤で、連続勤務の上限${MAX_CONSECUTIVE_DAYS}日を超えています`,
          shiftIds: ids,
        });
      }
    };

    for (let i = 1; i < days.length; i++) {
      if (isNextDay(prev, days[i])) {
        runLen++;
      } else {
        flush(prev, runLen, runStart);
        runStart = days[i];
        runLen = 1;
      }
      prev = days[i];
    }
    flush(prev, runLen, runStart);
  }
  return warnings;
}

/** シフト集合の法令警告をまとめて返す */
export function checkShiftRules(shifts: ShiftLike[]): ShiftWarning[] {
  return [
    ...findShortIntervals(shifts),
    ...findTooManyConsecutiveDays(shifts),
  ];
}

function groupByStaff(shifts: ShiftLike[]): Map<string, ShiftLike[]> {
  const map = new Map<string, ShiftLike[]>();
  for (const s of shifts) {
    const list = map.get(s.staffId);
    if (list) list.push(s);
    else map.set(s.staffId, [s]);
  }
  return map;
}

/** d2 が d1 の翌日か（どちらも YYYY-MM-DD） */
function isNextDay(d1: string, d2: string): boolean {
  const a = new Date(`${d1}T00:00:00Z`);
  a.setUTCDate(a.getUTCDate() + 1);
  return a.toISOString().slice(0, 10) === d2;
}
