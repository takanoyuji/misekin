"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/auth/audit";
import { requireAdmin, canAccessStore } from "@/lib/auth/permissions";
import {
  translateShiftRule,
  type TranslatedShiftRule,
} from "@/lib/ai/shift-rule-translator";

interface ActionResult {
  success?: boolean;
  error?: string;
}

async function assertStoreAccess(
  userId: string,
  organizationId: string,
  storeId: string
) {
  const ctx = await requireAdmin(userId, organizationId);
  const store = await db.store.findFirst({
    where: { id: storeId, organizationId },
    select: { id: true },
  });
  if (!store) throw new Error("店舗が見つかりません");
  if (!(await canAccessStore(ctx.memberId, ctx.role, storeId))) {
    throw new Error("この店舗を操作する権限がありません");
  }
}

/**
 * 日本語ルールを Claude で構造化して返す（保存はしない）
 * 画面で内容を確認してから saveShiftRule で保存する（§5 の承認ステップ）
 */
export async function translateRule(
  organizationId: string,
  storeId: string,
  sourceText: string
): Promise<ActionResult & { rule?: TranslatedShiftRule }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const text = sourceText.trim();
  if (!text) return { error: "ルールを入力してください" };
  if (text.length > 300) return { error: "ルールは300文字以内で入力してください" };

  try {
    await assertStoreAccess(session.user.id, organizationId, storeId);
    const rule = await translateShiftRule(text);
    return { success: true, rule };
  } catch (error: any) {
    return { error: error.message ?? "ルールの翻訳に失敗しました" };
  }
}

/**
 * 確認済みの構造化ルールを保存する
 */
export async function saveShiftRule(
  organizationId: string,
  storeId: string,
  sourceText: string,
  rule: TranslatedShiftRule
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    await assertStoreAccess(session.user.id, organizationId, storeId);

    // クライアントから来た rule は信用しすぎず、最低限の形だけ確認する
    const allowed = [
      "SPACING",
      "MAX_SHIFTS_PER_WEEK",
      "MIN_SHIFTS_PER_WEEK",
      "SALES_PRIORITY",
      "PAIR_AVOID",
      "OTHER",
    ];
    const ruleType = allowed.includes(rule.ruleType) ? rule.ruleType : "OTHER";
    const weight = rule.weight === "HARD" ? "HARD" : "SOFT";

    const created = await db.shiftRule.create({
      data: {
        organizationId,
        storeId,
        ruleType,
        weight,
        params: (rule.params ?? {}) as object,
        sourceText: sourceText.trim().slice(0, 300),
        description: (rule.description ?? sourceText).slice(0, 300),
        enabled: true,
        createdByUserId: session.user.id,
      },
      select: { id: true },
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "STORE_UPDATE",
      targetType: "ShiftRule",
      targetId: created.id,
      storeId,
      after: { ruleType, weight, sourceText },
      reason: "シフトルールの追加",
    });

    revalidatePath("/shifts/rules");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "ルールの保存に失敗しました" };
  }
}

/** ルールの有効・無効を切り替える */
export async function toggleShiftRule(
  organizationId: string,
  ruleId: string,
  enabled: boolean
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const rule = await db.shiftRule.findFirst({
      where: { id: ruleId, organizationId },
      select: { id: true, storeId: true },
    });
    if (!rule) return { error: "ルールが見つかりません" };

    await assertStoreAccess(session.user.id, organizationId, rule.storeId);
    await db.shiftRule.update({ where: { id: ruleId }, data: { enabled } });

    revalidatePath("/shifts/rules");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "更新に失敗しました" };
  }
}

/** ルールを削除する */
export async function deleteShiftRule(
  organizationId: string,
  ruleId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const rule = await db.shiftRule.findFirst({
      where: { id: ruleId, organizationId },
      select: { id: true, storeId: true },
    });
    if (!rule) return { error: "ルールが見つかりません" };

    await assertStoreAccess(session.user.id, organizationId, rule.storeId);
    await db.shiftRule.delete({ where: { id: ruleId } });

    revalidatePath("/shifts/rules");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "削除に失敗しました" };
  }
}
