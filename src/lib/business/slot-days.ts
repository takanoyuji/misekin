/**
 * 時間帯（ShiftSlot）を出す曜日の判定。
 *
 * ShiftSlot.daysOfWeek の値:
 *   0=日 1=月 2=火 3=水 4=木 5=金 6=土 7=祝日
 *   空配列 = 毎日（祝日も含む）。曜日を指定していない既存の時間帯はこれ。
 *
 * 祝日の扱い:
 *   祝日は曜日より優先し、「祝」(7) を含む時間帯だけを出す。
 *   例: 平日=[1..5] / 土日祝=[0,6,7] と分けた店では、月曜の祝日に土日祝の時間帯だけが出る。
 *   土日だけ=[0,6] の時間帯は、土曜が祝日の日には出ない（祝日を含めたいなら「祝」も選ぶ）。
 *
 * クライアントからも使うため、祝日の判定（ライブラリ）はここに入れない。
 * 祝日かどうかは呼び出し側が jp-holiday.ts で調べて渡す。
 */

export const HOLIDAY_DAY = 7;

/** 画面に並べる順（月〜日、祝） */
export const DAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "月" },
  { value: 2, label: "火" },
  { value: 3, label: "水" },
  { value: 4, label: "木" },
  { value: 5, label: "金" },
  { value: 6, label: "土" },
  { value: 0, label: "日" },
  { value: HOLIDAY_DAY, label: "祝" },
];

/** "yyyy-MM-dd" の曜日（0=日〜6=土）。タイムゾーンに依らない */
export function dayOfWeekOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** 重複を除き、0〜7 以外を捨てて昇順にする */
export function normalizeDaysOfWeek(days: readonly number[]): number[] {
  return [...new Set(days)]
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= HOLIDAY_DAY)
    .sort((a, b) => a - b);
}

/** その日にこの時間帯を出すか */
export function slotAppliesOn(
  daysOfWeek: readonly number[] | null | undefined,
  date: string,
  isHoliday: boolean
): boolean {
  if (!daysOfWeek || daysOfWeek.length === 0) return true;
  if (isHoliday) return daysOfWeek.includes(HOLIDAY_DAY);
  return daysOfWeek.includes(dayOfWeekOf(date));
}

/** 店舗設定の一覧に出す短い説明（例: "毎日" / "月火水木金" / "土日祝"） */
export function describeDaysOfWeek(
  daysOfWeek: readonly number[] | null | undefined
): string {
  const days = normalizeDaysOfWeek(daysOfWeek ?? []);
  if (days.length === 0 || days.length === DAY_OPTIONS.length) return "毎日";
  return DAY_OPTIONS.filter((o) => days.includes(o.value))
    .map((o) => o.label)
    .join("");
}
