/**
 * 勤怠の異常（打刻漏れ等）を本人にメール＋アプリ内通知で知らせる日次ジョブ。
 * POST /api/cron/anomaly-alerts から毎朝1回呼ばれる。仕様は docs/requirements.md 3.10.1。
 *
 * 流れ:
 *   1. 2026-11-01 以降の勤怠のうち、異常の可能性があり（hasAnomaly / 退勤なし / 休憩終了なし）、
 *      申請・管理者修正・締めが無いものを拾う
 *   2. 実行時点で異常を判定し直し、送り先の条件と前回の送信記録で絞る
 *   3. スタッフごとに1通にまとめて送り、送れた分だけ記録と通知を作る
 */
import type { Prisma } from "@/generated/prisma/client";
import { getAppUrl } from "@/lib/app-url";
import {
  ANOMALY_ALERT_START_DATE,
  buildAnomalyAlertEmail,
  buildAnomalyAlertNotification,
  decideNotice,
  evaluateAttendanceForAlert,
  isAlertRecipientEligible,
  type AlertItem,
} from "@/lib/business/anomaly-alert";
import { getBusinessDate } from "@/lib/business/business-day";
import { db } from "@/lib/db";
import { sendAttendanceAnomalyEmail } from "@/lib/email";

export interface AnomalyAlertJobResult {
  dryRun: boolean;
  /** 候補として読んだ勤怠の数 */
  checkedAttendances: number;
  /** 送った（dryRun なら送る予定の）スタッフ */
  staff: {
    staffId: string;
    organizationId: string;
    staffName: string;
    /** dryRun のときだけ入れる（cron の出力にメールアドレスを残さない） */
    email?: string;
    sent: boolean;
    items: { attendanceId: string; businessDate: string; storeName: string; reasons: string[]; decision: string }[];
  }[];
  sentStaffCount: number;
  sentAttendanceCount: number;
  failedStaffCount: number;
}

export async function runAnomalyAlertJob(options: {
  now?: Date;
  dryRun?: boolean;
} = {}): Promise<AnomalyAlertJobResult> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? false;

  const candidates = await db.attendance.findMany({
    where: {
      businessDate: { gte: ANOMALY_ALERT_START_DATE },
      isLocked: false,
      clockInAt: { not: null },
      OR: [
        { hasAnomaly: true },
        { clockOutAt: null },
        { breaks: { some: { endAt: null } } },
      ],
      // 申請が出ている（審査中・承認・却下）ものは既に本人が動いているか、管理者が判断済み
      correctionRequests: {
        none: { status: { in: ["PENDING", "APPROVED", "REJECTED"] } },
      },
      // 管理者が直した勤怠は人の目が入っている
      corrections: { none: {} },
      staff: { status: "ACTIVE", userId: { not: null } },
    },
    select: {
      id: true,
      organizationId: true,
      businessDate: true,
      clockInAt: true,
      clockOutAt: true,
      breaks: { select: { startAt: true, endAt: true } },
      store: {
        select: {
          name: true,
          timezone: true,
          dayChangeHour: true,
          dayChangeMinute: true,
        },
      },
      staff: {
        select: {
          id: true,
          displayName: true,
          status: true,
          resignDate: true,
          userId: true,
          user: { select: { email: true } },
          organization: { select: { name: true, isActive: true } },
        },
      },
      anomalyNotice: { select: { firstSentAt: true, sendCount: true } },
    },
    orderBy: [{ staffId: "asc" }, { businessDate: "asc" }],
  });

  // ログインできる（組織メンバーとして有効な）人だけに送る
  const memberKeys = new Set(
    (
      await db.organizationMember.findMany({
        where: {
          isActive: true,
          userId: {
            in: [...new Set(candidates.map((c) => c.staff.userId!).filter(Boolean))],
          },
        },
        select: { organizationId: true, userId: true },
      })
    ).map((m) => `${m.organizationId}:${m.userId}`)
  );

  type Group = {
    staffId: string;
    organizationId: string;
    userId: string;
    staffName: string;
    organizationName: string;
    email: string;
    items: AlertItem[];
  };
  const groups = new Map<string, Group>();

  for (const a of candidates) {
    const s = a.staff;
    const eligible = isAlertRecipientEligible({
      staffStatus: s.status,
      resignDate: s.resignDate,
      userId: s.userId,
      userEmail: s.user?.email,
      memberActive: memberKeys.has(`${a.organizationId}:${s.userId}`),
      organizationActive: s.organization.isActive,
      now,
    });
    if (!eligible) continue;

    const reasons = evaluateAttendanceForAlert({
      businessDate: a.businessDate,
      clockInAt: a.clockInAt,
      clockOutAt: a.clockOutAt,
      breaks: a.breaks,
      todayBusinessDate: getBusinessDate(
        now,
        a.store.timezone,
        a.store.dayChangeHour,
        a.store.dayChangeMinute
      ),
      now,
    });
    const decision = decideNotice({ reasons, previous: a.anomalyNotice, now });
    if (!decision) continue;

    let g = groups.get(s.id);
    if (!g) {
      g = {
        staffId: s.id,
        organizationId: a.organizationId,
        userId: s.userId!,
        staffName: s.displayName,
        organizationName: s.organization.name,
        email: s.user!.email,
        items: [],
      };
      groups.set(s.id, g);
    }
    g.items.push({
      attendanceId: a.id,
      businessDate: a.businessDate,
      storeName: a.store.name,
      timezone: a.store.timezone,
      clockInAt: a.clockInAt,
      clockOutAt: a.clockOutAt,
      reasons,
      decision,
    });
  }

  const result: AnomalyAlertJobResult = {
    dryRun,
    checkedAttendances: candidates.length,
    staff: [],
    sentStaffCount: 0,
    sentAttendanceCount: 0,
    failedStaffCount: 0,
  };

  const appUrl = getAppUrl();

  for (const g of groups.values()) {
    let sent = false;
    if (!dryRun) {
      const mail = buildAnomalyAlertEmail({
        staffName: g.staffName,
        organizationName: g.organizationName,
        items: g.items,
        appUrl,
      });
      sent = await sendAttendanceAnomalyEmail({ to: g.email, ...mail });

      if (sent) {
        const notification = buildAnomalyAlertNotification(g.items);
        await db.$transaction(async (tx) => {
          for (const item of g.items) {
            const reasons = item.reasons as unknown as Prisma.InputJsonValue;
            await tx.attendanceAnomalyNotice.upsert({
              where: { attendanceId: item.attendanceId },
              create: {
                organizationId: g.organizationId,
                attendanceId: item.attendanceId,
                staffId: g.staffId,
                reasons,
                firstSentAt: now,
                lastSentAt: now,
                sendCount: 1,
              },
              update: {
                reasons,
                lastSentAt: now,
                sendCount: { increment: 1 },
              },
            });
          }
          await tx.notification.create({
            data: {
              organizationId: g.organizationId,
              userId: g.userId,
              staffId: g.staffId,
              type: "ATTENDANCE_ANOMALY_DETECTED",
              title: notification.title,
              body: notification.body,
              linkUrl: notification.linkUrl,
              metadata: {
                attendanceIds: g.items.map((i) => i.attendanceId),
              },
            },
          });
        });
        result.sentStaffCount += 1;
        result.sentAttendanceCount += g.items.length;
      } else {
        result.failedStaffCount += 1;
      }
    }

    result.staff.push({
      staffId: g.staffId,
      organizationId: g.organizationId,
      staffName: g.staffName,
      ...(dryRun ? { email: g.email } : {}),
      sent,
      items: g.items.map((i) => ({
        attendanceId: i.attendanceId,
        businessDate: i.businessDate,
        storeName: i.storeName,
        reasons: i.reasons,
        decision: i.decision,
      })),
    });
  }

  return result;
}
