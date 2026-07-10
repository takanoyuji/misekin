import { describe, it, expect } from "vitest";
import { detectAnomalies, getAnomalyLabel } from "@/lib/business/anomaly-detection";

describe("detectAnomalies", () => {
  const baseParams = {
    clockInAt: new Date("2024-07-10T09:00:00Z"), // JST 18:00
    clockOutAt: new Date("2024-07-10T14:00:00Z"), // JST 23:00 (5h work)
    breaks: [] as { startAt: Date; endAt: Date | null }[],
    now: new Date("2024-07-10T14:30:00Z"),
  };

  it("正常な勤怠では異常なし", () => {
    const result = detectAnomalies(baseParams);
    expect(result.hasAnomaly).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("退勤打刻がなく24時間以上経過した場合は退勤漏れ検知", () => {
    const clockIn = new Date("2024-07-10T09:00:00Z");
    const now = new Date("2024-07-11T10:00:00Z"); // 25h after clockIn
    const result = detectAnomalies({
      clockInAt: clockIn,
      clockOutAt: null,
      breaks: [],
      now,
    });
    expect(result.hasAnomaly).toBe(true);
    expect(result.reasons).toContain("MISSING_CLOCK_OUT");
  });

  it("24時間未満の退勤漏れは検知されない（退勤漏れ確定前）", () => {
    const clockIn = new Date("2024-07-10T09:00:00Z");
    const now = new Date("2024-07-10T22:00:00Z"); // 13h after clockIn
    const result = detectAnomalies({
      clockInAt: clockIn,
      clockOutAt: null,
      breaks: [],
      now,
    });
    expect(result.reasons).not.toContain("MISSING_CLOCK_OUT");
  });

  it("長時間勤務（12時間以上）を検知する", () => {
    const clockIn = new Date("2024-07-10T08:00:00Z");
    const clockOut = new Date("2024-07-10T21:00:00Z"); // 13h later
    const result = detectAnomalies({
      clockInAt: clockIn,
      clockOutAt: clockOut,
      breaks: [],
    });
    expect(result.hasAnomaly).toBe(true);
    expect(result.reasons).toContain("LONG_SHIFT");
  });

  it("12時間未満の勤務は長時間検知されない", () => {
    const clockIn = new Date("2024-07-10T08:00:00Z");
    const clockOut = new Date("2024-07-10T19:30:00Z"); // 11h30m
    const result = detectAnomalies({
      clockInAt: clockIn,
      clockOutAt: clockOut,
      breaks: [],
    });
    expect(result.reasons).not.toContain("LONG_SHIFT");
  });

  it("ちょうど12時間は長時間検知される", () => {
    const clockIn = new Date("2024-07-10T08:00:00Z");
    const clockOut = new Date("2024-07-10T20:00:00Z"); // 12h exactly
    const result = detectAnomalies({
      clockInAt: clockIn,
      clockOutAt: clockOut,
      breaks: [],
    });
    expect(result.reasons).toContain("LONG_SHIFT");
  });

  it("退勤時刻が出勤時刻より前の場合を検知", () => {
    const result = detectAnomalies({
      ...baseParams,
      clockOutAt: new Date("2024-07-10T08:00:00Z"), // before clockIn
    });
    expect(result.hasAnomaly).toBe(true);
    expect(result.reasons).toContain("CLOCK_OUT_BEFORE_CLOCK_IN");
  });

  it("退勤済みで未終了の休憩がある場合を検知", () => {
    const result = detectAnomalies({
      ...baseParams,
      breaks: [
        {
          startAt: new Date("2024-07-10T11:00:00Z"),
          endAt: null, // 未終了
        },
      ],
    });
    expect(result.hasAnomaly).toBe(true);
    expect(result.reasons).toContain("MISSING_BREAK_END");
  });

  it("退勤前の未終了休憩はMISSING_BREAK_ENDを検知しない", () => {
    // 退勤なし (まだ休憩中) は正常
    const result = detectAnomalies({
      ...baseParams,
      clockOutAt: null,
      breaks: [
        {
          startAt: new Date("2024-07-10T11:00:00Z"),
          endAt: null,
        },
      ],
      now: new Date("2024-07-10T11:30:00Z"),
    });
    expect(result.reasons).not.toContain("MISSING_BREAK_END");
  });
});

describe("getAnomalyLabel", () => {
  it("各異常理由の日本語ラベルを返す", () => {
    expect(getAnomalyLabel("MISSING_CLOCK_OUT")).toBe("退勤漏れ");
    expect(getAnomalyLabel("LONG_SHIFT")).toBe("長時間勤務");
    expect(getAnomalyLabel("CLOCK_OUT_BEFORE_CLOCK_IN")).toBe("退勤時刻が出勤時刻より前");
    expect(getAnomalyLabel("MISSING_BREAK_END")).toBe("休憩終了漏れ");
  });
});
