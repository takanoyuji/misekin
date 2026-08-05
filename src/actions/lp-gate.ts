"use server";

import { cookies } from "next/headers";

import {
  LP_GATE_COOKIE,
  LP_GATE_MAX_AGE,
  getLpPassword,
  lpGateToken,
} from "@/lib/lp-gate";

/** 合言葉を照合して、合っていればクッキーを立てる */
export async function unlockLp(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string; ok?: boolean }> {
  const input = String(formData.get("password") ?? "");
  const password = getLpPassword();
  if (!password) return { ok: true };

  if (input !== password) {
    return { error: "合言葉が違います" };
  }

  const store = await cookies();
  store.set(LP_GATE_COOKIE, await lpGateToken(password), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: LP_GATE_MAX_AGE,
  });
  return { ok: true };
}
