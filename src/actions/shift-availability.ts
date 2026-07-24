"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { availabilitySchema, type AvailabilityInput } from "@/lib/validations/shift";

interface ActionResult {
  success?: boolean;
  error?: string;
}

/**
 * 自分の勤務希望を提出する（1営業日ぶき、提出済みなら上書き）
 */
export async function submitAvailability(
  input: AvailabilityInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }
  const { storeId, slotId, businessDate, type, note } = parsed.data;

  try {
    // 自分が所属している店舗のみ
    const staffStore = await db.staffStore.findFirst({
      where: { storeId, isActive: true, staff: { userId: session.user.id } },
      select: {
        staffId: true,
        staff: { select: { organizationId: true } },
      },
    });
    if (!staffStore) {
      return { error: "所属していない店舗には希望を出せません" };
    }

    // 時間帯が店舗のものか確認
    const slot = await db.shiftSlot.findFirst({
      where: { id: slotId, storeId, isActive: true },
      select: { id: true },
    });
    if (!slot) return { error: "時間帯が見つかりません" };

    await db.shiftAvailability.upsert({
      where: {
        staffId_storeId_businessDate_slotId: {
          staffId: staffStore.staffId,
          storeId,
          businessDate,
          slotId,
        },
      },
      create: {
        organizationId: staffStore.staff.organizationId,
        storeId,
        slotId,
        staffId: staffStore.staffId,
        businessDate,
        type,
        note: note ?? null,
      },
      update: {
        type,
        note: note ?? null,
      },
    });

    revalidatePath("/my-shifts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "希望の提出に失敗しました" };
  }
}

/** 提出済みの希望を取り消す（1営業日・1時間帯） */
export async function deleteAvailability(
  storeId: string,
  businessDate: string,
  slotId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const staffStore = await db.staffStore.findFirst({
      where: { storeId, isActive: true, staff: { userId: session.user.id } },
      select: { staffId: true },
    });
    if (!staffStore) return { error: "権限がありません" };

    await db.shiftAvailability.deleteMany({
      where: { staffId: staffStore.staffId, storeId, businessDate, slotId },
    });

    revalidatePath("/my-shifts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "取り消しに失敗しました" };
  }
}
