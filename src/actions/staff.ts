"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/auth/audit";
import {
  requireAdmin,
  requireOwner,
  canAccessStore,
  requireStaffAccess,
  requireStaffStoreScope,
  requireStaffEmailEditPermission,
  validateOrgStoreIds,
} from "@/lib/auth/permissions";
import {
  createStaffSchema,
  updateStaffSchema,
  updateStaffEmailSchema,
  staffStoreSchema,
  wageHistorySchema,
  transportationSchema,
  type CreateStaffInput,
  type StaffStoreInput,
  type WageHistoryInput,
  type TransportationInput,
} from "@/lib/validations/staff";
import { nanoid } from "nanoid";
import { sendStaffInvitationEmail, sendVerificationEmail } from "@/lib/email";
import bcrypt from "bcryptjs";
import { addDays, addHours } from "date-fns";
import { getAppUrl } from "@/lib/app-url";

interface ActionResult {
  success?: boolean;
  error?: string;
  data?: unknown;
}

/**
 * スタッフを追加する（招待メールなし）
 */
export async function addStaff(
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
    await requireAdmin(session.user.id, organizationId);

    // 既存スタッフチェック（メールがある場合のみ）
    if (parsed.data.email) {
      const existing = await db.staff.findFirst({
        where: { organizationId, email: parsed.data.email },
      });
      if (existing) {
        return { error: "このメールアドレスはすでに登録されています" };
      }
    }

    const staff = await db.$transaction(async (tx) => {
      const staff = await tx.staff.create({
        data: {
          organizationId,
          ...parsed.data,
          status: "ACTIVE",
        },
      });

      if (input.storeId) {
        await tx.staffStore.create({
          data: {
            staffId: staff.id,
            storeId: input.storeId,
            startDate: new Date(),
            isPrimary: true,
            canClock: true,
          },
        });
      }

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

    revalidatePath("/staff");
    return { success: true, data: { staffId: staff.id } };
  } catch (error: any) {
    return { error: error.message ?? "スタッフの追加に失敗しました" };
  }
}

/**
 * 既存スタッフに招待メールを送る
 */
/**
 * スタッフに招待メールを送る。
 *
 * `options.role` に "ADMIN" を渡すと、本人が登録した時点で管理者として組織に参加する。
 * ただし **管理者を生やせるのはオーナーだけ**。ADMIN が別の ADMIN を作れてしまうと
 * 権限の境界が崩れるため、ロール指定があるときだけ requireOwner に切り替える。
 *
 * 招待した時点では相手のアカウントがまだ無いので、意図したロールと担当店舗は
 * Staff に持たせておき、受諾時（acceptStaffInvitation）に反映してクリアする。
 */
export async function sendStaffInvitation(
  organizationId: string,
  staffId: string,
  options?: { role?: "ADMIN"; storeIds?: string[] }
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const wantsAdmin = options?.role === "ADMIN";

  try {
    // 通常の招待は管理者でも送れる。管理者として招待する場合だけオーナーに限定する
    if (wantsAdmin) {
      await requireOwner(session.user.id, organizationId);
    } else {
      await requireAdmin(session.user.id, organizationId);
    }
    // 担当外の店舗のスタッフには招待を送らせない
    await requireStaffAccess(session.user.id, organizationId, staffId);

    // 担当店舗は自組織のものに限る（他組織の店舗IDを混ぜられるのを防ぐ）
    const validatedStoreIds = wantsAdmin
      ? await validateOrgStoreIds(organizationId, options?.storeIds ?? [])
      : [];
    if ("error" in validatedStoreIds) return { error: validatedStoreIds.error };

    const staff = await db.staff.findUnique({
      where: { id: staffId, organizationId },
      select: {
        id: true,
        email: true,
        displayName: true,
        staffStores: {
          where: { isActive: true },
          orderBy: [{ isPrimary: "desc" }, { startDate: "asc" }],
          take: 1,
          select: { store: { select: { name: true } } },
        },
      },
    });

    if (!staff) {
      return { error: "スタッフが見つかりません" };
    }

    if (!staff.email) {
      return { error: "このスタッフにはメールアドレスが登録されていません" };
    }

    // 招待し直したときに前回の指定が残らないよう、毎回上書きする
    await db.staff.update({
      where: { id: staffId, organizationId },
      data: {
        invitedRole: wantsAdmin ? "ADMIN" : null,
        invitedStoreIds: wantsAdmin ? validatedStoreIds : [],
      },
    });

    const inviteToken = nanoid(32);

    // 既存トークンを削除して新しいトークンを作成
    await db.verificationToken.deleteMany({
      where: {
        identifier: staff.email,
        type: "EMAIL_VERIFICATION",
      },
    });

    await db.verificationToken.create({
      data: {
        identifier: staff.email,
        token: inviteToken,
        expires: addDays(new Date(), 7),
        type: "EMAIL_VERIFICATION",
      },
    });

    const inviterUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });

    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    // 主たる所属店舗があれば文面に添える (未所属なら省略する)
    const primaryStore = staff.staffStores[0]?.store.name;
    const APP_URL = getAppUrl();

    await sendStaffInvitationEmail({
      to: staff.email,
      staffName: staff.displayName,
      organizationName: org?.name ?? "",
      storeName: primaryStore,
      inviterName: inviterUser?.name ?? undefined,
      invitationUrl: `${APP_URL}/invite/staff?token=${inviteToken}&email=${encodeURIComponent(staff.email)}`,
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "MEMBER_INVITE",
      targetType: "Staff",
      targetId: staff.id,
      after: {
        email: staff.email,
        role: wantsAdmin ? "ADMIN" : "MEMBER",
        storeIds: wantsAdmin
          ? validatedStoreIds.length > 0
            ? validatedStoreIds
            : "ALL"
          : undefined,
      },
    });

    revalidatePath("/staff/[id]", "page");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "招待メールの送信に失敗しました" };
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

  // 型だけでは実行時の不正な属性 (email / status / organizationId 等) を防げないため
  // スキーマで許可された項目のみに絞り込む
  const parsed = updateStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  try {
    await requireAdmin(session.user.id, organizationId);
    // 担当外の店舗のスタッフは操作させない
    await requireStaffAccess(session.user.id, organizationId, staffId);

    const before = await db.staff.findUnique({ where: { id: staffId } });
    const updated = await db.staff.update({
      where: { id: staffId, organizationId },
      data: parsed.data,
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
 * スタッフのメールアドレスを変更する
 *
 * 変更できるのは本人・組織オーナー・該当店舗の店舗管理者のみ
 * (基本情報の更新とは権限が異なるため updateStaff とは経路を分ける)
 *
 * ログイン可能なスタッフ (User 紐付けあり) の場合はログインIDも同時に変更し、
 * 新しいアドレスの確認が済むまでログインできない状態に戻す。
 */
export async function updateStaffEmail(
  organizationId: string,
  staffId: string,
  email: string | null
): Promise<ActionResult & { requiresReverification?: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = updateStaffEmailSchema.safeParse({ email });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }
  const nextEmail = parsed.data.email;

  try {
    await requireStaffEmailEditPermission(
      session.user.id,
      organizationId,
      staffId
    );

    const staff = await db.staff.findFirst({
      where: { id: staffId, organizationId },
      select: {
        id: true,
        userId: true,
        email: true,
        displayName: true,
      },
    });

    if (!staff) return { error: "スタッフが見つかりません" };
    if (staff.email === nextEmail) return { success: true };

    // 組織内の重複チェック (Staff は organizationId + email が一意)
    if (nextEmail) {
      const duplicated = await db.staff.findFirst({
        where: { organizationId, email: nextEmail, id: { not: staffId } },
        select: { id: true },
      });
      if (duplicated) {
        return {
          error: "このメールアドレスは組織内の別のスタッフが使用しています",
        };
      }
    }

    const linkedUserId = staff.userId;

    // ログイン可能なスタッフはメールアドレスがログインIDを兼ねるため未設定にできない
    if (linkedUserId && !nextEmail) {
      return {
        error:
          "ログインアカウントに紐づくスタッフのメールアドレスは未設定にできません",
      };
    }

    if (linkedUserId && nextEmail) {
      const duplicatedUser = await db.user.findFirst({
        where: { email: nextEmail, id: { not: linkedUserId } },
        select: { id: true },
      });
      if (duplicatedUser) {
        return {
          error: "このメールアドレスは既に別のアカウントで使用されています",
        };
      }
    }

    const verificationToken = linkedUserId ? nanoid(32) : null;

    await db.$transaction(async (tx) => {
      await tx.staff.update({
        where: { id: staffId, organizationId },
        data: { email: nextEmail },
      });

      if (linkedUserId && nextEmail && verificationToken) {
        // ログインIDを変更し、新しいアドレスの確認が済むまで未認証に戻す
        await tx.user.update({
          where: { id: linkedUserId },
          data: { email: nextEmail, emailVerified: null },
        });

        await tx.verificationToken.deleteMany({
          where: { identifier: nextEmail, type: "EMAIL_VERIFICATION" },
        });
        await tx.verificationToken.create({
          data: {
            identifier: nextEmail,
            token: verificationToken,
            expires: addHours(new Date(), 24),
            type: "EMAIL_VERIFICATION",
          },
        });
      }
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "STAFF_UPDATE",
      targetType: "Staff",
      targetId: staffId,
      staffId,
      before: { email: staff.email },
      after: { email: nextEmail },
      reason: "メールアドレス変更",
      metadata: { loginIdChanged: !!linkedUserId },
    });

    if (linkedUserId && nextEmail && verificationToken) {
      await sendVerificationEmail(
        nextEmail,
        staff.displayName,
        verificationToken
      );
    }

    revalidatePath(`/staff/${staffId}`);
    revalidatePath("/account");
    return { success: true, requiresReverification: !!linkedUserId };
  } catch (error: any) {
    return { error: error.message ?? "メールアドレスの変更に失敗しました" };
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
    // 担当外の店舗のスタッフは操作させない
    await requireStaffAccess(session.user.id, organizationId, staffId);

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
 * 管理者がスタッフのPINを設定/リセットする
 */
export async function setStaffPin(
  organizationId: string,
  staffId: string,
  storeId: string,
  pin: string | null
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);
    const hasAccess = await canAccessStore(ctx.memberId, ctx.role, storeId);
    if (!hasAccess) return { error: "この店舗へのアクセス権がありません" };

    if (pin !== null) {
      if (!/^\d{4,8}$/.test(pin)) {
        return { error: "PINは4〜8桁の数字で設定してください" };
      }
      const pinHash = await bcrypt.hash(pin, 10);
      await db.staffStore.update({
        where: { staffId_storeId: { staffId, storeId } },
        data: {
          pinHash,
          pinFailCount: 0,
          pinLockedUntil: null,
        },
      });
    } else {
      await db.staffStore.update({
        where: { staffId_storeId: { staffId, storeId } },
        data: {
          pinHash: null,
          pinFailCount: 0,
          pinLockedUntil: null,
        },
      });
    }

    revalidatePath(`/staff/${staffId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "PINの設定に失敗しました" };
  }
}

/**
 * スタッフのPIN必須設定を更新する
 */
export async function updateStaffStoreRequirePin(
  organizationId: string,
  staffId: string,
  storeId: string,
  requirePin: boolean
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);
    const hasAccess = await canAccessStore(ctx.memberId, ctx.role, storeId);
    if (!hasAccess) return { error: "この店舗へのアクセス権がありません" };

    await db.staffStore.update({
      where: { staffId_storeId: { staffId, storeId } },
      data: { requirePin },
    });

    revalidatePath(`/staff/${staffId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "PIN必須設定の変更に失敗しました" };
  }
}

/**
 * スタッフを打刻の位置チェックから外す設定を更新する
 *
 * リモート出勤（在宅のキャスト等）は店舗にいないことが正常なので、
 * 位置が離れていることを異常として扱わない。
 * 打刻をブロックする仕組みではないため、これは「フラグを立てない」設定。
 */
export async function updateStaffStoreSkipLocationCheck(
  organizationId: string,
  staffId: string,
  storeId: string,
  skipLocationCheck: boolean
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);
    const hasAccess = await canAccessStore(ctx.memberId, ctx.role, storeId);
    if (!hasAccess) return { error: "この店舗へのアクセス権がありません" };

    await db.staffStore.update({
      where: { staffId_storeId: { staffId, storeId } },
      data: { skipLocationCheck },
    });

    revalidatePath(`/staff/${staffId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "位置チェック設定の変更に失敗しました" };
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
    // staffStoreId は入力から来るので、自組織かつ担当店舗のものか必ず検証する
    // （検証しないと他組織の所属に時給を書き込めてしまう）
    await requireStaffStoreScope(
      session.user.id,
      organizationId,
      parsed.data.staffStoreId
    );

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
    // 時給と同じく staffStoreId は入力由来なので必ず検証する
    await requireStaffStoreScope(
      session.user.id,
      organizationId,
      parsed.data.staffStoreId
    );

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
