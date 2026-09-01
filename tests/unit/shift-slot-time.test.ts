import { describe, it, expect } from "vitest";
import { slotTimes } from "@/lib/business/shift-slot-time";
import { createSlotSchema } from "@/lib/validations/shift-slot";

const TZ = "Asia/Tokyo";

describe("時間帯からシフトの時刻を作る", () => {
  it("JSTの時刻としてUTCに直す（サーバーのTZに引きずられない）", () => {
    const { start, end } = slotTimes("2026-09-01", "19:00", "23:00", TZ);
    // 19:00 JST = 10:00 UTC
    expect(start.toISOString()).toBe("2026-09-01T10:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-01T14:00:00.000Z");
  });

  it("終了が開始以下なら翌日にまたぐ", () => {
    const { start, end } = slotTimes("2026-09-01", "21:00", "05:00", TZ);
    expect(start.toISOString()).toBe("2026-09-01T12:00:00.000Z");
    // 翌日 05:00 JST = 当日 20:00 UTC
    expect(end.toISOString()).toBe("2026-09-01T20:00:00.000Z");
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it("00:00 終わりも翌日として扱う", () => {
    const { start, end } = slotTimes("2026-09-01", "19:00", "00:00", TZ);
    expect(start.toISOString()).toBe("2026-09-01T10:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-01T15:00:00.000Z");
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(5);
  });

  it("月をまたぐ日跨ぎでも翌日の日付になる", () => {
    const { end } = slotTimes("2026-08-31", "22:00", "05:00", TZ);
    expect(end.toISOString()).toBe("2026-08-31T20:00:00.000Z");
  });

  it("店舗のタイムゾーンが違えば結果も変わる", () => {
    const jst = slotTimes("2026-09-01", "19:00", "23:00", TZ);
    const utc = slotTimes("2026-09-01", "19:00", "23:00", "UTC");
    expect(jst.start.toISOString()).not.toBe(utc.start.toISOString());
    expect(utc.start.toISOString()).toBe("2026-09-01T19:00:00.000Z");
  });
});

describe("時間帯の入力検証", () => {
  const base = {
    storeId: "cmrh9xt7x00020aqldpdoa2iq",
    name: "遅番",
    sortOrder: 0,
  };

  it("24:00 は弾く（00:00 と書く）", () => {
    const r = createSlotSchema.safeParse({
      ...base,
      startTime: "18:00",
      endTime: "24:00",
    });
    expect(r.success).toBe(false);
  });

  it("時・分の範囲外は弾く", () => {
    for (const t of ["99:99", "25:00", "12:60", "1:00", "0900"]) {
      const r = createSlotSchema.safeParse({
        ...base,
        startTime: t,
        endTime: "23:00",
      });
      expect(r.success, `${t} が通ってしまった`).toBe(false);
    }
  });

  it("正しい時刻は通る", () => {
    const r = createSlotSchema.safeParse({
      ...base,
      startTime: "00:00",
      endTime: "23:59",
    });
    expect(r.success).toBe(true);
  });
});
