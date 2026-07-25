import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  resolveActiveOrganizationId,
  getOrganizationRole,
} from "@/lib/auth/active-org";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  // アクティブ組織の名前を取得
  // クッキー未設定 (招待で参加したスタッフ等) でも所属組織に解決する
  const activeOrgId = await resolveActiveOrganizationId(
    session.user?.id,
    (session as any).activeOrganizationId as string | null
  );

  let organizationName: string | null = null;
  let isMember = false;
  let isOwner = false;
  if (activeOrgId) {
    const org = await db.organization.findUnique({
      where: { id: activeOrgId },
      select: { name: true },
    });
    organizationName = org?.name ?? null;

    // MEMBER は管理メニューを表示しない / OWNER のみ権限管理を表示
    const role = await getOrganizationRole(session.user?.id, activeOrgId);
    isMember = role === "MEMBER";
    isOwner = role === "OWNER";
  }

  // ログインユーザーの未読通知数を取得
  const userId = session.user?.id;
  let unreadCount = 0;
  if (userId && activeOrgId) {
    unreadCount = await db.notification.count({
      where: {
        userId,
        organizationId: activeOrgId,
        isRead: false,
      },
    });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar isMember={isMember} isOwner={isOwner} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AppHeader
          session={session}
          organizationName={organizationName}
          unreadCount={unreadCount}
        />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto bg-background p-4 sm:p-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
