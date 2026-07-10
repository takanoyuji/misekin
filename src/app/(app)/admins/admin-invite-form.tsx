"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { inviteAdminMember } from "@/actions/admin";

interface AdminInviteFormProps {
  organizationId: string;
}

export function AdminInviteForm({ organizationId }: AdminInviteFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await inviteAdminMember(organizationId, email.trim());
      if (result.error) {
        setError(result.error);
      } else {
        toast.success("管理者として追加しました");
        setEmail("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div className="space-y-1">
        <label htmlFor="invite-email" className="block text-sm font-medium">
          招待するメールアドレス
        </label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="admin@example.com"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          既存のみせ勤アカウントを管理者として追加します
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || !email.trim()}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:pointer-events-none transition-colors"
      >
        {isPending ? "追加中..." : "管理者として追加"}
      </button>
    </form>
  );
}
