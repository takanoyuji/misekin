"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  submitAvailability,
  deleteAvailability,
} from "@/actions/shift-availability";
import { Check, CircleSlash, Loader2, Star } from "lucide-react";

type AvailabilityType = "AVAILABLE" | "UNAVAILABLE" | "PREFERRED";

interface StoreOption {
  id: string;
  name: string;
}
interface DayLabel {
  date: string;
  label: string;
}
interface AvailabilityRow {
  storeId: string;
  businessDate: string;
  type: AvailabilityType;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
}
interface PublishedShift {
  storeId: string;
  businessDate: string;
  startTime: string;
  endTime: string;
}

interface Props {
  stores: StoreOption[];
  days: DayLabel[];
  availabilities: AvailabilityRow[];
  publishedShifts: PublishedShift[];
}

const TYPE_META: Record<
  AvailabilityType,
  { label: string; icon: typeof Check; cls: string; activeCls: string }
> = {
  AVAILABLE: {
    label: "可",
    icon: Check,
    cls: "border-green-300 text-green-700 hover:bg-green-50",
    activeCls: "bg-green-600 border-green-600 text-white",
  },
  PREFERRED: {
    label: "希望",
    icon: Star,
    cls: "border-primary/40 text-primary hover:bg-primary/5",
    activeCls: "bg-primary border-primary text-primary-foreground",
  },
  UNAVAILABLE: {
    label: "不可",
    icon: CircleSlash,
    cls: "border-red-300 text-red-600 hover:bg-red-50",
    activeCls: "bg-red-600 border-red-600 text-white",
  },
};

export function AvailabilityBoard({
  stores,
  days,
  availabilities,
  publishedShifts,
}: Props) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 現在の店舗の希望を date -> type で引けるようにする
  const current = new Map<string, AvailabilityType>();
  for (const a of availabilities) {
    if (a.storeId === storeId) current.set(a.businessDate, a.type);
  }
  const shiftByDate = new Map<string, PublishedShift>();
  for (const s of publishedShifts) {
    if (s.storeId === storeId) shiftByDate.set(s.businessDate, s);
  }

  function choose(date: string, type: AvailabilityType) {
    setError(null);
    setPendingDate(date);
    const alreadySame = current.get(date) === type;

    startTransition(async () => {
      const result = alreadySame
        ? await deleteAvailability(storeId, date)
        : await submitAvailability({
            storeId,
            businessDate: date,
            type,
            startTime: null,
            endTime: null,
            note: null,
          });
      setPendingDate(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* 店舗タブ */}
      {stores.length > 1 && (
        <div
          role="tablist"
          aria-label="店舗を選択"
          className="flex flex-wrap gap-1 border-b border-border"
        >
          {stores.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === storeId}
              onClick={() => setStoreId(s.id)}
              className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-medium transition-colors ${
                s.id === storeId
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        各日で「可 / 希望 / 不可」を選べます。同じものをもう一度押すと取り消します。
        公開されたシフトは右側に表示されます。
      </p>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {days.map(({ date, label }) => {
          const chosen = current.get(date);
          const shift = shiftByDate.get(date);
          const isRowPending = pendingDate === date;
          return (
            <li
              key={date}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
            >
              <span className="w-24 shrink-0 font-numeric text-sm font-medium">
                {label}
              </span>

              <div className="flex gap-2">
                {(
                  ["AVAILABLE", "PREFERRED", "UNAVAILABLE"] as AvailabilityType[]
                ).map((t) => {
                  const meta = TYPE_META[t];
                  const Icon = meta.icon;
                  const active = chosen === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => choose(date, t)}
                      disabled={isRowPending}
                      aria-pressed={active}
                      className={`inline-flex min-h-9 items-center gap-1 rounded-md border px-3 text-xs font-medium transition-colors disabled:opacity-50 ${
                        active ? meta.activeCls : `bg-background ${meta.cls}`
                      }`}
                    >
                      {isRowPending && active ? (
                        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <Icon className="size-3" aria-hidden="true" />
                      )}
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              {shift && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 font-numeric text-xs font-medium text-primary">
                  シフト {shift.startTime}–{shift.endTime}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
