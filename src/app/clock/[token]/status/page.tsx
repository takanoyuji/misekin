import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import {
  calculateClockState,
  getClockStateLabel,
  getAvailableActions,
  type ClockState,
} from "@/lib/business/time-clock";
import { getBusinessDate } from "@/lib/business/business-day";
import bcrypt from "bcryptjs";
import { StatusActions } from "./status-actions";
import { addMinutes } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { format } from "date-fns";
import { Clock } from "lucide-react";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ staffId?: string; pin?: string }>;
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
  const { staffId, pin } = await searchParams;

  if (!staffId || !pin) {
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

  // PINロックチェック
  const isPinLocked =
    staffStore.pinLockedUntil && staffStore.pinLockedUntil > new Date();
  let pinError: string | null = null;

  if (isPinLocked) {
    const lockedUntil = addMinutes(staffStore.pinLockedUntil!, 0);
    const timezone = store.organization.timezone ?? "Asia/Tokyo";
    const zonedLockedUntil = toZonedTime(lockedUntil, timezone);
    pinError = `PINが一時的にロックされています（${format(zonedLockedUntil, "HH:mm")}まで）`;
  } else if (!staffStore.pinHash) {
    pinError = "PINが設定されていません。管理者にお問い合わせください";
  } else {
    const isPinValid = await bcrypt.compare(pin, staffStore.pinHash);
    if (!isPinValid) {
      const newFailCount = staffStore.pinFailCount + 1;
      const lockUntil = newFailCount >= 5 ? addMinutes(new Date(), 15) : null;

      await db.staffStore.update({
        where: { id: staffStore.id },
        data: { pinFailCount: newFailCount, pinLockedUntil: lockUntil },
      });

      if (lockUntil) {
        pinError = "PINを5回間違えました。15分間ロックされます";
      } else {
        pinError = `PINが正しくありません（残り${5 - newFailCount}回）`;
      }
    } else {
      // PIN成功: 失敗カウントリセット
      await db.staffStore.update({
        where: { id: staffStore.id },
        data: { pinFailCount: 0, pinLockedUntil: null },
      });
    }
  }

  // PINエラー時はPIN入力画面に戻す
  if (pinError) {
    // エラーをURLパラメータ経由で渡す（クライアントサイドリダイレクト用）
    redirect(
      `/clock/${token}/pin?staffId=${staffId}&error=${encodeURIComponent(pinError)}`
    );
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
          pin={pin}
          staffName={staffStore.staff.displayName}
          currentState={currentState}
          availableActions={availableActions}
        />

        {/* 戻るボタン */}
        <a
          href={`/clock/${token}`}
          className="mt-4 block text-center text-sm text-gray-400 hover:text-gray-600 py-2 transition-colors"
        >
          スタッフ選択に戻る
        </a>
      </div>
    </div>
  );
}
