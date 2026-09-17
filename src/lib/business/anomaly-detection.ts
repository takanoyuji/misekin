import { differenceInMinutes, differenceInHours } from "date-fns";
import { haversineMeters } from "./geo";

// 異常判定の閾値（将来的に設定可能にする構造）
const ANOMALY_THRESHOLDS = {
  LONG_SHIFT_HOURS: 12, // 長時間勤務判定（時間）
  MISSING_CLOCK_OUT_HOURS: 24, // 退勤漏れとして確定する時間
} as const;

export type AnomalyReason =
  | "MISSING_CLOCK_OUT"
  | "MISSING_BREAK_END"
  | "CLOCK_OUT_BEFORE_CLOCK_IN"
  | "LONG_SHIFT"
  | "DUPLICATE_CLOCK_IN"
  | "MULTI_STORE_OVERLAP"
  | "MANUAL_CREATION"
  | "INVALID_TRANSITION"
  | "LOCATION_OUT_OF_RANGE"
  | "LOCATION_UNAVAILABLE";

/** 位置に由来する異常。打刻イベントから毎回導出し直すので、他の理由とは分けて扱う */
export const LOCATION_ANOMALY_REASONS: readonly AnomalyReason[] = [
  "LOCATION_OUT_OF_RANGE",
  "LOCATION_UNAVAILABLE",
] as const;

export function isLocationAnomalyReason(reason: string): boolean {
  return (LOCATION_ANOMALY_REASONS as readonly string[]).includes(reason);
}

export interface AnomalyResult {
  hasAnomaly: boolean;
  reasons: AnomalyReason[];
}

/**
 * 勤怠レコードの異常を検出する
 */
export function detectAnomalies(params: {
  clockInAt: Date | null;
  clockOutAt: Date | null;
  breaks: { startAt: Date; endAt: Date | null }[];
  now?: Date;
}): AnomalyResult {
  const reasons: AnomalyReason[] = [];
  const now = params.now ?? new Date();

  const { clockInAt, clockOutAt, breaks } = params;

  // 退勤漏れチェック
  if (clockInAt && !clockOutAt) {
    const hoursElapsed = differenceInHours(now, clockInAt);
    if (hoursElapsed >= ANOMALY_THRESHOLDS.MISSING_CLOCK_OUT_HOURS) {
      reasons.push("MISSING_CLOCK_OUT");
    }
  }

  // 休憩終了漏れチェック
  const openBreak = breaks.find((b) => !b.endAt);
  if (openBreak && clockOutAt) {
    reasons.push("MISSING_BREAK_END");
  }

  // 退勤 < 出勤
  if (clockInAt && clockOutAt && clockOutAt < clockInAt) {
    reasons.push("CLOCK_OUT_BEFORE_CLOCK_IN");
  }

  // 長時間勤務チェック
  if (clockInAt && clockOutAt) {
    const hours = differenceInHours(clockOutAt, clockInAt);
    if (hours >= ANOMALY_THRESHOLDS.LONG_SHIFT_HOURS) {
      reasons.push("LONG_SHIFT");
    }
  } else if (clockInAt && !clockOutAt) {
    const hours = differenceInHours(now, clockInAt);
    if (hours >= ANOMALY_THRESHOLDS.LONG_SHIFT_HOURS) {
      reasons.push("LONG_SHIFT");
    }
  }

  return {
    hasAnomaly: reasons.length > 0,
    reasons,
  };
}

/**
 * 異常理由の日本語ラベルを返す
 */
export function getAnomalyLabel(reason: AnomalyReason): string {
  const labels: Record<AnomalyReason, string> = {
    MISSING_CLOCK_OUT: "退勤漏れ",
    MISSING_BREAK_END: "休憩終了漏れ",
    CLOCK_OUT_BEFORE_CLOCK_IN: "退勤時刻が出勤時刻より前",
    LONG_SHIFT: "長時間勤務",
    DUPLICATE_CLOCK_IN: "重複出勤",
    MULTI_STORE_OVERLAP: "複数店舗同時勤務",
    MANUAL_CREATION: "管理者手動作成",
    INVALID_TRANSITION: "不正な状態遷移",
    LOCATION_OUT_OF_RANGE: "店舗から離れた場所で打刻",
    LOCATION_UNAVAILABLE: "位置情報を取得できなかった打刻",
  };
  return labels[reason] ?? reason;
}

/**
 * 打刻の位置から異常を検出する。
 *
 * 方針（2026-09-09 決定）: **打刻はブロックしない。** 記録してフラグを立て、締めの前に人が見る。
 * ビル内では測位が Wi-Fi / 基地局にフォールバックして誤差が数百m〜数kmになるため、
 * 距離だけで弾くと本人が打刻できなくなり、その分が管理者の手入力に化けて精度がむしろ落ちる。
 *
 * 判定の条件:
 * - 店舗で記録が有効 かつ 店舗座標と判定距離の両方が設定済みのときだけ判定する
 *   （judge しない = null のうちは「記録のみ」。まず実分布を観測してから閾値を決めるため）
 * - 距離から測位誤差を引いてもなお半径を超えるときだけ「範囲外」とする。
 *   誤差が大きい測位は、そもそも範囲外の証拠にならない
 */
export function detectLocationAnomalies(params: {
  events: {
    latitude: number | null;
    longitude: number | null;
    locationAccuracy: number | null;
  }[];
  store: {
    locationTrackingEnabled: boolean;
    latitude: number | null;
    longitude: number | null;
    geofenceRadiusMeters: number | null;
  };
  /** リモート出勤など、店舗にいないことが正常なスタッフは判定から外す */
  skipLocationCheck?: boolean;
}): AnomalyReason[] {
  const { events, store, skipLocationCheck } = params;

  if (skipLocationCheck) return [];
  if (!store.locationTrackingEnabled) return [];
  if (store.latitude == null || store.longitude == null) return [];
  if (store.geofenceRadiusMeters == null) return [];

  const storePoint = { latitude: store.latitude, longitude: store.longitude };
  const reasons = new Set<AnomalyReason>();

  for (const event of events) {
    if (event.latitude == null || event.longitude == null) {
      reasons.add("LOCATION_UNAVAILABLE");
      continue;
    }

    const distance = haversineMeters(storePoint, {
      latitude: event.latitude,
      longitude: event.longitude,
    });
    const accuracy = event.locationAccuracy ?? 0;

    if (distance - accuracy > store.geofenceRadiusMeters) {
      reasons.add("LOCATION_OUT_OF_RANGE");
    }
  }

  return [...reasons];
}

/**
 * 既存の異常理由に、位置の理由を反映し直す。
 *
 * 勤怠を書き換える経路が複数あり（打刻 / 管理者修正 / 修正申請の承認）、
 * detectAnomalies は毎回 reasons を作り直す。素直に上書きすると位置の理由が消えるので、
 * 位置以外を残したうえで位置の理由だけ差し替える。同じ入力で何度通しても結果は変わらない。
 */
export function mergeLocationReasons(
  existingReasons: string[],
  locationReasons: AnomalyReason[]
): AnomalyReason[] {
  const kept = existingReasons.filter((r) => !isLocationAnomalyReason(r));
  return [...new Set([...kept, ...locationReasons])] as AnomalyReason[];
}
