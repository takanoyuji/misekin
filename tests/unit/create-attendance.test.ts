import { describe, it, expect } from "vitest";
import { createAttendanceSchema } from "@/lib/validations/attendance";
import { getBusinessDate } from "@/lib/business/business-day";

describe("createAttendanceSchema（管理者の勤怠手入力）", () => {
  const valid = {
    storeId: "clh1234567890abcdefghijk",
    staffId: "clh1234567890abcdefghijl",
    clockInAt: "2026-09-15T20:00",
    clockOutAt: "2026-09-16T03:00",
    reason: "本人から打刻忘れの連絡",
  };

  it("日をまたぐ勤務を受け付ける", () => {
    expect(createAttendanceSchema.safeParse(valid).success).toBe(true);
  });

  it("出勤・退勤とも必須（片方だけの勤怠は作らせない）", () => {
    expect(createAttendanceSchema.safeParse({ ...valid, clockOutAt: undefined }).success).toBe(false);
    expect(createAttendanceSchema.safeParse({ ...valid, clockInAt: undefined }).success).toBe(false);
  });

  it("退勤が出勤より前なら弾く", () => {
    const r = createAttendanceSchema.safeParse({ ...valid, clockOutAt: "2026-09-15T19:00" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain("退勤時刻は出勤時刻より後");
  });

  it("休憩が出勤〜退勤の外にあれば弾く", () => {
    const r = createAttendanceSchema.safeParse({
      ...valid,
      breaks: [{ startAt: "2026-09-15T19:30", endAt: "2026-09-15T20:30" }],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain("休憩は出勤〜退勤の間");
  });

  it("理由は必須", () => {
    const r = createAttendanceSchema.safeParse({ ...valid, reason: "  " });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toContain("登録理由");
  });
});

describe("手入力の営業日は出勤時刻と店舗の日付切替で決まる（打刻と同じ規則）", () => {
  it("切替 06:00 の店で 深夜2時の出勤は前日の営業日", () => {
    // 2026-09-16 02:00 JST = 2026-09-15T17:00Z
    expect(getBusinessDate(new Date("2026-09-15T17:00:00Z"), "Asia/Tokyo", 6)).toBe("2026-09-15");
    // 2026-09-16 18:00 JST
    expect(getBusinessDate(new Date("2026-09-16T09:00:00Z"), "Asia/Tokyo", 6)).toBe("2026-09-16");
  });
});
