"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

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
