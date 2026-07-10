"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStaff } from "@/actions/staff";

interface StaffEditFormProps {
  staff: {
    id: string;
    displayName: string;
    fullName: string;
    email: string;
    phone: string;
    employeeCode: string;
    hireDate: string;
    notes: string;
  };
  organizationId: string;
}

export function StaffEditForm({ staff, organizationId }: StaffEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const input: Record<string, any> = {
      displayName: formData.get("displayName") as string,
      fullName: (formData.get("fullName") as string) || null,
      phone: (formData.get("phone") as string) || null,
      employeeCode: (formData.get("employeeCode") as string) || null,
      notes: (formData.get("notes") as string) || null,
    };

    const hireDateRaw = formData.get("hireDate") as string;
    if (hireDateRaw) {
      input.hireDate = new Date(hireDateRaw);
    } else {
      input.hireDate = null;
    }

    startTransition(async () => {
      const result = await updateStaff(organizationId, staff.id, input);
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
      {/* 表示名 */}
      <div className="space-y-1">
        <label
          htmlFor="staff-displayName"
          className="block text-sm font-medium text-foreground"
        >
          表示名 <span className="text-destructive">*</span>
        </label>
        <input
          id="staff-displayName"
          name="displayName"
          type="text"
          defaultValue={staff.displayName}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* 本名 */}
      <div className="space-y-1">
        <label
          htmlFor="staff-fullName"
          className="block text-sm font-medium text-foreground"
        >
          本名
        </label>
        <input
          id="staff-fullName"
          name="fullName"
          type="text"
          defaultValue={staff.fullName}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* メール（読み取り専用） */}
      <div className="space-y-1">
        <label
          htmlFor="staff-email"
          className="block text-sm font-medium text-foreground"
        >
          メールアドレス
        </label>
        <input
          id="staff-email"
          name="email"
          type="email"
          value={staff.email}
          readOnly
          className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
          aria-describedby="email-readonly-note"
        />
        <p id="email-readonly-note" className="text-xs text-muted-foreground">
          メールアドレスは変更できません
        </p>
      </div>

      {/* 電話番号 */}
      <div className="space-y-1">
        <label
          htmlFor="staff-phone"
          className="block text-sm font-medium text-foreground"
        >
          電話番号
        </label>
        <input
          id="staff-phone"
          name="phone"
          type="tel"
          defaultValue={staff.phone}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* 社員番号 */}
      <div className="space-y-1">
        <label
          htmlFor="staff-employeeCode"
          className="block text-sm font-medium text-foreground"
        >
          社員番号
        </label>
        <input
          id="staff-employeeCode"
          name="employeeCode"
          type="text"
          defaultValue={staff.employeeCode}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* 入社日 */}
      <div className="space-y-1">
        <label
          htmlFor="staff-hireDate"
          className="block text-sm font-medium text-foreground"
        >
          入社日
        </label>
        <input
          id="staff-hireDate"
          name="hireDate"
          type="date"
          defaultValue={staff.hireDate}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* メモ */}
      <div className="space-y-1">
        <label
          htmlFor="staff-notes"
          className="block text-sm font-medium text-foreground"
        >
          メモ
        </label>
        <textarea
          id="staff-notes"
          name="notes"
          defaultValue={staff.notes}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

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
