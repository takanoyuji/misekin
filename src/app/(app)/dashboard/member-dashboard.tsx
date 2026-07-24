import Link from "next/link";
import { db } from "@/lib/db";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";
import { PageHeader } from "@/components/common/page-header";
import {
  ArrowRight,
  CalendarClock,
  Clock,
  Coffee,
  FileEdit,
  Store as StoreIcon,
  TriangleAlert,
} from "lucide-react";

interface MemberDashboardProps {
  userId: string;
  organizationId: string;
}

const TZ = "Asia/Tokyo";

function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}時間${m.toString().padStart(2, "0")}分`;
}

function formatTime(date: Date | null | undefined): string {
  if (!date) return "—";
  return format(toZonedTime(date, TZ), "HH:mm");
}

/**
 * スタッフ本人向けのホーム
 * 「自分は今どういう状態か」「自分が対応すべきことは何か」に絞って表示する
 */
export async function MemberDashboard({
  userId,
  organizationId,
}: MemberDashboardProps) {
  const staff = await db.staff.findFirst({
    where: { userId, organizationId },
    select: { id: true, displayName: true },
  });

  if (!staff) {
    return (
      <div className="space-y-6">
        <PageHeader title="ホーム" />
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            スタッフ情報が見つかりません。管理者にお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const jstNow = toZonedTime(now, TZ);
  const monthStart = format(jstNow, "yyyy-MM-01");
  const today = format(jstNow, "yyyy-MM-dd");

  const [current, monthly, recent, pendingRequests, staffStores] =
    await Promise.all([
      // 進行中の勤務 (出勤済みで退勤していない)
      db.attendance.findFirst({
        where: { staffId: staff.id, status: "IN_PROGRESS" },
        orderBy: { businessDate: "desc" },
        select: {
          businessDate: true,
          clockInAt: true,
          breakMinutes: true,
          store: { select: { name: true } },
          attendanceEvents: {
            orderBy: { clockedAt: "desc" },
            take: 1,
            select: { eventType: true },
          },
        },
      }),
      // 今月の勤務実績
      db.attendance.findMany({
        where: {
          staffId: staff.id,
          businessDate: { gte: monthStart, lte: today },
        },
        select: {
          businessDate: true,
          workMinutes: true,
          isLocked: true,
          storeId: true,
          hasAnomaly: true,
        },
      }),
      // 直近の勤務
      db.attendance.findMany({
        where: { staffId: staff.id, status: { not: "IN_PROGRESS" } },
        orderBy: { businessDate: "desc" },
        take: 5,
        select: {
          id: true,
          businessDate: true,
          clockInAt: true,
          clockOutAt: true,
          workMinutes: true,
          hasAnomaly: true,
          store: { select: { name: true } },
        },
      }),
      // 審査中・要確認の申請
      db.correctionRequest.findMany({
        where: {
          staffId: staff.id,
          status: { in: ["PENDING", "REJECTED"] },
        },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          updatedAt: true,
          businessDate: true,
          attendance: { select: { businessDate: true } },
        },
      }),
      db.staffStore.findMany({
        where: { staffId: staff.id, isActive: true },
        orderBy: [{ isPrimary: "desc" }],
        select: {
          id: true,
          isPrimary: true,
          store: { select: { name: true } },
          wageHistories: {
            orderBy: { effectiveFrom: "desc" },
            take: 1,
            select: { amount: true },
          },
        },
      }),
    ]);

  // 異常のある勤怠 (退勤漏れなど) は本人が修正申請を出す必要がある
  const anomalies = monthly.filter((a) => a.hasAnomaly);
  const rejected = pendingRequests.filter((r) => r.status === "REJECTED");
  const pending = pendingRequests.filter((r) => r.status === "PENDING");
  const actionCount = anomalies.length + rejected.length;

  const totalMinutes = monthly.reduce((sum, a) => sum + (a.workMinutes ?? 0), 0);
  const workedDays = new Set(
    monthly.filter((a) => (a.workMinutes ?? 0) > 0).map((a) => a.businessDate)
  ).size;

  // 給与は締め済み(ロック済み)の勤怠のみ算出する。未確定分は金額を出さない
  const wageByStore = new Map(
    staffStores.map((ss) => [
      ss.store.name,
      Number(ss.wageHistories[0]?.amount ?? 0),
    ])
  );
  const lockedRows = monthly.filter((a) => a.isLocked);
  const lockedMinutes = lockedRows.reduce(
    (sum, a) => sum + (a.workMinutes ?? 0),
    0
  );
  const storeNameById = new Map(
    staffStores.map((ss) => [ss.id, ss.store.name])
  );
  const confirmedPay = lockedRows.reduce((sum, a) => {
    // 店舗ごとの時給で計算する
    const name = storeNameById.get(a.storeId);
    const wage = name ? (wageByStore.get(name) ?? 0) : 0;
    return sum + ((a.workMinutes ?? 0) / 60) * wage;
  }, 0);

  const breakInProgress =
    current?.attendanceEvents[0]?.eventType === "BREAK_START";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`おかえりなさい、${staff.displayName} さん`}
        description={format(jstNow, "yyyy年M月d日(E)", { locale: ja })}
      />

      {/* 現在の状態 */}
      <section
        aria-labelledby="current-heading"
        className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"
      >
        <h2 id="current-heading" className="sr-only">
          現在の勤務状態
        </h2>
        {current ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                  breakInProgress
                    ? "bg-status-break/10 text-status-break"
                    : "bg-status-working/10 text-status-working"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${
                    breakInProgress ? "bg-status-break" : "bg-status-working"
                  }`}
                />
                {breakInProgress ? "休憩中" : "勤務中"}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {current.store.name} ・ 営業日 {current.businessDate}
              </p>
              <p className="mt-1 font-numeric text-2xl font-bold">
                {formatTime(current.clockInAt)} 出勤
              </p>
            </div>
            {breakInProgress && (
              <Coffee
                className="size-8 text-status-break"
                aria-hidden="true"
              />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Clock
              className="size-8 shrink-0 text-muted-foreground/40"
              aria-hidden="true"
            />
            <div>
              <p className="font-medium">現在は勤務時間外です</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                出退勤の打刻は店舗の端末から行ってください
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 対応が必要なこと */}
      {actionCount > 0 && (
        <section
          aria-labelledby="action-heading"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm sm:p-6"
        >
          <h2
            id="action-heading"
            className="flex items-center gap-2 text-base font-semibold text-amber-900"
          >
            <TriangleAlert className="size-5 shrink-0" aria-hidden="true" />
            対応が必要です（{actionCount}件）
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {anomalies.map((a) => (
              <li
                key={a.businessDate}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2"
              >
                <span className="font-numeric text-amber-900">
                  {a.businessDate} の打刻に確認が必要です
                </span>
                <Link
                  href="/my-correction-requests/new"
                  className="inline-flex items-center gap-1 text-xs font-medium text-amber-900 underline underline-offset-2"
                >
                  修正を申請する
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
            {rejected.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2"
              >
                <span className="font-numeric text-amber-900">
                  {r.attendance?.businessDate ?? r.businessDate ?? "—"} の修正申請が却下されました
                </span>
                <Link
                  href="/my-correction-requests"
                  className="inline-flex items-center gap-1 text-xs font-medium text-amber-900 underline underline-offset-2"
                >
                  内容を確認する
                  <ArrowRight className="size-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 今月の勤務 */}
      <section aria-labelledby="month-heading">
        <h2 id="month-heading" className="mb-3 text-base font-semibold">
          今月の勤務（{format(jstNow, "M月1日", { locale: ja })}〜
          {format(jstNow, "M月d日", { locale: ja })}）
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">出勤日数</p>
            <p className="mt-2 font-numeric text-2xl font-bold">
              {workedDays}
              <span className="ml-1 text-base font-normal">日</span>
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">実働時間</p>
            <p className="mt-2 font-numeric text-2xl font-bold">
              {formatMinutes(totalMinutes)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">確定分の給与</p>
            {lockedMinutes > 0 ? (
              <>
                <p className="mt-2 font-numeric text-2xl font-bold">
                  ¥{Math.floor(confirmedPay).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  締め済み {formatMinutes(lockedMinutes)} 分
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-base font-medium text-muted-foreground">
                  未確定
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  締め処理後に表示されます
                </p>
              </>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          締め処理が済んでいない期間の金額は表示していません。実働時間は暫定値です。
        </p>
      </section>

      {/* 直近の勤務 */}
      <section aria-labelledby="recent-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="recent-heading" className="text-base font-semibold">
            直近の勤務
          </h2>
          <Link
            href="/my-attendance"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            すべて見る
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {recent.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              まだ勤務記録がありません
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <CalendarClock
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="font-numeric font-medium">
                      {a.businessDate}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {a.store.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-numeric">
                    <span className="text-muted-foreground">
                      {formatTime(a.clockInAt)}–{formatTime(a.clockOutAt)}
                    </span>
                    <span className="font-medium">
                      {formatMinutes(a.workMinutes)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* 申請状況と所属店舗 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section
          aria-labelledby="requests-heading"
          className="rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="requests-heading"
              className="flex items-center gap-2 text-base font-semibold"
            >
              <FileEdit className="size-4" aria-hidden="true" />
              審査中の申請
            </h2>
            <Link
              href="/my-correction-requests"
              className="text-sm text-primary hover:underline"
            >
              一覧
            </Link>
          </div>
          {pending.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              審査中の申請はありません
            </p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {pending.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"
                >
                  <span className="font-numeric">
                    {r.attendance?.businessDate ?? r.businessDate ?? "—"}
                  </span>
                  <span className="text-xs text-status-pending">承認待ち</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="stores-heading"
          className="rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <h2
              id="stores-heading"
              className="flex items-center gap-2 text-base font-semibold"
            >
              <StoreIcon className="size-4" aria-hidden="true" />
              所属店舗
            </h2>
            <Link
              href="/my-stores"
              className="text-sm text-primary hover:underline"
            >
              詳細
            </Link>
          </div>
          {staffStores.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              所属店舗が設定されていません
            </p>
          ) : (
            <ul className="mt-4 flex flex-wrap gap-2">
              {staffStores.map((ss) => (
                <li
                  key={ss.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm"
                >
                  {ss.store.name}
                  {ss.isPrimary && (
                    <span className="text-xs text-primary">主</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
