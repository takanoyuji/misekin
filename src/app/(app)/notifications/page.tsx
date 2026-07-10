import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export const metadata: Metadata = {
  title: "通知",
};

const NOTIFICATION_TYPE_ICON: Record<string, string> = {
  INFO: "ℹ",
  SUCCESS: "✓",
  WARNING: "⚠",
  ERROR: "✕",
  CORRECTION_REQUEST: "✏",
  CORRECTION_APPROVED: "✓",
  CORRECTION_REJECTED: "✕",
  SYSTEM: "⚙",
};

const NOTIFICATION_TYPE_COLOR: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-600",
  SUCCESS: "bg-green-100 text-green-600",
  WARNING: "bg-amber-100 text-amber-600",
  ERROR: "bg-red-100 text-red-600",
  CORRECTION_REQUEST: "bg-purple-100 text-purple-600",
  CORRECTION_APPROVED: "bg-green-100 text-green-600",
  CORRECTION_REJECTED: "bg-red-100 text-red-600",
  SYSTEM: "bg-gray-100 text-gray-600",
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = (session as any).activeOrganizationId as string | null;
  if (!activeOrgId) redirect("/dashboard");

  try {
    await requireOrgMember(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const notifications = await db.notification.findMany({
    where: { userId: session.user!.id, organizationId: activeOrgId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // 未読を既読にする
  await db.notification.updateMany({
    where: {
      userId: session.user!.id,
      organizationId: activeOrgId,
      isRead: false,
    },
    data: { isRead: true, readAt: new Date() },
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="通知"
        description={
          unreadCount > 0
            ? `未読通知が${unreadCount}件あります`
            : "すべての通知を確認しました"
        }
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "通知" },
        ]}
      />

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted text-2xl mb-3">
              🔔
            </div>
            <p className="text-muted-foreground text-sm">通知はありません</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm divide-y divide-border">
          {notifications.map((notification) => {
            const iconClass =
              NOTIFICATION_TYPE_COLOR[notification.type] ??
              "bg-gray-100 text-gray-600";
            const icon =
              NOTIFICATION_TYPE_ICON[notification.type] ?? "ℹ";

            const content = (
              <div className="flex items-start gap-4 px-5 py-4">
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${iconClass}`}
                  aria-hidden="true"
                >
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`text-sm font-medium ${
                        notification.isRead
                          ? "text-foreground"
                          : "text-foreground font-semibold"
                      }`}
                    >
                      {notification.title}
                      {!notification.isRead && (
                        <span
                          className="ml-2 inline-block size-2 rounded-full bg-primary align-middle"
                          aria-label="未読"
                        />
                      )}
                    </p>
                    <time
                      dateTime={notification.createdAt.toISOString()}
                      className="shrink-0 text-xs text-muted-foreground whitespace-nowrap"
                    >
                      {format(
                        new Date(notification.createdAt),
                        "yyyy/MM/dd HH:mm",
                        { locale: ja }
                      )}
                    </time>
                  </div>
                  {notification.body && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {notification.body}
                    </p>
                  )}
                </div>
              </div>
            );

            if (notification.linkUrl) {
              return (
                <Link
                  key={notification.id}
                  href={notification.linkUrl}
                  className="block hover:bg-muted/30 transition-colors"
                >
                  {content}
                </Link>
              );
            }

            return (
              <div
                key={notification.id}
                className={
                  notification.isRead ? "" : "bg-primary/5"
                }
              >
                {content}
              </div>
            );
          })}
        </div>
      )}

      {notifications.length === 50 && (
        <p className="text-xs text-muted-foreground text-center">
          最新50件のみ表示しています
        </p>
      )}
    </div>
  );
}
