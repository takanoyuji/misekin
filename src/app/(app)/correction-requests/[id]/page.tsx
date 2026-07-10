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
import { CorrectionRequestReviewForm } from "./correction-request-review-form";

export const metadata: Metadata = {
  title: "修正申請詳細",
};

function formatDateTime(
  date: Date | string | null | undefined,
  timezone = "Asia/Tokyo"
): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return format(toZonedTime(d, timezone), "yyyy/MM/dd HH:mm");
  } catch {
    return "—";
  }
}

export default async function CorrectionRequestDetailPage({
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

  const request = await db.correctionRequest.findUnique({
    where: { id },
    include: {
      staff: {
        select: { displayName: true, employeeCode: true, email: true },
      },
      attendance: {
        select: {
          id: true,
          businessDate: true,
          clockInAt: true,
          clockOutAt: true,
          organizationId: true,
          storeId: true,
          store: { select: { name: true, timezone: true } },
        },
      },
      reviewedBy: { select: { name: true, email: true } },
    },
  });

  if (!request) notFound();
  if (request.attendance.organizationId !== activeOrgId) notFound();

  const hasAccess = await canAccessStore(
    ctx.memberId,
    ctx.role,
    request.attendance.storeId
  );
  if (!hasAccess) redirect("/correction-requests");

  const timezone = request.attendance.store.timezone ?? "Asia/Tokyo";
  const originalData = request.originalData as any;
  const requestedData = request.requestedData as any;
  const isPending = request.status === "PENDING";

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="修正申請詳細"
        breadcrumbs={[
          { label: "修正申請一覧", href: "/correction-requests" },
          { label: `申請 #${id.slice(-6)}` },
        ]}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        {/* 申請者情報 */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">申請者情報</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">スタッフ名</dt>
              <dd className="font-medium">{request.staff.displayName}</dd>
            </div>
            {request.staff.employeeCode && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">社員番号</dt>
                <dd className="font-numeric">#{request.staff.employeeCode}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">メール</dt>
              <dd className="text-xs">{request.staff.email}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">申請日時</dt>
              <dd className="font-numeric">
                {formatDateTime(request.createdAt)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">ステータス</dt>
              <dd>
                <StatusBadge status={request.status} />
              </dd>
            </div>
          </dl>
        </section>

        {/* 対象勤怠 */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">対象勤怠</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">勤務日</dt>
              <dd className="font-numeric font-medium">
                {request.attendance.businessDate}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">店舗</dt>
              <dd>{request.attendance.store.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">現在の出勤</dt>
              <dd className="font-numeric">
                {formatDateTime(request.attendance.clockInAt, timezone)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">現在の退勤</dt>
              <dd className="font-numeric">
                {formatDateTime(request.attendance.clockOutAt, timezone)}
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <Link
              href={`/attendance/${request.attendance.id}`}
              className="text-sm text-primary hover:underline"
            >
              勤怠詳細を確認 &rarr;
            </Link>
          </div>
        </section>
      </div>

      {/* 変更前・変更後の比較 */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">変更内容の比較</h2>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="mb-3 font-medium text-muted-foreground">変更前（現在）</p>
            <dl className="space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">出勤</dt>
                <dd className="font-numeric">
                  {originalData?.clockInAt
                    ? formatDateTime(new Date(originalData.clockInAt), timezone)
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">退勤</dt>
                <dd className="font-numeric">
                  {originalData?.clockOutAt
                    ? formatDateTime(new Date(originalData.clockOutAt), timezone)
                    : "—"}
                </dd>
              </div>
              {Array.isArray(originalData?.breaks) &&
                originalData.breaks.map((b: any, i: number) => (
                  <div key={i} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">休憩{i + 1}</dt>
                    <dd className="font-numeric text-xs">
                      {b.startAt
                        ? format(
                            toZonedTime(new Date(b.startAt), timezone),
                            "HH:mm"
                          )
                        : "—"}
                      〜
                      {b.endAt
                        ? format(
                            toZonedTime(new Date(b.endAt), timezone),
                            "HH:mm"
                          )
                        : "—"}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
          <div>
            <p className="mb-3 font-medium text-primary">変更希望</p>
            <dl className="space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">出勤</dt>
                <dd className="font-numeric font-medium text-primary">
                  {requestedData?.clockInAt
                    ? formatDateTime(new Date(requestedData.clockInAt), timezone)
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">退勤</dt>
                <dd className="font-numeric font-medium text-primary">
                  {requestedData?.clockOutAt
                    ? formatDateTime(
                        new Date(requestedData.clockOutAt),
                        timezone
                      )
                    : "—"}
                </dd>
              </div>
              {Array.isArray(requestedData?.breaks) &&
                requestedData.breaks.map((b: any, i: number) => (
                  <div key={i} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">休憩{i + 1}</dt>
                    <dd className="font-numeric text-xs font-medium text-primary">
                      {b.startAt
                        ? format(
                            toZonedTime(new Date(b.startAt), timezone),
                            "HH:mm"
                          )
                        : "—"}
                      〜
                      {b.endAt
                        ? format(
                            toZonedTime(new Date(b.endAt), timezone),
                            "HH:mm"
                          )
                        : "—"}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>
      </section>

      {/* 申請理由 */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-base font-semibold">申請理由</h2>
        <p className="text-sm whitespace-pre-wrap">{request.reason}</p>
        {request.notes && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              補足メモ
            </p>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
              {request.notes}
            </p>
          </div>
        )}
      </section>

      {/* 審査済みの場合 */}
      {!isPending && request.reviewedAt && (
        <section className="rounded-xl border border-border bg-muted/30 p-5">
          <h2 className="mb-3 text-base font-semibold">審査結果</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">審査者</dt>
              <dd>{request.reviewedBy?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">審査日時</dt>
              <dd className="font-numeric">
                {formatDateTime(request.reviewedAt)}
              </dd>
            </div>
            {request.reviewNotes && (
              <div className="flex flex-col gap-1">
                <dt className="text-muted-foreground">コメント</dt>
                <dd className="whitespace-pre-wrap">{request.reviewNotes}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* 承認・却下フォーム（申請中のみ） */}
      {isPending && (
        <CorrectionRequestReviewForm
          requestId={id}
          organizationId={activeOrgId}
        />
      )}
    </div>
  );
}
