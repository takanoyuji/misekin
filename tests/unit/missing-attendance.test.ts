import { describe, it, expect } from "vitest";
import {
  calculateBreakMinutes,
  calculateWorkMinutes,
} from "@/lib/business/attendance";
import { missingAttendanceRequestSchema } from "@/lib/validations/attendance";

describe("missingAttendanceRequestSchema", () => {
  const valid = {
    storeId: "clh1234567890abcdefghijk",
    businessDate: "2026-07-15",
    requestedClockInAt: "2026-07-15T20:00",
    requestedClockOutAt: "2026-07-16T03:00",
    reason: "端末が使用中で打刻できませんでした",
  };

  it("日をまたぐ勤務を受け付ける", () => {
    const result = missingAttendanceRequestSchema.safeParse(valid);

    expect(result.success).toBe(true);
  });

  it("営業日の形式が不正なら弾く", () => {
    const result = missingAttendanceRequestSchema.safeParse({
      ...valid,
      businessDate: "2026/07/15",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("YYYY-MM-DD");
  });

  it("申請理由が空なら弾く", () => {
    const result = missingAttendanceRequestSchema.safeParse({
      ...valid,
      reason: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("出勤時刻が無ければ弾く", () => {
    const { requestedClockInAt, ...withoutClockIn } = valid;
    const result = missingAttendanceRequestSchema.safeParse(withoutClockIn);

    expect(result.success).toBe(false);
  });
});

describe("承認時に登録される勤務時間の算出", () => {
  it("日またぎ勤務から休憩を引いた実働を求める", () => {
    // 20:00 出勤 → 翌03:00 退勤、休憩1時間
    const clockIn = new Date("2026-07-15T11:00:00Z"); // JST 20:00
    const clockOut = new Date("2026-07-15T18:00:00Z"); // JST 翌03:00
    const breaks = [
      {
        startAt: new Date("2026-07-15T14:00:00Z"),
        endAt: new Date("2026-07-15T15:00:00Z"),
      },
    ];

    expect(calculateBreakMinutes(breaks)).toBe(60);
    expect(calculateWorkMinutes(clockIn, clockOut, breaks)).toBe(360);
  });

  it("休憩が無ければ総拘束時間がそのまま実働になる", () => {
    const clockIn = new Date("2026-07-15T11:00:00Z");
    const clockOut = new Date("2026-07-15T18:00:00Z");

    expect(calculateWorkMinutes(clockIn, clockOut, [])).toBe(420);
  });

  it("終了していない休憩は差し引かない", () => {
    const breaks = [
      { startAt: new Date("2026-07-15T14:00:00Z"), endAt: null },
    ];

    expect(calculateBreakMinutes(breaks)).toBe(0);
  });
});
