"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { inviteAdminMember } from "@/actions/admin";
import { StoreScopePicker, type StoreOption } from "./store-scope-picker";

interface AdminInviteFormProps {
  organizationId: string;
  stores: StoreOption[];
}

export function AdminInviteForm({
  organizationId,
  stores,
}: AdminInviteFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  // null = 全店舗
  const [scope, setScope] = useState<string[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);

    if (scope !== null && scope.length === 0) {
      setError("担当店舗を1つ以上選ぶか、「全店舗を管理する」にしてください");
      return;
    }

    startTransition(async () => {
      const result = await inviteAdminMember(organizationId, {
        email: email.trim(),
        storeIds: scope === null ? [] : scope,
      });
      if (result.error) {
        setError(result.error);
      } else {
        toast.success("管理者として追加しました");
        setEmail("");
        setScope(null);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
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

      <div className="space-y-1.5">
        <p className="block text-sm font-medium">担当店舗</p>
        <StoreScopePicker
          stores={stores}
          value={scope}
          onChange={setScope}
          idPrefix="invite-scope"
        />
        <p className="text-xs text-muted-foreground">
          特定の店舗だけを担当する店舗管理者にする場合は、その店舗を選択します。
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
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
      >
        {isPending ? "追加中…" : "管理者として追加"}
      </button>
    </form>
  );
}
