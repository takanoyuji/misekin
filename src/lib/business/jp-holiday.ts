import "server-only";
import holidayJp from "@holiday-jp/holiday_jp";

/**
 * 日本の祝日か（振替休日・国民の休日を含む）。
 * "yyyy-MM-dd" をそのまま引くので、サーバーのタイムゾーンに左右されない。
 * データは @holiday-jp/holiday_jp に同梱（2050年まで）。祝日法の改正があれば版を上げる。
 * 1.4MB あるのでサーバー専用にし、クライアントには判定結果だけを渡す。
 */
export function isJapaneseHoliday(date: string): boolean {
  return Object.prototype.hasOwnProperty.call(holidayJp.holidays, date);
}
