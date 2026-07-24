import { db } from "@/lib/db";

/**
 * セッションからアクティブな組織IDを解決する
 *
 * アクティブ組織はクッキーに保存されるが、クッキーが設定されるのは
 * 「組織の作成時」と「組織の切替時」だけ。招待で参加したスタッフは
 * どちらも通らないためクッキーが空になる。
 * その場合は所属している組織にフォールバックする。
 */
export async function resolveActiveOrganizationId(
  userId: string | undefined,
  cookieValue: string | null | undefined
): Promise<string | null> {
  if (cookieValue) return cookieValue;
  if (!userId) return null;

  const membership = await db.organizationMember.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });

  return membership?.organizationId ?? null;
}

/**
 * 組織内でのロールを取得する
 */
export async function getOrganizationRole(
  userId: string | undefined,
  organizationId: string | null
): Promise<"OWNER" | "ADMIN" | "MEMBER" | null> {
  if (!userId || !organizationId) return null;

  const membership = await db.organizationMember.findFirst({
    where: { userId, organizationId, isActive: true },
    select: { role: true },
  });

  return membership?.role ?? null;
}
