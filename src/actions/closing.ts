"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdmin, getAccessibleStoreIds } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/auth/audit";
import { z } from "zod";

const createClosingPeriodSchema = z.object({
  name: z.string().min(1, "名前は必須です"),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付形式が不正です"),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付形式が不正です"),
  storeId: z.string().optional(),
});

interface ActionResult {
  success?: boolean;
  error?: string;
  data?: unknown;
}

interface CreateClosingPeriodInput {
  storeId?: string | null;
  name: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
}

/**
 * 締め期間を作成する
 */
export async function createClosingPeriod(
  organizationId: string,
  input: CreateClosingPeriodInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  if (!input.name.trim()) {
    return { error: "締め期間名を入力してください" };
  }
  if (!input.periodStart || !input.periodEnd) {
    return { error: "期間を入力してください" };
  }
  if (input.periodStart > input.periodEnd) {
    return { error: "開始日は終了日より前にしてください" };
  }

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);

    // 店舗アクセス制御
    if (input.storeId) {
      const accessibleIds = await getAccessibleStoreIds(
        ctx.memberId,
        ctx.role,
        organizationId
      );
      if (accessibleIds !== null && !accessibleIds.includes(input.storeId)) {
        return { error: "この店舗へのアクセス権がありません" };
      }

      // 店舗の組織確認
      const store = await db.store.findUnique({
        where: { id: input.storeId },
        select: { organizationId: true },
      });
      if (!store || store.organizationId !== organizationId) {
        return { error: "店舗が見つかりません" };
      }
    }

    const period = await db.closingPeriod.create({
      data: {
        organizationId,
        storeId: input.storeId || null,
        name: input.name.trim(),
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "CLOSING_PERIOD_CLOSE",
      targetType: "ClosingPeriod",
      targetId: period.id,
      after: {
        name: input.name,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        storeId: input.storeId,
      },
    });

    revalidatePath("/closing");
    return { success: true, data: { periodId: period.id } };
  } catch (error: any) {
    if (error.message?.startsWith("FORBIDDEN")) {
      return { error: "権限がありません" };
    }
    return { error: error.message ?? "締め期間の作成に失敗しました" };
  }
}

/**
 * 締め処理を実行する（対象期間の勤怠をロック）
 */
export async function executeClosing(
  organizationId: string,
  closingPeriodId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);

    const closingPeriod = await db.closingPeriod.findUnique({
      where: { id: closingPeriodId },
    });

    if (!closingPeriod) return { error: "締め期間が見つかりません" };
    if (closingPeriod.organizationId !== organizationId) {
      return { error: "権限がありません" };
    }
    if (closingPeriod.closedAt) {
      return { error: "この締め期間はすでに実行済みです" };
    }

    // 店舗アクセス制御
    if (closingPeriod.storeId) {
      const accessibleIds = await getAccessibleStoreIds(
        ctx.memberId,
        ctx.role,
        organizationId
      );
      if (
        accessibleIds !== null &&
        !accessibleIds.includes(closingPeriod.storeId)
      ) {
        return { error: "この店舗へのアクセス権がありません" };
      }
    }

    const { periodStart, periodEnd, storeId } = closingPeriod;

    await db.$transaction(async (tx) => {
      // 対象期間の勤怠をロック
      await tx.attendance.updateMany({
        where: {
          organizationId,
          businessDate: { gte: periodStart, lte: periodEnd },
          ...(storeId ? { storeId } : {}),
          isLocked: false,
        },
        data: {
          isLocked: true,
          lockedAt: new Date(),
          lockedByUserId: session.user!.id,
          closingPeriodId,
        },
      });

      // 締め期間を実行済みにする
      await tx.closingPeriod.update({
        where: { id: closingPeriodId },
        data: {
          closedAt: new Date(),
          closedByUserId: session.user!.id,
        },
      });

      // 監査ログ
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: session.user!.id,
          action: "ATTENDANCE_LOCK",
          targetType: "ClosingPeriod",
          targetId: closingPeriodId,
          after: {
            periodStart,
            periodEnd,
            storeId,
            executedAt: new Date().toISOString(),
          },
        },
      });
    });

    revalidatePath("/closing");
    return { success: true };
  } catch (error: any) {
    if (error.message?.startsWith("FORBIDDEN")) {
      return { error: "権限がありません" };
    }
    return { error: error.message ?? "締め処理に失敗しました" };
  }
}

/**
 * 締め期間内の勤怠をロックする
 * executeClosing と同等の処理を行う（API互換エイリアス）
 */
export async function lockClosingPeriod(
  organizationId: string,
  closingPeriodId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);

    const closingPeriod = await db.closingPeriod.findUnique({
      where: { id: closingPeriodId },
    });

    if (!closingPeriod) return { error: "締め期間が見つかりません" };
    if (closingPeriod.organizationId !== organizationId) {
      return { error: "権限がありません" };
    }
    if (closingPeriod.closedAt) {
      return { error: "この締め期間はすでにロック済みです" };
    }

    // 店舗アクセス制御
    if (closingPeriod.storeId) {
      const accessibleIds = await getAccessibleStoreIds(
        ctx.memberId,
        ctx.role,
        organizationId
      );
      if (
        accessibleIds !== null &&
        !accessibleIds.includes(closingPeriod.storeId)
      ) {
        return { error: "この店舗へのアクセス権がありません" };
      }
    }

    const now = new Date();
    const { periodStart, periodEnd, storeId } = closingPeriod;

    const lockedCount = await db.$transaction(async (tx) => {
      // 対象期間の勤怠をロック
      const { count } = await tx.attendance.updateMany({
        where: {
          organizationId,
          businessDate: { gte: periodStart, lte: periodEnd },
          ...(storeId ? { storeId } : {}),
          isLocked: false,
        },
        data: {
          isLocked: true,
          lockedAt: now,
          lockedByUserId: session.user!.id,
          closingPeriodId,
        },
      });

      // 締め期間を締め済みに更新
      await tx.closingPeriod.update({
        where: { id: closingPeriodId },
        data: {
          closedAt: now,
          closedByUserId: session.user!.id,
        },
      });

      return count;
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "ATTENDANCE_LOCK",
      targetType: "ClosingPeriod",
      targetId: closingPeriodId,
      storeId: storeId ?? undefined,
      after: {
        closedAt: now.toISOString(),
        lockedAttendanceCount: lockedCount,
        periodStart,
        periodEnd,
      },
    });

    revalidatePath("/closing");
    return { success: true, data: { lockedAttendanceCount: lockedCount } };
  } catch (error: any) {
    if (error.message?.startsWith("FORBIDDEN")) {
      return { error: "権限がありません" };
    }
    return { error: error.message ?? "締め処理に失敗しました" };
  }
}

/**
 * 締め期間を削除する（未ロックの場合のみ削除可）
 */
export async function deleteClosingPeriod(
  organizationId: string,
  closingPeriodId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    await requireAdmin(session.user.id, organizationId);

    const closingPeriod = await db.closingPeriod.findUnique({
      where: { id: closingPeriodId },
    });

    if (!closingPeriod) return { error: "締め期間が見つかりません" };
    if (closingPeriod.organizationId !== organizationId) {
      return { error: "権限がありません" };
    }
    if (closingPeriod.closedAt) {
      return {
        error:
          "締め済みの期間は削除できません。勤怠データ保全のため削除は許可されていません。",
      };
    }

    const before = {
      name: closingPeriod.name,
      periodStart: closingPeriod.periodStart,
      periodEnd: closingPeriod.periodEnd,
      storeId: closingPeriod.storeId,
    };

    await db.closingPeriod.delete({
      where: { id: closingPeriodId },
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "CLOSING_PERIOD_CLOSE",
      targetType: "ClosingPeriod",
      targetId: closingPeriodId,
      storeId: closingPeriod.storeId ?? undefined,
      before,
    });

    revalidatePath("/closing");
    return { success: true };
  } catch (error: any) {
    if (error.message?.startsWith("FORBIDDEN")) {
      return { error: "権限がありません" };
    }
    return { error: error.message ?? "締め期間の削除に失敗しました" };
  }
}
