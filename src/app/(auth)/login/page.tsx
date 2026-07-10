"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginUser } from "@/actions/auth";
import {
  loginSchema,
  type LoginInput,
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

function LoginPageContent() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  function onSubmit(data: LoginInput) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", data.email);
      formData.append("password", data.password);
      await loginUser(formData);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ログイン</CardTitle>
        <CardDescription>
          メールアドレスとパスワードを入力してください
        </CardDescription>
      </CardHeader>

      <CardContent>
        {errorParam === "credentials" && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
          >
            メールアドレスまたはパスワードが正しくありません
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          aria-label="ログインフォーム"
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
              disabled={isPending}
              {...register("email")}
            />
            {errors.email && (
              <p id="email-error" role="alert" className="text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">パスワード</Label>
              <Link
                href="/reset-password"
                className="text-xs text-primary hover:underline"
                tabIndex={0}
              >
                パスワードを忘れた方
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-describedby={errors.password ? "password-error" : undefined}
              aria-invalid={!!errors.password}
              disabled={isPending}
              {...register("password")}
            />
            {errors.password && (
              <p id="password-error" role="alert" className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isPending}
            aria-busy={isPending}
          >
            {isPending ? "ログイン中..." : "ログイン"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          アカウントをお持ちでない方は{" "}
          <Link href="/register" className="text-primary hover:underline font-medium">
            新規登録
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
}
