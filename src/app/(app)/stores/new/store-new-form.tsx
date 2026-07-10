"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStore } from "@/actions/store";

interface StoreNewFormProps {
  organizationId: string;
}

export function StoreNewForm({ organizationId }: StoreNewFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const input = {
      name: formData.get("name") as string,
      code: (formData.get("code") as string) || null,
      address: (formData.get("address") as string) || null,
      timezone: formData.get("timezone") as string,
      dayChangeHour: parseInt(formData.get("dayChangeHour") as string, 10),
      dayChangeMinute: parseInt(
        formData.get("dayChangeMinute") as string,
        10
      ),
    };

    startTransition(async () => {
      const result = await createStore(organizationId, input);
      if (result.error) {
        setError(result.error);
      } else {
        const data = result.data as { storeId: string };
        router.push(`/stores/${data.storeId}`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label
          htmlFor="new-store-name"
          className="block text-sm font-medium text-foreground"
        >
          店舗名 <span className="text-destructive">*</span>
        </label>
        <input
          id="new-store-name"
          name="name"
          type="text"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="例: 新宿店"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="new-store-code"
          className="block text-sm font-medium text-foreground"
        >
          店舗コード
        </label>
        <input
          id="new-store-code"
          name="code"
          type="text"
          maxLength={20}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="例: SHINJUKU（任意）"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="new-store-address"
          className="block text-sm font-medium text-foreground"
        >
          住所
        </label>
        <input
          id="new-store-address"
          name="address"
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="new-store-timezone"
          className="block text-sm font-medium text-foreground"
        >
          タイムゾーン
        </label>
        <select
          id="new-store-timezone"
          name="timezone"
          defaultValue="Asia/Tokyo"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
          <option value="Asia/Seoul">Asia/Seoul (KST)</option>
          <option value="UTC">UTC</option>
        </select>
      </div>

      <div className="space-y-1">
        <span className="block text-sm font-medium text-foreground">
          日付切り替え時刻
        </span>
        <div className="flex items-center gap-2">
          <input
            name="dayChangeHour"
            type="number"
            min={0}
            max={23}
            defaultValue={6}
            className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="切り替え時（時）"
          />
          <span className="text-sm text-muted-foreground">時</span>
          <input
            name="dayChangeMinute"
            type="number"
            min={0}
            max={59}
            defaultValue={0}
            className="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="切り替え時（分）"
          />
          <span className="text-sm text-muted-foreground">分</span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <a
          href="/stores"
          className="flex-1 text-center py-2 rounded-lg border border-input text-sm font-medium hover:bg-muted transition-colors"
        >
          キャンセル
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
        >
          {isPending ? "作成中..." : "店舗を作成"}
        </button>
      </div>
    </form>
  );
}
