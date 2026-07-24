"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { availabilitySchema, type AvailabilityInput } from "@/lib/validations/shift";

interface ActionResult {
  success?: boolean;
  error?: string;
}

/** "HH:mm" を営業日の UTC Date に変換する（店舗TZ基準） */
function toDateTime(
  businessDate: string,
  time: string | null | undefined
): Date | null {
  if (!time) return null;
  // 保存はUTC。ここでは営業日+時刻をそのままISOとして解釈する簡易版。
  // （店舗TZの厳密変換は表示側で吸収。希望時間は目安のため許容）
  return new Date(`${businessDate}T${time}:00`);
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
  const { storeId, businessDate, type, startTime, endTime, note } = parsed.data;

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

    const start = type === "UNAVAILABLE" ? null : toDateTime(businessDate, startTime);
    const end = type === "UNAVAILABLE" ? null : toDateTime(businessDate, endTime);

    await db.shiftAvailability.upsert({
      where: {
        staffId_storeId_businessDate: {
          staffId: staffStore.staffId,
          storeId,
          businessDate,
        },
      },
      create: {
        organizationId: staffStore.staff.organizationId,
        storeId,
        staffId: staffStore.staffId,
        businessDate,
        type,
        startAt: start,
        endAt: end,
        note: note ?? null,
      },
      update: {
        type,
        startAt: start,
        endAt: end,
        note: note ?? null,
      },
    });

    revalidatePath("/my-shifts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "希望の提出に失敗しました" };
  }
}

/** 提出済みの希望を取り消す */
export async function deleteAvailability(
  storeId: string,
  businessDate: string
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
      where: { staffId: staffStore.staffId, storeId, businessDate },
    });

    revalidatePath("/my-shifts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "取り消しに失敗しました" };
  }
}
