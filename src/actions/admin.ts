"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/auth/audit";
import { requireOwner, validateOrgStoreIds } from "@/lib/auth/permissions";
import {
  changeMemberRoleSchema,
  setStoreScopeSchema,
  inviteAdminSchema,
} from "@/lib/validations/admin";

interface ActionResult {
  success?: boolean;
  error?: string;
}

/**
 * 自組織に属する店舗のうち、指定IDだけを検証して返す。
 * 他組織や存在しない店舗IDが混じっていた場合はエラー。
 */
/**
 * 既存ユーザーを管理者(ADMIN)として招待する。
 * storeIds を指定するとその店舗のみ担当する店舗管理者になる（未指定=全店舗）。
 */
export async function inviteAdminMember(
  organizationId: string,
  input: { email: string; storeIds?: string[] }
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = inviteAdminSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力が正しくありません" };
  }
  const trimmedEmail = parsed.data.email.trim().toLowerCase();
  const storeIds = parsed.data.storeIds ?? [];

  try {
    await requireOwner(session.user.id, organizationId);

    // 担当店舗の検証（自組織の店舗に限定 = mass-assignment 対策）
    const validated = await validateOrgStoreIds(organizationId, storeIds);
    if ("error" in validated) return { error: validated.error };

    // 招待対象ユーザーを検索
    const targetUser = await db.user.findFirst({
      where: { email: trimmedEmail },
    });
    if (!targetUser) {
      return { error: "このメールアドレスのアカウントが見つかりません" };
    }

    // 既にメンバーか確認
    const existing = await db.organizationMember.findFirst({
      where: { organizationId, userId: targetUser.id },
    });

    let memberId: string;
    if (existing) {
      if (existing.isActive) {
        return { error: "このユーザーはすでにメンバーです" };
      }
      // 無効化されていた場合は ADMIN として再有効化
      await db.organizationMember.update({
        where: { id: existing.id },
        data: { isActive: true, role: "ADMIN" },
      });
      memberId = existing.id;
    } else {
      const created = await db.organizationMember.create({
        data: {
          organizationId,
          userId: targetUser.id,
          role: "ADMIN",
        },
      });
      memberId = created.id;
    }

    // 担当店舗スコープを設定（指定があれば）
    if (validated.length > 0) {
      await db.storeAdmin.deleteMany({
        where: { organizationMemberId: memberId },
      });
      await db.storeAdmin.createMany({
        data: validated.map((storeId) => ({
          organizationMemberId: memberId,
          storeId,
        })),
      });
    }

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "MEMBER_INVITE",
      targetType: "OrganizationMember",
      targetId: targetUser.id,
      after: {
        email: trimmedEmail,
        role: "ADMIN",
        storeIds: validated.length > 0 ? validated : "ALL",
      },
    });

    revalidatePath("/admins");
    // スタッフ詳細にも権限セクションがあるため合わせて再検証する
    revalidatePath("/staff/[id]", "page");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "招待に失敗しました" };
  }
}

/**
 * 既存メンバーのロールを変更する（ADMIN ↔ MEMBER のみ）。
 * OWNER の付与・剥奪・自分自身の変更は不可。
 */
export async function changeMemberRole(
  organizationId: string,
  input: { memberId: string; role: "ADMIN" | "MEMBER" }
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = changeMemberRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力が正しくありません" };
  }
  const { memberId, role } = parsed.data;

  try {
    await requireOwner(session.user.id, organizationId);

    const member = await db.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) return { error: "メンバーが見つかりません" };
    if (member.role === "OWNER") {
      return { error: "オーナーの権限は変更できません" };
    }
    if (member.userId === session.user.id) {
      return { error: "自分自身の権限は変更できません" };
    }
    if (member.role === role) {
      return { success: true }; // 変更なし
    }

    await db.organizationMember.update({
      where: { id: member.id },
      data: { role },
    });

    // MEMBER に降格する場合は担当店舗スコープを消去（残すと意味を持たない）
    if (role === "MEMBER") {
      await db.storeAdmin.deleteMany({
        where: { organizationMemberId: member.id },
      });
    }

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "MEMBER_ROLE_CHANGE",
      targetType: "OrganizationMember",
      targetId: member.id,
      before: { role: member.role },
      after: { role },
    });

    revalidatePath("/admins");
    // スタッフ詳細にも権限セクションがあるため合わせて再検証する
    revalidatePath("/staff/[id]", "page");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "権限の変更に失敗しました" };
  }
}

/**
 * 店舗管理者(ADMIN)の担当店舗スコープを設定する。
 * storeIds 空 = 全店舗。指定あり = その店舗のみ。
 */
export async function setStoreAdminScope(
  organizationId: string,
  input: { memberId: string; storeIds: string[] }
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = setStoreScopeSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力が正しくありません" };
  }
  const { memberId, storeIds } = parsed.data;

  try {
    await requireOwner(session.user.id, organizationId);

    const member = await db.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) return { error: "メンバーが見つかりません" };
    if (member.role !== "ADMIN") {
      return { error: "担当店舗を設定できるのは管理者のみです" };
    }

    const validated = await validateOrgStoreIds(organizationId, storeIds);
    if ("error" in validated) return { error: validated.error };

    const before = await db.storeAdmin.findMany({
      where: { organizationMemberId: member.id },
      select: { storeId: true },
    });

    // 全置換（deleteMany → createMany）
    await db.storeAdmin.deleteMany({
      where: { organizationMemberId: member.id },
    });
    if (validated.length > 0) {
      await db.storeAdmin.createMany({
        data: validated.map((storeId) => ({
          organizationMemberId: member.id,
          storeId,
        })),
      });
    }

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "STORE_ADMIN_SCOPE_CHANGE",
      targetType: "OrganizationMember",
      targetId: member.id,
      before: { storeIds: before.map((b) => b.storeId) },
      after: { storeIds: validated.length > 0 ? validated : "ALL" },
    });

    revalidatePath("/admins");
    // スタッフ詳細にも権限セクションがあるため合わせて再検証する
    revalidatePath("/staff/[id]", "page");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "担当店舗の設定に失敗しました" };
  }
}

/**
 * 管理者メンバーを削除する（無効化）
 */
export async function removeAdminMember(
  organizationId: string,
  memberId: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    await requireOwner(session.user.id, organizationId);

    const member = await db.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });

    if (!member) return { error: "メンバーが見つかりません" };
    if (member.role === "OWNER") return { error: "オーナーは削除できません" };
    if (member.userId === session.user.id) return { error: "自分自身は削除できません" };

    await db.organizationMember.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "MEMBER_DEACTIVATE",
      targetType: "OrganizationMember",
      targetId: memberId,
      before: member,
    });

    revalidatePath("/admins");
    // スタッフ詳細にも権限セクションがあるため合わせて再検証する
    revalidatePath("/staff/[id]", "page");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "削除に失敗しました" };
  }
}
