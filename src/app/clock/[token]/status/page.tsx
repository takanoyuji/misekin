import Link from "next/link";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  calculateClockState,
  getClockStateLabel,
  getAvailableActions,
  type ClockState,
} from "@/lib/business/time-clock";
import { getBusinessDate } from "@/lib/business/business-day";
import { clockCookieName, verifyClockSession } from "@/lib/clock-session";
import { StatusActions } from "./status-actions";
import { toZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { Clock, MapPin } from "lucide-react";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ staffId?: string }>;
}

const stateColorMap: Record<ClockState, string> = {
  NOT_CLOCKED_IN: "text-gray-500",
  WORKING: "text-green-600",
  ON_BREAK: "text-yellow-600",
  CLOCKED_OUT: "text-blue-600",
};

const stateBgMap: Record<ClockState, string> = {
  NOT_CLOCKED_IN: "bg-gray-50 border-gray-200",
  WORKING: "bg-green-50 border-green-200",
  ON_BREAK: "bg-yellow-50 border-yellow-200",
  CLOCKED_OUT: "bg-blue-50 border-blue-200",
};

export default async function StatusPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { staffId } = await searchParams;

  if (!staffId) {
    redirect(`/clock/${token}`);
  }

  // トークン検証
  const clockUrl = await db.storeClockUrl.findFirst({
    where: { token, isActive: true },
    include: {
      store: {
        include: {
          organization: { select: { id: true, name: true, timezone: true } },
        },
      },
    },
  });

  if (!clockUrl || (clockUrl.expiresAt && clockUrl.expiresAt < new Date())) {
    redirect("/clock/invalid");
  }

  const store = clockUrl.store;

  // スタッフ＆PINの検証
  const staffStore = await db.staffStore.findFirst({
    where: {
      staffId,
      storeId: store.id,
      isActive: true,
      canClock: true,
      staff: { status: "ACTIVE", organizationId: store.organizationId },
    },
    include: { staff: { select: { id: true, displayName: true } } },
  });

  if (!staffStore) {
    redirect(`/clock/${token}`);
  }

  // PINの検証は verifyClockPin 側で済ませ、その結果を短命Cookieで確認する。
  // PIN必須のスタッフはセッションが無ければPIN入力へ戻す。
  if (staffStore.requirePin) {
    const cookieStore = await cookies();
    const session = cookieStore.get(clockCookieName(token))?.value;
    if (!verifyClockSession(session, staffStore.id, new Date().getTime())) {
      redirect(`/clock/${token}/pin?staffId=${staffId}`);
    }
  }

  // 現在の勤怠状態を取得
  const now = new Date();
  const timezone = store.organization.timezone ?? "Asia/Tokyo";
  const businessDate = getBusinessDate(
    now,
    timezone,
    store.dayChangeHour,
    store.dayChangeMinute
  );

  const todayAttendance = await db.attendance.findFirst({
    where: { staffId, storeId: store.id, businessDate },
    include: {
      attendanceEvents: { orderBy: { clockedAt: "asc" } },
      breaks: { orderBy: { startAt: "asc" } },
    },
  });

  const currentState = calculateClockState(
    todayAttendance?.attendanceEvents ?? []
  );
  const stateLabel = getClockStateLabel(currentState);
  const availableActions = getAvailableActions(currentState);

  const zonedNow = toZonedTime(now, timezone);
  const displayTime = format(zonedNow, "HH:mm");

  // 出勤時刻の表示
  let clockInDisplay: string | null = null;
  if (todayAttendance?.clockInAt) {
    const zonedClockIn = toZonedTime(todayAttendance.clockInAt, timezone);
    clockInDisplay = format(zonedClockIn, "HH:mm");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* スタッフ名 */}
        <div className="text-center mb-6">
          <p className="text-gray-500 text-sm mb-1">{store.name}</p>
          <h1 className="text-2xl font-bold text-gray-900">
            {staffStore.staff.displayName}
          </h1>
          <div className="flex items-center justify-center gap-1 mt-1 text-gray-400 text-sm">
            <Clock className="size-4" aria-hidden="true" />
            <span aria-label={`現在時刻 ${displayTime}`}>{displayTime}</span>
          </div>
        </div>

        {/* 現在の状態 */}
        <div
          className={`rounded-2xl border-2 p-6 text-center mb-6 ${stateBgMap[currentState]}`}
          role="status"
          aria-label={`現在の状態: ${stateLabel}`}
        >
          <p className="text-sm text-gray-500 mb-1">現在の状態</p>
          <p className={`text-3xl font-bold ${stateColorMap[currentState]}`}>
            {stateLabel}
          </p>
          {clockInDisplay && currentState !== "NOT_CLOCKED_IN" && (
            <p className="text-sm text-gray-400 mt-2">
              出勤時刻: {clockInDisplay}
            </p>
          )}
        </div>

        {/* アクションボタン */}
        <StatusActions
          token={token}
          staffId={staffId}
          staffName={staffStore.staff.displayName}
          currentState={currentState}
          availableActions={availableActions}
          locationTrackingEnabled={store.locationTrackingEnabled}
        />

        {/* 位置情報の告知。記録する店舗でだけ出す */}
        {store.locationTrackingEnabled && (
          <p className="mt-4 flex items-start gap-1.5 text-xs text-gray-400">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              打刻した瞬間の位置を記録します。常時の追跡はしません。
              位置が取れなくても打刻はできます。
            </span>
          </p>
        )}

        {/* 戻るボタン */}
        <Link
          href={`/clock/${token}`}
          className="mt-4 block text-center text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
        >
          スタッフ選択に戻る
        </Link>
      </div>
    </div>
  );
}
