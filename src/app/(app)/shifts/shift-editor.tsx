"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createShift,
  deleteShift,
  publishShifts,
  setRequirement,
  generateShifts,
} from "@/actions/shift";
import { Loader2, Plus, Send, Sparkles, Trash2, X } from "lucide-react";

type ShiftStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
type AvailabilityType = "AVAILABLE" | "UNAVAILABLE" | "PREFERRED";

interface DayLabel {
  date: string;
  label: string;
}
interface StaffOption {
  id: string;
  displayName: string;
}
interface SlotDef {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}
interface ShiftCell {
  id: string;
  staffId: string;
  slotId: string | null;
  businessDate: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  note: string | null;
}
interface Requirement {
  slotId: string;
  businessDate: string;
  requiredCount: number;
}
interface Availability {
  staffId: string;
  slotId: string;
  businessDate: string;
  type: AvailabilityType;
}

interface Props {
  organizationId: string;
  storeId: string;
  days: DayLabel[];
  staff: StaffOption[];
  slots: SlotDef[];
  requirements: Requirement[];
  shifts: ShiftCell[];
  availabilities: Availability[];
  weekStart: string;
  weekEnd: string;
}

const AVAIL_BG: Record<AvailabilityType, string> = {
  AVAILABLE: "bg-green-50",
  PREFERRED: "bg-primary/5",
  UNAVAILABLE: "bg-red-50",
};

export function ShiftEditor({
  organizationId,
  storeId,
  days,
  staff,
  slots,
  requirements,
  shifts,
  availabilities,
  weekStart,
  weekEnd,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 表示中の時間帯
  const [activeSlotId, setActiveSlotId] = useState(slots[0]?.id ?? "");
  const activeSlot = slots.find((s) => s.id === activeSlotId) ?? slots[0];

  // 自動生成ダイアログ
  const [genOpen, setGenOpen] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [isGenerating, startGenerate] = useTransition();

  // 選択中スロットのみに絞ったマップ
  const shiftAt = new Map<string, ShiftCell>();
  for (const s of shifts)
    if (s.slotId === activeSlotId)
      shiftAt.set(`${s.staffId}_${s.businessDate}`, s);

  const availAt = new Map<string, AvailabilityType>();
  for (const a of availabilities)
    if (a.slotId === activeSlotId)
      availAt.set(`${a.staffId}_${a.businessDate}`, a.type);

  const reqByDate = new Map<string, number>();
  for (const r of requirements)
    if (r.slotId === activeSlotId) reqByDate.set(r.businessDate, r.requiredCount);

  const assignedByDate = new Map<string, number>();
  for (const s of shifts)
    if (s.slotId === activeSlotId)
      assignedByDate.set(
        s.businessDate,
        (assignedByDate.get(s.businessDate) ?? 0) + 1
      );

  function addShift(staffId: string, date: string) {
    setError(null);
    startTransition(async () => {
      const result = await createShift(organizationId, {
        storeId,
        slotId: activeSlotId,
        staffId,
        businessDate: date,
        note: null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function removeShift(shiftId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteShift(organizationId, shiftId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function publish() {
    setError(null);
    startTransition(async () => {
      const result = await publishShifts(
        organizationId,
        storeId,
        weekStart,
        weekEnd
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function changeRequirement(date: string, value: string) {
    const n = Math.max(0, Math.min(999, Number(value) || 0));
    startTransition(async () => {
      await setRequirement(organizationId, {
        storeId,
        slotId: activeSlotId,
        businessDate: date,
        requiredCount: n,
        note: null,
      });
      router.refresh();
    });
  }

  function handleGenerate() {
    setError(null);
    setGenMessage(null);
    startGenerate(async () => {
      const result = await generateShifts(
        organizationId,
        storeId,
        weekStart,
        weekEnd
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      setGenOpen(false);
      setGenMessage(result.message ?? "自動生成しました");
      router.refresh();
    });
  }

  const hasDraft = shifts.some((s) => s.status === "DRAFT");

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {genMessage && (
        <p className="text-sm text-green-600" role="status">
          {genMessage}
        </p>
      )}

      {/* 時間帯タブ */}
      <div
        role="tablist"
        aria-label="時間帯を選択"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {slots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            role="tab"
            aria-selected={slot.id === activeSlotId}
            onClick={() => setActiveSlotId(slot.id)}
            className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-medium transition-colors ${
              slot.id === activeSlotId
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {slot.name}
            <span className="ml-1 font-numeric text-xs text-muted-foreground">
              {slot.startTime}–{slot.endTime}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          背景色は希望（
          <span className="rounded bg-primary/5 px-1">青=希望</span>{" "}
          <span className="rounded bg-green-50 px-1">緑=可</span>{" "}
          <span className="rounded bg-red-50 px-1">赤=不可</span>
          ）。空きセルの＋で「{activeSlot?.name}」に追加します。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setGenMessage(null);
              setGenOpen(true);
            }}
            disabled={isPending || isGenerating}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-primary/40 bg-background px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:pointer-events-none disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            自動生成
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={isPending || !hasDraft}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            この週を公開
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium text-muted-foreground">
                スタッフ
              </th>
              {days.map((d) => (
                <th
                  key={d.date}
                  className="px-2 py-2 text-center font-medium text-muted-foreground"
                >
                  <div className="font-numeric">{d.label}</div>
                </th>
              ))}
            </tr>
            {/* 必要人数の行（選択中の時間帯） */}
            <tr className="border-b border-border bg-background text-xs">
              <th className="sticky left-0 z-10 bg-background px-3 py-1.5 text-left font-normal text-muted-foreground">
                必要人数 / 割当
              </th>
              {days.map((d) => {
                const req = reqByDate.get(d.date) ?? 0;
                const assigned = assignedByDate.get(d.date) ?? 0;
                const short = req > 0 && assigned < req;
                return (
                  <td key={d.date} className="px-2 py-1.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="number"
                        min={0}
                        defaultValue={req}
                        key={`${activeSlotId}_${d.date}_${req}`}
                        onBlur={(e) => changeRequirement(d.date, e.target.value)}
                        aria-label={`${d.label}の必要人数`}
                        className="w-12 rounded border border-input bg-background px-1 py-0.5 text-center font-numeric text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <span
                        className={`font-numeric ${short ? "text-red-600 font-semibold" : "text-muted-foreground"}`}
                      >
                        /{assigned}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {staff.map((st) => (
              <tr key={st.id}>
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium">
                  {st.displayName}
                </th>
                {days.map((d) => {
                  const key = `${st.id}_${d.date}`;
                  const shift = shiftAt.get(key);
                  const avail = availAt.get(key);
                  return (
                    <td
                      key={d.date}
                      className={`px-1.5 py-1.5 text-center align-middle ${avail ? AVAIL_BG[avail] : ""}`}
                    >
                      {shift ? (
                        <div className="inline-flex flex-col items-center gap-0.5">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-1 font-numeric text-xs font-medium ${
                              shift.status === "PUBLISHED"
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-foreground"
                            }`}
                          >
                            {shift.startTime}–{shift.endTime}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeShift(shift.id)}
                            disabled={isPending}
                            aria-label={`${st.displayName} ${d.label} のシフトを削除`}
                            className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                          >
                            <Trash2 className="size-3" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addShift(st.id, d.date)}
                          disabled={isPending}
                          aria-label={`${st.displayName} ${d.label} にシフトを追加`}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-background hover:text-primary disabled:opacity-50"
                        >
                          <Plus className="size-4" aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td
                  colSpan={days.length + 1}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  この店舗に所属するスタッフがいません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 自動生成ダイアログ */}
      {genOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gen-dialog-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2
                id="gen-dialog-title"
                className="flex items-center gap-2 text-lg font-bold"
              >
                <Sparkles className="size-5 text-primary" aria-hidden="true" />
                シフトを自動生成
              </h2>
              <button
                type="button"
                onClick={() => setGenOpen(false)}
                aria-label="閉じる"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              この週の必要人数・希望・ルールをもとに、すべての時間帯の下書きシフトを自動で組みます。
              既存の下書きは置き換わります（公開済みは残ります）。生成後に確認・修正してから公開してください。
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              各シフトの時刻は、割り当てた時間帯の定義（早番・遅番など）から自動で設定します。
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isGenerating && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                生成する
              </button>
              <button
                type="button"
                onClick={() => setGenOpen(false)}
                disabled={isGenerating}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium transition-colors hover:bg-muted"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
