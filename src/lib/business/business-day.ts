import { toZonedTime, format, fromZonedTime } from "date-fns-tz";
import { subDays } from "date-fns";

/**
 * 打刻日時から営業日（YYYY-MM-DD）を計算する
 *
 * 例: 店舗TZ = Asia/Tokyo, dayChangeHour = 6
 * - 2026-07-10 23:00 JST → 営業日 2026-07-10
 * - 2026-07-11 05:00 JST → 営業日 2026-07-10（切替時刻前）
 * - 2026-07-11 06:00 JST → 営業日 2026-07-11（切替時刻以降）
 */
export function getBusinessDate(
  clockedAt: Date,
  timezone: string,
  dayChangeHour: number,
  dayChangeMinute: number = 0
): string {
  const localTime = toZonedTime(clockedAt, timezone);
  const localHour = localTime.getHours();
  const localMinute = localTime.getMinutes();

  const totalLocalMinutes = localHour * 60 + localMinute;
  const changeMinutes = dayChangeHour * 60 + dayChangeMinute;

  if (totalLocalMinutes < changeMinutes) {
    // 切替時刻前なので前日の営業日
    const prevDay = subDays(localTime, 1);
    return format(prevDay, "yyyy-MM-dd", { timeZone: timezone });
  }

  return format(localTime, "yyyy-MM-dd", { timeZone: timezone });
}

/**
 * 営業日（YYYY-MM-DD）と店舗設定から、その営業日の開始時刻（UTC）を取得する
 */
export function getBusinessDayStart(
  businessDate: string,
  timezone: string,
  dayChangeHour: number,
  dayChangeMinute: number = 0
): Date {
  const [year, month, day] = businessDate.split("-").map(Number);
  // 営業日の切替時刻をその日の開始として扱う
  const localDateStr = `${businessDate}T${String(dayChangeHour).padStart(2, "0")}:${String(dayChangeMinute).padStart(2, "0")}:00`;
  return fromZonedTime(localDateStr, timezone);
}

/**
 * 営業日（YYYY-MM-DD）と店舗設定から、その営業日の終了時刻（UTC）を取得する
 */
export function getBusinessDayEnd(
  businessDate: string,
  timezone: string,
  dayChangeHour: number,
  dayChangeMinute: number = 0
): Date {
  const [year, month, day] = businessDate.split("-").map(Number);
  const nextDay = new Date(year, month - 1, day + 1);
  const nextDayStr = format(nextDay, "yyyy-MM-dd");
  const localDateStr = `${nextDayStr}T${String(dayChangeHour).padStart(2, "0")}:${String(dayChangeMinute).padStart(2, "0")}:00`;
  return fromZonedTime(localDateStr, timezone);
}
