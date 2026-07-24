"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/auth/audit";
import { requireAdmin, canAccessStore } from "@/lib/auth/permissions";
import {
  createShiftSchema,
  updateShiftSchema,
  requirementSchema,
  type CreateShiftInput,
  type UpdateShiftInput,
  type RequirementInput,
} from "@/lib/validations/shift";

interface ActionResult {
  success?: boolean;
  error?: string;
  data?: unknown;
}

/** 管理者の店舗アクセス権をまとめて確認する */
async function assertStoreAccess(
  userId: string,
  organizationId: string,
  storeId: string
) {
  const ctx = await requireAdmin(userId, organizationId);
  const store = await db.store.findFirst({
    where: { id: storeId, organizationId },
    select: { id: true, timezone: true, dayChangeHour: true, dayChangeMinute: true },
  });
  if (!store) throw new Error("店舗が見つかりません");
  const ok = await canAccessStore(ctx.memberId, ctx.role, storeId);
  if (!ok) throw new Error("この店舗を操作する権限がありません");
  return store;
}

/** シフトを作成する（下書き） */
export async function createShift(
  organizationId: string,
  input: CreateShiftInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = createShiftSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }
  const { storeId, staffId, businessDate, startAt, endAt, note } = parsed.data;

  try {
    await assertStoreAccess(session.user.id, organizationId, storeId);

    // スタッフがその店舗に所属しているか
    const staffStore = await db.staffStore.findFirst({
      where: { staffId, storeId, isActive: true, staff: { organizationId } },
      select: { id: true },
    });
    if (!staffStore) {
      return { error: "そのスタッフはこの店舗に所属していません" };
    }

    const shift = await db.shift.create({
      data: {
        organizationId,
        storeId,
        staffId,
        businessDate,
        startAt,
        endAt,
        note: note ?? null,
        status: "DRAFT",
        createdByUserId: session.user.id,
      },
      select: { id: true },
    });

    revalidatePath("/shifts");
    return { success: true, data: { shiftId: shift.id } };
  } catch (error: any) {
    return { error: error.message ?? "シフトの作成に失敗しました" };
  }
}

/** シフトの時刻・メモを更新する（公開後は変更回数を数える） */
export async function updateShift(
  organizationId: string,
  input: UpdateShiftInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = updateShiftSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }
  const { shiftId, startAt, endAt, note } = parsed.data;

  try {
    const shift = await db.shift.findFirst({
      where: { id: shiftId, organizationId },
      select: { id: true, storeId: true, status: true, staffId: true },
    });
    if (!shift) return { error: "シフトが見つかりません" };

    await assertStoreAccess(session.user.id, organizationId, shift.storeId);

    // 公開済みの変更は「確定後変更回数」として計測する（戦略レポートの指標）
    const isPublished = shift.status === "PUBLISHED";

    await db.shift.update({
      where: { id: shiftId },
      data: {
        startAt,
        endAt,
        note: note ?? null,
        ...(isPublished ? { revisionCount: { increment: 1 } } : {}),
      },
    });

    if (isPublished) {
      await createAuditLog({
        organizationId,
        actorUserId: session.user.id,
        action: "ATTENDANCE_MODIFY",
        targetType: "Shift",
        targetId: shiftId,
        staffId: shift.staffId,
        storeId: shift.storeId,
        reason: "公開済みシフトの変更",
      });
    }

    revalidatePath("/shifts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "シフトの更新に失敗しました" };
  }
}

/** シフトを削除する */
export async function deleteShift(
  organizationId: string,
  shiftId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const shift = await db.shift.findFirst({
      where: { id: shiftId, organizationId },
      select: { id: true, storeId: true },
    });
    if (!shift) return { error: "シフトが見つかりません" };

    await assertStoreAccess(session.user.id, organizationId, shift.storeId);

    await db.shift.delete({ where: { id: shiftId } });

    revalidatePath("/shifts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "シフトの削除に失敗しました" };
  }
}

/**
 * 指定店舗・期間の下書きシフトを一括公開する
 */
export async function publishShifts(
  organizationId: string,
  storeId: string,
  from: string,
  to: string
): Promise<ActionResult & { publishedCount?: number }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    await assertStoreAccess(session.user.id, organizationId, storeId);

    const result = await db.shift.updateMany({
      where: {
        organizationId,
        storeId,
        status: "DRAFT",
        businessDate: { gte: from, lte: to },
      },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "ATTENDANCE_MODIFY",
      targetType: "Shift",
      storeId,
      reason: `シフト公開 (${from}〜${to}, ${result.count}件)`,
    });

    revalidatePath("/shifts");
    return { success: true, publishedCount: result.count };
  } catch (error: any) {
    return { error: error.message ?? "公開に失敗しました" };
  }
}

/** 店舗・営業日の必要人数を設定する */
export async function setRequirement(
  organizationId: string,
  input: RequirementInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = requirementSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }
  const { storeId, businessDate, requiredCount, note } = parsed.data;

  try {
    await assertStoreAccess(session.user.id, organizationId, storeId);

    await db.shiftRequirement.upsert({
      where: { storeId_businessDate: { storeId, businessDate } },
      create: { organizationId, storeId, businessDate, requiredCount, note: note ?? null },
      update: { requiredCount, note: note ?? null },
    });

    revalidatePath("/shifts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "必要人数の設定に失敗しました" };
  }
}
