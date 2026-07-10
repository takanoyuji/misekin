"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/auth/audit";
import { requireAdmin, canAccessStore } from "@/lib/auth/permissions";
import {
  createStaffSchema,
  updateStaffSchema,
  staffStoreSchema,
  wageHistorySchema,
  transportationSchema,
  type CreateStaffInput,
  type StaffStoreInput,
  type WageHistoryInput,
  type TransportationInput,
} from "@/lib/validations/staff";
import { nanoid } from "nanoid";
import { sendStaffInvitationEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import { addDays } from "date-fns";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

interface ActionResult {
  success?: boolean;
  error?: string;
  data?: unknown;
}

/**
 * スタッフを招待する
 */
export async function inviteStaff(
  organizationId: string,
  input: CreateStaffInput & { storeId?: string }
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = createStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);

    // 既存スタッフチェック
    const existing = await db.staff.findFirst({
      where: { organizationId, email: parsed.data.email },
    });
    if (existing) {
      return { error: "このメールアドレスはすでに登録されています" };
    }

    const inviteToken = nanoid(32);

    const staff = await db.$transaction(async (tx) => {
      const staff = await tx.staff.create({
        data: {
          organizationId,
          ...parsed.data,
          status: "INVITED",
        },
      });

      // 招待トークンを発行
      await tx.verificationToken.create({
        data: {
          identifier: parsed.data.email,
          token: inviteToken,
          expires: addDays(new Date(), 7),
          type: "EMAIL_VERIFICATION",
        },
      });

      return staff;
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "STAFF_CREATE",
      targetType: "Staff",
      targetId: staff.id,
      staffId: staff.id,
      after: { email: staff.email, displayName: staff.displayName },
    });

    const inviterUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });

    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    await sendStaffInvitationEmail({
      to: parsed.data.email,
      staffName: parsed.data.displayName,
      organizationName: org?.name ?? "",
      storeName: "",
      inviterName: inviterUser?.name ?? "",
      invitationUrl: `${APP_URL}/invite/staff?token=${inviteToken}&email=${encodeURIComponent(parsed.data.email)}`,
    });

    revalidatePath("/staff");
    return { success: true, data: { staffId: staff.id } };
  } catch (error: any) {
    return { error: error.message ?? "スタッフの招待に失敗しました" };
  }
}

/**
 * スタッフ情報を更新する
 */
export async function updateStaff(
  organizationId: string,
  staffId: string,
  input: Partial<Omit<CreateStaffInput, "email">>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    await requireAdmin(session.user.id, organizationId);

    const before = await db.staff.findUnique({ where: { id: staffId } });
    const updated = await db.staff.update({
      where: { id: staffId, organizationId },
      data: input,
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "STAFF_UPDATE",
      targetType: "Staff",
      targetId: staffId,
      staffId,
      before,
      after: updated,
    });

    revalidatePath(`/staff/${staffId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "更新に失敗しました" };
  }
}

/**
 * スタッフの在籍状態を変更する
 */
export async function updateStaffStatus(
  organizationId: string,
  staffId: string,
  status: "ACTIVE" | "ON_LEAVE" | "RESIGNED" | "SUSPENDED",
  resignDate?: Date
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    await requireAdmin(session.user.id, organizationId);

    const before = await db.staff.findUnique({
      where: { id: staffId },
      select: { status: true, resignDate: true },
    });

    await db.staff.update({
      where: { id: staffId, organizationId },
      data: {
        status,
        resignDate: status === "RESIGNED" ? (resignDate ?? new Date()) : undefined,
      },
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "STAFF_STATUS_CHANGE",
      targetType: "Staff",
      targetId: staffId,
      staffId,
      before,
      after: { status, resignDate },
    });

    revalidatePath(`/staff/${staffId}`);
    revalidatePath("/staff");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "ステータス変更に失敗しました" };
  }
}

/**
 * スタッフを店舗に所属させる
 */
export async function assignStaffToStore(
  organizationId: string,
  input: StaffStoreInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);
    const hasAccess = await canAccessStore(ctx.memberId, ctx.role, input.storeId);
    if (!hasAccess) return { error: "この店舗へのアクセス権がありません" };

    await db.staffStore.upsert({
      where: {
        staffId_storeId: { staffId: input.staffId, storeId: input.storeId },
      },
      create: {
        staffId: input.staffId,
        storeId: input.storeId,
        startDate: input.startDate,
        endDate: input.endDate,
        isPrimary: input.isPrimary,
        canClock: input.canClock,
      },
      update: {
        startDate: input.startDate,
        endDate: input.endDate,
        isPrimary: input.isPrimary,
        canClock: input.canClock,
        isActive: true,
      },
    });

    revalidatePath(`/staff/${input.staffId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "店舗所属の設定に失敗しました" };
  }
}

/**
 * スタッフのPINを設定する
 */
export async function setStaffPin(
  organizationId: string,
  staffId: string,
  storeId: string,
  pin: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  if (!/^\d{4,8}$/.test(pin)) {
    return { error: "PINは4〜8桁の数字で設定してください" };
  }

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);
    const hasAccess = await canAccessStore(ctx.memberId, ctx.role, storeId);
    if (!hasAccess) return { error: "この店舗へのアクセス権がありません" };

    const pinHash = await bcrypt.hash(pin, 10);

    await db.staffStore.update({
      where: { staffId_storeId: { staffId, storeId } },
      data: {
        pinHash,
        pinFailCount: 0,
        pinLockedUntil: null,
      },
    });

    revalidatePath(`/staff/${staffId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "PINの設定に失敗しました" };
  }
}

/**
 * 時給履歴を追加する
 */
export async function addWageHistory(
  organizationId: string,
  input: WageHistoryInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = wageHistorySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  try {
    await requireAdmin(session.user.id, organizationId);

    // 既存の有効期限なし時給を終了させる
    if (!parsed.data.effectiveTo) {
      await db.wageHistory.updateMany({
        where: {
          staffStoreId: parsed.data.staffStoreId,
          effectiveTo: null,
        },
        data: {
          effectiveTo: parsed.data.effectiveFrom,
        },
      });
    }

    const wageHistory = await db.wageHistory.create({
      data: {
        staffStoreId: parsed.data.staffStoreId,
        amount: parsed.data.amount,
        effectiveFrom: parsed.data.effectiveFrom,
        effectiveTo: parsed.data.effectiveTo,
        createdByUserId: session.user.id,
        reason: parsed.data.reason,
      },
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "WAGE_HISTORY_CREATE",
      targetType: "WageHistory",
      targetId: wageHistory.id,
      after: wageHistory,
    });

    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "時給の設定に失敗しました" };
  }
}

/**
 * 交通費設定を追加する
 */
export async function addTransportationHistory(
  organizationId: string,
  input: TransportationInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = transportationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  try {
    await requireAdmin(session.user.id, organizationId);

    // 既存の有効期限なし設定を終了させる
    await db.transportationHistory.updateMany({
      where: {
        staffStoreId: parsed.data.staffStoreId,
        effectiveTo: null,
      },
      data: { effectiveTo: parsed.data.effectiveFrom },
    });

    await db.transportationHistory.create({
      data: {
        staffStoreId: parsed.data.staffStoreId,
        type: parsed.data.type,
        amount: parsed.data.amount,
        monthlyLimit: parsed.data.monthlyLimit,
        effectiveFrom: parsed.data.effectiveFrom,
        effectiveTo: parsed.data.effectiveTo,
        notes: parsed.data.notes,
      },
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "TRANSPORTATION_HISTORY_CREATE",
      targetType: "TransportationHistory",
    });

    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "交通費の設定に失敗しました" };
  }
}
