import { differenceInMinutes } from "date-fns";

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
