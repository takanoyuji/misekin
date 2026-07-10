"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeAdminMember } from "@/actions/admin";

interface AdminRemoveButtonProps {
  memberId: string;
  memberName: string;
  organizationId: string;
}

export function AdminRemoveButton({ memberId, memberName, organizationId }: AdminRemoveButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(false);

  function handleRemove() {
    startTransition(async () => {
      const result = await removeAdminMember(organizationId, memberId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("管理者を削除しました");
        setIsConfirming(false);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="text-xs text-destructive hover:underline"
      >
        削除
      </button>

      {isConfirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">管理者を削除しますか？</h2>
            <p className="text-gray-600 text-sm mb-5">
              <strong>{memberName}</strong> を管理者から削除します。この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-60"
              >
                {isPending ? "処理中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
