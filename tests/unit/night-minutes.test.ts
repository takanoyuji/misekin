import { describe, it, expect } from "vitest";
import {
  calculateNightMinutes,
  calculateWorkMinutes,
} from "@/lib/business/attendance";

/** JST の日時を UTC の Date にする */
function jst(iso: string): Date {
  return new Date(`${iso}+09:00`);
}

describe("calculateNightMinutes", () => {
  it("深夜帯にかからない勤務は0分", () => {
    // 13:00〜19:00
    expect(
      calculateNightMinutes(
        jst("2026-07-10T13:00:00"),
        jst("2026-07-10T19:00:00"),
        []
      )
    ).toBe(0);
  });

  it("22時をまたぐと、22時以降だけが深夜になる", () => {
    // 19:00〜24:00 → 深夜は 22:00〜24:00 の120分
    expect(
      calculateNightMinutes(
        jst("2026-07-10T19:00:00"),
        jst("2026-07-11T00:00:00"),
        []
      )
    ).toBe(120);
  });

  it("日をまたぐ勤務も翌5時までを数える", () => {
    // 20:00〜翌3:00 → 深夜は 22:00〜3:00 の300分
    expect(
      calculateNightMinutes(
        jst("2026-07-10T20:00:00"),
        jst("2026-07-11T03:00:00"),
        []
      )
    ).toBe(300);
  });

  it("翌5時を過ぎた分は深夜に含めない", () => {
    // 23:00〜翌7:00 → 深夜は 23:00〜5:00 の360分（5〜7時は対象外）
    expect(
      calculateNightMinutes(
        jst("2026-07-10T23:00:00"),
        jst("2026-07-11T07:00:00"),
        []
      )
    ).toBe(360);
  });

  it("深夜帯に入った休憩だけを引く", () => {
    // 20:00〜翌2:00（深夜240分）。休憩 23:00〜23:30 は深夜内なので30分引く
    expect(
      calculateNightMinutes(
        jst("2026-07-10T20:00:00"),
        jst("2026-07-11T02:00:00"),
        [{ startAt: jst("2026-07-10T23:00:00"), endAt: jst("2026-07-10T23:30:00") }]
      )
    ).toBe(210);
  });

  it("深夜帯の外の休憩は引かない（合計を丸ごと引かないこと）", () => {
    // 20:00〜翌2:00（深夜240分）。休憩 20:30〜21:30 は深夜の外
    expect(
      calculateNightMinutes(
        jst("2026-07-10T20:00:00"),
        jst("2026-07-11T02:00:00"),
        [{ startAt: jst("2026-07-10T20:30:00"), endAt: jst("2026-07-10T21:30:00") }]
      )
    ).toBe(240);
  });

  it("休憩が深夜帯をまたぐときは、かかった分だけ引く", () => {
    // 20:00〜翌2:00。休憩 21:30〜22:30 のうち深夜は 22:00〜22:30 の30分だけ
    expect(
      calculateNightMinutes(
        jst("2026-07-10T20:00:00"),
        jst("2026-07-11T02:00:00"),
        [{ startAt: jst("2026-07-10T21:30:00"), endAt: jst("2026-07-10T22:30:00") }]
      )
    ).toBe(210);
  });

  it("終了していない休憩は無視する", () => {
    expect(
      calculateNightMinutes(
        jst("2026-07-10T22:00:00"),
        jst("2026-07-11T02:00:00"),
        [{ startAt: jst("2026-07-10T23:00:00"), endAt: null }]
      )
    ).toBe(240);
  });

  it("退勤が出勤以前なら0分", () => {
    expect(
      calculateNightMinutes(
        jst("2026-07-10T22:00:00"),
        jst("2026-07-10T22:00:00"),
        []
      )
    ).toBe(0);
  });

  it("深夜労働時間は実労働時間を超えない", () => {
    const inAt = jst("2026-07-10T22:00:00");
    const outAt = jst("2026-07-11T04:00:00");
    const breaks = [
      { startAt: jst("2026-07-10T23:00:00"), endAt: jst("2026-07-11T00:00:00") },
    ];
    const work = calculateWorkMinutes(inAt, outAt, breaks);
    const night = calculateNightMinutes(inAt, outAt, breaks);
    expect(night).toBeLessThanOrEqual(work);
    expect(night).toBe(300); // 360分の深夜から休憩60分を引く
  });
});
