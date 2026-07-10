"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestPasswordReset, resetPassword } from "@/actions/auth";
import {
  resetPasswordRequestSchema,
  resetPasswordSchema,
  type ResetPasswordRequestInput,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ----- リセットリクエストフォーム（メールアドレス入力） -----

function RequestResetForm() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordRequestInput>({
    resolver: zodResolver(resetPasswordRequestSchema),
  });

  async function onSubmit(data: ResetPasswordRequestInput) {
    setServerError(null);
    const result = await requestPasswordReset(data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-4 py-6 text-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-foreground">メールを送信しました</p>
              <p className="mt-1 text-sm text-muted-foreground">
                パスワードリセット用のリンクをメールにお送りしました。
                <br />
                リンクの有効期限は1時間です。
              </p>
            </div>
            <Link
              href="/login"
              className="mt-2 text-sm text-primary hover:underline font-medium"
            >
              ログインページへ
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>パスワードをリセット</CardTitle>
        <CardDescription>
          登録済みのメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
        </CardDescription>
      </CardHeader>

      <CardContent>
        {serverError && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
          >
            {serverError}
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          aria-label="パスワードリセットリクエストフォーム"
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-describedby={errors.email ? "email-error" : undefined}
              aria-invalid={!!errors.email}
              disabled={isSubmitting}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" role="alert" className="text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "送信中..." : "リセットメールを送信"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <Link href="/login" className="text-sm text-primary hover:underline">
          ログインページへ戻る
        </Link>
      </CardFooter>
    </Card>
  );
}

// ----- パスワードリセット実行フォーム（新パスワード入力） -----

function ResetPasswordForm({ token }: { token: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  async function onSubmit(data: ResetPasswordInput) {
    setServerError(null);
    const result = await resetPassword(data);
    if (result.error) {
      setServerError(result.error);
    } else {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center gap-4 py-6 text-center"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <svg
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-foreground">パスワードを変更しました</p>
              <p className="mt-1 text-sm text-muted-foreground">
                新しいパスワードでログインしてください。
              </p>
            </div>
            <Link
              href="/login"
              className="mt-2 text-sm text-primary hover:underline font-medium"
            >
              ログインページへ
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>新しいパスワードを設定</CardTitle>
        <CardDescription>
          新しいパスワードを入力してください
        </CardDescription>
      </CardHeader>

      <CardContent>
        {serverError && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
          >
            {serverError}
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          aria-label="パスワードリセットフォーム"
          className="space-y-4"
          noValidate
        >
          {/* hidden token field */}
          <input type="hidden" {...register("token")} />

          <div className="space-y-1.5">
            <Label htmlFor="password">新しいパスワード</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="英字と数字を含む8文字以上"
              aria-describedby={
                errors.password ? "password-error" : "password-hint"
              }
              aria-invalid={!!errors.password}
              disabled={isSubmitting}
              {...register("password")}
            />
            {errors.password ? (
              <p id="password-error" role="alert" className="text-xs text-destructive">
                {errors.password.message}
              </p>
            ) : (
              <p id="password-hint" className="text-xs text-muted-foreground">
                英字と数字を含む8文字以上で設定してください
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">新しいパスワード（確認）</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              aria-describedby={
                errors.confirmPassword ? "confirmPassword-error" : undefined
              }
              aria-invalid={!!errors.confirmPassword}
              disabled={isSubmitting}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p
                id="confirmPassword-error"
                role="alert"
                className="text-xs text-destructive"
              >
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "変更中..." : "パスワードを変更する"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <Link href="/login" className="text-sm text-primary hover:underline">
          ログインページへ戻る
        </Link>
      </CardFooter>
    </Card>
  );
}

// ----- ページエントリーポイント -----

import { Suspense } from "react";

function ResetPasswordPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  if (token) {
    return <ResetPasswordForm token={token} />;
  }

  return <RequestResetForm />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
