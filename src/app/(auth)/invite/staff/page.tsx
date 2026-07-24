import type { Metadata } from "next";
import Link from "next/link";
import { getStaffInvitation } from "@/actions/invitation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StaffInvitationForm } from "./staff-invitation-form";

export const metadata: Metadata = {
  title: "スタッフ招待",
};

interface PageProps {
  searchParams: Promise<{ token?: string; email?: string }>;
}

export default async function StaffInvitationPage({ searchParams }: PageProps) {
  const { token, email } = await searchParams;

  if (!token) {
    return <InvitationError message="招待リンクが不完全です。メールに記載されたリンクをご確認ください。" />;
  }

  const { data, error, alreadyCompleted } = await getStaffInvitation(
    token,
    email
  );

  // 受諾済みのリンクを開き直したケース。異常ではないのでログインへ案内する
  if (alreadyCompleted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>登録済みです</CardTitle>
          <CardDescription>この招待の手続きは完了しています</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="status"
            className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            この招待は既に登録が完了しています。設定したパスワードでログインしてください。
          </div>
          <Link
            href="/login"
            className={cn(buttonVariants(), "w-full")}
          >
            ログイン画面へ
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return <InvitationError message={error ?? "招待リンクを確認できませんでした。"} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>スタッフ登録</CardTitle>
        <CardDescription>
          {data.organizationName} から招待されています
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="mb-6 space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">お名前</dt>
            <dd className="font-medium">{data.staffName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">メールアドレス</dt>
            <dd className="truncate font-medium">{data.email}</dd>
          </div>
        </dl>

        <StaffInvitationForm token={token} hasAccount={data.hasAccount} />
      </CardContent>
    </Card>
  );
}

function InvitationError({ message }: { message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>スタッフ登録</CardTitle>
        <CardDescription>招待を確認できませんでした</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="alert"
          className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {message}
        </div>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          ログイン画面へ
        </Link>
      </CardContent>
    </Card>
  );
}
