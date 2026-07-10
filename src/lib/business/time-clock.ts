import { ClockEventType, AttendanceStatus } from "@/generated/prisma/client";

export type ClockState =
  | "NOT_CLOCKED_IN" // 未出勤
  | "WORKING" // 勤務中
  | "ON_BREAK" // 休憩中
  | "CLOCKED_OUT"; // 退勤済み

export type ClockAction =
  | "CLOCK_IN"
  | "BREAK_START"
  | "BREAK_END"
  | "CLOCK_OUT";

/**
 * 現在の勤務状態から実行可能なアクションを返す
 */
export function getAvailableActions(state: ClockState): ClockAction[] {
  switch (state) {
    case "NOT_CLOCKED_IN":
      return ["CLOCK_IN"];
    case "WORKING":
      return ["BREAK_START", "CLOCK_OUT"];
    case "ON_BREAK":
      return ["BREAK_END", "CLOCK_OUT"]; // 休憩中退勤は確認ダイアログが必要
    case "CLOCKED_OUT":
      return [];
  }
}

/**
 * 勤務状態遷移バリデーション
 * @returns null = 有効, string = エラーメッセージ
 */
export function validateClockTransition(
  currentState: ClockState,
  action: ClockAction
): string | null {
  const available = getAvailableActions(currentState);
  if (!available.includes(action)) {
    return getTransitionError(currentState, action);
  }
  return null;
}

function getTransitionError(
  state: ClockState,
  action: ClockAction
): string {
  switch (action) {
    case "CLOCK_IN":
      if (state === "WORKING" || state === "ON_BREAK")
        return "すでに出勤済みです";
      if (state === "CLOCKED_OUT") return "すでに退勤済みです";
      return "無効な操作です";
    case "BREAK_START":
      if (state === "NOT_CLOCKED_IN") return "出勤してから休憩開始してください";
      if (state === "ON_BREAK") return "すでに休憩中です";
      if (state === "CLOCKED_OUT") return "退勤済みのため操作できません";
      return "無効な操作です";
    case "BREAK_END":
      if (state === "NOT_CLOCKED_IN" || state === "WORKING")
        return "休憩中ではありません";
      if (state === "CLOCKED_OUT") return "退勤済みのため操作できません";
      return "無効な操作です";
    case "CLOCK_OUT":
      if (state === "NOT_CLOCKED_IN") return "出勤していません";
      if (state === "CLOCKED_OUT") return "すでに退勤済みです";
      return "無効な操作です";
  }
}

/**
 * 打刻イベントから現在の勤務状態を計算する
 */
export function calculateClockState(
  events: { eventType: ClockEventType }[]
): ClockState {
  let state: ClockState = "NOT_CLOCKED_IN";

  for (const event of events) {
    switch (event.eventType) {
      case "CLOCK_IN":
        state = "WORKING";
        break;
      case "BREAK_START":
        state = "ON_BREAK";
        break;
      case "BREAK_END":
        state = "WORKING";
        break;
      case "CLOCK_OUT":
        state = "CLOCKED_OUT";
        break;
    }
  }

  return state;
}

/**
 * 勤務状態の日本語ラベルを返す
 */
export function getClockStateLabel(state: ClockState): string {
  switch (state) {
    case "NOT_CLOCKED_IN":
      return "未出勤";
    case "WORKING":
      return "勤務中";
    case "ON_BREAK":
      return "休憩中";
    case "CLOCKED_OUT":
      return "退勤済み";
  }
}

/**
 * アクションの日本語ラベルを返す
 */
export function getClockActionLabel(action: ClockAction): string {
  switch (action) {
    case "CLOCK_IN":
      return "出勤";
    case "BREAK_START":
      return "休憩開始";
    case "BREAK_END":
      return "休憩終了";
    case "CLOCK_OUT":
      return "退勤";
  }
}
