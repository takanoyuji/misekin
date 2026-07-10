"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStore } from "@/actions/store";

interface StoreEditFormProps {
  store: {
    id: string;
    name: string;
    code: string;
    address: string;
    timezone: string;
    dayChangeHour: number;
    dayChangeMinute: number;
    isActive: boolean;
  };
  organizationId: string;
}

export function StoreEditForm({ store, organizationId }: StoreEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const input = {
      name: formData.get("name") as string,
      code: (formData.get("code") as string) || null,
      address: (formData.get("address") as string) || null,
      timezone: formData.get("timezone") as string,
      dayChangeHour: parseInt(formData.get("dayChangeHour") as string, 10),
      dayChangeMinute: parseInt(formData.get("dayChangeMinute") as string, 10),
    };

    startTransition(async () => {
      const result = await updateStore(organizationId, store.id, input);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 店舗名 */}
      <div className="space-y-1">
        <label
          htmlFor="store-name"
          className="block text-sm font-medium text-foreground"
        >
          店舗名 <span className="text-destructive">*</span>
        </label>
        <input
          id="store-name"
          name="name"
          type="text"
          defaultValue={store.name}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* コード */}
      <div className="space-y-1">
        <label
          htmlFor="store-code"
          className="block text-sm font-medium text-foreground"
        >
          店舗コード
        </label>
        <input
          id="store-code"
          name="code"
          type="text"
          defaultValue={store.code}
          maxLength={20}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="例: SHINJUKU"
        />
      </div>

      {/* 住所 */}
      <div className="space-y-1">
        <label
          htmlFor="store-address"
          className="block text-sm font-medium text-foreground"
        >
          住所
        </label>
        <input
          id="store-address"
          name="address"
          type="text"
          defaultValue={store.address}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* タイムゾーン */}
      <div className="space-y-1">
        <label
          htmlFor="store-timezone"
          className="block text-sm font-medium text-foreground"
        >
          タイムゾーン
        </label>
        <select
          id="store-timezone"
          name="timezone"
          defaultValue={store.timezone}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
          <option value="Asia/Seoul">Asia/Seoul (KST)</option>
          <option value="UTC">UTC</option>
        </select>
      </div>

      {/* 日付切り替え時刻 */}
      <div className="space-y-1">
        <span className="block text-sm font-medium text-foreground">
          日付切り替え時刻
        </span>
        <div className="flex items-center gap-2">
          <input
            id="store-dayChangeHour"
            name="dayChangeHour"
            type="number"
            min={0}
            max={23}
            defaultValue={store.dayChangeHour}
            className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="切り替え時（時）"
          />
          <span className="text-sm text-muted-foreground">時</span>
          <input
            id="store-dayChangeMinute"
            name="dayChangeMinute"
            type="number"
            min={0}
            max={59}
            defaultValue={store.dayChangeMinute}
            className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="切り替え時（分）"
          />
          <span className="text-sm text-muted-foreground">分</span>
        </div>
        <p className="text-xs text-muted-foreground">
          この時刻以降を翌日の勤務として扱います（例: 06:00 → 深夜6時まで前日扱い）
        </p>
      </div>

      {/* エラー・成功 */}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-green-600" role="status">
          保存しました
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
      >
        {isPending ? "保存中..." : "保存する"}
      </button>
    </form>
  );
}
