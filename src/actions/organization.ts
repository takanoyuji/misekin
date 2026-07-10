"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/auth/audit";
import { requireOwner, requireAdmin } from "@/lib/auth/permissions";
import {
  createOrganizationSchema,
  onboardingSchema,
  type CreateOrganizationInput,
  type OnboardingInput,
} from "@/lib/validations/organization";
import { customAlphabet } from "nanoid";
import { createStoreClockUrl } from "./store";

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
 * オンボーディング: 組織と最初の店舗を作成する
 */
export async function createOrganizationWithStore(
  input: OnboardingInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  const { organizationName, storeName, timezone, dayChangeHour, dayChangeMinute } =
    parsed.data;

  try {
    const result = await db.$transaction(async (tx) => {
      // 組織作成
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          timezone,
          dayChangeHour,
          dayChangeMinute,
        },
      });

      // オーナーとして登録
      const member = await tx.organizationMember.create({
        data: {
          organizationId: organization.id,
          userId: session.user!.id,
          role: "OWNER",
        },
      });

      // 最初の店舗作成
      const store = await tx.store.create({
        data: {
          organizationId: organization.id,
          name: storeName,
          timezone,
          dayChangeHour,
          dayChangeMinute,
        },
      });

      // 打刻URL発行
      await tx.storeClockUrl.create({
        data: {
          storeId: store.id,
          token: nanoid(),
        },
      });

      // セッションのアクティブ組織を更新
      await tx.session.updateMany({
        where: { userId: session.user!.id },
        data: { activeOrganizationId: organization.id },
      });

      return { organization, store };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("Failed to create organization:", error);
    return { error: "組織の作成に失敗しました" };
  }
}

/**
 * 組織設定を更新する
 */
export async function updateOrganization(
  organizationId: string,
  input: Partial<CreateOrganizationInput>
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const ctx = await requireOwner(session.user.id, organizationId);

    const before = await db.organization.findUnique({
      where: { id: organizationId },
    });

    const updated = await db.organization.update({
      where: { id: organizationId },
      data: input,
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "STORE_UPDATE",
      targetType: "Organization",
      targetId: organizationId,
      before,
      after: updated,
    });

    revalidatePath("/organization");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "更新に失敗しました" };
  }
}

/**
 * アクティブ組織を切り替える
 */
export async function switchOrganization(
  organizationId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  // 所属確認
  const member = await db.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      organizationId,
      isActive: true,
    },
  });

  if (!member) return { error: "この組織へのアクセス権がありません" };

  await db.session.updateMany({
    where: { userId: session.user.id },
    data: { activeOrganizationId: organizationId },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/**
 * ユーザーが所属する組織一覧を取得する
 */
export async function getUserOrganizations() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const memberships = await db.organizationMember.findMany({
    where: {
      userId: session.user.id,
      isActive: true,
    },
    include: {
      organization: {
        select: { id: true, name: true, isActive: true },
      },
    },
  });

  return memberships
    .filter((m) => m.organization.isActive)
    .map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
    }));
}
