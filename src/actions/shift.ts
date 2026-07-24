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
import {
  solveShifts,
  type SolverRule,
} from "@/lib/ai/shift-solver";

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

/**
 * 指定店舗・週のシフトを自動生成する（設計A→C）
 *
 * 必要人数・希望・ルールをソルバーに渡し、割当て結果から下書きシフトを作る。
 * 既存の下書きは置き換える（公開済みは残す）。生成後は管理者が確認・修正してから公開する。
 * 割当ての時刻は希望に無いため、渡された既定時刻で埋める。
 */
export async function generateShifts(
  organizationId: string,
  storeId: string,
  from: string,
  to: string,
  defaultStartTime: string, // "HH:mm"
  defaultEndTime: string
): Promise<ActionResult & { message?: string; unmetDays?: number }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  if (
    !/^\d{2}:\d{2}$/.test(defaultStartTime) ||
    !/^\d{2}:\d{2}$/.test(defaultEndTime)
  ) {
    return { error: "時刻の形式が不正です" };
  }

  try {
    await assertStoreAccess(session.user.id, organizationId, storeId);

    // 対象日リスト
    const days: string[] = [];
    {
      let cur = from;
      for (let i = 0; i < 62 && cur <= to; i++) {
        days.push(cur);
        const d = new Date(`${cur}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + 1);
        cur = d.toISOString().slice(0, 10);
      }
    }

    const [staffStores, availabilities, requirements, rules] =
      await Promise.all([
        db.staffStore.findMany({
          where: { storeId, isActive: true, staff: { status: "ACTIVE" } },
          select: { staffId: true },
        }),
        db.shiftAvailability.findMany({
          where: { storeId, businessDate: { gte: from, lte: to } },
          select: { staffId: true, businessDate: true, type: true },
        }),
        db.shiftRequirement.findMany({
          where: { storeId, businessDate: { gte: from, lte: to } },
          select: { businessDate: true, requiredCount: true },
        }),
        db.shiftRule.findMany({
          where: { storeId, enabled: true },
          select: { ruleType: true, weight: true, params: true },
        }),
      ]);

    const staffIds = staffStores.map((s) => s.staffId);
    if (staffIds.length === 0) {
      return { error: "この店舗に所属するスタッフがいません" };
    }

    // ルールを solver 形式に変換（評価可能なタイプのみ）
    const solverRules: SolverRule[] = [];
    for (const r of rules) {
      const p = (r.params ?? {}) as Record<string, unknown>;
      if (r.ruleType === "SPACING" && typeof p.minGapDays === "number") {
        solverRules.push({
          ruleType: "SPACING",
          weight: r.weight,
          minGapDays: p.minGapDays,
        });
      } else if (
        r.ruleType === "MAX_SHIFTS_PER_WEEK" &&
        typeof p.maxPerWeek === "number"
      ) {
        solverRules.push({
          ruleType: "MAX_SHIFTS_PER_WEEK",
          weight: r.weight,
          maxPerWeek: p.maxPerWeek,
        });
      } else if (
        r.ruleType === "MIN_SHIFTS_PER_WEEK" &&
        typeof p.minPerWeek === "number"
      ) {
        solverRules.push({
          ruleType: "MIN_SHIFTS_PER_WEEK",
          weight: r.weight,
          minPerWeek: p.minPerWeek,
        });
      }
    }

    const result = await solveShifts({
      days,
      staffIds,
      availabilities,
      requirements,
      rules: solverRules,
    });

    if (result.status === "NO_REQUIREMENT") {
      return { error: result.message };
    }
    if (result.status === "INFEASIBLE") {
      return { error: result.message };
    }

    // 時刻を Date に変換（日跨ぎは翌日）
    function toShiftTimes(dateStr: string): { start: Date; end: Date } {
      const start = new Date(`${dateStr}T${defaultStartTime}:00`);
      let end = new Date(`${dateStr}T${defaultEndTime}:00`);
      if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      return { start, end };
    }

    await db.$transaction(async (tx) => {
      // 既存の下書きだけを消して置き換える（公開済みは温存）
      await tx.shift.deleteMany({
        where: {
          organizationId,
          storeId,
          status: "DRAFT",
          businessDate: { gte: from, lte: to },
        },
      });

      // 公開済みで既に割当てのある (staff,date) は重複を避けて除外
      const published = await tx.shift.findMany({
        where: {
          storeId,
          status: "PUBLISHED",
          businessDate: { gte: from, lte: to },
        },
        select: { staffId: true, businessDate: true },
      });
      const publishedKey = new Set(
        published.map((p) => `${p.staffId}_${p.businessDate}`)
      );

      const toCreate = result.assignments
        .filter((a) => !publishedKey.has(`${a.staffId}_${a.businessDate}`))
        .map((a) => {
          const { start, end } = toShiftTimes(a.businessDate);
          return {
            organizationId,
            storeId,
            staffId: a.staffId,
            businessDate: a.businessDate,
            startAt: start,
            endAt: end,
            status: "DRAFT" as const,
            createdByUserId: session.user!.id,
          };
        });

      if (toCreate.length > 0) {
        await tx.shift.createMany({ data: toCreate });
      }
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "ATTENDANCE_MODIFY",
      targetType: "Shift",
      storeId,
      reason: `シフト自動生成 (${from}〜${to}, ${result.assignments.length}件)`,
      metadata: { status: result.status, unmet: result.unmet.length },
    });

    revalidatePath("/shifts");
    return {
      success: true,
      message: result.message,
      unmetDays: result.unmet.length,
    };
  } catch (error: any) {
    return { error: error.message ?? "自動生成に失敗しました" };
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
