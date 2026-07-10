"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { executeClosing } from "@/actions/closing";
import { Lock, AlertTriangle } from "lucide-react";

interface Props {
  organizationId: string;
  closingPeriodId: string;
  periodName: string;
  periodStart: string;
  periodEnd: string;
  storeName: string;
}

export function ClosingExecuteButton({
  organizationId,
  closingPeriodId,
  periodName,
  periodStart,
  periodEnd,
  storeName,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleExecute() {
    setError(null);
    startTransition(async () => {
      const result = await executeClosing(organizationId, closingPeriodId);
      if (result.error) {
        setError(result.error);
        setShowConfirm(false);
      } else {
        setShowConfirm(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {!showConfirm ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
        >
          <Lock className="size-4" aria-hidden="true" />
          締め実行
        </button>
      ) : (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 max-w-sm">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle
              className="size-4 shrink-0 text-orange-600 mt-0.5"
              aria-hidden="true"
            />
            <div className="text-sm">
              <p className="font-medium text-orange-800">締め処理の確認</p>
              <p className="mt-1 text-orange-700">
                <strong>「{periodName}」</strong>の締め処理を実行します。
              </p>
              <ul className="mt-2 space-y-0.5 text-orange-700 text-xs">
                <li>期間: {periodStart.replace(/-/g, "/")} 〜 {periodEnd.replace(/-/g, "/")}</li>
                <li>対象: {storeName}</li>
              </ul>
              <p className="mt-2 text-xs font-medium text-orange-800">
                締め後は勤怠の修正ができなくなります。
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExecute}
              disabled={isPending}
              className={cn(
                "inline-flex items-center rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                isPending
                  ? "cursor-not-allowed bg-orange-400 text-white"
                  : "bg-orange-600 text-white hover:bg-orange-700"
              )}
            >
              {isPending ? "実行中..." : "実行する"}
            </button>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={isPending}
              className="inline-flex items-center rounded-md border border-input px-4 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
