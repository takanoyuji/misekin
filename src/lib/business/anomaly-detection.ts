import { differenceInMinutes, differenceInHours } from "date-fns";

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
  | "INVALID_TRANSITION";

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
  };
  return labels[reason] ?? reason;
}
