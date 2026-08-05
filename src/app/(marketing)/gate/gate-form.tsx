"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { unlockLp } from "@/actions/lp-gate";

export function GateForm({ next }: { next?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(unlockLp, null);

  useEffect(() => {
    if (state?.ok) router.replace(next && next.startsWith("/") ? next : "/concafe");
  }, [state, next, router]);

  return (
    <form action={action} className="mt-6 space-y-3">
      <input
        type="password"
        name="password"
        autoFocus
        autoComplete="current-password"
        aria-label="合言葉"
        className="min-h-12 w-full rounded-xl border border-[#F3E4EE] bg-white px-4 text-base text-[#3D3339] outline-none focus-visible:ring-2 focus-visible:ring-[#D6335C]"
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-full bg-[#D6335C] px-6 text-base font-bold text-white disabled:opacity-60"
      >
        {pending ? "確認中…" : "開く"}
      </button>
      {state?.error && (
        <p className="text-center text-sm text-[#D6335C]" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
