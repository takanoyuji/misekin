"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteStaff } from "@/actions/staff";
import type { CreateStaffInput } from "@/lib/validations/staff";

interface StaffInviteFormProps {
  organizationId: string;
}

export function StaffInviteForm({ organizationId }: StaffInviteFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const hireDateRaw = formData.get("hireDate") as string;
    const input: CreateStaffInput & { storeId?: string } = {
      displayName: formData.get("displayName") as string,
      email: formData.get("email") as string,
      fullName: (formData.get("fullName") as string) || null,
      phone: (formData.get("phone") as string) || null,
      employeeCode: (formData.get("employeeCode") as string) || null,
      hireDate: hireDateRaw ? new Date(hireDateRaw) : null,
    };

    startTransition(async () => {
      const result = await inviteStaff(organizationId, input);
      if (result.error) {
        setError(result.error);
      } else {
        const data = result.data as { staffId: string };
        router.push(`/staff/${data.staffId}`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label
          htmlFor="invite-displayName"
          className="block text-sm font-medium text-foreground"
        >
          表示名 <span className="text-destructive">*</span>
        </label>
        <input
          id="invite-displayName"
          name="displayName"
          type="text"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="例: 田中 太郎"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="invite-email"
          className="block text-sm font-medium text-foreground"
        >
          メールアドレス <span className="text-destructive">*</span>
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="staff@example.com"
        />
        <p className="text-xs text-muted-foreground">
          招待メールがこのアドレスに送信されます
        </p>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="invite-fullName"
          className="block text-sm font-medium text-foreground"
        >
          本名
        </label>
        <input
          id="invite-fullName"
          name="fullName"
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="invite-phone"
          className="block text-sm font-medium text-foreground"
        >
          電話番号
        </label>
        <input
          id="invite-phone"
          name="phone"
          type="tel"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="invite-employeeCode"
          className="block text-sm font-medium text-foreground"
        >
          社員番号
        </label>
        <input
          id="invite-employeeCode"
          name="employeeCode"
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="invite-hireDate"
          className="block text-sm font-medium text-foreground"
        >
          入社日
        </label>
        <input
          id="invite-hireDate"
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
          {isPending ? "送信中..." : "招待メールを送る"}
        </button>
      </div>
    </form>
  );
}
