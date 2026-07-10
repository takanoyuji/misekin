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
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "勤怠一覧",
};

const PAGE_SIZE = 50;

interface SearchParams {
  page?: string;
  dateFrom?: string;
  dateTo?: string;
  storeId?: string;
  staffId?: string;
  status?: string;
  hasAnomaly?: string;
  hasPendingRequest?: string;
}

function formatTime(date: Date | null | undefined, timezone = "Asia/Tokyo"): string {
  if (!date) return "—";
  return format(toZonedTime(date, timezone), "HH:mm");
}

function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}時間${m.toString().padStart(2, "0")}分`;
}

export default async function AttendancePage({
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
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  // 日付範囲デフォルト: 今月
  const now = new Date();
  const jstNow = toZonedTime(now, "Asia/Tokyo");
  const defaultDateFrom = format(
    new Date(jstNow.getFullYear(), jstNow.getMonth(), 1),
    "yyyy-MM-dd"
  );
  const defaultDateTo = format(jstNow, "yyyy-MM-dd");

  const dateFrom = params.dateFrom ?? defaultDateFrom;
  const dateTo = params.dateTo ?? defaultDateTo;
  const storeFilter = params.storeId || undefined;
  const statusFilter = params.status || undefined;
  const hasAnomalyFilter =
    params.hasAnomaly === "1" ? true : params.hasAnomaly === "0" ? false : undefined;
  const hasPendingRequest = params.hasPendingRequest === "1";

  // 店舗アクセス制御
  let storeWhere: string[] | undefined = undefined;
  if (accessibleStoreIds !== null) {
    storeWhere = storeFilter
      ? accessibleStoreIds.includes(storeFilter)
        ? [storeFilter]
        : []
      : accessibleStoreIds;
  } else if (storeFilter) {
    storeWhere = [storeFilter];
  }

  const whereBase: any = {
    organizationId: activeOrgId,
    ...(storeWhere !== undefined ? { storeId: { in: storeWhere } } : {}),
    businessDate: { gte: dateFrom, lte: dateTo },
    ...(params.staffId ? { staffId: params.staffId } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(hasAnomalyFilter !== undefined ? { hasAnomaly: hasAnomalyFilter } : {}),
    ...(hasPendingRequest
      ? { correctionRequests: { some: { status: "PENDING" } } }
      : {}),
  };

  const [attendances, total] = await Promise.all([
    db.attendance.findMany({
      where: whereBase,
      include: {
        staff: { select: { displayName: true, employeeCode: true } },
        store: { select: { name: true } },
        correctionRequests: {
          where: { status: "PENDING" },
          select: { id: true },
        },
      },
      orderBy: [{ businessDate: "desc" }, { clockInAt: "desc" }],
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.attendance.count({ where: whereBase }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // フィルター用店舗一覧
  const stores = await db.store.findMany({
    where: {
      organizationId: activeOrgId,
      isActive: true,
      ...(accessibleStoreIds !== null ? { id: { in: accessibleStoreIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p: Record<string, string> = {
      ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params.dateTo ? { dateTo: params.dateTo } : {}),
      ...(params.storeId ? { storeId: params.storeId } : {}),
      ...(params.staffId ? { staffId: params.staffId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.hasAnomaly ? { hasAnomaly: params.hasAnomaly } : {}),
      ...(params.hasPendingRequest
        ? { hasPendingRequest: params.hasPendingRequest }
        : {}),
      ...Object.fromEntries(
        Object.entries(overrides).filter(([, v]) => v !== undefined) as [string, string][]
      ),
    };
    return "/attendance?" + new URLSearchParams(p).toString();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="勤怠一覧" description="スタッフの勤怠記録を確認できます" />

      {/* フィルター */}
      <form
        method="GET"
        action="/attendance"
        className="rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              開始日
            </label>
            <input
              type="date"
              name="dateFrom"
              defaultValue={dateFrom}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              終了日
            </label>
            <input
              type="date"
              name="dateTo"
              defaultValue={dateTo}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              店舗
            </label>
            <select
              name="storeId"
              defaultValue={params.storeId ?? ""}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">すべて</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              ステータス
            </label>
            <select
              name="status"
              defaultValue={params.status ?? ""}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">すべて</option>
              <option value="IN_PROGRESS">勤務中</option>
              <option value="COMPLETED">退勤済み</option>
              <option value="MISSING_CLOCK_OUT">退勤漏れ</option>
              <option value="MISSING_BREAK_END">休憩中</option>
              <option value="ANOMALY">異常</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              異常フラグ
            </label>
            <select
              name="hasAnomaly"
              defaultValue={params.hasAnomaly ?? ""}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">すべて</option>
              <option value="1">異常あり</option>
              <option value="0">正常のみ</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              修正申請
            </label>
            <select
              name="hasPendingRequest"
              defaultValue={params.hasPendingRequest ?? ""}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            >
              <option value="">すべて</option>
              <option value="1">申請中あり</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            絞り込む
          </button>
          <a
            href="/attendance"
            className="inline-flex items-center rounded-md border border-input px-4 py-1.5 text-sm font-medium hover:bg-muted"
          >
            リセット
          </a>
        </div>
      </form>

      {/* テーブル */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-sm text-muted-foreground">
            全 <span className="font-medium text-foreground">{total}</span> 件
          </p>
        </div>

        {attendances.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            条件に一致する勤怠記録がありません
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    勤務日
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    スタッフ
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    店舗
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    出勤
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    退勤
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    休憩
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    実労働
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    状態
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    異常
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attendances.map((att) => {
                  const isMissing =
                    att.status === "MISSING_CLOCK_OUT" || att.status === "ANOMALY";
                  const hasPending = att.correctionRequests.length > 0;
                  return (
                    <tr
                      key={att.id}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-muted/30",
                        isMissing && "bg-red-50 hover:bg-red-100"
                      )}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/attendance/${att.id}`}
                          className="block font-numeric text-sm"
                        >
                          {att.businessDate}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/attendance/${att.id}`} className="block">
                          <span className="font-medium">
                            {att.staff.displayName}
                          </span>
                          {att.staff.employeeCode && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              #{att.staff.employeeCode}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <Link href={`/attendance/${att.id}`} className="block">
                          {att.store.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-numeric">
                        <Link href={`/attendance/${att.id}`} className="block">
                          {formatTime(att.clockInAt)}
                        </Link>
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 font-numeric",
                          isMissing && "text-red-600 font-semibold"
                        )}
                      >
                        <Link href={`/attendance/${att.id}`} className="block">
                          {formatTime(att.clockOutAt)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-numeric text-muted-foreground">
                        <Link href={`/attendance/${att.id}`} className="block">
                          {formatMinutes(att.breakMinutes)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-numeric">
                        <Link href={`/attendance/${att.id}`} className="block">
                          {formatMinutes(att.workMinutes)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/attendance/${att.id}`} className="block">
                          <div className="flex flex-col gap-1">
                            <StatusBadge status={att.status} />
                            {hasPending && (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                申請中
                              </span>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/attendance/${att.id}`} className="block">
                          {att.hasAnomaly && (
                            <AlertTriangle
                              className="size-4 text-orange-500"
                              aria-label="異常あり"
                            />
                          )}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
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
                  href={buildUrl({ page: String(page - 1) })}
                  className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  前へ
                </Link>
              )}
              <span className="text-sm font-medium">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={buildUrl({ page: String(page + 1) })}
                  className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
                >
                  次へ
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
