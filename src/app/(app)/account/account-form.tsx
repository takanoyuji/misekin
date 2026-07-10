"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { updateAccountName, changePassword } from "@/actions/account";

interface AccountFormProps {
  userName: string;
  userEmail: string;
  hasPassword: boolean;
}

export function AccountForm({
  userName,
  userEmail,
  hasPassword,
}: AccountFormProps) {
  const router = useRouter();

  // プロフィール
  const [name, setName] = useState(userName);
  const [isNamePending, startNameTransition] = useTransition();

  // パスワード変更
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordPending, startPasswordTransition] = useTransition();

  function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault();
    startNameTransition(async () => {
      const result = await updateAccountName(name);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("名前を更新しました");
        router.refresh();
      }
    });
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("新しいパスワードと確認用パスワードが一致しません");
      return;
    }

    startPasswordTransition(async () => {
      const result = await changePassword(currentPassword, newPassword);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("パスワードを変更しました");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* プロフィール設定 */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">プロフィール設定</h2>
        </div>
        <div className="p-6">
          <form onSubmit={handleNameSubmit} className="space-y-4">
            {/* メールアドレス（読み取り専用） */}
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={userEmail}
                disabled
                className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                メールアドレスは変更できません
              </p>
            </div>

            {/* 名前 */}
            <div className="space-y-1">
              <label
                htmlFor="name"
                className="block text-sm font-medium text-foreground"
              >
                名前
                <span className="ml-1 text-destructive" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={100}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <button
              type="submit"
              disabled={isNamePending}
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
            >
              {isNamePending ? "保存中..." : "保存する"}
            </button>
          </form>
        </div>
      </section>

      {/* パスワード変更 */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">パスワード変更</h2>
        </div>
        <div className="p-6">
          {!hasPassword ? (
            <p className="text-sm text-muted-foreground">
              このアカウントはパスワードが設定されていません。外部認証プロバイダ経由でログインしています。
            </p>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {/* 現在のパスワード */}
              <div className="space-y-1">
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-medium text-foreground"
                >
                  現在のパスワード
                  <span className="ml-1 text-destructive" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {/* 新しいパスワード */}
              <div className="space-y-1">
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-foreground"
                >
                  新しいパスワード
                  <span className="ml-1 text-destructive" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  minLength={8}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  8文字以上で入力してください
                </p>
              </div>

              {/* パスワード確認 */}
              <div className="space-y-1">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-foreground"
                >
                  新しいパスワード（確認）
                  <span className="ml-1 text-destructive" aria-hidden="true">
                    *
                  </span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive" role="alert">
                    パスワードが一致しません
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  isPasswordPending ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  newPassword !== confirmPassword
                }
                className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:pointer-events-none transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50"
              >
                {isPasswordPending ? "変更中..." : "パスワードを変更する"}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
