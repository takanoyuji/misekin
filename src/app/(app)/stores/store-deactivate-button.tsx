"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deactivateStore } from "@/actions/store";

interface StoreDeactivateButtonProps {
  storeId: string;
  storeName: string;
  organizationId: string;
}

export function StoreDeactivateButton({
  storeId,
  storeName,
  organizationId,
}: StoreDeactivateButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeactivate = () => {
    setError(null);
    startTransition(async () => {
      const result = await deactivateStore(organizationId, storeId);
      if (result.error) {
        setError(result.error);
      } else {
        setIsConfirming(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="text-xs text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive rounded"
      >
        無効化
      </button>

      {isConfirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deactivate-store-title"
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <h2
              id="deactivate-store-title"
              className="text-lg font-bold text-gray-900 mb-2"
            >
              店舗を無効化しますか？
            </h2>
            <p className="text-gray-600 text-sm mb-2">
              <strong>{storeName}</strong> を無効化します。
            </p>
            <p className="text-gray-500 text-xs mb-5">
              無効化すると、打刻URLも無効になります。スタッフデータは保持されます。
            </p>
            {error && (
              <p className="text-red-500 text-sm mb-4" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsConfirming(false);
                  setError(null);
                }}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-60"
              >
                {isPending ? "処理中..." : "無効化する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
