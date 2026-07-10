"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clockAction } from "@/actions/attendance";
import type { ClockState, ClockAction } from "@/lib/business/time-clock";

const actionConfig: Record<
  ClockAction,
  { label: string; className: string; confirmIfState?: ClockState }
> = {
  CLOCK_IN: {
    label: "出勤",
    className:
      "bg-green-500 hover:bg-green-600 active:bg-green-700 text-white",
  },
  BREAK_START: {
    label: "休憩開始",
    className:
      "bg-yellow-400 hover:bg-yellow-500 active:bg-yellow-600 text-white",
  },
  BREAK_END: {
    label: "休憩終了",
    className:
      "bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-white",
  },
  CLOCK_OUT: {
    label: "退勤",
    className: "bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white",
    confirmIfState: "ON_BREAK",
  },
};

interface StatusActionsProps {
  token: string;
  staffId: string;
  pin: string;
  staffName: string;
  currentState: ClockState;
  availableActions: ClockAction[];
}

export function StatusActions({
  token,
  staffId,
  pin,
  staffName,
  currentState,
  availableActions,
}: StatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ClockAction | null>(null);

  const executeAction = (action: ClockAction) => {
    setError(null);
    startTransition(async () => {
      const result = await clockAction({
        token,
        staffId,
        pin,
        action,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      // 完了画面へ遷移
      const clockedAt = result.clockedAt
        ? new Date(result.clockedAt).toISOString()
        : new Date().toISOString();

      router.push(
        `/clock/${token}/complete?action=${action}&staffName=${encodeURIComponent(staffName)}&clockedAt=${encodeURIComponent(clockedAt)}`
      );
    });
  };

  const handleActionClick = (action: ClockAction) => {
    const config = actionConfig[action];
    // 休憩中に退勤を押した場合は確認ダイアログを表示
    if (config.confirmIfState && currentState === config.confirmIfState) {
      setConfirmAction(action);
      return;
    }
    executeAction(action);
  };

  const handleConfirm = () => {
    if (confirmAction) {
      executeAction(confirmAction);
      setConfirmAction(null);
    }
  };

  const handleCancelConfirm = () => {
    setConfirmAction(null);
  };

  if (availableActions.length === 0) {
    return (
      <p className="text-center text-gray-400 text-sm py-4">
        本日の打刻は完了しています
      </p>
    );
  }

  return (
    <>
      {/* エラー */}
      {error && (
        <div
          className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm text-center"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </div>
      )}

      {/* アクションボタン群 */}
      <div className="flex flex-col gap-3">
        {availableActions.map((action) => {
          const config = actionConfig[action];
          return (
            <button
              key={action}
              type="button"
              onClick={() => handleActionClick(action)}
              disabled={isPending}
              className={`w-full py-5 rounded-2xl text-xl font-bold shadow-md transition-all duration-150 active:scale-95 disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-blue-400 ${config.className}`}
              aria-label={config.label}
            >
              {isPending ? "処理中..." : config.label}
            </button>
          );
        })}
      </div>

      {/* 確認ダイアログ（休憩中退勤） */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          aria-describedby="confirm-desc"
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <h2
              id="confirm-title"
              className="text-xl font-bold text-gray-900 mb-3"
            >
              休憩中に退勤しますか？
            </h2>
            <p id="confirm-desc" className="text-gray-600 text-sm mb-6">
              休憩中のまま退勤すると、休憩は自動的に終了します。
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleCancelConfirm}
                className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-gray-400"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="flex-1 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
              >
                {isPending ? "処理中..." : "退勤する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
