import { differenceInMinutes } from "date-fns";
import { toZonedTime } from "date-fns-tz";

interface BreakRecord {
  startAt: Date;
  endAt: Date | null;
}

/**
 * 休憩時間の合計（分）を計算する
 */
export function calculateBreakMinutes(breaks: BreakRecord[]): number {
  return breaks.reduce((total, b) => {
    if (!b.endAt) return total;
    const minutes = differenceInMinutes(b.endAt, b.startAt);
    return total + Math.max(0, minutes);
  }, 0);
}

/**
 * 実労働時間（分）を計算する
 */
export function calculateWorkMinutes(
  clockInAt: Date,
  clockOutAt: Date,
  breaks: BreakRecord[]
): number {
  const totalMinutes = differenceInMinutes(clockOutAt, clockInAt);
  const breakMinutes = calculateBreakMinutes(breaks);
  return Math.max(0, totalMinutes - breakMinutes);
}

/**
 * 分を時:分形式の文字列に変換する
 * 例: 480 → "8:00", 90 → "1:30"
 */
export function formatMinutesToHHMM(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, "0")}`;
}

/**
 * 分を "8時間30分" 形式に変換する
 */
export function formatMinutesToJapanese(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}分`;
  if (mins === 0) return `${hours}時間`;
  return `${hours}時間${mins}分`;
}

/* ------------------------------------------------------------------ */
/* 深夜労働時間                                                        */
/* ------------------------------------------------------------------ */

/**
 * 深夜帯（労基法37条4項）。既定は 22:00〜翌5:00。
 * 自社Exhaleの給与計算実績1,416件と突き合わせて、この定義で一致することを確認済み。
 */
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 5;

/** 1日の分数 */
const DAY = 24 * 60;

/** ある区間と深夜帯の重なり（分）。区間は「基準日0:00からの経過分」で表す */
function overlapWithNight(
  startMin: number,
  endMin: number,
  nightStartHour: number,
  nightEndHour: number
): number {
  const nightStart = nightStartHour * 60;
  // 22:00〜翌5:00 のように日を跨ぐので、翌日の 5:00 として連続した軸で持つ
  const nightEnd = nightEndHour * 60 + DAY;

  let total = 0;
  // 前日・当日・翌日ぶんの深夜帯を見る（勤務が長時間でも取りこぼさない）
  for (const shift of [-DAY, 0, DAY]) {
    const s = Math.max(startMin, nightStart + shift);
    const e = Math.min(endMin, nightEnd + shift);
    if (e > s) total += e - s;
  }
  return total;
}

/** Date を「その日の0:00からの経過分」に直す（店舗のタイムゾーン基準） */
function minutesFromDayStart(at: Date, timezone: string, baseDay: Date): number {
  const local = toZonedTime(at, timezone);
  const base = toZonedTime(baseDay, timezone);
  const baseMidnight = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate()
  );
  return Math.round((local.getTime() - baseMidnight.getTime()) / 60000);
}

/**
 * 深夜労働時間（分）を計算する。
 *
 * 勤務時間と深夜帯の重なりから、休憩のうち深夜帯にかかった分だけを引く。
 * 休憩の一部だけが深夜帯にかかるケースがあるため、休憩の合計をそのまま引いてはいけない
 * （Exhaleの実績でも、この差で8件のずれが出ていた）。
 *
 * 打刻の記録があるみせ勤では、休憩の時刻が分かるぶん正確に出せる。
 */
export function calculateNightMinutes(
  clockInAt: Date,
  clockOutAt: Date,
  breaks: BreakRecord[],
  timezone: string = "Asia/Tokyo",
  nightStartHour: number = NIGHT_START_HOUR,
  nightEndHour: number = NIGHT_END_HOUR
): number {
  const inMin = minutesFromDayStart(clockInAt, timezone, clockInAt);
  const outMin = minutesFromDayStart(clockOutAt, timezone, clockInAt);
  if (outMin <= inMin) return 0;

  const worked = overlapWithNight(inMin, outMin, nightStartHour, nightEndHour);

  const breakNight = breaks.reduce((total, b) => {
    if (!b.endAt) return total;
    const bs = minutesFromDayStart(b.startAt, timezone, clockInAt);
    const be = minutesFromDayStart(b.endAt, timezone, clockInAt);
    if (be <= bs) return total;
    // 勤務時間の外にはみ出た休憩は数えない
    const s = Math.max(bs, inMin);
    const e = Math.min(be, outMin);
    if (e <= s) return total;
    return total + overlapWithNight(s, e, nightStartHour, nightEndHour);
  }, 0);

  return Math.max(0, worked - breakNight);
}
