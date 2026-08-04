"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { sendStaffInvitation } from "@/actions/staff";

interface StaffInviteButtonProps {
  staffId: string;
  organizationId: string;
  staffEmail: string | null;
  /** オーナーだけが「管理者として招待」を選べる（ADMINがADMINを増やせないようにするため） */
  canInviteAsAdmin?: boolean;
  /** 担当店舗の選択肢。未選択なら全店舗を担当する管理者になる */
  stores?: { id: string; name: string }[];
  /** 表示上の呼び方（キャスト / スタッフ） */
  staffTerm?: string;
}

export function StaffInviteButton({
  staffId,
  organizationId,
  staffEmail,
  canInviteAsAdmin = false,
  stores = [],
  staffTerm = "スタッフ",
}: StaffInviteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [asAdmin, setAsAdmin] = useState(false);
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  if (!staffEmail) return null;

  function toggleStore(id: string) {
    setStoreIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const handleClick = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await sendStaffInvitation(
        organizationId,
        staffId,
        asAdmin ? { role: "ADMIN", storeIds } : undefined
      );
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({
          type: "success",
          text: asAdmin
            ? "管理者として招待しました。本人が登録を終えると管理者になります"
            : "招待メールを送信しました",
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending
          ? "送信中…"
          : asAdmin
            ? "管理者として招待する"
            : "招待メールを送る"}
      </Button>

      {canInviteAsAdmin && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={asAdmin}
              onChange={(e) => setAsAdmin(e.target.checked)}
              disabled={isPending}
              className="size-3.5"
            />
            管理者として招待する
          </label>

          {asAdmin && (
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-2.5">
              <p className="text-[11px] text-muted-foreground">
                担当する店舗（選ばなければ全店舗）
              </p>
              {stores.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  店舗がまだありません
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {stores.map((s) => (
                    <li key={s.id}>
                      <label
                        className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${
                          storeIds.includes(s.id)
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border bg-background"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={storeIds.includes(s.id)}
                          onChange={() => toggleStore(s.id)}
                          disabled={isPending}
                          className="sr-only"
                        />
                        {s.name}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-muted-foreground">
                この{staffTerm}が登録を終えた時点で管理者になります。あとから変更もできます。
              </p>
            </div>
          )}
        </div>
      )}

      {message && (
        <p
          className={`text-xs ${message.type === "success" ? "text-green-600" : "text-destructive"}`}
          role="alert"
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
