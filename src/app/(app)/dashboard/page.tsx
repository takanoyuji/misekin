import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import {
  Users,
  Clock,
  AlertTriangle,
  FileEdit,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "ホーム",
};

// ダッシュボード集計カード
interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  description?: string;
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  colorClass,
  bgClass,
  description,
}: SummaryCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full",
            bgClass
          )}
        >
          <Icon className={cn("size-4", colorClass)} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-2">
        <p className={cn("text-3xl font-bold font-numeric", colorClass)}>
          {value}
          <span className="ml-1 text-base font-medium">人</span>
        </p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = (session as any).activeOrganizationId as string | null;

  if (!activeOrgId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">
          所属組織が設定されていません。管理者にお問い合わせください。
        </p>
      </div>
    );
  }

  // 今日の営業日を取得 (Asia/Tokyo)
  const now = new Date();
  const jstNow = toZonedTime(now, "Asia/Tokyo");
  const businessDate = format(jstNow, "yyyy-MM-dd");

  // 今日の勤怠レコードを取得
  const attendances = await db.attendance.findMany({
    where: {
      organizationId: activeOrgId,
      businessDate,
    },
    include: {
      staff: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
      store: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { clockInAt: "asc" },
  });

  type AttendanceRow = (typeof attendances)[number];

  // ステータス集計
  const workingCount = attendances.filter(
    (a: AttendanceRow) => a.status === "IN_PROGRESS"
  ).length;
  const breakCount = attendances.filter(
    (a: AttendanceRow) => a.status === "MISSING_BREAK_END"
  ).length;
  const completedCount = attendances.filter(
    (a: AttendanceRow) => a.status === "COMPLETED"
  ).length;
  const missingClockOutCount = attendances.filter(
    (a: AttendanceRow) =>
      a.status === "MISSING_CLOCK_OUT" || a.status === "ANOMALY"
  ).length;

  // 店舗別集計
  const storeMap = new Map<
    string,
    {
      storeName: string;
      working: number;
      onBreak: number;
      completed: number;
      missing: number;
    }
  >();

  for (const att of attendances) {
    const storeId = att.store.id;
    const storeName = att.store.name;
    if (!storeMap.has(storeId)) {
      storeMap.set(storeId, {
        storeName,
        working: 0,
        onBreak: 0,
        completed: 0,
        missing: 0,
      });
    }
    const entry = storeMap.get(storeId)!;
    if (att.status === "IN_PROGRESS") entry.working++;
    else if (att.status === "MISSING_BREAK_END") entry.onBreak++;
    else if (att.status === "COMPLETED") entry.completed++;
    else if (att.status === "MISSING_CLOCK_OUT" || att.status === "ANOMALY")
      entry.missing++;
  }

  const storeStats = Array.from(storeMap.entries()).map(([id, stats]) => ({
    id,
    ...stats,
  }));

  // 退勤漏れスタッフ
  const missingClockOutStaff = attendances.filter(
    (a: AttendanceRow) =>
      a.status === "MISSING_CLOCK_OUT" || a.status === "ANOMALY"
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type CorrectionRow = any;

  // 未処理修正申請 (最新5件)
  const pendingCorrections = await db.correctionRequest.findMany({
    where: {
      status: "PENDING",
      attendance: {
        organizationId: activeOrgId,
      },
    },
    include: {
      staff: {
        select: {
          displayName: true,
        },
      },
      attendance: {
        select: {
          businessDate: true,
          store: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const pendingCorrectionCount = await db.correctionRequest.count({
    where: {
      status: "PENDING",
      attendance: {
        organizationId: activeOrgId,
      },
    },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="ホーム"
        description={`${format(jstNow, "yyyy年M月d日")}の勤怠状況`}
      />

      {/* サマリーカード */}
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="sr-only">
          本日の状況サマリー
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryCard
            title="勤務中"
            value={workingCount}
            icon={Users}
            colorClass="text-status-working"
            bgClass="bg-status-working"
            description="現在出勤しているスタッフ"
          />
          <SummaryCard
            title="休憩中"
            value={breakCount}
            icon={Clock}
            colorClass="text-status-break"
            bgClass="bg-status-break"
            description="現在休憩中のスタッフ"
          />
          <SummaryCard
            title="退勤済み"
            value={completedCount}
            icon={CheckCircle}
            colorClass="text-muted-foreground"
            bgClass="bg-muted"
            description="本日退勤したスタッフ"
          />
          <SummaryCard
            title="退勤漏れ"
            value={missingClockOutCount}
            icon={AlertTriangle}
            colorClass="text-status-missing"
            bgClass="bg-status-missing"
            description="退勤打刻が未完了"
          />
          <SummaryCard
            title="未処理申請"
            value={pendingCorrectionCount}
            icon={FileEdit}
            colorClass="text-status-pending"
            bgClass="bg-status-pending"
            description="承認待ちの修正申請"
          />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 店舗別現在状況 */}
        <section aria-labelledby="store-status-heading">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h2
                id="store-status-heading"
                className="text-base font-semibold"
              >
                店舗別現在状況
              </h2>
            </div>
            {storeStats.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                本日の勤怠記録がありません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                        店舗名
                      </th>
                      <th className="px-3 py-3 text-center font-medium text-muted-foreground">
                        勤務中
                      </th>
                      <th className="px-3 py-3 text-center font-medium text-muted-foreground">
                        休憩中
                      </th>
                      <th className="px-3 py-3 text-center font-medium text-muted-foreground">
                        退勤済み
                      </th>
                      <th className="px-3 py-3 text-center font-medium text-muted-foreground">
                        漏れ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {storeStats.map((store) => (
                      <tr
                        key={store.id}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-5 py-3 font-medium">
                          {store.storeName}
                        </td>
                        <td className="px-3 py-3 text-center font-numeric">
                          <span className="text-status-working font-semibold">
                            {store.working}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center font-numeric">
                          <span className="text-status-break font-semibold">
                            {store.onBreak}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center font-numeric text-muted-foreground">
                          {store.completed}
                        </td>
                        <td className="px-3 py-3 text-center font-numeric">
                          {store.missing > 0 ? (
                            <span className="text-status-missing font-semibold">
                              {store.missing}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* 退勤漏れスタッフ一覧 */}
        <section aria-labelledby="missing-heading">
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 id="missing-heading" className="text-base font-semibold">
                退勤漏れスタッフ
              </h2>
              {missingClockOutCount > 0 && (
                <span className="rounded-full bg-status-missing px-2.5 py-0.5 text-xs font-semibold text-status-missing">
                  {missingClockOutCount}件
                </span>
              )}
            </div>
            {missingClockOutStaff.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                退勤漏れはありません
              </p>
            ) : (
              <ul className="divide-y divide-border" role="list">
                {missingClockOutStaff.map((att: AttendanceRow) => (
                  <li
                    key={att.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {att.staff.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {att.store.name} ・ 出勤:{" "}
                        {att.clockInAt
                          ? format(
                              toZonedTime(att.clockInAt, "Asia/Tokyo"),
                              "HH:mm"
                            )
                          : "—"}
                      </p>
                    </div>
                    <StatusBadge status={att.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* 未処理修正申請一覧 (最新5件) */}
      <section aria-labelledby="corrections-heading">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 id="corrections-heading" className="text-base font-semibold">
              未処理修正申請
            </h2>
            {pendingCorrectionCount > 0 && (
              <a
                href="/correction-requests"
                className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                すべて見る ({pendingCorrectionCount}件)
              </a>
            )}
          </div>
          {pendingCorrections.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              未処理の修正申請はありません
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
                      対象日
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
                  {pendingCorrections.map((req: CorrectionRow) => (
                    <tr
                      key={req.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-5 py-3 font-medium">
                        {req.staff.displayName}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {req.attendance.store.name}
                      </td>
                      <td className="px-4 py-3 font-numeric text-muted-foreground">
                        {req.attendance.businessDate}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                        {req.reason}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={req.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
