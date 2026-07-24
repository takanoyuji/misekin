"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateShiftPeriodSettings } from "@/actions/store";
import { CalendarRange, Check, Loader2 } from "lucide-react";

interface Props {
  organizationId: string;
  storeId: string;
  initialUnit: "MONTHLY" | "WEEKLY";
  initialStartDay: number;
}

const DOW_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function ShiftPeriodForm({
  organizationId,
  storeId,
  initialUnit,
  initialStartDay,
}: Props) {
  const router = useRouter();
  const [unit, setUnit] = useState<"MONTHLY" | "WEEKLY">(initialUnit);
  const [monthlyDay, setMonthlyDay] = useState(
    initialUnit === "MONTHLY" ? initialStartDay : 1
  );
  const [weeklyDow, setWeeklyDow] = useState(
    initialUnit === "WEEKLY" ? initialStartDay : 1
  );
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const startDay = unit === "MONTHLY" ? monthlyDay : weeklyDow;
    startTransition(async () => {
      const result = await updateShiftPeriodSettings(organizationId, storeId, {
        shiftPeriodUnit: unit,
        shiftPeriodStartDay: startDay,
      });
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: "シフト期間設定を保存しました" });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarRange className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-base font-semibold">シフト希望の提出期間</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        スタッフがまとめて希望を出す区切りです。既定は月次（毎月1日区切り）。
      </p>

      {/* 期間の種類 */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">期間の種類</legend>
        <div className="flex gap-2">
          {(["MONTHLY", "WEEKLY"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              aria-pressed={unit === u}
              className={`min-h-11 rounded-md border px-4 text-sm font-medium transition-colors ${
                unit === u
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-muted"
              }`}
            >
              {u === "MONTHLY" ? "月次" : "週次"}
            </button>
          ))}
        </div>
      </fieldset>

      {/* 区切り日 */}
      {unit === "MONTHLY" ? (
        <div className="space-y-1">
          <label htmlFor="monthly-day" className="block text-sm font-medium">
            区切り日（毎月）
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">毎月</span>
            <input
              id="monthly-day"
              type="number"
              min={1}
              max={28}
              value={monthlyDay}
              onChange={(e) =>
                setMonthlyDay(
                  Math.min(28, Math.max(1, Number(e.target.value) || 1))
                )
              }
              disabled={isPending}
              className="min-h-11 w-20 rounded-md border border-input bg-background px-3 text-center text-sm font-numeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <span className="text-sm text-muted-foreground">日から</span>
          </div>
          <p className="text-xs text-muted-foreground">
            例: 16 にすると「16日〜翌月15日」が1期間になります（1〜28日）。
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <label className="block text-sm font-medium">週の始まり</label>
          <div className="flex flex-wrap gap-1">
            {DOW_LABELS.map((label, dow) => (
              <button
                key={dow}
                type="button"
                onClick={() => setWeeklyDow(dow)}
                aria-pressed={weeklyDow === dow}
                className={`size-11 rounded-md border text-sm font-medium transition-colors ${
                  weeklyDow === dow
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {message && (
        <p
          className={`text-sm ${
            message.type === "success" ? "text-green-600" : "text-destructive"
          }`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Check className="size-4" aria-hidden="true" />
        )}
        保存する
      </button>
    </form>
  );
}
