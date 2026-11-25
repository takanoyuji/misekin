import { describe, it, expect, vi } from "vitest";
import {
  dayOfWeekOf,
  describeDaysOfWeek,
  normalizeDaysOfWeek,
  slotAppliesOn,
} from "@/lib/business/slot-days";

vi.mock("server-only", () => ({}));
const { isJapaneseHoliday } = await import("@/lib/business/jp-holiday");

// VLL池袋店の設定（2026-11-25 本番の shift_slots から）
const WEEKDAY = [1, 2, 3, 4, 5]; // 平日 19:00-22:00
const WEEKEND_HOLIDAY = [0, 6, 7]; // 土日祝(前半) 17:00-20:00 / (後半) 20:00-23:00

describe("dayOfWeekOf", () => {
  it("yyyy-MM-dd の曜日を返す", () => {
    expect(dayOfWeekOf("2026-11-19")).toBe(4); // 木
    expect(dayOfWeekOf("2026-11-22")).toBe(0); // 日
    expect(dayOfWeekOf("2026-11-21")).toBe(6); // 土
  });
});

describe("slotAppliesOn", () => {
  it("曜日を指定していない時間帯は毎日出る（祝日も）", () => {
    expect(slotAppliesOn([], "2026-11-19", false)).toBe(true);
    expect(slotAppliesOn(null, "2026-11-23", true)).toBe(true);
  });

  it("平日の木曜は平日の時間帯だけ", () => {
    expect(slotAppliesOn(WEEKDAY, "2026-11-19", false)).toBe(true);
    expect(slotAppliesOn(WEEKEND_HOLIDAY, "2026-11-19", false)).toBe(false);
  });

  it("土日は土日祝の時間帯だけ", () => {
    for (const d of ["2026-11-21", "2026-11-22"]) {
      expect(slotAppliesOn(WEEKDAY, d, false)).toBe(false);
      expect(slotAppliesOn(WEEKEND_HOLIDAY, d, false)).toBe(true);
    }
  });

  it("月曜の祝日は土日祝の時間帯だけ（祝日は曜日より優先）", () => {
    expect(slotAppliesOn(WEEKDAY, "2026-11-23", true)).toBe(false);
    expect(slotAppliesOn(WEEKEND_HOLIDAY, "2026-11-23", true)).toBe(true);
  });

  it("「祝」を選んでいない時間帯は、土曜の祝日にも出ない", () => {
    expect(slotAppliesOn([0, 6], "2028-01-01", true)).toBe(false); // 土曜の元日
  });
});

describe("isJapaneseHoliday", () => {
  it("祝日・振替休日を判定する", () => {
    expect(isJapaneseHoliday("2026-11-23")).toBe(true); // 勤労感謝の日
    expect(isJapaneseHoliday("2026-11-19")).toBe(false);
    expect(isJapaneseHoliday("2027-01-11")).toBe(true); // 成人の日
    expect(isJapaneseHoliday("2026-05-06")).toBe(true); // 振替休日
  });
});

describe("normalizeDaysOfWeek / describeDaysOfWeek", () => {
  it("重複・範囲外を除いて昇順にする", () => {
    expect(normalizeDaysOfWeek([7, 0, 6, 6, 9, -1])).toEqual([0, 6, 7]);
  });
  it("短い説明を返す", () => {
    expect(describeDaysOfWeek([])).toBe("毎日");
    expect(describeDaysOfWeek(WEEKDAY)).toBe("月火水木金");
    expect(describeDaysOfWeek(WEEKEND_HOLIDAY)).toBe("土日祝");
  });
});
