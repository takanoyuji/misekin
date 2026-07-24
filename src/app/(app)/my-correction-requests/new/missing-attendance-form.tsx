"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMissingAttendanceRequest } from "@/actions/attendance";
import { Loader2, Plus, Send, Trash2 } from "lucide-react";

interface StoreOption {
  id: string;
  name: string;
}

interface Props {
  organizationId: string;
  stores: StoreOption[];
  /** 申請できる最も古い営業日 (YYYY-MM-DD) */
  minDate: string;
  /** 申請できる最も新しい営業日 (YYYY-MM-DD) */
  maxDate: string;
}

/**
 * 打刻の付け忘れを申請するフォーム
 * 勤怠レコードが存在しない日が対象のため、店舗と営業日から指定する
 */
export function MissingAttendanceForm({
  organizationId,
  stores,
  minDate,
  maxDate,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [businessDate, setBusinessDate] = useState("");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [breaks, setBreaks] = useState<{ startAt: string; endAt: string }[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!businessDate) {
      setError("勤務した営業日を選んでください");
      return;
    }
    if (!clockIn || !clockOut) {
      setError("出勤時刻と退勤時刻を入力してください");
      return;
    }

    startTransition(async () => {
      const result = await createMissingAttendanceRequest(organizationId, {
          storeId,
        businessDate,
        requestedClockInAt: new Date(clockIn),
        requestedClockOutAt: new Date(clockOut),
        requestedBreaks: breaks
          .filter((b) => b.startAt)
          .map((b) => ({
            startAt: new Date(b.startAt),
            endAt: b.endAt ? new Date(b.endAt) : null,
          })),
        reason,
        notes: null,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      router.push("/my-correction-requests");
      router.refresh();
    });
  }

  if (stores.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          所属店舗が設定されていません。管理者にお問い合わせください。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        打刻を忘れて記録が残っていない日の申請です。管理者が承認すると、この内容で勤怠が登録されます。
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="store" className="block text-sm font-medium">
            店舗
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <select
            id="store"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            required
            disabled={isPending}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="businessDate" className="block text-sm font-medium">
            営業日
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="businessDate"
            type="date"
            value={businessDate}
            onChange={(e) => setBusinessDate(e.target.value)}
            min={minDate}
            max={maxDate}
            required
            disabled={isPending}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-numeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground">
            深夜勤務は勤務を始めた日の営業日を選んでください
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="clockIn" className="block text-sm font-medium">
            出勤時刻
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="clockIn"
            type="datetime-local"
            value={clockIn}
            onChange={(e) => setClockIn(e.target.value)}
            required
            disabled={isPending}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-numeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="clockOut" className="block text-sm font-medium">
            退勤時刻
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="clockOut"
            type="datetime-local"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
            required
            disabled={isPending}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-numeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground">
            日をまたいだ場合は翌日の日付を指定してください
          </p>
        </div>
      </div>

      {/* 休憩 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">休憩（任意）</span>
          <button
            type="button"
            onClick={() =>
              setBreaks((prev) => [...prev, { startAt: "", endAt: "" }])
            }
            disabled={isPending}
            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Plus className="size-3" aria-hidden="true" />
            休憩を追加
          </button>
        </div>

        {breaks.map((b, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[140px] flex-1 space-y-1">
              <label
                htmlFor={`break-start-${i}`}
                className="block text-xs text-muted-foreground"
              >
                開始
              </label>
              <input
                id={`break-start-${i}`}
                type="datetime-local"
                value={b.startAt}
                onChange={(e) =>
                  setBreaks((prev) =>
                    prev.map((p, pi) =>
                      pi === i ? { ...p, startAt: e.target.value } : p
                    )
                  )
                }
                disabled={isPending}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-numeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              />
            </div>
            <div className="min-w-[140px] flex-1 space-y-1">
              <label
                htmlFor={`break-end-${i}`}
                className="block text-xs text-muted-foreground"
              >
                終了
              </label>
              <input
                id={`break-end-${i}`}
                type="datetime-local"
                value={b.endAt}
                onChange={(e) =>
                  setBreaks((prev) =>
                    prev.map((p, pi) =>
                      pi === i ? { ...p, endAt: e.target.value } : p
                    )
                  )
                }
                disabled={isPending}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm font-numeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                setBreaks((prev) => prev.filter((_, pi) => pi !== i))
              }
              disabled={isPending}
              aria-label={`${i + 1}件目の休憩を削除`}
              className="inline-flex size-11 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <label htmlFor="reason" className="block text-sm font-medium">
          申請理由
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={3}
          maxLength={500}
          placeholder="例: 出勤時に端末が使用中で打刻できませんでした"
          disabled={isPending}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending || !reason.trim()}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60 sm:w-auto"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        申請する
      </button>
    </form>
  );
}
