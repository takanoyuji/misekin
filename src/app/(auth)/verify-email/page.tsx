import Link from "next/link";
import { verifyEmail } from "@/actions/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string; email?: string }>;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const params = await searchParams;
  const { token, email } = params;

  // トークンまたはメールアドレスが不足している場合
  if (!token || !email) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>メール認証</CardTitle>
          <CardDescription>リンクが無効です</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="alert"
            className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-4"
          >
            認証リンクが無効または不完全です。メールに記載されたリンクをご確認ください。
          </div>
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          >
            ログインページへ
          </Link>
        </CardContent>
      </Card>
    );
  }

  const result = await verifyEmail(token, email);

  if (result.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>メール認証</CardTitle>
          <CardDescription>認証に失敗しました</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
          >
            {result.error}
          </div>
          <p className="text-sm text-muted-foreground">
            認証リンクの有効期限は24時間です。期限が切れた場合は再度登録をお試しください。
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/register"
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              新規登録に戻る
            </Link>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost" }), "w-full")}
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
        <CardTitle>メール認証完了</CardTitle>
        <CardDescription>メールアドレスの認証が完了しました</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-4 py-4 text-center"
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
            <p className="font-semibold text-foreground">認証完了</p>
            <p className="mt-1 text-sm text-muted-foreground">
              メールアドレスの認証が完了しました。
              <br />
              ログインしてみせ勤をご利用ください。
            </p>
          </div>
        </div>
        <Link
          href="/login"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          ログインする
        </Link>
      </CardContent>
    </Card>
  );
}
