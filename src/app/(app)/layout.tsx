import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
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
  const activeOrgId = (session as any).activeOrganizationId as string | null;

  let organizationName: string | null = null;
  if (activeOrgId) {
    const org = await db.organization.findUnique({
      where: { id: activeOrgId },
      select: { name: true },
    });
    organizationName = org?.name ?? null;
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
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AppHeader
          session={session}
          organizationName={organizationName}
          unreadCount={unreadCount}
        />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto bg-background p-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
