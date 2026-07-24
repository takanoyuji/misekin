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

// ------------------------------------------------------------------
// 店長ルール（ShiftRule）の評価
// ------------------------------------------------------------------
// ソルバー段階の前に、評価可能な一部のルールを現在のシフトに対して警告として出す。
// SPACING（出勤間隔）と MAX_SHIFTS_PER_WEEK（週上限）は割当てなしで判定できる。
// SALES_PRIORITY・PAIR_AVOID 等はソルバーが必要なため、ここでは評価しない。

export interface EvaluableRule {
  id: string;
  ruleType: string;
  params: Record<string, unknown>;
  description: string;
}

export interface RuleViolation {
  ruleId: string;
  staffId: string;
  message: string;
}

/** ルールタイプが今の段階で警告評価できるか */
export function isEvaluableRuleType(ruleType: string): boolean {
  return ruleType === "SPACING" || ruleType === "MAX_SHIFTS_PER_WEEK";
}

/**
 * 有効な店長ルールを、現在のシフトに対して評価して違反を返す
 */
export function evaluateRules(
  rules: EvaluableRule[],
  shifts: ShiftLike[]
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const byStaff = groupByStaff(shifts);

  for (const rule of rules) {
    if (rule.ruleType === "SPACING") {
      const minGap = Number(rule.params.minGapDays);
      if (!Number.isFinite(minGap) || minGap < 1) continue;
      for (const [staffId, staffShifts] of byStaff) {
        const days = [...new Set(staffShifts.map((s) => s.businessDate))].sort();
        for (let i = 1; i < days.length; i++) {
          const gap = dayDiff(days[i - 1], days[i]);
          if (gap < minGap) {
            violations.push({
              ruleId: rule.id,
              staffId,
              message: `${days[i - 1]}と${days[i]}の間隔が${gap}日で、${minGap}日以上の希望を下回ります`,
            });
          }
        }
      }
    } else if (rule.ruleType === "MAX_SHIFTS_PER_WEEK") {
      const maxPerWeek = Number(rule.params.maxPerWeek);
      if (!Number.isFinite(maxPerWeek) || maxPerWeek < 0) continue;
      for (const [staffId, staffShifts] of byStaff) {
        const days = new Set(staffShifts.map((s) => s.businessDate));
        if (days.size > maxPerWeek) {
          violations.push({
            ruleId: rule.id,
            staffId,
            message: `この期間で${days.size}回の出勤があり、週上限${maxPerWeek}回を超えています`,
          });
        }
      }
    }
  }
  return violations;
}

/** d1→d2 の日数差（どちらも YYYY-MM-DD） */
function dayDiff(d1: string, d2: string): number {
  const a = new Date(`${d1}T00:00:00Z`).getTime();
  const b = new Date(`${d2}T00:00:00Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
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
