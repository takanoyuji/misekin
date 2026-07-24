"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createShift,
  deleteShift,
  publishShifts,
  setRequirement,
} from "@/actions/shift";
import { Loader2, Plus, Send, Trash2, X } from "lucide-react";

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
interface ShiftCell {
  id: string;
  staffId: string;
  businessDate: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  note: string | null;
}
interface Requirement {
  businessDate: string;
  requiredCount: number;
}
interface Availability {
  staffId: string;
  businessDate: string;
  type: AvailabilityType;
}

interface Props {
  organizationId: string;
  storeId: string;
  days: DayLabel[];
  staff: StaffOption[];
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
  requirements,
  shifts,
  availabilities,
  weekStart,
  weekEnd,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    staffId: string;
    date: string;
  } | null>(null);
  const [start, setStart] = useState("20:00");
  const [end, setEnd] = useState("01:00");

  const shiftAt = new Map<string, ShiftCell>();
  for (const s of shifts) shiftAt.set(`${s.staffId}_${s.businessDate}`, s);

  const availAt = new Map<string, AvailabilityType>();
  for (const a of availabilities)
    availAt.set(`${a.staffId}_${a.businessDate}`, a.type);

  const reqByDate = new Map<string, number>();
  for (const r of requirements) reqByDate.set(r.businessDate, r.requiredCount);

  const assignedByDate = new Map<string, number>();
  for (const s of shifts)
    assignedByDate.set(
      s.businessDate,
      (assignedByDate.get(s.businessDate) ?? 0) + 1
    );

  function openEditor(staffId: string, date: string) {
    setError(null);
    setEditing({ staffId, date });
    setStart("20:00");
    setEnd("01:00");
  }

  function submitShift() {
    if (!editing) return;
    const { staffId, date } = editing;
    // 日跨ぎ: 終了が開始より小さければ翌日
    const startAt = new Date(`${date}T${start}:00`);
    let endAt = new Date(`${date}T${end}:00`);
    if (endAt <= startAt) endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);

    setError(null);
    startTransition(async () => {
      const result = await createShift(organizationId, {
        storeId,
        staffId,
        businessDate: date,
        startAt,
        endAt,
        note: null,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(null);
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
        businessDate: date,
        requiredCount: n,
        note: null,
      });
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

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          背景色は希望（
          <span className="rounded bg-primary/5 px-1">青=希望</span>{" "}
          <span className="rounded bg-green-50 px-1">緑=可</span>{" "}
          <span className="rounded bg-red-50 px-1">赤=不可</span>
          ）。空きセルの＋でシフトを追加します。
        </p>
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
            {/* 必要人数の行 */}
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
                        <div className="group relative inline-flex flex-col items-center gap-0.5">
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
                          onClick={() => openEditor(st.id, d.date)}
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

      {/* シフト追加ダイアログ */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shift-dialog-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="shift-dialog-title" className="text-lg font-bold">
                シフトを追加
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="閉じる"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              {staff.find((s) => s.id === editing.staffId)?.displayName} ・{" "}
              {days.find((d) => d.date === editing.date)?.label}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span className="font-medium">出勤</span>
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 font-numeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">退勤</span>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 font-numeric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              退勤が出勤より前の場合は翌日として扱います（日跨ぎ）。
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={submitShift}
                disabled={isPending}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                追加する
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
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
