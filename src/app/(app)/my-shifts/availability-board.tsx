"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  submitAvailability,
  deleteAvailability,
} from "@/actions/shift-availability";
import { Check, CircleSlash, Loader2, Star } from "lucide-react";

type AvailabilityType = "AVAILABLE" | "UNAVAILABLE" | "PREFERRED";

interface DayLabel {
  date: string;
  label: string;
}
interface PeriodLabel {
  label: string;
  start: string;
  end: string;
}
interface SlotDef {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}
interface StoreOption {
  id: string;
  name: string;
  days: DayLabel[];
  periods: PeriodLabel[];
  slots: SlotDef[];
}
interface AvailabilityRow {
  storeId: string;
  slotId: string;
  businessDate: string;
  type: AvailabilityType;
  note: string | null;
}
interface PublishedShift {
  storeId: string;
  slotId: string | null;
  businessDate: string;
  startTime: string;
  endTime: string;
}

interface Props {
  stores: StoreOption[];
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
  availabilities,
  publishedShifts,
}: Props) {
  const router = useRouter();
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  // 送信中セル: `${date}_${slotId}`
  const [pending, setPending] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const activeStore = stores.find((s) => s.id === storeId) ?? stores[0];
  const days = activeStore?.days ?? [];
  const periods = activeStore?.periods ?? [];
  const slots = activeStore?.slots ?? [];

  // 希望を (date_slotId) -> type で引く
  const current = new Map<string, AvailabilityType>();
  for (const a of availabilities) {
    if (a.storeId === storeId)
      current.set(`${a.businessDate}_${a.slotId}`, a.type);
  }
  // 公開シフトを (date_slotId) -> 時刻 で引く
  const shiftAt = new Map<string, PublishedShift>();
  for (const s of publishedShifts) {
    if (s.storeId === storeId && s.slotId)
      shiftAt.set(`${s.businessDate}_${s.slotId}`, s);
  }

  const groups = periods
    .map((p) => ({
      period: p,
      days: days.filter((d) => d.date >= p.start && d.date <= p.end),
    }))
    .filter((g) => g.days.length > 0);

  function choose(date: string, slotId: string, type: AvailabilityType) {
    setError(null);
    const key = `${date}_${slotId}`;
    setPending(key);
    const alreadySame = current.get(key) === type;

    startTransition(async () => {
      const result = alreadySame
        ? await deleteAvailability(storeId, date, slotId)
        : await submitAvailability({
            storeId,
            slotId,
            businessDate: date,
            type,
            note: null,
          });
      setPending(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
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
        時間帯ごとに「希望 / 可 / 不可」を選べます。同じものをもう一度押すと取り消します。
      </p>

      {slots.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          この店舗に時間帯が設定されていません。管理者にお問い合わせください。
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          提出できる期間がありません。
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.period.start}>
              <h2 className="mb-2 text-sm font-semibold">{g.period.label}</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                {g.days.map(({ date, label }) => (
                  <li key={date} className="px-4 py-3">
                    <div className="mb-2 font-numeric text-sm font-medium">
                      {label}
                    </div>
                    <div className="space-y-2">
                      {slots.map((slot) => {
                        const key = `${date}_${slot.id}`;
                        const chosen = current.get(key);
                        const shift = shiftAt.get(key);
                        const isCellPending = pending === key;
                        return (
                          <div
                            key={slot.id}
                            className="flex flex-wrap items-center gap-x-3 gap-y-1"
                          >
                            <span className="w-28 shrink-0 text-xs text-muted-foreground">
                              {slot.name}（{slot.startTime}–{slot.endTime}）
                            </span>
                            <div className="flex gap-1.5">
                              {(
                                [
                                  "PREFERRED",
                                  "AVAILABLE",
                                  "UNAVAILABLE",
                                ] as AvailabilityType[]
                              ).map((t) => {
                                const meta = TYPE_META[t];
                                const Icon = meta.icon;
                                const active = chosen === t;
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => choose(date, slot.id, t)}
                                    disabled={isCellPending}
                                    aria-pressed={active}
                                    className={`inline-flex min-h-9 items-center gap-1 rounded-md border px-3 text-xs font-medium transition-colors disabled:opacity-50 ${
                                      active
                                        ? meta.activeCls
                                        : `bg-background ${meta.cls}`
                                    }`}
                                  >
                                    {isCellPending && active ? (
                                      <Loader2
                                        className="size-3 animate-spin"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <Icon
                                        className="size-3"
                                        aria-hidden="true"
                                      />
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
                          </div>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
