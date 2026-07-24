"use client";

import { useState, useTransition } from "react";
import { assignStaffToStore } from "@/actions/staff";

interface Props {
  staffId: string;
  organizationId: string;
  availableStores: { id: string; name: string }[];
}

export function StaffStoreAddForm({ staffId, organizationId, availableStores }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (availableStores.length === 0) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const storeId = formData.get("storeId") as string;
    if (!storeId) return;

    startTransition(async () => {
      const result = await assignStaffToStore(organizationId, {
        staffId,
        storeId,
        startDate: new Date(),
        isPrimary: false,
        canClock: true,
      });
      if (result.error) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-primary hover:underline font-medium"
      >
        + 店舗を追加
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-wrap">
      <select
        name="storeId"
        required
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">店舗を選択</option>
        {availableStores.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {isPending ? "追加中…" : "追加"}
      </button>
      <button
        type="button"
        onClick={() => { setOpen(false); setError(null); }}
        className="text-sm text-muted-foreground hover:underline"
      >
        キャンセル
      </button>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </form>
  );
}
