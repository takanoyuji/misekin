"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/auth/audit";
import { requireOwner } from "@/lib/auth/permissions";

interface ActionResult {
  success?: boolean;
  error?: string;
}

/**
 * 既存ユーザーを管理者として招待する
 */
export async function inviteAdminMember(
  organizationId: string,
  email: string
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) return { error: "メールアドレスを入力してください" };

  try {
    await requireOwner(session.user.id, organizationId);

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
    if (existing) {
      if (existing.isActive) {
        return { error: "このユーザーはすでにメンバーです" };
      }
      // 無効化されていた場合は再有効化
      await db.organizationMember.update({
        where: { id: existing.id },
        data: { isActive: true, role: "ADMIN" },
      });
    } else {
      await db.organizationMember.create({
        data: {
          organizationId,
          userId: targetUser.id,
          role: "ADMIN",
        },
      });
    }

    await createAuditLog({
      organizationId,
      actorUserId: session.user.id,
      action: "MEMBER_INVITE",
      targetType: "OrganizationMember",
      targetId: targetUser.id,
      after: { email: trimmedEmail, role: "ADMIN" },
    });

    revalidatePath("/admins");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "招待に失敗しました" };
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
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "削除に失敗しました" };
  }
}
