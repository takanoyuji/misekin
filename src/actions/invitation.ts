"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { createAuditLog } from "@/lib/auth/audit";

interface ActionResult {
  success?: boolean;
  error?: string;
}

export interface StaffInvitationInfo {
  staffName: string;
  organizationName: string;
  email: string;
  /** 既にログインアカウントがある場合はパスワード入力を求めない */
  hasAccount: boolean;
}

export interface InvitationLookupResult {
  data?: StaffInvitationInfo;
  error?: string;
  /** 登録が既に完了している場合。エラーではなくログインへ案内する */
  alreadyCompleted?: boolean;
}

/**
 * 招待トークンを検証し、表示用の情報を返す
 *
 * 招待メールのリンクを開いた時点で呼ぶ。副作用は持たせない。
 * 受諾済みのリンクを再度開いた場合は alreadyCompleted を返す
 * (受諾時にトークンを削除するため、登録済みでもトークンは見つからない)
 */
export async function getStaffInvitation(
  token: string,
  emailHint?: string
): Promise<InvitationLookupResult> {
  if (!token) return { error: "招待トークンが指定されていません" };

  const verificationToken = await db.verificationToken.findFirst({
    where: { token, type: "EMAIL_VERIFICATION" },
  });

  if (!verificationToken) {
    // 受諾済みかどうかを URL の email パラメータで判定する
    if (emailHint) {
      const registered = await db.user.findFirst({
        where: { email: emailHint.toLowerCase(), passwordHash: { not: null } },
        select: { id: true },
      });
      if (registered) {
        return { alreadyCompleted: true };
      }
    }
    return {
      error:
        "このリンクは使用できません。新しい招待メールが送信されている場合は最新のものをご利用いただくか、管理者に再送をご依頼ください。",
    };
  }

  if (verificationToken.expires < new Date()) {
    return {
      error: "招待リンクの有効期限が切れています。管理者に再送を依頼してください",
    };
  }

  const email = verificationToken.identifier;

  const staff = await db.staff.findFirst({
    where: { email },
    select: {
      displayName: true,
      status: true,
      organization: { select: { name: true } },
    },
  });

  if (!staff) {
    return { error: "招待の対象となるスタッフが見つかりません" };
  }

  if (staff.status === "RESIGNED" || staff.status === "SUSPENDED") {
    return { error: "このスタッフは現在利用できません。管理者にお問い合わせください" };
  }

  const existingUser = await db.user.findUnique({
    where: { email },
    select: { passwordHash: true },
  });

  return {
    data: {
      staffName: staff.displayName,
      organizationName: staff.organization.name,
      email,
      hasAccount: !!existingUser?.passwordHash,
    },
  };
}

/**
 * 招待を受諾してスタッフのログインアカウントを有効化する
 *
 * - ログインアカウントがなければ作成する (パスワードは本人が設定)
 * - Staff と User を紐付け、在籍状態を ACTIVE にする
 * - 組織メンバー(MEMBER)として登録する。MEMBER は管理機能を使えない
 */
export async function acceptStaffInvitation(
  token: string,
  password: string | null
): Promise<ActionResult> {
  if (!token) return { error: "招待トークンが指定されていません" };

  const verificationToken = await db.verificationToken.findFirst({
    where: { token, type: "EMAIL_VERIFICATION" },
  });

  if (!verificationToken) {
    return { error: "無効な招待リンクです" };
  }

  if (verificationToken.expires < new Date()) {
    return {
      error: "招待リンクの有効期限が切れています。管理者に再送を依頼してください",
    };
  }

  const email = verificationToken.identifier;

  const staff = await db.staff.findFirst({
    where: { email },
    select: {
      id: true,
      organizationId: true,
      displayName: true,
      status: true,
      userId: true,
    },
  });

  if (!staff) {
    return { error: "招待の対象となるスタッフが見つかりません" };
  }

  if (staff.status === "RESIGNED" || staff.status === "SUSPENDED") {
    return { error: "このスタッフは現在利用できません。管理者にお問い合わせください" };
  }

  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // 新規アカウントの場合のみパスワードを受け取る
  if (!existingUser?.passwordHash) {
    if (!password || password.length < 8) {
      return { error: "パスワードは8文字以上で設定してください" };
    }
  }

  try {
    const userId = await db.$transaction(async (tx) => {
      let user = existingUser;

      if (!user) {
        const created = await tx.user.create({
          data: {
            email,
            name: staff.displayName,
            passwordHash: await bcrypt.hash(password!, 12),
            // 招待メールを受け取れている = アドレスの到達確認は済んでいる
            emailVerified: new Date(),
          },
          select: { id: true, passwordHash: true },
        });
        user = created;
      } else if (!user.passwordHash) {
        // アカウントはあるがパスワード未設定の場合はここで設定する
        await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash: await bcrypt.hash(password!, 12),
            emailVerified: new Date(),
          },
        });
      } else {
        await tx.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }

      await tx.staff.update({
        where: { id: staff.id },
        data: {
          userId: user.id,
          status: staff.status === "INVITED" ? "ACTIVE" : staff.status,
        },
      });

      // 既にメンバーであればロールは変更しない (管理者を降格させない)
      const existingMember = await tx.organizationMember.findFirst({
        where: { userId: user.id, organizationId: staff.organizationId },
        select: { id: true, isActive: true },
      });

      if (!existingMember) {
        await tx.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: staff.organizationId,
            role: "MEMBER",
            isActive: true,
          },
        });
      } else if (!existingMember.isActive) {
        await tx.organizationMember.update({
          where: { id: existingMember.id },
          data: { isActive: true },
        });
      }

      await tx.verificationToken.deleteMany({
        where: { identifier: email, type: "EMAIL_VERIFICATION" },
      });

      return user.id;
    });

    await createAuditLog({
      organizationId: staff.organizationId,
      actorUserId: userId,
      action: "STAFF_STATUS_CHANGE",
      targetType: "Staff",
      targetId: staff.id,
      staffId: staff.id,
      before: { status: staff.status, userId: staff.userId },
      after: { status: "ACTIVE", userId },
      reason: "招待の受諾",
    });

    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "招待の受諾に失敗しました" };
  }
}
