"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createShiftSlot,
  updateShiftSlot,
  deleteShiftSlot,
} from "@/actions/shift-slot";
import { Clock, Loader2, Plus, Trash2 } from "lucide-react";

interface SlotRow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
}

interface Props {
  organizationId: string;
  storeId: string;
  slots: SlotRow[];
}

export function ShiftSlotManager({ organizationId, storeId, slots }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 追加フォーム
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("22:00");

  function handleAdd() {
    setError(null);
    if (!name.trim()) {
      setError("名前を入力してください");
      return;
    }
    startTransition(async () => {
      const result = await createShiftSlot(organizationId, {
        storeId,
        name: name.trim(),
        startTime,
        endTime,
        sortOrder: slots.length,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setName("");
      router.refresh();
    });
  }

  function handleUpdate(slot: SlotRow, patch: Partial<SlotRow>) {
    setError(null);
    startTransition(async () => {
      const result = await updateShiftSlot(organizationId, {
        slotId: slot.id,
        name: patch.name ?? slot.name,
        startTime: patch.startTime ?? slot.startTime,
        endTime: patch.endTime ?? slot.endTime,
        sortOrder: patch.sortOrder ?? slot.sortOrder,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete(slotId: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteShiftSlot(organizationId, slotId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-base font-semibold">シフトの時間帯</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        早番・遅番などの時間帯を定義します。スタッフはこの時間帯ごとに希望を出し、シフトも時間帯ごとに組みます。
      </p>

      {/* 既存の時間帯 */}
      <ul className="space-y-2">
        {slots.map((slot) => (
          <li
            key={slot.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-3"
          >
            <input
              type="text"
              defaultValue={slot.name}
              maxLength={30}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== slot.name)
                  handleUpdate(slot, { name: e.target.value.trim() });
              }}
              aria-label="時間帯名"
              className="min-h-9 w-28 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              type="time"
              defaultValue={slot.startTime}
              onBlur={(e) => {
                if (e.target.value !== slot.startTime)
                  handleUpdate(slot, { startTime: e.target.value });
              }}
              aria-label="開始時刻"
              className="min-h-9 rounded-md border border-input bg-background px-2 font-numeric text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-muted-foreground">–</span>
            <input
              type="time"
              defaultValue={slot.endTime}
              onBlur={(e) => {
                if (e.target.value !== slot.endTime)
                  handleUpdate(slot, { endTime: e.target.value });
              }}
              aria-label="終了時刻"
              className="min-h-9 rounded-md border border-input bg-background px-2 font-numeric text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="button"
              onClick={() => handleDelete(slot.id)}
              disabled={isPending}
              aria-label={`${slot.name}を削除`}
              className="ml-auto inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {/* 追加 */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
        <label className="space-y-1 text-xs">
          <span className="font-medium">名前</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="早番"
            maxLength={30}
            className="min-h-9 w-24 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium">開始</span>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="min-h-9 rounded-md border border-input bg-background px-2 font-numeric text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium">終了</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="min-h-9 rounded-md border border-input bg-background px-2 font-numeric text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          追加
        </button>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
