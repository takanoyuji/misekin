"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { acceptStaffInvitation } from "@/actions/invitation";
import { Loader2 } from "lucide-react";

interface StaffInvitationFormProps {
  token: string;
  /** 既にパスワード設定済みのアカウントがある場合は入力を求めない */
  hasAccount: boolean;
}

export function StaffInvitationForm({
  token,
  hasAccount,
}: StaffInvitationFormProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!hasAccount && password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    startTransition(async () => {
      const result = await acceptStaffInvitation(
        token,
        hasAccount ? null : password
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          登録が完了しました。設定したメールアドレスとパスワードでログインできます。
        </div>
        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          ログイン画面へ
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {hasAccount ? (
        <p className="text-sm text-muted-foreground">
          このメールアドレスのアカウントは既に登録済みです。下のボタンを押すとスタッフ登録が完了し、既存のパスワードでログインできます。
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground"
            >
              パスワード
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              disabled={isPending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground">
              8文字以上で入力してください
            </p>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-foreground"
            >
              パスワード（確認）
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
              disabled={isPending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive" role="alert">
                パスワードが一致しません
              </p>
            )}
          </div>
        </>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={
          isPending ||
          (!hasAccount &&
            (password.length < 8 || password !== confirmPassword))
        }
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isPending ? "登録中…" : "登録する"}
      </button>
    </form>
  );
}
