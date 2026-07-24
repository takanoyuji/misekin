"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStaffEmail } from "@/actions/staff";
import { Check, Loader2, Mail, TriangleAlert } from "lucide-react";

interface StaffEmailFormProps {
  staffId: string;
  organizationId: string;
  currentEmail: string | null;
  /** Staff.userId が設定されている = ログインアカウントを持つ */
  hasLoginAccount: boolean;
}

export function StaffEmailForm({
  staffId,
  organizationId,
  currentEmail,
  hasLoginAccount,
}: StaffEmailFormProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(currentEmail ?? "");
  const [displayEmail, setDisplayEmail] = useState(currentEmail);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCancel() {
    setIsEditing(false);
    setValue(displayEmail ?? "");
    setMessage(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    const next = value.trim();
    if (next === (displayEmail ?? "")) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      const result = await updateStaffEmail(organizationId, staffId, next);

      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }

      setDisplayEmail(next === "" ? null : next);
      setIsEditing(false);
      setMessage({
        type: "success",
        text: result.requiresReverification
          ? "メールアドレスを変更しました。新しいアドレス宛に確認メールを送信しました。確認が完了するまでこのアカウントはログインできません。"
          : "メールアドレスを変更しました",
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-medium">メールアドレス</h3>
      </div>

      {!isEditing ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {displayEmail ?? "未設定"}
          </p>
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setIsEditing(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
          >
            変更する
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label
              htmlFor="staff-email-input"
              className="block text-sm font-medium text-foreground"
            >
              新しいメールアドレス
            </label>
            <input
              id="staff-email-input"
              type="email"
              name="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="email"
              disabled={isPending}
              aria-describedby="staff-email-help"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <p id="staff-email-help" className="text-xs text-muted-foreground">
              {hasLoginAccount
                ? "空欄にはできません。"
                : "空欄にすると未設定になります。"}
            </p>
          </div>

          {hasLoginAccount && (
            <div className="flex gap-2 rounded-md border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
              <TriangleAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <p>
                このスタッフはログインアカウントを持っています。変更するとログインIDも新しいアドレスに変わり、
                <strong className="font-semibold">
                  確認メールのリンクを開くまでログインできなくなります。
                </strong>
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-3" aria-hidden="true" />
              )}
              変更を保存
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}

      {message && (
        <p
          className={`text-xs ${
            message.type === "success" ? "text-green-600" : "text-destructive"
          }`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
