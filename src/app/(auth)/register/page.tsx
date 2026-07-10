"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerUser } from "@/actions/auth";
import {
  registerSchema,
  type RegisterInput,
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

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterInput) {
    setServerError(null);
    const result = await registerUser(data);
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
              <p className="font-semibold text-foreground">確認メールを送信しました</p>
              <p className="mt-1 text-sm text-muted-foreground">
                ご登録のメールアドレスに確認メールをお送りしました。
                <br />
                メール内のリンクをクリックして登録を完了してください。
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
        <CardTitle>新規登録</CardTitle>
        <CardDescription>アカウントを作成してみせ勤を始めましょう</CardDescription>
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
          aria-label="新規登録フォーム"
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">お名前</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              placeholder="山田 太郎"
              aria-describedby={errors.name ? "name-error" : undefined}
              aria-invalid={!!errors.name}
              disabled={isSubmitting}
              {...register("name")}
            />
            {errors.name && (
              <p id="name-error" role="alert" className="text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

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

          <div className="space-y-1.5">
            <Label htmlFor="password">パスワード</Label>
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
            <Label htmlFor="confirmPassword">パスワード（確認）</Label>
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
            {isSubmitting ? "登録中..." : "アカウントを作成"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="text-primary hover:underline font-medium">
            ログイン
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
