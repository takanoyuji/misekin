"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changeMemberRole, setStoreAdminScope } from "@/actions/admin";
import { StoreScopePicker, type StoreOption } from "./store-scope-picker";
import { Loader2 } from "lucide-react";

type Role = "OWNER" | "ADMIN" | "MEMBER";

interface Props {
  organizationId: string;
  member: {
    id: string;
    name: string;
    email: string;
    role: Role;
    isSelf: boolean;
    /** 現在の担当店舗ID。空配列 = 全店舗 */
    scopeStoreIds: string[];
  };
  stores: StoreOption[];
  onRemove: React.ReactNode;
}

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "オーナー",
  ADMIN: "管理者",
  MEMBER: "メンバー",
};

const ROLE_BADGE: Record<Role, string> = {
  OWNER: "bg-purple-50 text-purple-700",
  ADMIN: "bg-blue-50 text-blue-700",
  MEMBER: "bg-gray-100 text-gray-600",
};

export function MemberPermissionCard({
  organizationId,
  member,
  stores,
  onRemove,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 担当店舗の編集状態（null = 全店舗）
  const initialScope: string[] | null =
    member.scopeStoreIds.length === 0 ? null : member.scopeStoreIds;
  const [scope, setScope] = useState<string[] | null>(initialScope);

  const editable = member.role !== "OWNER" && !member.isSelf;

  const scopeChanged =
    JSON.stringify(scope === null ? "ALL" : [...scope].sort()) !==
    JSON.stringify(initialScope === null ? "ALL" : [...initialScope].sort());

  function handleRoleChange(next: "ADMIN" | "MEMBER") {
    if (next === member.role) return;
    setError(null);
    startTransition(async () => {
      const result = await changeMemberRole(organizationId, {
        memberId: member.id,
        role: next,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(`権限を「${ROLE_LABEL[next]}」に変更しました`);
      router.refresh();
    });
  }

  function handleScopeSave() {
    // 「指定店舗」を選んだのに0件はエラー（空=全店舗と衝突するため）
    if (scope !== null && scope.length === 0) {
      setError("担当店舗を1つ以上選ぶか、「全店舗を管理する」にしてください");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setStoreAdminScope(organizationId, {
        memberId: member.id,
        storeIds: scope === null ? [] : scope,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success("担当店舗を更新しました");
      router.refresh();
    });
  }

  const scopeSummary =
    member.scopeStoreIds.length === 0
      ? "全店舗"
      : stores
          .filter((s) => member.scopeStoreIds.includes(s.id))
          .map((s) => s.name)
          .join("、") || `${member.scopeStoreIds.length}店舗`;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {member.name || "—"}
            {member.isSelf && (
              <span className="ml-2 text-xs text-muted-foreground">(あなた)</span>
            )}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {member.email}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[member.role]}`}
        >
          {ROLE_LABEL[member.role]}
        </span>
      </div>

      {!editable ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {member.role === "OWNER"
            ? "オーナーの権限は変更できません。"
            : "自分自身の権限は変更できません。"}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {/* 権限（ロール）切り替え */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">権限</p>
            <div
              role="group"
              aria-label="権限を選択"
              className="inline-flex rounded-md border border-border p-0.5"
            >
              {(["ADMIN", "MEMBER"] as const).map((r) => {
                const active = member.role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRoleChange(r)}
                    disabled={isPending || active}
                    aria-pressed={active}
                    className={`min-h-9 rounded px-3 text-sm font-medium transition-colors disabled:cursor-default ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted disabled:opacity-100"
                    }`}
                  >
                    {ROLE_LABEL[r]}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              「管理者」は管理画面にログインしてシフト・勤怠を管理できます。「メンバー」は自分の打刻・シフト希望のみ。
            </p>
          </div>

          {/* 担当店舗（ADMINのみ） */}
          {member.role === "ADMIN" && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">
                担当店舗{" "}
                <span className="font-normal">
                  （現在: {scopeSummary}）
                </span>
              </p>
              <StoreScopePicker
                stores={stores}
                value={scope}
                onChange={setScope}
                idPrefix={`scope-${member.id}`}
              />
              <button
                type="button"
                onClick={handleScopeSave}
                disabled={isPending || !scopeChanged}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isPending && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}
                担当店舗を保存
              </button>
            </div>
          )}

          <div className="border-t border-border pt-3">{onRemove}</div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
