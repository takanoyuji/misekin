import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Plus } from "lucide-react";

export const metadata: Metadata = {
  title: "修正申請一覧",
};

function formatDateTime(date: Date, timezone = "Asia/Tokyo"): string {
  return format(toZonedTime(date, timezone), "yyyy/MM/dd HH:mm");
}

export default async function MyCorrectionRequestsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = (session as any).activeOrganizationId as string | null;
  if (!activeOrgId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">所属組織が設定されていません。</p>
      </div>
    );
  }

  try {
    await requireOrgMember(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const staff = await db.staff.findFirst({
    where: { userId: session.user!.id, organizationId: activeOrgId },
    select: { id: true },
  });

  if (!staff) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">
          スタッフ情報が見つかりません。管理者にお問い合わせください。
        </p>
      </div>
    );
  }

  const requests = await db.correctionRequest.findMany({
    where: { staffId: staff.id },
    include: {
      attendance: {
        select: {
          businessDate: true,
          store: { select: { name: true } },
        },
      },
      reviewedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="修正申請"
        description="あなたの勤怠修正申請を管理します"
        actions={
          <Link
            href="/my-correction-requests/new"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" aria-hidden="true" />
            申請する
          </Link>
        }
      />

      {pendingCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          申請中の修正申請が {pendingCount} 件あります。管理者の承認をお待ちください。
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              修正申請がありません
            </p>
            <Link
              href="/my-correction-requests/new"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" aria-hidden="true" />
              修正を申請する
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    申請日時
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    対象勤怠日
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    店舗
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    申請理由
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    ステータス
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-numeric text-muted-foreground">
                      {formatDateTime(req.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-numeric font-medium">
                      {req.attendance.businessDate}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {req.attendance.store.name}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                      {req.reason}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={req.status} />
                        {req.reviewNotes && req.status === "REJECTED" && (
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {req.reviewNotes}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
