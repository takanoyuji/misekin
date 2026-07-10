"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStaffStatus } from "@/actions/staff";

interface StaffStatusActionsProps {
  staffId: string;
  staffName: string;
  currentStatus: string;
  organizationId: string;
}

export function StaffStatusActions({
  staffId,
  staffName,
  currentStatus,
  organizationId,
}: StaffStatusActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [resignDate, setResignDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const handleStatusChange = (
    status: "ACTIVE" | "ON_LEAVE" | "RESIGNED" | "SUSPENDED",
    date?: Date
  ) => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await updateStaffStatus(
        organizationId,
        staffId,
        status,
        date
      );
      if (result.error) {
        setError(result.error);
      } else {
        const labels: Record<string, string> = {
          ACTIVE: "在籍に変更しました",
          ON_LEAVE: "休職中に変更しました",
          RESIGNED: "退職処理を完了しました",
          SUSPENDED: "停止中に変更しました",
        };
        setSuccess(labels[status] ?? "状態を変更しました");
        setConfirmResign(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">状態を変更する</p>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-green-600" role="status">
          {success}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {currentStatus !== "ACTIVE" && (
          <button
            type="button"
            onClick={() => handleStatusChange("ACTIVE")}
            disabled={isPending}
            className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors disabled:opacity-60"
          >
            在籍に変更
          </button>
        )}
        {currentStatus !== "ON_LEAVE" && currentStatus !== "RESIGNED" && (
          <button
            type="button"
            onClick={() => handleStatusChange("ON_LEAVE")}
            disabled={isPending}
            className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-60"
          >
            休職中に変更
          </button>
        )}
        {currentStatus !== "SUSPENDED" && currentStatus !== "RESIGNED" && (
          <button
            type="button"
            onClick={() => handleStatusChange("SUSPENDED")}
            disabled={isPending}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-60"
          >
            停止中に変更
          </button>
        )}
        {currentStatus !== "RESIGNED" && (
          <button
            type="button"
            onClick={() => setConfirmResign(true)}
            className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            退職処理
          </button>
        )}
      </div>

      {/* 退職確認ダイアログ */}
      {confirmResign && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resign-dialog-title"
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <h2
              id="resign-dialog-title"
              className="text-lg font-bold text-gray-900 mb-2"
            >
              退職処理を行いますか？
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              <strong>{staffName}</strong> の退職処理を行います。
            </p>
            <div className="space-y-3 mb-5">
              <label
                htmlFor="resign-date"
                className="block text-sm font-medium text-gray-700"
              >
                退職日
              </label>
              <input
                id="resign-date"
                type="date"
                value={resignDate}
                onChange={(e) => setResignDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm mb-3" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmResign(false);
                  setError(null);
                }}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() =>
                  handleStatusChange(
                    "RESIGNED",
                    resignDate ? new Date(resignDate) : undefined
                  )
                }
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-800 text-white text-sm font-bold transition-colors disabled:opacity-60"
              >
                {isPending ? "処理中..." : "退職処理する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
