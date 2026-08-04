"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdmin, canAccessStore } from "@/lib/auth/permissions";
import {
  createSlotSchema,
  updateSlotSchema,
  type CreateSlotInput,
  type UpdateSlotInput,
} from "@/lib/validations/shift-slot";
import { createAuditLog } from "@/lib/auth/audit";
import {
  translateShiftSlots,
  validateSlots,
  type TranslatedShiftSlot,
} from "@/lib/ai/shift-slot-translator";

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

/** 時間帯を追加する */
export async function createShiftSlot(
  organizationId: string,
  input: CreateSlotInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = createSlotSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  try {
    await assertStoreAccess(session.user.id, organizationId, parsed.data.storeId);
    await db.shiftSlot.create({
      data: {
        organizationId,
        storeId: parsed.data.storeId,
        name: parsed.data.name,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        sortOrder: parsed.data.sortOrder,
      },
    });
    revalidatePath(`/stores/${parsed.data.storeId}`);
    revalidatePath("/shifts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "時間帯の追加に失敗しました" };
  }
}

/** 時間帯を更新する */
export async function updateShiftSlot(
  organizationId: string,
  input: UpdateSlotInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = updateSlotSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  try {
    const slot = await db.shiftSlot.findFirst({
      where: { id: parsed.data.slotId, organizationId },
      select: { id: true, storeId: true },
    });
    if (!slot) return { error: "時間帯が見つかりません" };

    await assertStoreAccess(session.user.id, organizationId, slot.storeId);
    await db.shiftSlot.update({
      where: { id: parsed.data.slotId },
      data: {
        name: parsed.data.name,
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        sortOrder: parsed.data.sortOrder,
      },
    });
    revalidatePath(`/stores/${slot.storeId}`);
    revalidatePath("/shifts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "更新に失敗しました" };
  }
}

/**
 * 時間帯を削除する（無効化）
 * 過去のシフト・希望との関連を保つため、物理削除せず isActive=false にする
 */
export async function deleteShiftSlot(
  organizationId: string,
  slotId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const slot = await db.shiftSlot.findFirst({
      where: { id: slotId, organizationId },
      select: { id: true, storeId: true },
    });
    if (!slot) return { error: "時間帯が見つかりません" };

    await assertStoreAccess(session.user.id, organizationId, slot.storeId);

    // 最低1つは残す（時間帯ゼロだと希望提出・必要人数が成立しない）
    const activeCount = await db.shiftSlot.count({
      where: { storeId: slot.storeId, isActive: true },
    });
    if (activeCount <= 1) {
      return { error: "時間帯は最低1つ必要です。先に別の時間帯を追加してください。" };
    }

    await db.shiftSlot.update({
      where: { id: slotId },
      data: { isActive: false },
    });
    revalidatePath(`/stores/${slot.storeId}`);
    revalidatePath("/shifts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "削除に失敗しました" };
  }
}

/* ------------------------------------------------------------------ */
/* 日本語で書いた営業時間から時間帯を作る                                 */
/* ------------------------------------------------------------------ */

/**
 * 営業時間の文章を時間帯の候補に変換する（保存はしない）。
 * 保存するかどうかは店長が画面で決める。
 */
export async function translateSlotsFromText(
  organizationId: string,
  storeId: string,
  text: string
): Promise<ActionResult & { slots?: TranslatedShiftSlot[]; summary?: string; caution?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };
  if (!text.trim()) return { error: "営業時間を入力してください" };
  if (text.length > 500) return { error: "入力が長すぎます（500文字まで）" };

  try {
    await assertStoreAccess(session.user.id, organizationId, storeId);
    const result = await translateShiftSlots(text);
    return {
      success: true,
      slots: result.slots,
      summary: result.summary,
      caution: result.caution,
    };
  } catch (error: any) {
    return { error: error.message ?? "読み取りに失敗しました" };
  }
}

/**
 * 読み取った時間帯をまとめて保存する。
 *
 * 既存の時間帯は「使わない」状態にするだけで消さない。
 * シフト希望・必要人数・確定シフトが紐づいているため、消すと過去がたどれなくなる。
 */
export async function replaceShiftSlots(
  organizationId: string,
  storeId: string,
  slots: { name: string; startTime: string; endTime: string }[]
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const invalid = validateSlots(
    slots.map((s) => ({ ...s, note: "" }))
  );
  if (invalid) return { error: invalid };

  try {
    await assertStoreAccess(session.user.id, organizationId, storeId);

    const before = await db.shiftSlot.findMany({
      where: { storeId, isActive: true },
      select: { id: true, name: true, startTime: true, endTime: true },
    });

    await db.$transaction(async (tx) => {
      // 過去のデータが紐づくので無効化にとどめる
      await tx.shiftSlot.updateMany({
        where: { storeId, isActive: true },
        data: { isActive: false },
      });
      await tx.shiftSlot.createMany({
        data: slots.map((s, i) => ({
          organizationId,
          storeId,
          name: s.name,
          startTime: s.startTime,
          endTime: s.endTime,
          sortOrder: i,
        })),
      });
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "SHIFT_SLOT_REPLACE",
      targetType: "Store",
      targetId: storeId,
      before: { slots: before },
      after: { slots },
    });

    revalidatePath(`/stores/${storeId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "保存に失敗しました" };
  }
}
