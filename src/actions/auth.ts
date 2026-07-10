"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { addHours } from "date-fns";
import {
  registerSchema,
  resetPasswordRequestSchema,
  resetPasswordSchema,
  type RegisterInput,
  type ResetPasswordRequestInput,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email";

interface ActionResult {
  success?: boolean;
  error?: string;
}

/**
 * ユーザー登録
 */
export async function registerUser(
  input: RegisterInput
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  const { name, email, password } = parsed.data;

  // 既存ユーザーチェック
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // セキュリティのため「メールを送信しました」と返す
    return { success: true };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
  });

  // メール認証トークン発行
  const token = nanoid(32);
  await db.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires: addHours(new Date(), 24),
      type: "EMAIL_VERIFICATION",
    },
  });

  await sendVerificationEmail(email, name ?? email, token);

  return { success: true };
}

/**
 * メールアドレス確認
 */
export async function verifyEmail(
  token: string,
  email: string
): Promise<ActionResult> {
  const verificationToken = await db.verificationToken.findUnique({
    where: { identifier_token: { identifier: email, token } },
  });

  if (!verificationToken) {
    return { error: "無効または期限切れのトークンです" };
  }

  if (verificationToken.type !== "EMAIL_VERIFICATION") {
    return { error: "無効なトークンです" };
  }

  if (verificationToken.expires < new Date()) {
    return { error: "トークンの有効期限が切れています" };
  }

  // メール認証済みに更新
  await db.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });

  // トークン削除
  await db.verificationToken.delete({
    where: { identifier_token: { identifier: email, token } },
  });

  return { success: true };
}

/**
 * パスワードリセットリクエスト
 */
export async function requestPasswordReset(
  input: ResetPasswordRequestInput
): Promise<ActionResult> {
  const parsed = resetPasswordRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "有効なメールアドレスを入力してください" };
  }

  const { email } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  // セキュリティのため、ユーザーの存在有無を返さない
  if (!user) return { success: true };

  // 既存のリセットトークンを削除
  await db.verificationToken.deleteMany({
    where: { identifier: email, type: "PASSWORD_RESET" },
  });

  const token = nanoid(32);
  await db.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires: addHours(new Date(), 1),
      type: "PASSWORD_RESET",
    },
  });

  await sendPasswordResetEmail(email, user.name ?? email, token);

  return { success: true };
}

/**
 * パスワードリセット実行
 */
export async function resetPassword(
  input: ResetPasswordInput
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  const { token, password } = parsed.data;

  // トークンを探す（identifierが不明なのでtokenで検索）
  const verificationToken = await db.verificationToken.findFirst({
    where: { token, type: "PASSWORD_RESET" },
  });

  if (!verificationToken) {
    return { error: "無効または期限切れのトークンです" };
  }

  if (verificationToken.expires < new Date()) {
    return { error: "トークンの有効期限が切れています" };
  }

  const email = verificationToken.identifier;
  const passwordHash = await bcrypt.hash(password, 12);

  await db.user.update({
    where: { email },
    data: { passwordHash },
  });

  // トークン削除
  await db.verificationToken.delete({
    where: {
      identifier_token: { identifier: email, token },
    },
  });

  // 既存のセッションを全て無効化
  await db.session.deleteMany({ where: { userId: (await db.user.findUnique({ where: { email } }))!.id } });

  return { success: true };
}

/**
 * ログイン
 */
export async function loginUser(formData: FormData) {
  try {
    await signIn("credentials", formData);
  } catch (error: any) {
    if (error.message?.includes("CredentialsSignin")) {
      redirect("/login?error=credentials");
    }
    throw error;
  }
}

/**
 * ログアウト
 */
export async function logoutUser() {
  await signOut({ redirectTo: "/login" });
}
