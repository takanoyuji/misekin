import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, FileEdit } from "lucide-react";

export const metadata: Metadata = {
  title: "自分の勤怠",
};

interface SearchParams {
  month?: string; // YYYY-MM
}

function formatTime(date: Date | null | undefined, timezone = "Asia/Tokyo"): string {
  if (!date) return "—";
  return format(toZonedTime(date, timezone), "HH:mm");
}

function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export default async function MyAttendancePage({
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
    ctx = await requireOrgMember(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  // スタッフプロフィールを取得
  const staff = await db.staff.findFirst({
    where: { userId: session.user!.id, organizationId: activeOrgId },
    select: { id: true, displayName: true },
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

  const params = await searchParams;

  // 月の計算
  const now = new Date();
  const jstNow = toZonedTime(now, "Asia/Tokyo");
  const currentMonth = params.month ?? format(jstNow, "yyyy-MM");

  let targetDate: Date;
  try {
    targetDate = new Date(`${currentMonth}-01`);
    if (isNaN(targetDate.getTime())) throw new Error("Invalid date");
  } catch {
    targetDate = startOfMonth(jstNow);
  }

  const monthStart = format(startOfMonth(targetDate), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(targetDate), "yyyy-MM-dd");

  const prevMonth = format(subMonths(targetDate, 1), "yyyy-MM");
  const nextMonth = format(addMonths(targetDate, 1), "yyyy-MM");
  const isCurrentMonth =
    format(targetDate, "yyyy-MM") === format(jstNow, "yyyy-MM");

  const attendances = await db.attendance.findMany({
    where: {
      organizationId: activeOrgId,
      staffId: staff.id,
      businessDate: { gte: monthStart, lte: monthEnd },
    },
    include: {
      store: { select: { name: true, timezone: true } },
      correctionRequests: {
        where: { status: "PENDING" },
        select: { id: true },
      },
    },
    orderBy: { businessDate: "desc" },
  });

  // 月の集計
  const totalWorkMinutes = attendances.reduce(
    (sum, a) => sum + (a.workMinutes ?? 0),
    0
  );
  const completedCount = attendances.filter(
    (a) => a.status === "COMPLETED"
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="自分の勤怠"
        description="あなたの勤怠記録を確認できます"
      />

      {/* 月切り替え */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
        <Link
          href={`/my-attendance?month=${prevMonth}`}
          className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          前月
        </Link>
        <div className="text-center">
          <p className="text-lg font-semibold">
            {format(targetDate, "yyyy年M月")}
          </p>
          <p className="text-xs text-muted-foreground">
            {staff.displayName}
          </p>
        </div>
        <Link
          href={`/my-attendance?month=${nextMonth}`}
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted",
            isCurrentMonth && "pointer-events-none opacity-40"
          )}
          aria-disabled={isCurrentMonth}
        >
          翌月
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {/* 月の集計 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm text-center">
          <p className="text-xs text-muted-foreground">出勤日数</p>
          <p className="text-2xl font-bold font-numeric mt-1">
            {completedCount}
            <span className="text-base font-medium ml-1">日</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm text-center">
          <p className="text-xs text-muted-foreground">総労働時間</p>
          <p className="text-2xl font-bold font-numeric mt-1">
            {Math.floor(totalWorkMinutes / 60)}
            <span className="text-base font-medium ml-0.5">h</span>
            {(totalWorkMinutes % 60).toString().padStart(2, "0")}
            <span className="text-base font-medium ml-0.5">m</span>
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-border bg-card p-4 shadow-sm text-center">
          <p className="text-xs text-muted-foreground">レコード数</p>
          <p className="text-2xl font-bold font-numeric mt-1">
            {attendances.length}
            <span className="text-base font-medium ml-1">件</span>
          </p>
        </div>
      </div>

      {/* 勤怠テーブル */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">勤怠一覧</h2>
        </div>

        {attendances.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            この月の勤怠記録がありません
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    日付
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
                    実労働
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    状態
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attendances.map((att) => {
                  const tz = att.store.timezone ?? "Asia/Tokyo";
                  const hasPending = att.correctionRequests.length > 0;
                  const isMissing =
                    att.status === "MISSING_CLOCK_OUT" ||
                    att.status === "ANOMALY";
                  return (
                    <tr
                      key={att.id}
                      className={cn(
                        "transition-colors",
                        isMissing && "bg-red-50"
                      )}
                    >
                      <td className="px-4 py-3 font-numeric font-medium">
                        {att.businessDate}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {att.store.name}
                      </td>
                      <td className="px-4 py-3 font-numeric">
                        {formatTime(att.clockInAt, tz)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 font-numeric",
                          isMissing && "text-red-600 font-semibold"
                        )}
                      >
                        {formatTime(att.clockOutAt, tz)}
                      </td>
                      <td className="px-4 py-3 font-numeric">
                        {formatMinutes(att.workMinutes)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={att.status} />
                          {hasPending && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              申請中
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {!att.isLocked && !hasPending && (
                          <Link
                            href={`/my-correction-requests/new?attendanceId=${att.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-muted"
                          >
                            <FileEdit className="size-3" aria-hidden="true" />
                            修正申請
                          </Link>
                        )}
                        {hasPending && (
                          <Link
                            href="/my-correction-requests"
                            className="text-xs text-primary hover:underline"
                          >
                            申請確認
                          </Link>
                        )}
                        {att.isLocked && (
                          <span className="text-xs text-muted-foreground">
                            締め済み
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
