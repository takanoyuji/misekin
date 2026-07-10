"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { updateOrganization } from "@/actions/organization";

interface OrganizationFormProps {
  organizationId: string;
  name: string;
  timezone: string;
  dayChangeHour: number;
}

const TIMEZONES = [
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST, UTC+9)" },
  { value: "Asia/Seoul", label: "Asia/Seoul (KST, UTC+9)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST, UTC+8)" },
  { value: "UTC", label: "UTC (UTC+0)" },
];

export function OrganizationForm({
  organizationId,
  name: initialName,
  timezone: initialTimezone,
  dayChangeHour: initialDayChangeHour,
}: OrganizationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialName);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [dayChangeHour, setDayChangeHour] = useState(initialDayChangeHour);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("組織名を入力してください");
      return;
    }

    startTransition(async () => {
      const result = await updateOrganization(organizationId, {
        name: name.trim(),
        timezone,
        dayChangeHour,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("組織設定を保存しました");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 組織名 */}
      <div className="space-y-1">
        <label
          htmlFor="org-name"
          className="block text-sm font-medium text-foreground"
        >
          組織名
          <span className="ml-1 text-destructive" aria-hidden="true">
            *
          </span>
        </label>
        <input
          id="org-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="例: 株式会社みせ勤"
        />
      </div>

      {/* タイムゾーン */}
      <div className="space-y-1">
        <label
          htmlFor="org-timezone"
          className="block text-sm font-medium text-foreground"
        >
          タイムゾーン
        </label>
        <select
          id="org-timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          組織のデフォルトタイムゾーンです。各店舗で個別に設定することもできます。
        </p>
      </div>

      {/* 切替時刻 */}
      <div className="space-y-1">
        <label
          htmlFor="org-dayChangeHour"
          className="block text-sm font-medium text-foreground"
        >
          日付切替時刻
        </label>
        <select
          id="org-dayChangeHour"
          value={dayChangeHour}
          onChange={(e) => setDayChangeHour(parseInt(e.target.value, 10))}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {Array.from({ length: 13 }, (_, i) => i).map((h) => (
            <option key={h} value={h}>
              {h === 0 ? "0時（深夜0時切替）" : `${h}時（深夜${h}時まで前日扱い）`}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          この時刻以降を翌日の勤務として扱います。深夜営業がある場合は適切に設定してください。
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
      >
        {isPending ? "保存中..." : "保存する"}
      </button>
    </form>
  );
}
