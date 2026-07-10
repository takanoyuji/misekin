import { describe, it, expect } from "vitest";
import { getBusinessDate } from "@/lib/business/business-day";

describe("getBusinessDate", () => {
  // 基本ケース: 日本時間 2024-07-10 15:00 (UTC+9) → 2024-07-10
  it("日中の打刻は当日の営業日を返す", () => {
    // JST 2024-07-10 15:00 = UTC 2024-07-10 06:00
    const clockedAt = new Date("2024-07-10T06:00:00Z");
    const result = getBusinessDate(clockedAt, "Asia/Tokyo", 6, 0);
    expect(result).toBe("2024-07-10");
  });

  // 深夜ケース: 日本時間 2024-07-11 05:00 (切替前) → 2024-07-10
  it("深夜5時の打刻は前日の営業日を返す (切替時刻6:00)", () => {
    // JST 2024-07-11 05:00 = UTC 2024-07-10 20:00
    const clockedAt = new Date("2024-07-10T20:00:00Z");
    const result = getBusinessDate(clockedAt, "Asia/Tokyo", 6, 0);
    expect(result).toBe("2024-07-10");
  });

  // 切替時刻ちょうど: 日本時間 2024-07-11 06:00 → 2024-07-11
  it("切替時刻ちょうどは当日の営業日を返す", () => {
    // JST 2024-07-11 06:00 = UTC 2024-07-10 21:00
    const clockedAt = new Date("2024-07-10T21:00:00Z");
    const result = getBusinessDate(clockedAt, "Asia/Tokyo", 6, 0);
    expect(result).toBe("2024-07-11");
  });

  // 切替時刻1分前: 日本時間 2024-07-11 05:59 → 2024-07-10
  it("切替時刻1分前は前日の営業日を返す", () => {
    // JST 2024-07-11 05:59 = UTC 2024-07-10 20:59
    const clockedAt = new Date("2024-07-10T20:59:00Z");
    const result = getBusinessDate(clockedAt, "Asia/Tokyo", 6, 0);
    expect(result).toBe("2024-07-10");
  });

  // 深夜営業なし: 切替時刻 00:00
  it("切替時刻0:00の場合は常に当日を返す", () => {
    // JST 2024-07-11 00:01 = UTC 2024-07-10 15:01
    const clockedAt = new Date("2024-07-10T15:01:00Z");
    const result = getBusinessDate(clockedAt, "Asia/Tokyo", 0, 0);
    expect(result).toBe("2024-07-11");
  });

  // 午前0時ちょうど (切替0:00)
  it("切替0:00で午前0時ちょうどは当日を返す", () => {
    // JST 2024-07-11 00:00 = UTC 2024-07-10 15:00
    const clockedAt = new Date("2024-07-10T15:00:00Z");
    const result = getBusinessDate(clockedAt, "Asia/Tokyo", 0, 0);
    expect(result).toBe("2024-07-11");
  });

  // 月末をまたぐケース
  it("月末の深夜打刻は前月最終日の営業日を返す", () => {
    // JST 2024-08-01 03:00 = UTC 2024-07-31 18:00
    const clockedAt = new Date("2024-07-31T18:00:00Z");
    const result = getBusinessDate(clockedAt, "Asia/Tokyo", 6, 0);
    expect(result).toBe("2024-07-31");
  });

  // 韓国時間 (UTC+9, JST同等)
  it("韓国標準時でも正しく動作する", () => {
    // KST 2024-07-11 05:30 = UTC 2024-07-10 20:30
    const clockedAt = new Date("2024-07-10T20:30:00Z");
    const result = getBusinessDate(clockedAt, "Asia/Seoul", 6, 0);
    expect(result).toBe("2024-07-10");
  });

  // 切替時刻に分が設定されている場合
  it("切替時刻に分が設定されている場合も正しく動作する", () => {
    // JST 2024-07-11 06:29 = UTC 2024-07-10 21:29 (切替 06:30 なので前日)
    const clockedAt = new Date("2024-07-10T21:29:00Z");
    const result = getBusinessDate(clockedAt, "Asia/Tokyo", 6, 30);
    expect(result).toBe("2024-07-10");
  });

  it("切替時刻(分)ちょうどは当日を返す", () => {
    // JST 2024-07-11 06:30 = UTC 2024-07-10 21:30 (切替 06:30 なので当日)
    const clockedAt = new Date("2024-07-10T21:30:00Z");
    const result = getBusinessDate(clockedAt, "Asia/Tokyo", 6, 30);
    expect(result).toBe("2024-07-11");
  });
});
