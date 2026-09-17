import { describe, it, expect } from "vitest";
import {
  detectAnomalies,
  detectLocationAnomalies,
  getAnomalyLabel,
  mergeLocationReasons,
} from "@/lib/business/anomaly-detection";

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

describe("detectLocationAnomalies", () => {
  // 池袋の店舗を想定
  const store = {
    locationTrackingEnabled: true,
    latitude: 35.729503,
    longitude: 139.71086,
    geofenceRadiusMeters: 200,
  };

  /** 店舗から北へ おおよそ meters 離れた地点（緯度1度 ≒ 111km） */
  const pointAway = (meters: number) => ({
    latitude: store.latitude + meters / 111000,
    longitude: store.longitude,
    locationAccuracy: null as number | null,
  });

  it("店舗の近くで打刻していれば異常なし", () => {
    const reasons = detectLocationAnomalies({
      events: [pointAway(50)],
      store,
    });
    expect(reasons).toEqual([]);
  });

  it("半径を大きく超えていれば範囲外として検出する", () => {
    const reasons = detectLocationAnomalies({
      events: [pointAway(3000)],
      store,
    });
    expect(reasons).toEqual(["LOCATION_OUT_OF_RANGE"]);
  });

  it("測位誤差が大きいときは範囲外にしない（屋内でのズレを誤検知しないため）", () => {
    const reasons = detectLocationAnomalies({
      events: [{ ...pointAway(800), locationAccuracy: 1500 }],
      store,
    });
    expect(reasons).toEqual([]);
  });

  it("誤差を引いてもなお半径を超えるときは範囲外にする", () => {
    const reasons = detectLocationAnomalies({
      events: [{ ...pointAway(3000), locationAccuracy: 500 }],
      store,
    });
    expect(reasons).toEqual(["LOCATION_OUT_OF_RANGE"]);
  });

  it("位置が取れていない打刻は取得不可として検出する", () => {
    const reasons = detectLocationAnomalies({
      events: [{ latitude: null, longitude: null, locationAccuracy: null }],
      store,
    });
    expect(reasons).toEqual(["LOCATION_UNAVAILABLE"]);
  });

  it("判定距離が未設定なら記録のみで判定しない", () => {
    const reasons = detectLocationAnomalies({
      events: [pointAway(3000)],
      store: { ...store, geofenceRadiusMeters: null },
    });
    expect(reasons).toEqual([]);
  });

  it("店舗座標が未設定なら判定しない", () => {
    const reasons = detectLocationAnomalies({
      events: [pointAway(3000)],
      store: { ...store, latitude: null, longitude: null },
    });
    expect(reasons).toEqual([]);
  });

  it("記録が無効の店舗では判定しない", () => {
    const reasons = detectLocationAnomalies({
      events: [pointAway(3000)],
      store: { ...store, locationTrackingEnabled: false },
    });
    expect(reasons).toEqual([]);
  });

  it("対象外のスタッフ（リモート出勤）は判定しない", () => {
    const reasons = detectLocationAnomalies({
      events: [pointAway(3000)],
      store,
      skipLocationCheck: true,
    });
    expect(reasons).toEqual([]);
  });

  it("同じ理由は打刻が何件あっても1つにまとめる", () => {
    const reasons = detectLocationAnomalies({
      events: [pointAway(3000), pointAway(4000), pointAway(5000)],
      store,
    });
    expect(reasons).toEqual(["LOCATION_OUT_OF_RANGE"]);
  });
});

describe("mergeLocationReasons", () => {
  it("位置以外の理由は残す", () => {
    expect(mergeLocationReasons(["LONG_SHIFT"], [])).toEqual(["LONG_SHIFT"]);
  });

  it("古い位置の理由は消して、新しい判定結果に入れ替える", () => {
    expect(
      mergeLocationReasons(
        ["LONG_SHIFT", "LOCATION_OUT_OF_RANGE"],
        ["LOCATION_UNAVAILABLE"]
      )
    ).toEqual(["LONG_SHIFT", "LOCATION_UNAVAILABLE"]);
  });

  it("判定しなくなったら位置の理由は落ちる", () => {
    expect(
      mergeLocationReasons(["LOCATION_OUT_OF_RANGE"], [])
    ).toEqual([]);
  });

  it("何度通しても結果は変わらない（重複しない）", () => {
    const once = mergeLocationReasons(
      ["LONG_SHIFT"],
      ["LOCATION_OUT_OF_RANGE"]
    );
    const twice = mergeLocationReasons(once, ["LOCATION_OUT_OF_RANGE"]);
    expect(twice).toEqual(once);
  });
});

describe("getAnomalyLabel（位置）", () => {
  it("位置の理由も日本語で返る", () => {
    expect(getAnomalyLabel("LOCATION_OUT_OF_RANGE")).toBe(
      "店舗から離れた場所で打刻"
    );
    expect(getAnomalyLabel("LOCATION_UNAVAILABLE")).toBe(
      "位置情報を取得できなかった打刻"
    );
  });
});
