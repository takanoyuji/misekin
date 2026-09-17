"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/auth/audit";
import { verticalForCategory, verticalSlugFromDb } from "@/lib/verticals";
import {
  requireAdmin,
  requireOwner,
  canAccessStore,
} from "@/lib/auth/permissions";
import {
  createStoreSchema,
  updateStoreSchema,
  shiftPeriodSettingsSchema,
  storeLocationSettingsSchema,
  type CreateStoreInput,
  type ShiftPeriodSettingsInput,
  type StoreLocationSettingsInput,
} from "@/lib/validations/store";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  21
);

interface ActionResult {
  success?: boolean;
  error?: string;
  data?: unknown;
}

/**
 * 店舗を作成する
 */
export async function createStore(
  organizationId: string,
  input: CreateStoreInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = createStoreSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);

    const store = await db.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          organizationId,
          ...parsed.data,
        },
      });

      // 打刻URLを自動発行
      await tx.storeClockUrl.create({
        data: {
          storeId: store.id,
          token: nanoid(),
        },
      });

      // 業態に合わせたシフトの時間帯を入れておく。
      // 参照ではなくコピーなので、あとからテンプレートを直しても既存店には影響しない。
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { vertical: true },
      });
      const vertical = verticalForCategory(
        store.category,
        verticalSlugFromDb(org?.vertical)
      );
      await tx.shiftSlot.createMany({
        data: vertical.defaults.slots.map((slot, i) => ({
          organizationId,
          storeId: store.id,
          name: slot.name,
          startTime: slot.startTime,
          endTime: slot.endTime,
          sortOrder: i,
        })),
      });

      return store;
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "STORE_CREATE",
      targetType: "Store",
      targetId: store.id,
      after: store,
    });

    revalidatePath("/stores");
    return { success: true, data: { storeId: store.id } };
  } catch (error: any) {
    return { error: error.message ?? "店舗の作成に失敗しました" };
  }
}

/**
 * 店舗情報を更新する
 */
export async function updateStore(
  organizationId: string,
  storeId: string,
  input: Partial<CreateStoreInput>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  // 受け取った値をそのまま data に渡さない。
  // 位置設定など、この画面から変えてはいけない列まで書けてしまうため
  // （UIで隠してもリクエストは手で組める）。
  const parsed = updateStoreSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);
    const hasAccess = await canAccessStore(ctx.memberId, ctx.role, storeId);
    if (!hasAccess) return { error: "この店舗へのアクセス権がありません" };

    const before = await db.store.findUnique({ where: { id: storeId } });
    const updated = await db.store.update({
      where: { id: storeId, organizationId },
      data: parsed.data,
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "STORE_UPDATE",
      targetType: "Store",
      targetId: storeId,
      storeId,
      before,
      after: updated,
    });

    revalidatePath(`/stores/${storeId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "更新に失敗しました" };
  }
}

/**
 * シフト希望の提出期間設定を更新する
 * （通常の店舗編集とは分けた専用経路。誤操作を避け、権限も個別に検証する）
 */
export async function updateShiftPeriodSettings(
  organizationId: string,
  storeId: string,
  input: ShiftPeriodSettingsInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = shiftPeriodSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);
    if (!(await canAccessStore(ctx.memberId, ctx.role, storeId))) {
      return { error: "この店舗へのアクセス権がありません" };
    }

    const before = await db.store.findFirst({
      where: { id: storeId, organizationId },
      select: { shiftPeriodUnit: true, shiftPeriodStartDay: true },
    });
    if (!before) return { error: "店舗が見つかりません" };

    await db.store.update({
      where: { id: storeId, organizationId },
      data: {
        shiftPeriodUnit: parsed.data.shiftPeriodUnit,
        shiftPeriodStartDay: parsed.data.shiftPeriodStartDay,
      },
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "STORE_UPDATE",
      targetType: "Store",
      targetId: storeId,
      storeId,
      before,
      after: parsed.data,
      reason: "シフト希望の提出期間設定を変更",
    });

    revalidatePath(`/stores/${storeId}`);
    revalidatePath("/shifts");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "更新に失敗しました" };
  }
}

/**
 * 打刻の位置設定を更新する
 * （通常の店舗編集とは分けた専用経路。全スタッフの勤怠フラグに効くので、
 *   他項目のついで操作で変わらないようにする）
 *
 * 位置は個人情報なので、既定は記録しない。ここで明示的に有効にした店舗だけが記録する。
 * 判定距離を空のままにすると「記録のみ」で、異常フラグは立たない。
 */
export async function updateLocationSettings(
  organizationId: string,
  storeId: string,
  input: StoreLocationSettingsInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = storeLocationSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);
    if (!(await canAccessStore(ctx.memberId, ctx.role, storeId))) {
      return { error: "この店舗へのアクセス権がありません" };
    }

    const before = await db.store.findFirst({
      where: { id: storeId, organizationId },
      select: {
        locationTrackingEnabled: true,
        latitude: true,
        longitude: true,
        geofenceRadiusMeters: true,
      },
    });
    if (!before) return { error: "店舗が見つかりません" };

    await db.store.update({
      where: { id: storeId, organizationId },
      data: {
        locationTrackingEnabled: parsed.data.locationTrackingEnabled,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        geofenceRadiusMeters: parsed.data.geofenceRadiusMeters,
      },
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "STORE_UPDATE",
      targetType: "Store",
      targetId: storeId,
      storeId,
      before,
      after: parsed.data,
      reason: "打刻の位置設定を変更",
    });

    revalidatePath(`/stores/${storeId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "更新に失敗しました" };
  }
}

/**
 * 店舗を無効化する
 */
export async function deactivateStore(
  organizationId: string,
  storeId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    await requireOwner(session.user.id, organizationId);

    await db.$transaction(async (tx) => {
      // 店舗を無効化
      await tx.store.update({
        where: { id: storeId, organizationId },
        data: { isActive: false },
      });

      // 打刻URLを無効化
      await tx.storeClockUrl.updateMany({
        where: { storeId },
        data: { isActive: false, invalidatedAt: new Date() },
      });
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "STORE_DEACTIVATE",
      targetType: "Store",
      targetId: storeId,
      storeId,
    });

    revalidatePath("/stores");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "無効化に失敗しました" };
  }
}

/**
 * 打刻URLを新規発行または再発行する
 */
export async function createStoreClockUrl(
  organizationId: string,
  storeId: string,
  options?: { expiresAt?: Date }
): Promise<ActionResult & { token?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);
    const hasAccess = await canAccessStore(ctx.memberId, ctx.role, storeId);
    if (!hasAccess) return { error: "この店舗へのアクセス権がありません" };

    const token = await db.$transaction(async (tx) => {
      // 既存のURLを無効化
      await tx.storeClockUrl.updateMany({
        where: { storeId, isActive: true },
        data: { isActive: false, invalidatedAt: new Date() },
      });

      // 新しいURLを発行
      const clockUrl = await tx.storeClockUrl.create({
        data: {
          storeId,
          token: nanoid(),
          expiresAt: options?.expiresAt,
        },
      });

      return clockUrl.token;
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "CLOCK_URL_ISSUE",
      targetType: "StoreClockUrl",
      storeId,
    });

    revalidatePath(`/stores/${storeId}`);
    return { success: true, token };
  } catch (error: any) {
    return { error: error.message ?? "URLの発行に失敗しました" };
  }
}

/**
 * 打刻URLを無効化する
 */
export async function revokeStoreClockUrl(
  organizationId: string,
  storeId: string,
  clockUrlId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const ctx = await requireAdmin(session.user.id, organizationId);
    const hasAccess = await canAccessStore(ctx.memberId, ctx.role, storeId);
    if (!hasAccess) return { error: "この店舗へのアクセス権がありません" };

    await db.storeClockUrl.update({
      where: { id: clockUrlId, storeId },
      data: { isActive: false, invalidatedAt: new Date() },
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "CLOCK_URL_REVOKE",
      targetType: "StoreClockUrl",
      targetId: clockUrlId,
      storeId,
    });

    revalidatePath(`/stores/${storeId}`);
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "URLの無効化に失敗しました" };
  }
}

/**
 * 打刻URLトークンから店舗情報を取得する（認証不要）
 */
export async function getStoreByClockToken(token: string) {
  const clockUrl = await db.storeClockUrl.findFirst({
    where: {
      token,
      isActive: true,
    },
    include: {
      store: {
        include: {
          organization: {
            select: { id: true, name: true, timezone: true, dayChangeHour: true, dayChangeMinute: true },
          },
        },
      },
    },
  });

  if (!clockUrl) return null;

  // 有効期限チェック
  if (clockUrl.expiresAt && clockUrl.expiresAt < new Date()) {
    return null;
  }

  return clockUrl.store;
}
