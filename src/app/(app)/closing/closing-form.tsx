"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClosingPeriod } from "@/actions/closing";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

interface Store {
  id: string;
  name: string;
}

interface Props {
  organizationId: string;
  stores: Store[];
}

export function ClosingForm({ organizationId, stores }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const now = new Date();
  const jstNow = toZonedTime(now, "Asia/Tokyo");
  const currentMonthStart = format(
    new Date(jstNow.getFullYear(), jstNow.getMonth(), 1),
    "yyyy-MM-dd"
  );
  const currentMonthEnd = format(
    new Date(jstNow.getFullYear(), jstNow.getMonth() + 1, 0),
    "yyyy-MM-dd"
  );

  const [name, setName] = useState(
    `${format(jstNow, "yyyy年M月")}締め`
  );
  const [storeId, setStoreId] = useState("");
  const [periodStart, setPeriodStart] = useState(currentMonthStart);
  const [periodEnd, setPeriodEnd] = useState(currentMonthEnd);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await createClosingPeriod(organizationId, {
        name: name.trim(),
        storeId: storeId || null,
        periodStart,
        periodEnd,
      });

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 締め期間名 */}
        <div className="flex flex-col gap-1.5 lg:col-span-2">
          <label htmlFor="closingName" className="text-sm font-medium">
            締め期間名
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="closingName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="例: 2025年1月締め"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* 対象店舗 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="closingStore" className="text-sm font-medium">
            対象店舗
          </label>
          <select
            id="closingStore"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">全店舗</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* 期間 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            対象期間
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
              className="flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="shrink-0 text-muted-foreground">〜</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              required
              className="flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          締め期間を作成しました。「締め実行」ボタンで勤怠をロックしてください。
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            "inline-flex items-center rounded-md px-5 py-2 text-sm font-medium transition-colors",
            isPending
              ? "cursor-not-allowed bg-primary/60 text-primary-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {isPending ? "作成中..." : "締め期間を作成"}
        </button>
      </div>
    </form>
  );
}
