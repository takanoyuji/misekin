import { createHash, timingSafeEqual } from "crypto";

import { extractApiKey } from "@/lib/api/api-key";

/**
 * 定期実行API（/api/cron/*）の認証。`Authorization: Bearer <CRON_SECRET>` と照合する。
 * CRON_SECRET が未設定なら既定値で通さず NOT_CONFIGURED を返す。
 */
export function isCronAuthorized(
  authHeader: string | null,
  secret: string | undefined
): "OK" | "UNAUTHORIZED" | "NOT_CONFIGURED" {
  if (!secret || secret.trim().length < 16) return "NOT_CONFIGURED";
  const given = extractApiKey(authHeader);
  if (!given) return "UNAUTHORIZED";
  // 長さの違いで早く返らないよう、ハッシュ同士で比べる
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b) ? "OK" : "UNAUTHORIZED";
}
