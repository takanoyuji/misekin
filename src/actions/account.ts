"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { addHours } from "date-fns";
import { createAuditLog } from "@/lib/auth/audit";
import { sendVerificationEmail } from "@/lib/email";
import { updateStaffEmailSchema } from "@/lib/validations/staff";

export async function updateAccountName(
  name: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };
  if (!name.trim()) return { error: "名前を入力してください" };

  try {
    await db.user.update({
      where: { id: session.user.id },
      data: { name: name.trim() },
    });
    revalidatePath("/account");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "名前の更新に失敗しました" };
  }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user?.passwordHash) {
      return { error: "パスワードが設定されていません" };
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return { error: "現在のパスワードが正しくありません" };
    }

    if (newPassword.length < 8) {
      return { error: "新しいパスワードは8文字以上で入力してください" };
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.user.update({
      where: { id: session.user.id },
      data: { passwordHash: newHash },
    });

    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "パスワードの変更に失敗しました" };
  }
}

/**
 * 自分のメールアドレスを変更する
 *
 * ログインIDと、自分に紐づくスタッフ情報のメールアドレスを揃えて更新する。
 * 変更後は新しいアドレスの確認が済むまでログインできない。
 */
export async function updateAccountEmail(
  email: string
): Promise<{ success?: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };
  const userId = session.user.id;

  const parsed = updateStaffEmailSchema.safeParse({ email });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  const nextEmail = parsed.data.email;
  if (!nextEmail) {
    return { error: "メールアドレスを入力してください" };
  }

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) return { error: "ユーザーが見つかりません" };
    if (user.email === nextEmail) return { success: true };

    const duplicatedUser = await db.user.findFirst({
      where: { email: nextEmail, id: { not: userId } },
      select: { id: true },
    });
    if (duplicatedUser) {
      return { error: "このメールアドレスは既に使用されています" };
    }

    // 自分のスタッフ情報も揃えるため、各組織内での重複を先に確認する
    // (Staff は organizationId + email が一意)
    const myStaffProfiles = await db.staff.findMany({
      where: { userId },
      select: { id: true, organizationId: true },
    });

    if (myStaffProfiles.length > 0) {
      const conflict = await db.staff.findFirst({
        where: {
          email: nextEmail,
          organizationId: {
            in: myStaffProfiles.map((s) => s.organizationId),
          },
          id: { notIn: myStaffProfiles.map((s) => s.id) },
        },
        select: { id: true },
      });
      if (conflict) {
        return {
          error: "このメールアドレスは所属組織の別のスタッフが使用しています",
        };
      }
    }

    const token = nanoid(32);

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { email: nextEmail, emailVerified: null },
      });

      if (myStaffProfiles.length > 0) {
        await tx.staff.updateMany({
          where: { userId },
          data: { email: nextEmail },
        });
      }

      await tx.verificationToken.deleteMany({
        where: { identifier: nextEmail, type: "EMAIL_VERIFICATION" },
      });
      await tx.verificationToken.create({
        data: {
          identifier: nextEmail,
          token,
          expires: addHours(new Date(), 24),
          type: "EMAIL_VERIFICATION",
        },
      });
    });

    // 自分のスタッフ情報がある組織それぞれに監査ログを残す
    for (const profile of myStaffProfiles) {
      await createAuditLog({
        organizationId: profile.organizationId,
        actorUserId: userId,
        action: "STAFF_UPDATE",
        targetType: "Staff",
        targetId: profile.id,
        staffId: profile.id,
        before: { email: user.email },
        after: { email: nextEmail },
        reason: "本人によるメールアドレス変更",
        metadata: { loginIdChanged: true },
      });
    }

    await sendVerificationEmail(nextEmail, user.name ?? nextEmail, token);

    revalidatePath("/account");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "メールアドレスの変更に失敗しました" };
  }
}
