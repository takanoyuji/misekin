"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteStaff } from "@/actions/staff";

interface StaffNewFormProps {
  organizationId: string;
}

export function StaffNewForm({ organizationId }: StaffNewFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const hireDateRaw = formData.get("hireDate") as string;

    const input = {
      displayName: formData.get("displayName") as string,
      fullName: (formData.get("fullName") as string) || null,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || null,
      employeeCode: (formData.get("employeeCode") as string) || null,
      hireDate: hireDateRaw ? new Date(hireDateRaw) : null,
    };

    startTransition(async () => {
      const result = await inviteStaff(organizationId, input);
      if (result.error) {
        setError(result.error);
      } else {
        router.push("/staff");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 表示名 */}
      <div className="space-y-1">
        <label
          htmlFor="new-staff-displayName"
          className="block text-sm font-medium text-foreground"
        >
          表示名 <span className="text-destructive">*</span>
        </label>
        <input
          id="new-staff-displayName"
          name="displayName"
          type="text"
          required
          maxLength={50}
          placeholder="例: 田中 太郎"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          打刻画面などに表示される名前です
        </p>
      </div>

      {/* 氏名 */}
      <div className="space-y-1">
        <label
          htmlFor="new-staff-fullName"
          className="block text-sm font-medium text-foreground"
        >
          氏名
        </label>
        <input
          id="new-staff-fullName"
          name="fullName"
          type="text"
          maxLength={50}
          placeholder="例: 田中 太郎（任意）"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* メールアドレス */}
      <div className="space-y-1">
        <label
          htmlFor="new-staff-email"
          className="block text-sm font-medium text-foreground"
        >
          メールアドレス <span className="text-destructive">*</span>
        </label>
        <input
          id="new-staff-email"
          name="email"
          type="email"
          required
          placeholder="例: tanaka@example.com"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          招待メールがこのアドレスに送信されます
        </p>
      </div>

      {/* 電話番号 */}
      <div className="space-y-1">
        <label
          htmlFor="new-staff-phone"
          className="block text-sm font-medium text-foreground"
        >
          電話番号
        </label>
        <input
          id="new-staff-phone"
          name="phone"
          type="tel"
          maxLength={20}
          placeholder="例: 090-1234-5678（任意）"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* 社員コード */}
      <div className="space-y-1">
        <label
          htmlFor="new-staff-employeeCode"
          className="block text-sm font-medium text-foreground"
        >
          社員コード
        </label>
        <input
          id="new-staff-employeeCode"
          name="employeeCode"
          type="text"
          maxLength={20}
          placeholder="例: EMP001（任意）"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* 入社日 */}
      <div className="space-y-1">
        <label
          htmlFor="new-staff-hireDate"
          className="block text-sm font-medium text-foreground"
        >
          入社日
        </label>
        <input
          id="new-staff-hireDate"
          name="hireDate"
          type="date"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <a
          href="/staff"
          className="flex-1 text-center py-2 rounded-lg border border-input text-sm font-medium hover:bg-muted transition-colors"
        >
          キャンセル
        </a>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
        >
          {isPending ? "招待中..." : "招待メールを送信"}
        </button>
      </div>
    </form>
  );
}
