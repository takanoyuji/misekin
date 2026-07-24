"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveTransportationChangeRequest,
  rejectTransportationChangeRequest,
} from "@/actions/transportation-request";
import { Check, Loader2, X } from "lucide-react";

interface TransportationReviewActionsProps {
  organizationId: string;
  requestId: string;
}

export function TransportationReviewActions({
  organizationId,
  requestId,
}: TransportationReviewActionsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveTransportationChangeRequest(
        organizationId,
        requestId,
        notes.trim() || undefined
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleReject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await rejectTransportationChangeRequest(
        organizationId,
        requestId,
        notes
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleApprove}
            disabled={isPending}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 sm:flex-none"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            承認する
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("reject");
              setError(null);
            }}
            disabled={isPending}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-destructive/40 px-4 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50 sm:flex-none"
          >
            <X className="size-4" aria-hidden="true" />
            却下する
          </button>
        </div>
      ) : (
        <form onSubmit={handleReject} className="space-y-3">
          <div className="space-y-1">
            <label
              htmlFor={`notes-${requestId}`}
              className="block text-sm font-medium"
            >
              却下理由
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <textarea
              id={`notes-${requestId}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              required
              rows={3}
              maxLength={500}
              disabled={isPending}
              placeholder="申請者に通知されます"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isPending || !notes.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md bg-destructive px-4 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              却下を確定する
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("idle");
                setNotes("");
                setError(null);
              }}
              disabled={isPending}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              戻る
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
