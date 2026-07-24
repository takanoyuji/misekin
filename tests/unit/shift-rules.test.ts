import { describe, it, expect } from "vitest";
import {
  findShortIntervals,
  findTooManyConsecutiveDays,
  checkShiftRules,
  MIN_INTERVAL_HOURS,
  MAX_CONSECUTIVE_DAYS,
} from "@/lib/business/shift-rules";

function shift(
  id: string,
  staffId: string,
  date: string,
  startISO: string,
  endISO: string
) {
  return {
    id,
    staffId,
    businessDate: date,
    startAt: new Date(startISO),
    endAt: new Date(endISO),
  };
}

describe("findShortIntervals（勤務間インターバル11時間）", () => {
  it("退勤から翌出勤が11時間未満なら警告", () => {
    // 1/15 深夜3:00退勤 → 1/15 13:00出勤 = 10時間
    const shifts = [
      shift("a", "s1", "2026-01-14", "2026-01-14T11:00:00Z", "2026-01-14T18:00:00Z"), // JST 20:00-翌3:00
      shift("b", "s1", "2026-01-15", "2026-01-15T04:00:00Z", "2026-01-15T11:00:00Z"), // JST 13:00-20:00
    ];
    const w = findShortIntervals(shifts);
    expect(w).toHaveLength(1);
    expect(w[0].type).toBe("SHORT_INTERVAL");
    expect(w[0].shiftIds).toEqual(["a", "b"]);
  });

  it("11時間以上空いていれば警告なし", () => {
    const shifts = [
      shift("a", "s1", "2026-01-14", "2026-01-14T11:00:00Z", "2026-01-14T18:00:00Z"),
      shift("b", "s1", "2026-01-15", "2026-01-15T06:00:00Z", "2026-01-15T13:00:00Z"), // 12時間後
    ];
    expect(findShortIntervals(shifts)).toHaveLength(0);
  });

  it("別スタッフのシフトは比較しない", () => {
    const shifts = [
      shift("a", "s1", "2026-01-14", "2026-01-14T11:00:00Z", "2026-01-14T18:00:00Z"),
      shift("b", "s2", "2026-01-15", "2026-01-15T04:00:00Z", "2026-01-15T11:00:00Z"),
    ];
    expect(findShortIntervals(shifts)).toHaveLength(0);
  });

  it("MIN_INTERVAL_HOURS は11", () => {
    expect(MIN_INTERVAL_HOURS).toBe(11);
  });
});

describe("findTooManyConsecutiveDays（連続勤務13日）", () => {
  it("14連勤で警告", () => {
    const shifts = Array.from({ length: 14 }, (_, i) => {
      const d = String(i + 1).padStart(2, "0");
      return shift(
        `id${i}`,
        "s1",
        `2026-03-${d}`,
        `2026-03-${d}T10:00:00Z`,
        `2026-03-${d}T18:00:00Z`
      );
    });
    const w = findTooManyConsecutiveDays(shifts);
    expect(w).toHaveLength(1);
    expect(w[0].type).toBe("TOO_MANY_CONSECUTIVE_DAYS");
  });

  it("13連勤ちょうどは許容（上限内）", () => {
    const shifts = Array.from({ length: 13 }, (_, i) => {
      const d = String(i + 1).padStart(2, "0");
      return shift(
        `id${i}`,
        "s1",
        `2026-03-${d}`,
        `2026-03-${d}T10:00:00Z`,
        `2026-03-${d}T18:00:00Z`
      );
    });
    expect(findTooManyConsecutiveDays(shifts)).toHaveLength(0);
  });

  it("間に休みが入れば連続がリセットされる", () => {
    // 7連勤 → 1日空け → 7連勤（どちらも13日以内）
    const days = [
      ...Array.from({ length: 7 }, (_, i) => i + 1),
      ...Array.from({ length: 7 }, (_, i) => i + 9),
    ];
    const shifts = days.map((n) => {
      const d = String(n).padStart(2, "0");
      return shift(
        `id${n}`,
        "s1",
        `2026-03-${d}`,
        `2026-03-${d}T10:00:00Z`,
        `2026-03-${d}T18:00:00Z`
      );
    });
    expect(findTooManyConsecutiveDays(shifts)).toHaveLength(0);
  });

  it("同一日に複数シフトでも1日として数える", () => {
    const shifts = [
      shift("a", "s1", "2026-03-01", "2026-03-01T10:00:00Z", "2026-03-01T14:00:00Z"),
      shift("b", "s1", "2026-03-01", "2026-03-01T15:00:00Z", "2026-03-01T18:00:00Z"),
    ];
    expect(findTooManyConsecutiveDays(shifts)).toHaveLength(0);
  });

  it("MAX_CONSECUTIVE_DAYS は13", () => {
    expect(MAX_CONSECUTIVE_DAYS).toBe(13);
  });
});

describe("checkShiftRules", () => {
  it("両方の警告をまとめて返す", () => {
    const shifts = [
      shift("a", "s1", "2026-01-14", "2026-01-14T11:00:00Z", "2026-01-14T18:00:00Z"),
      shift("b", "s1", "2026-01-15", "2026-01-15T04:00:00Z", "2026-01-15T11:00:00Z"),
    ];
    const w = checkShiftRules(shifts);
    expect(w.length).toBeGreaterThanOrEqual(1);
  });

  it("空配列では警告なし", () => {
    expect(checkShiftRules([])).toEqual([]);
  });
});
