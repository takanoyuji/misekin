import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, canAccessStore } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { cn } from "@/lib/utils";
import { AlertTriangle, Edit, Lock } from "lucide-react";

export const metadata: Metadata = {
  title: "勤怠詳細",
};

function formatDateTime(date: Date | null | undefined, timezone = "Asia/Tokyo"): string {
  if (!date) return "—";
  return format(toZonedTime(date, timezone), "yyyy/MM/dd HH:mm");
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

const EVENT_TYPE_LABEL: Record<string, string> = {
  CLOCK_IN: "出勤",
  BREAK_START: "休憩開始",
  BREAK_END: "休憩終了",
  CLOCK_OUT: "退勤",
};

const CLOCK_SOURCE_LABEL: Record<string, string> = {
  STORE_URL: "打刻端末",
  ADMIN: "管理者操作",
  SYSTEM: "システム",
};

export default async function AttendanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = (session as any).activeOrganizationId as string | null;
  if (!activeOrgId) redirect("/dashboard");

  let ctx;
  try {
    ctx = await requireAdmin(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;

  const attendance = await db.attendance.findUnique({
    where: { id },
    include: {
      staff: {
        select: {
          id: true,
          displayName: true,
          employeeCode: true,
          email: true,
        },
      },
      store: {
        select: { id: true, name: true, timezone: true },
      },
      breaks: { orderBy: { startAt: "asc" } },
      attendanceEvents: { orderBy: { clockedAt: "asc" } },
      corrections: {
        orderBy: { createdAt: "desc" },
        include: {
          attendance: { select: { id: true } },
        },
      },
      correctionRequests: {
        orderBy: { createdAt: "desc" },
        include: {
          reviewedBy: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!attendance) notFound();
  if (attendance.organizationId !== activeOrgId) notFound();

  const hasAccess = await canAccessStore(ctx.memberId, ctx.role, attendance.storeId);
  if (!hasAccess) redirect("/attendance");

  const timezone = attendance.store.timezone ?? "Asia/Tokyo";
  const anomalyReasons = attendance.anomalyReasons as string[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="勤怠詳細"
        breadcrumbs={[
          { label: "勤怠一覧", href: "/attendance" },
          { label: attendance.businessDate },
        ]}
        actions={
          <Link
            href={`/attendance/${id}/edit`}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              attendance.isLocked
                ? "cursor-not-allowed bg-muted text-muted-foreground"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
            aria-disabled={attendance.isLocked}
            tabIndex={attendance.isLocked ? -1 : undefined}
          >
            {attendance.isLocked ? (
              <>
                <Lock className="size-4" aria-hidden="true" />
                締め済み（修正不可）
              </>
            ) : (
              <>
                <Edit className="size-4" aria-hidden="true" />
                修正する
              </>
            )}
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 基本情報 */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">基本情報</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">勤務日</dt>
              <dd className="font-numeric font-medium">{attendance.businessDate}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">スタッフ</dt>
              <dd className="text-right">
                <span className="font-medium">{attendance.staff.displayName}</span>
                {attendance.staff.employeeCode && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    #{attendance.staff.employeeCode}
                  </span>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">店舗</dt>
              <dd className="font-medium">{attendance.store.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">ステータス</dt>
              <dd>
                <StatusBadge status={attendance.status} />
              </dd>
            </div>
            {attendance.isLocked && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">締め状態</dt>
                <dd className="flex items-center gap-1 text-orange-600">
                  <Lock className="size-3.5" aria-hidden="true" />
                  締め済み
                </dd>
              </div>
            )}
          </dl>
        </section>

        {/* 現在の勤怠時刻 */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">採用中の勤怠時刻</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">出勤</dt>
              <dd className="font-numeric font-medium">
                {formatDateTime(attendance.clockInAt, timezone)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">退勤</dt>
              <dd
                className={cn(
                  "font-numeric font-medium",
                  !attendance.clockOutAt &&
                    (attendance.status === "MISSING_CLOCK_OUT" ||
                      attendance.status === "ANOMALY") &&
                    "text-red-600"
                )}
              >
                {formatDateTime(attendance.clockOutAt, timezone)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">休憩時間</dt>
              <dd className="font-numeric">{formatMinutes(attendance.breakMinutes)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">実労働時間</dt>
              <dd className="font-numeric font-semibold">
                {formatMinutes(attendance.workMinutes)}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* 異常判定 */}
      {attendance.hasAnomaly && anomalyReasons.length > 0 && (
        <section className="rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="size-4 text-orange-600" aria-hidden="true" />
            <h2 className="text-base font-semibold text-orange-800">異常判定内容</h2>
          </div>
          <ul className="space-y-1 text-sm text-orange-800">
            {anomalyReasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2">
                <span aria-hidden="true">・</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 打刻イベント一覧 */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">打刻記録（元データ）</h2>
        </div>
        {attendance.attendanceEvents.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            打刻記録がありません
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    種別
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    打刻時刻
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    記録元
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    IPアドレス
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attendance.attendanceEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">
                      {EVENT_TYPE_LABEL[event.eventType] ?? event.eventType}
                    </td>
                    <td className="px-4 py-3 font-numeric">
                      {formatDateTime(event.clockedAt, timezone)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {CLOCK_SOURCE_LABEL[event.source] ?? event.source}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {event.ipAddress ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 休憩一覧 */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">休憩一覧</h2>
        </div>
        {attendance.breaks.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            休憩記録がありません
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    #
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    開始
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    終了
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    時間
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attendance.breaks.map((brk, i) => {
                  const durationMin =
                    brk.endAt
                      ? Math.round(
                          (brk.endAt.getTime() - brk.startAt.getTime()) / 60000
                        )
                      : null;
                  return (
                    <tr key={brk.id} className="hover:bg-muted/20">
                      <td className="px-5 py-3 font-numeric text-muted-foreground">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 font-numeric">
                        {formatDateTime(brk.startAt, timezone)}
                      </td>
                      <td className="px-4 py-3 font-numeric">
                        {brk.endAt
                          ? formatDateTime(brk.endAt, timezone)
                          : "未終了"}
                        {brk.isAutoEnded && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            (自動終了)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-numeric text-muted-foreground">
                        {durationMin != null ? `${durationMin}分` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 修正履歴 */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">修正履歴</h2>
        </div>
        {attendance.corrections.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            修正履歴がありません
          </p>
        ) : (
          <div className="divide-y divide-border">
            {attendance.corrections.map((correction) => {
              const before = correction.before as any;
              const after = correction.after as any;
              return (
                <div key={correction.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{correction.reason}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>
                          変更前: 出勤{" "}
                          {before?.clockInAt
                            ? formatTime(new Date(before.clockInAt), timezone)
                            : "—"}
                          / 退勤{" "}
                          {before?.clockOutAt
                            ? formatTime(new Date(before.clockOutAt), timezone)
                            : "—"}
                        </span>
                        <span>
                          変更後: 出勤{" "}
                          {after?.clockInAt
                            ? formatTime(new Date(after.clockInAt), timezone)
                            : "—"}
                          / 退勤{" "}
                          {after?.clockOutAt
                            ? formatTime(new Date(after.clockOutAt), timezone)
                            : "—"}
                        </span>
                      </div>
                    </div>
                    <time
                      dateTime={correction.createdAt.toISOString()}
                      className="shrink-0 text-xs text-muted-foreground font-numeric"
                    >
                      {formatDateTime(correction.createdAt)}
                    </time>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 修正申請履歴 */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">修正申請履歴</h2>
        </div>
        {attendance.correctionRequests.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            修正申請履歴がありません
          </p>
        ) : (
          <div className="divide-y divide-border">
            {attendance.correctionRequests.map((req) => {
              const original = req.originalData as any;
              const requested = req.requestedData as any;
              return (
                <div key={req.id} className="px-5 py-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={req.status} />
                      <Link
                        href={`/correction-requests/${req.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        申請を確認
                      </Link>
                    </div>
                    <time
                      dateTime={req.createdAt.toISOString()}
                      className="shrink-0 text-xs text-muted-foreground font-numeric"
                    >
                      {formatDateTime(req.createdAt)}
                    </time>
                  </div>
                  <p className="text-sm text-muted-foreground">{req.reason}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>
                      変更前: 出勤{" "}
                      {original?.clockInAt
                        ? formatTime(new Date(original.clockInAt), timezone)
                        : "—"}
                      / 退勤{" "}
                      {original?.clockOutAt
                        ? formatTime(new Date(original.clockOutAt), timezone)
                        : "—"}
                    </span>
                    <span>
                      希望: 出勤{" "}
                      {requested?.clockInAt
                        ? formatTime(new Date(requested.clockInAt), timezone)
                        : "—"}
                      / 退勤{" "}
                      {requested?.clockOutAt
                        ? formatTime(new Date(requested.clockOutAt), timezone)
                        : "—"}
                    </span>
                  </div>
                  {req.reviewNotes && (
                    <p className="text-xs text-muted-foreground">
                      審査コメント: {req.reviewNotes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {attendance.adminNotes && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-2 text-base font-semibold">管理者メモ</h2>
          <p className="text-sm whitespace-pre-wrap">{attendance.adminNotes}</p>
        </section>
      )}
    </div>
  );
}
