import { describe, it, expect } from "vitest";
import {
  calculateClockState,
  getAvailableActions,
  validateClockTransition,
  getClockStateLabel,
  getClockActionLabel,
} from "@/lib/business/time-clock";

// ClockEventType のモック (Prismaから)
const ClockEventType = {
  CLOCK_IN: "CLOCK_IN" as const,
  BREAK_START: "BREAK_START" as const,
  BREAK_END: "BREAK_END" as const,
  CLOCK_OUT: "CLOCK_OUT" as const,
};

describe("calculateClockState", () => {
  it("イベントなし → NOT_CLOCKED_IN", () => {
    expect(calculateClockState([])).toBe("NOT_CLOCKED_IN");
  });

  it("出勤のみ → WORKING", () => {
    expect(calculateClockState([{ eventType: ClockEventType.CLOCK_IN }])).toBe("WORKING");
  });

  it("出勤→休憩開始 → ON_BREAK", () => {
    expect(
      calculateClockState([
        { eventType: ClockEventType.CLOCK_IN },
        { eventType: ClockEventType.BREAK_START },
      ])
    ).toBe("ON_BREAK");
  });

  it("出勤→休憩開始→休憩終了 → WORKING", () => {
    expect(
      calculateClockState([
        { eventType: ClockEventType.CLOCK_IN },
        { eventType: ClockEventType.BREAK_START },
        { eventType: ClockEventType.BREAK_END },
      ])
    ).toBe("WORKING");
  });

  it("出勤→退勤 → CLOCKED_OUT", () => {
    expect(
      calculateClockState([
        { eventType: ClockEventType.CLOCK_IN },
        { eventType: ClockEventType.CLOCK_OUT },
      ])
    ).toBe("CLOCKED_OUT");
  });

  it("出勤→休憩→退勤 → CLOCKED_OUT", () => {
    expect(
      calculateClockState([
        { eventType: ClockEventType.CLOCK_IN },
        { eventType: ClockEventType.BREAK_START },
        { eventType: ClockEventType.BREAK_END },
        { eventType: ClockEventType.CLOCK_OUT },
      ])
    ).toBe("CLOCKED_OUT");
  });

  it("複数回休憩 → WORKING", () => {
    expect(
      calculateClockState([
        { eventType: ClockEventType.CLOCK_IN },
        { eventType: ClockEventType.BREAK_START },
        { eventType: ClockEventType.BREAK_END },
        { eventType: ClockEventType.BREAK_START },
        { eventType: ClockEventType.BREAK_END },
      ])
    ).toBe("WORKING");
  });
});

describe("getAvailableActions", () => {
  it("NOT_CLOCKED_IN → [CLOCK_IN]", () => {
    expect(getAvailableActions("NOT_CLOCKED_IN")).toEqual(["CLOCK_IN"]);
  });

  it("WORKING → [BREAK_START, CLOCK_OUT]", () => {
    expect(getAvailableActions("WORKING")).toEqual(["BREAK_START", "CLOCK_OUT"]);
  });

  it("ON_BREAK → [BREAK_END, CLOCK_OUT]", () => {
    expect(getAvailableActions("ON_BREAK")).toEqual(["BREAK_END", "CLOCK_OUT"]);
  });

  it("CLOCKED_OUT → []", () => {
    expect(getAvailableActions("CLOCKED_OUT")).toEqual([]);
  });
});

describe("validateClockTransition", () => {
  it("有効な遷移はnullを返す", () => {
    expect(validateClockTransition("NOT_CLOCKED_IN", "CLOCK_IN")).toBeNull();
    expect(validateClockTransition("WORKING", "BREAK_START")).toBeNull();
    expect(validateClockTransition("WORKING", "CLOCK_OUT")).toBeNull();
    expect(validateClockTransition("ON_BREAK", "BREAK_END")).toBeNull();
    expect(validateClockTransition("ON_BREAK", "CLOCK_OUT")).toBeNull();
  });

  it("無効な遷移はエラーメッセージを返す", () => {
    expect(validateClockTransition("NOT_CLOCKED_IN", "BREAK_START")).toBeTruthy();
    expect(validateClockTransition("NOT_CLOCKED_IN", "CLOCK_OUT")).toBeTruthy();
    expect(validateClockTransition("WORKING", "CLOCK_IN")).toBeTruthy();
    expect(validateClockTransition("CLOCKED_OUT", "CLOCK_IN")).toBeTruthy();
    expect(validateClockTransition("CLOCKED_OUT", "BREAK_START")).toBeTruthy();
    expect(validateClockTransition("ON_BREAK", "CLOCK_IN")).toBeTruthy();
  });

  it("すでに出勤済みの場合は日本語エラーを返す", () => {
    const error = validateClockTransition("WORKING", "CLOCK_IN");
    expect(error).toContain("すでに出勤済み");
  });

  it("退勤済みは操作不可エラーを返す", () => {
    const error = validateClockTransition("CLOCKED_OUT", "BREAK_START");
    expect(error).toContain("退勤済み");
  });
});

describe("getClockStateLabel", () => {
  it("各状態の日本語ラベルを返す", () => {
    expect(getClockStateLabel("NOT_CLOCKED_IN")).toBe("未出勤");
    expect(getClockStateLabel("WORKING")).toBe("勤務中");
    expect(getClockStateLabel("ON_BREAK")).toBe("休憩中");
    expect(getClockStateLabel("CLOCKED_OUT")).toBe("退勤済み");
  });
});

describe("getClockActionLabel", () => {
  it("各アクションの日本語ラベルを返す", () => {
    expect(getClockActionLabel("CLOCK_IN")).toBe("出勤");
    expect(getClockActionLabel("BREAK_START")).toBe("休憩開始");
    expect(getClockActionLabel("BREAK_END")).toBe("休憩終了");
    expect(getClockActionLabel("CLOCK_OUT")).toBe("退勤");
  });
});
