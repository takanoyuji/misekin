"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/auth/audit";
import { requireAdmin, canAccessStore } from "@/lib/auth/permissions";

interface ActionResult {
  success?: boolean;
  error?: string;
}

const createRequestSchema = z.object({
  staffStoreId: z.string().cuid(),
  requestedType: z.enum(["PER_SHIFT", "MONTHLY", "NONE"]),
  requestedAmount: z.number().min(0, "金額は0以上で入力してください").max(1_000_000),
  requestedLimit: z.number().min(0).max(1_000_000).optional().nullable(),
  reason: z
    .string()
    .trim()
    .min(1, "申請理由を入力してください")
    .max(500, "申請理由は500文字以内で入力してください"),
});

export type CreateTransportationRequestInput = z.infer<
  typeof createRequestSchema
>;

/**
 * 交通費の変更を申請する (スタッフ本人)
 *
 * 本人は交通費を直接変更できない。この申請を管理者が承認して初めて反映される。
 */
export async function createTransportationChangeRequest(
  input: CreateTransportationRequestInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = createRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }
  const { staffStoreId, requestedType, requestedAmount, requestedLimit, reason } =
    parsed.data;

  try {
    // 自分の所属店舗であることを確認する (他人の交通費は申請できない)
    const staffStore = await db.staffStore.findFirst({
      where: { id: staffStoreId, staff: { userId: session.user.id } },
      select: {
        id: true,
        staffId: true,
        staff: { select: { organizationId: true } },
        transportationHistories: {
          orderBy: { effectiveFrom: "desc" },
          take: 1,
          select: { type: true, amount: true },
        },
      },
    });

    if (!staffStore) {
      return { error: "対象の所属店舗が見つかりません" };
    }

    // 同じ所属店舗に審査中の申請が残っている場合は二重申請させない
    const pending = await db.transportationChangeRequest.findFirst({
      where: { staffStoreId, status: "PENDING" },
      select: { id: true },
    });
    if (pending) {
      return {
        error: "この店舗の交通費は既に申請中です。承認または却下をお待ちください",
      };
    }

    const current = staffStore.transportationHistories[0];

    const created = await db.transportationChangeRequest.create({
      data: {
        staffStoreId,
        staffId: staffStore.staffId,
        status: "PENDING",
        currentType: current?.type ?? null,
        currentAmount: current?.amount ?? null,
        requestedType,
        requestedAmount,
        requestedLimit: requestedLimit ?? null,
        reason,
      },
      select: { id: true },
    });

    await createAuditLog({
      organizationId: staffStore.staff.organizationId,
      actorUserId: session.user.id,
      action: "TRANSPORTATION_HISTORY_CREATE",
      targetType: "TransportationChangeRequest",
      targetId: created.id,
      staffId: staffStore.staffId,
      after: { requestedType, requestedAmount, requestedLimit },
      reason: "交通費の変更申請",
    });

    revalidatePath("/my-stores");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "申請に失敗しました" };
  }
}

/**
 * 交通費の変更申請を取り下げる (申請者本人のみ)
 */
export async function cancelTransportationChangeRequest(
  requestId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const request = await db.transportationChangeRequest.findFirst({
      where: { id: requestId, staff: { userId: session.user.id } },
      select: { id: true, status: true },
    });

    if (!request) return { error: "申請が見つかりません" };
    if (request.status !== "PENDING") {
      return { error: "審査済みの申請は取り下げできません" };
    }

    await db.transportationChangeRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED" },
    });

    revalidatePath("/my-stores");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "取り下げに失敗しました" };
  }
}

/**
 * 交通費の変更申請を承認する (管理者)
 *
 * 承認時に交通費履歴を新規作成する。過去の履歴は上書きしない。
 */
export async function approveTransportationChangeRequest(
  organizationId: string,
  requestId: string,
  reviewNotes?: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);

    const request = await db.transportationChangeRequest.findFirst({
      where: { id: requestId, staff: { organizationId } },
      select: {
        id: true,
        status: true,
        staffId: true,
        staffStoreId: true,
        requestedType: true,
        requestedAmount: true,
        requestedLimit: true,
        currentType: true,
        currentAmount: true,
        staffStore: { select: { storeId: true } },
      },
    });

    if (!request) return { error: "申請が見つかりません" };
    if (request.status !== "PENDING") {
      return { error: "この申請は既に処理されています" };
    }

    // 店舗スコープを持つ管理者は担当店舗の申請のみ承認できる
    const allowed = await canAccessStore(
      ctx.memberId,
      ctx.role,
      request.staffStore.storeId
    );
    if (!allowed) {
      return { error: "この店舗の申請を承認する権限がありません" };
    }

    const effectiveFrom = new Date();

    await db.$transaction(async (tx) => {
      // 現在有効な履歴に終了日を入れてから新しい履歴を作る (上書きしない)
      await tx.transportationHistory.updateMany({
        where: { staffStoreId: request.staffStoreId, effectiveTo: null },
        data: { effectiveTo: effectiveFrom },
      });

      await tx.transportationHistory.create({
        data: {
          staffStoreId: request.staffStoreId,
          type: request.requestedType,
          amount: request.requestedAmount,
          monthlyLimit: request.requestedLimit,
          effectiveFrom,
          notes: "交通費変更申請の承認による",
        },
      });

      await tx.transportationChangeRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          reviewedByUserId: session.user!.id,
          reviewedAt: effectiveFrom,
          reviewNotes: reviewNotes ?? null,
        },
      });
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "TRANSPORTATION_HISTORY_CREATE",
      targetType: "TransportationChangeRequest",
      targetId: requestId,
      staffId: request.staffId,
      storeId: request.staffStore.storeId,
      before: {
        type: request.currentType,
        amount: request.currentAmount,
      },
      after: {
        type: request.requestedType,
        amount: request.requestedAmount,
        monthlyLimit: request.requestedLimit,
      },
      reason: "交通費変更申請の承認",
    });

    revalidatePath("/correction-requests");
    revalidatePath("/my-stores");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "承認に失敗しました" };
  }
}

/**
 * 交通費の変更申請を却下する (管理者)
 */
export async function rejectTransportationChangeRequest(
  organizationId: string,
  requestId: string,
  reviewNotes: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  if (!reviewNotes?.trim()) {
    return { error: "却下理由を入力してください" };
  }

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);

    const request = await db.transportationChangeRequest.findFirst({
      where: { id: requestId, staff: { organizationId } },
      select: {
        id: true,
        status: true,
        staffId: true,
        staffStore: { select: { storeId: true } },
      },
    });

    if (!request) return { error: "申請が見つかりません" };
    if (request.status !== "PENDING") {
      return { error: "この申請は既に処理されています" };
    }

    const allowed = await canAccessStore(
      ctx.memberId,
      ctx.role,
      request.staffStore.storeId
    );
    if (!allowed) {
      return { error: "この店舗の申請を処理する権限がありません" };
    }

    await db.transportationChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        reviewedByUserId: session.user.id,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes.trim(),
      },
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "TRANSPORTATION_HISTORY_CREATE",
      targetType: "TransportationChangeRequest",
      targetId: requestId,
      staffId: request.staffId,
      storeId: request.staffStore.storeId,
      after: { status: "REJECTED" },
      reason: reviewNotes.trim(),
    });

    revalidatePath("/correction-requests");
    revalidatePath("/my-stores");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "却下に失敗しました" };
  }
}
