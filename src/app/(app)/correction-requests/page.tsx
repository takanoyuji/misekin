import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, getAccessibleStoreIds } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const metadata: Metadata = {
  title: "修正申請一覧",
};

interface SearchParams {
  status?: string;
  page?: string;
}

const PAGE_SIZE = 50;

function formatDateTime(date: Date, timezone = "Asia/Tokyo"): string {
  return format(toZonedTime(date, timezone), "yyyy/MM/dd HH:mm");
}

export default async function CorrectionRequestsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
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

  let ctx;
  try {
    ctx = await requireAdmin(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const accessibleStoreIds = await getAccessibleStoreIds(
    ctx.memberId,
    ctx.role,
    activeOrgId
  );

  const params = await searchParams;
  const statusFilter = params.status || "PENDING";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const storeFilter =
    accessibleStoreIds !== null
      ? { storeId: { in: accessibleStoreIds } }
      : {};

  const whereBase = {
    ...(statusFilter !== "ALL" ? { status: statusFilter as any } : {}),
    attendance: {
      organizationId: activeOrgId,
      ...storeFilter,
    },
  };

  const [requests, total, pendingCount] = await Promise.all([
    db.correctionRequest.findMany({
      where: whereBase,
      include: {
        staff: { select: { displayName: true, employeeCode: true } },
        attendance: {
          select: {
            businessDate: true,
            store: { select: { name: true } },
          },
        },
        reviewedBy: { select: { name: true } },
      },
      orderBy: [
        // PENDING を優先
        { status: "asc" },
        { createdAt: "desc" },
      ],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.correctionRequest.count({ where: whereBase }),
    db.correctionRequest.count({
      where: {
        status: "PENDING",
        attendance: { organizationId: activeOrgId, ...storeFilter },
      },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const statuses = [
    { value: "PENDING", label: "申請中" },
    { value: "APPROVED", label: "承認済み" },
    { value: "REJECTED", label: "却下" },
    { value: "CANCELLED", label: "取消" },
    { value: "ALL", label: "すべて" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="修正申請一覧"
        description="スタッフからの勤怠修正申請を管理します"
      />

      {/* ステータスタブ */}
      <div className="flex items-center gap-1 border-b border-border">
        {statuses.map((s) => (
          <Link
            key={s.value}
            href={`/correction-requests?status=${s.value}`}
            className={[
              "inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              statusFilter === s.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {s.label}
            {s.value === "PENDING" && pendingCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground leading-none">
                {pendingCount}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* テーブル */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-sm text-muted-foreground">
            全 <span className="font-medium text-foreground">{total}</span> 件
          </p>
        </div>

        {requests.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            {statusFilter === "PENDING"
              ? "未処理の修正申請はありません"
              : "条件に一致する修正申請がありません"}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    スタッフ
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    店舗
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    対象勤怠日
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    申請日時
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
                  <tr
                    key={req.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/correction-requests/${req.id}`}
                        className="block"
                      >
                        <span className="font-medium">
                          {req.staff.displayName}
                        </span>
                        {req.staff.employeeCode && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            #{req.staff.employeeCode}
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <Link
                        href={`/correction-requests/${req.id}`}
                        className="block"
                      >
                        {req.attendance.store.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-numeric">
                      <Link
                        href={`/correction-requests/${req.id}`}
                        className="block"
                      >
                        {req.attendance.businessDate}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-numeric text-muted-foreground">
                      <Link
                        href={`/correction-requests/${req.id}`}
                        className="block"
                      >
                        {formatDateTime(req.createdAt)}
                      </Link>
                    </td>
                    <td className="max-w-[200px] px-4 py-3">
                      <Link
                        href={`/correction-requests/${req.id}`}
                        className="block truncate text-muted-foreground"
                      >
                        {req.reason}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/correction-requests/${req.id}`}
                        className="block"
                      >
                        <StatusBadge status={req.status} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-4">
            <p className="text-sm text-muted-foreground">
              {(page - 1) * PAGE_SIZE + 1}〜
              {Math.min(page * PAGE_SIZE, total)} 件 / 全 {total} 件
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link
                  href={`/correction-requests?status=${statusFilter}&page=${page - 1}`}
                  className="inline-flex items-center rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
                >
                  前へ
                </Link>
              )}
              <span className="text-sm font-medium">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={`/correction-requests?status=${statusFilter}&page=${page + 1}`}
                  className="inline-flex items-center rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
                >
                  次へ
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
