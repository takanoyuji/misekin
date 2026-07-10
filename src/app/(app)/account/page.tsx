import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/common/page-header";
import { AccountForm } from "./account-form";

export const metadata: Metadata = {
  title: "アカウント設定",
};

export default async function AccountPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: session.user!.id },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
    },
  });

  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        title="アカウント設定"
        description="プロフィールとパスワードを管理します"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "アカウント設定" },
        ]}
      />

      <AccountForm
        userName={user.name ?? ""}
        userEmail={user.email ?? ""}
        hasPassword={!!user.passwordHash}
      />
    </div>
  );
}
