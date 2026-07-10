"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { reviewCorrectionRequest } from "@/actions/attendance";
import { CheckCircle, XCircle } from "lucide-react";

interface Props {
  requestId: string;
  organizationId: string;
}

export function CorrectionRequestReviewForm({ requestId, organizationId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!action) return;

    if (action === "REJECT" && !reviewNotes.trim()) {
      setError("却下理由を入力してください");
      return;
    }

    startTransition(async () => {
      const result = await reviewCorrectionRequest(organizationId, {
        requestId,
        action,
        reviewNotes: reviewNotes.trim() || null,
      });

      if (result.error) {
        setError(result.error);
      } else {
        router.push("/correction-requests");
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold">申請の審査</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* アクション選択 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setAction("APPROVE")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all",
              action === "APPROVE"
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-border hover:border-green-300 hover:bg-green-50/50"
            )}
          >
            <CheckCircle className="size-4" aria-hidden="true" />
            承認する
          </button>
          <button
            type="button"
            onClick={() => setAction("REJECT")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all",
              action === "REJECT"
                ? "border-red-500 bg-red-50 text-red-700"
                : "border-border hover:border-red-300 hover:bg-red-50/50"
            )}
          >
            <XCircle className="size-4" aria-hidden="true" />
            却下する
          </button>
        </div>

        {/* コメント欄（却下時は必須） */}
        {action && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reviewNotes" className="text-sm font-medium">
              {action === "REJECT" ? (
                <>
                  却下理由
                  <span className="ml-1 text-destructive" aria-hidden="true">
                    *
                  </span>
                </>
              ) : (
                <>
                  コメント
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    （任意）
                  </span>
                </>
              )}
            </label>
            <textarea
              id="reviewNotes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              placeholder={
                action === "REJECT"
                  ? "却下理由を入力してください（必須）"
                  : "スタッフへのコメントを入力できます（任意）"
              }
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
        )}

        {/* エラー表示 */}
        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        {/* 送信ボタン */}
        {action && (
          <button
            type="submit"
            disabled={isPending || !action}
            className={cn(
              "w-full rounded-md py-2.5 text-sm font-medium transition-colors",
              isPending
                ? "cursor-not-allowed opacity-60"
                : action === "APPROVE"
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-red-600 text-white hover:bg-red-700"
            )}
          >
            {isPending
              ? "処理中..."
              : action === "APPROVE"
                ? "承認を確定する"
                : "却下を確定する"}
          </button>
        )}
      </form>
    </section>
  );
}
