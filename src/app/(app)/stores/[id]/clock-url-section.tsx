"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStoreClockUrl } from "@/actions/store";
import { Copy, Check, RefreshCw, ExternalLink, Link2Off } from "lucide-react";

interface ClockUrlSectionProps {
  storeId: string;
  storeName: string;
  organizationId: string;
  clockUrlFull: string | null;
  clockUrlToken: string | null;
}

export function ClockUrlSection({
  storeId,
  storeName,
  organizationId,
  clockUrlFull: initialClockUrlFull,
  clockUrlToken: initialToken,
}: ClockUrlSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCopied, setIsCopied] = useState(false);
  const [isReissueConfirming, setIsReissueConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clockUrlFull, setClockUrlFull] = useState(initialClockUrlFull);
  const [token, setToken] = useState(initialToken);

  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  const handleCopy = async () => {
    if (!clockUrlFull) return;
    try {
      await navigator.clipboard.writeText(clockUrlFull);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // フォールバック
    }
  };

  const handleReissue = () => {
    setError(null);
    startTransition(async () => {
      const result = await createStoreClockUrl(organizationId, storeId);
      if (result.error) {
        setError(result.error);
      } else if (result.token) {
        const newUrl = `${appUrl || window.location.origin}/clock/${result.token}`;
        setClockUrlFull(newUrl);
        setToken(result.token);
        setIsReissueConfirming(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold">打刻URL</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          スタッフがスマホやタブレットから打刻するためのURLです
        </p>
      </div>
      <div className="p-6 space-y-4">
        {clockUrlFull && token ? (
          <>
            {/* URL表示 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                打刻URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={clockUrlFull}
                  readOnly
                  className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-xs font-mono text-muted-foreground focus-visible:outline-none"
                  aria-label="打刻URL"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="URLをコピー"
                >
                  {isCopied ? (
                    <>
                      <Check className="size-3.5 text-green-500" aria-hidden="true" />
                      <span className="text-green-600">コピー済み</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" aria-hidden="true" />
                      <span>コピー</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 打刻URLを開くボタン */}
            <a
              href={`/clock/${token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              打刻画面を開く
            </a>

            {/* 再発行ボタン */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-3">
                URLを再発行すると、現在のURLは無効になります。
              </p>
              <button
                type="button"
                onClick={() => setIsReissueConfirming(true)}
                className="inline-flex items-center gap-2 text-xs text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive rounded"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                URLを再発行する
              </button>
            </div>
          </>
        ) : (
          /* URLがない場合 */
          <div className="flex flex-col items-center py-6 text-center gap-3">
            <Link2Off
              className="size-10 text-muted-foreground/30"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              打刻URLが発行されていません
            </p>
            <button
              type="button"
              onClick={handleReissue}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {isPending ? "発行中..." : "URLを発行する"}
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* 再発行確認ダイアログ */}
      {isReissueConfirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reissue-title"
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <h2
              id="reissue-title"
              className="text-lg font-bold text-gray-900 mb-2"
            >
              打刻URLを再発行しますか？
            </h2>
            <p className="text-gray-600 text-sm mb-2">
              <strong>{storeName}</strong> の打刻URLを再発行します。
            </p>
            <p className="text-red-500 text-xs mb-5">
              現在のURLは即時無効になります。QRコードを印刷している場合は貼り替えが必要です。
            </p>
            {error && (
              <p className="text-red-500 text-sm mb-3" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsReissueConfirming(false);
                  setError(null);
                }}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleReissue}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-60"
              >
                {isPending ? "発行中..." : "再発行する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
