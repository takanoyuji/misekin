"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/auth/audit";
import { requireOwner } from "@/lib/auth/permissions";
import { generateApiKey } from "@/lib/api/api-key";
import { z } from "zod";

interface ActionResult {
  success?: boolean;
  error?: string;
  data?: unknown;
}

const createApiKeySchema = z.object({
  name: z.string().min(1, "キー名を入力してください").max(100),
  description: z.string().max(500).optional(),
  isReadOnly: z.boolean().default(true),
  storeScope: z.array(z.string()).optional(),
  expiresAt: z.string().optional(),
});

/**
 * APIキーを発行する
 */
export async function createApiKey(
  organizationId: string,
  input: unknown
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = createApiKeySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  try {
    await requireOwner(session.user.id, organizationId);

    const { rawKey, keyPrefix, keyHash } = generateApiKey();

    const expiresAt = parsed.data.expiresAt
      ? new Date(parsed.data.expiresAt)
      : null;

    const apiKey = await db.apiKey.create({
      data: {
        organizationId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        keyPrefix,
        keyHash,
        isReadOnly: parsed.data.isReadOnly,
        storeScope:
          parsed.data.storeScope && parsed.data.storeScope.length > 0
            ? parsed.data.storeScope
            : undefined,
        expiresAt,
        createdByUserId: session.user.id,
      },
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "API_KEY_ISSUE",
      targetType: "ApiKey",
      targetId: apiKey.id,
      after: { name: apiKey.name, keyPrefix: apiKey.keyPrefix },
    });

    revalidatePath("/api-keys");
    return { success: true, data: { rawKey, apiKeyId: apiKey.id } };
  } catch (error: any) {
    return { error: error.message ?? "APIキーの発行に失敗しました" };
  }
}

/**
 * APIキーを無効化する
 */
export async function revokeApiKey(
  organizationId: string,
  apiKeyId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    await requireOwner(session.user.id, organizationId);

    const apiKey = await db.apiKey.findUnique({
      where: { id: apiKeyId },
    });

    if (!apiKey) return { error: "APIキーが見つかりません" };
    if (apiKey.organizationId !== organizationId)
      return { error: "権限がありません" };
    if (!apiKey.isActive) return { error: "すでに無効化されています" };

    await db.apiKey.update({
      where: { id: apiKeyId },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "API_KEY_REVOKE",
      targetType: "ApiKey",
      targetId: apiKeyId,
      after: { name: apiKey.name, revokedAt: new Date() },
    });

    revalidatePath("/api-keys");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "APIキーの無効化に失敗しました" };
  }
}
