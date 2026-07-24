import { describe, it, expect } from "vitest";
import {
  getPeriodContaining,
  getNextPeriod,
  getSubmissionPeriods,
  daysInPeriod,
} from "@/lib/business/shift-period";

describe("月次期間（区切り日1）", () => {
  it("月の途中の日はその月の1日〜末日", () => {
    const p = getPeriodContaining("MONTHLY", 1, "2026-03-15");
    expect(p.start).toBe("2026-03-01");
    expect(p.end).toBe("2026-03-31");
    expect(p.label).toBe("2026年3月分");
  });

  it("2月は末日が28日", () => {
    const p = getPeriodContaining("MONTHLY", 1, "2026-02-10");
    expect(p.start).toBe("2026-02-01");
    expect(p.end).toBe("2026-02-28");
  });
});

describe("月次期間（区切り日16）", () => {
  it("16日以降は当月16日〜翌月15日", () => {
    const p = getPeriodContaining("MONTHLY", 16, "2026-03-20");
    expect(p.start).toBe("2026-03-16");
    expect(p.end).toBe("2026-04-15");
  });

  it("15日以前は前月16日〜当月15日", () => {
    const p = getPeriodContaining("MONTHLY", 16, "2026-03-10");
    expect(p.start).toBe("2026-02-16");
    expect(p.end).toBe("2026-03-15");
  });

  it("区切り日ちょうど(16日)は新しい期間の開始", () => {
    const p = getPeriodContaining("MONTHLY", 16, "2026-03-16");
    expect(p.start).toBe("2026-03-16");
  });

  it("年をまたぐ（12月区切り→翌1月）", () => {
    const p = getPeriodContaining("MONTHLY", 16, "2026-01-10");
    expect(p.start).toBe("2025-12-16");
    expect(p.end).toBe("2026-01-15");
  });
});

describe("週次期間", () => {
  it("月曜始まり(startDay=1)", () => {
    // 2026-03-18 は水曜
    const p = getPeriodContaining("WEEKLY", 1, "2026-03-18");
    expect(p.start).toBe("2026-03-16"); // 月曜
    expect(p.end).toBe("2026-03-22"); // 日曜
  });

  it("日曜始まり(startDay=0)", () => {
    const p = getPeriodContaining("WEEKLY", 0, "2026-03-18");
    expect(p.start).toBe("2026-03-15"); // 日曜
    expect(p.end).toBe("2026-03-21");
  });
});

describe("getNextPeriod / getSubmissionPeriods", () => {
  it("次の月次期間", () => {
    const p = getPeriodContaining("MONTHLY", 1, "2026-03-15");
    const next = getNextPeriod("MONTHLY", 1, p);
    expect(next.start).toBe("2026-04-01");
    expect(next.end).toBe("2026-04-30");
  });

  it("当期＋翌期の2つを返す", () => {
    const periods = getSubmissionPeriods("MONTHLY", 1, "2026-03-15", 2);
    expect(periods).toHaveLength(2);
    expect(periods[0].start).toBe("2026-03-01");
    expect(periods[1].start).toBe("2026-04-01");
  });
});

describe("daysInPeriod", () => {
  it("月次期間の日数分を返す", () => {
    const p = getPeriodContaining("MONTHLY", 1, "2026-03-15");
    const days = daysInPeriod(p);
    expect(days).toHaveLength(31);
    expect(days[0]).toBe("2026-03-01");
    expect(days[30]).toBe("2026-03-31");
  });

  it("週次期間は7日", () => {
    const p = getPeriodContaining("WEEKLY", 1, "2026-03-18");
    expect(daysInPeriod(p)).toHaveLength(7);
  });
});
