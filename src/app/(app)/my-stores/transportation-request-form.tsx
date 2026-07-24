"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createTransportationChangeRequest,
  cancelTransportationChangeRequest,
} from "@/actions/transportation-request";
import { Loader2, Send } from "lucide-react";

type TransportationType = "PER_SHIFT" | "MONTHLY" | "NONE";

const TYPE_LABELS: Record<TransportationType, string> = {
  PER_SHIFT: "出勤ごと",
  MONTHLY: "月額",
  NONE: "支給なし",
};

interface PendingRequest {
  id: string;
  requestedType: TransportationType;
  requestedAmount: number;
  createdAt: string;
}

interface TransportationRequestFormProps {
  staffStoreId: string;
  currentType: TransportationType | null;
  currentAmount: number | null;
  pendingRequest: PendingRequest | null;
}

export function TransportationRequestForm({
  staffStoreId,
  currentType,
  currentAmount,
  pendingRequest,
}: TransportationRequestFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<TransportationType>(currentType ?? "NONE");
  const [amount, setAmount] = useState(String(currentAmount ?? 0));
  const [limit, setLimit] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    startTransition(async () => {
      const result = await createTransportationChangeRequest({
        staffStoreId,
        requestedType: type,
        requestedAmount: Number(amount) || 0,
        requestedLimit: limit ? Number(limit) : null,
        reason,
      });

      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }

      setIsOpen(false);
      setReason("");
      setMessage({
        type: "success",
        text: "変更を申請しました。管理者の承認をお待ちください",
      });
      router.refresh();
    });
  }

  function handleCancel(requestId: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await cancelTransportationChangeRequest(requestId);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: "申請を取り下げました" });
      router.refresh();
    });
  }

  // 申請中は新しい申請を出せない
  if (pendingRequest) {
    return (
      <div className="space-y-2 border-t border-border pt-3">
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <p className="font-medium">交通費の変更を申請中です</p>
          <p className="mt-1 font-numeric">
            {TYPE_LABELS[pendingRequest.requestedType]} ・ ¥
            {pendingRequest.requestedAmount.toLocaleString()}
          </p>
          <p className="mt-0.5 text-blue-700">管理者の承認をお待ちください</p>
        </div>
        <button
          type="button"
          onClick={() => handleCancel(pendingRequest.id)}
          disabled={isPending}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          {isPending && (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          )}
          申請を取り下げる
        </button>
        {message && (
          <p
            className={`text-xs ${message.type === "success" ? "text-green-600" : "text-destructive"}`}
            role={message.type === "error" ? "alert" : "status"}
          >
            {message.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 border-t border-border pt-3">
      {!isOpen ? (
        <>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted"
          >
            交通費の変更を申請する
          </button>
          {message && (
            <p
              className={`text-xs ${message.type === "success" ? "text-green-600" : "text-destructive"}`}
              role={message.type === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          )}
        </>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <p className="text-xs text-muted-foreground">
            申請内容は管理者が承認するまで反映されません。
          </p>

          <div className="space-y-1">
            <label
              htmlFor={`type-${staffStoreId}`}
              className="block text-xs font-medium"
            >
              支給方法
            </label>
            <select
              id={`type-${staffStoreId}`}
              value={type}
              onChange={(e) => setType(e.target.value as TransportationType)}
              disabled={isPending}
              className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="NONE">支給なし</option>
              <option value="PER_SHIFT">出勤ごと</option>
              <option value="MONTHLY">月額</option>
            </select>
          </div>

          {type !== "NONE" && (
            <div className="space-y-1">
              <label
                htmlFor={`amount-${staffStoreId}`}
                className="block text-xs font-medium"
              >
                金額（円）
              </label>
              <input
                id={`amount-${staffStoreId}`}
                type="number"
                inputMode="numeric"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isPending}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-numeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              />
            </div>
          )}

          {type === "MONTHLY" && (
            <div className="space-y-1">
              <label
                htmlFor={`limit-${staffStoreId}`}
                className="block text-xs font-medium"
              >
                月額上限（円・任意）
              </label>
              <input
                id={`limit-${staffStoreId}`}
                type="number"
                inputMode="numeric"
                min={0}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                disabled={isPending}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-numeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              />
            </div>
          )}

          <div className="space-y-1">
            <label
              htmlFor={`reason-${staffStoreId}`}
              className="block text-xs font-medium"
            >
              申請理由
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <textarea
              id={`reason-${staffStoreId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              rows={3}
              maxLength={500}
              placeholder="例: 引っ越しにより通勤経路が変わったため"
              disabled={isPending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
          </div>

          {message?.type === "error" && (
            <p className="text-xs text-destructive" role="alert">
              {message.text}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending || !reason.trim()}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="size-3" aria-hidden="true" />
              )}
              申請する
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setMessage(null);
              }}
              disabled={isPending}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
