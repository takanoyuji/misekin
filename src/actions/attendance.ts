"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/auth/audit";
import { requireAdmin, canAccessStore } from "@/lib/auth/permissions";
import {
  correctAttendanceSchema,
  correctionRequestSchema,
  reviewCorrectionRequestSchema,
  type CorrectAttendanceInput,
  type CorrectionRequestInput,
  type ReviewCorrectionRequestInput,
} from "@/lib/validations/attendance";
import { getBusinessDate } from "@/lib/business/business-day";
import {
  calculateClockState,
  validateClockTransition,
} from "@/lib/business/time-clock";
import {
  calculateBreakMinutes,
  calculateWorkMinutes,
} from "@/lib/business/attendance";
import { detectAnomalies } from "@/lib/business/anomaly-detection";
import bcrypt from "bcryptjs";
import { addMinutes } from "date-fns";

interface ActionResult {
  success?: boolean;
  error?: string;
  data?: unknown;
}

interface ClockActionParams {
  token: string;
  staffId: string;
  pin: string;
  action: "CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT";
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

/**
 * 打刻処理（打刻URLからの操作）
 * @returns success または error
 */
export async function clockAction(
  params: ClockActionParams
): Promise<ActionResult & { newState?: string; clockedAt?: Date }> {
  const { token, staffId, pin, action, ipAddress, userAgent, deviceFingerprint } =
    params;

  // 打刻URLのトークン検証
  const clockUrl = await db.storeClockUrl.findFirst({
    where: { token, isActive: true },
    include: {
      store: {
        include: { organization: true },
      },
    },
  });

  if (!clockUrl) {
    return { error: "無効な打刻URLです" };
  }

  if (clockUrl.expiresAt && clockUrl.expiresAt < new Date()) {
    return { error: "打刻URLの有効期限が切れています" };
  }

  const store = clockUrl.store;
  const organization = store.organization;

  // スタッフの存在確認と組織確認
  const staffStore = await db.staffStore.findFirst({
    where: {
      staffId,
      storeId: store.id,
      isActive: true,
      canClock: true,
      staff: {
        status: "ACTIVE",
        organizationId: organization.id,
      },
    },
    include: { staff: true },
  });

  if (!staffStore) {
    return { error: "スタッフが見つかりません" };
  }

  // PINロックチェック
  if (staffStore.pinLockedUntil && staffStore.pinLockedUntil > new Date()) {
    return { error: "PINが一時的にロックされています。しばらく待ってからお試しください" };
  }

  // PIN検証
  if (!staffStore.pinHash) {
    return { error: "PINが設定されていません。管理者にお問い合わせください" };
  }

  const isPinValid = await bcrypt.compare(pin, staffStore.pinHash);
  if (!isPinValid) {
    // 失敗回数を増やす
    const newFailCount = staffStore.pinFailCount + 1;
    const lockUntil = newFailCount >= 5 ? addMinutes(new Date(), 15) : null;

    await db.staffStore.update({
      where: { id: staffStore.id },
      data: {
        pinFailCount: newFailCount,
        pinLockedUntil: lockUntil,
      },
    });

    if (lockUntil) {
      return { error: "PINの入力を5回間違えました。15分間ロックされます" };
    }

    return {
      error: `PINが正しくありません（残り${5 - newFailCount}回）`,
    };
  }

  // PIN成功: 失敗カウントリセット
  await db.staffStore.update({
    where: { id: staffStore.id },
    data: { pinFailCount: 0, pinLockedUntil: null },
  });

  const now = new Date();
  const businessDate = getBusinessDate(
    now,
    store.timezone,
    store.dayChangeHour,
    store.dayChangeMinute
  );

  // 現在の勤怠状態を取得
  const todayAttendance = await db.attendance.findFirst({
    where: {
      staffId,
      storeId: store.id,
      businessDate,
    },
    include: {
      breaks: { orderBy: { startAt: "asc" } },
      attendanceEvents: { orderBy: { clockedAt: "asc" } },
    },
  });

  const currentState = calculateClockState(
    todayAttendance?.attendanceEvents ?? []
  );

  // 別店舗で勤務中のチェック（CLOCK_IN の場合のみ）
  if (action === "CLOCK_IN") {
    const activeElsewhere = await db.attendance.findFirst({
      where: {
        staffId,
        status: "IN_PROGRESS",
        NOT: { storeId: store.id },
        businessDate,
      },
    });
    if (activeElsewhere) {
      return { error: "他の店舗で勤務中です。先に退勤してください" };
    }
  }

  // 状態遷移バリデーション
  const transitionError = validateClockTransition(currentState, action);
  if (transitionError) {
    return { error: transitionError };
  }

  // 休憩中に退勤する場合は自動的に休憩終了を記録
  const isBreakingAndClockOut = currentState === "ON_BREAK" && action === "CLOCK_OUT";

  try {
    await db.$transaction(async (tx) => {
      let attendance = todayAttendance;

      // CLOCK_INの場合は勤怠レコードを作成
      if (action === "CLOCK_IN") {
        attendance = await tx.attendance.create({
          data: {
            organizationId: organization.id,
            storeId: store.id,
            staffId,
            businessDate,
            clockInAt: now,
            status: "IN_PROGRESS",
          },
          include: { breaks: true, attendanceEvents: true },
        });
      }

      if (!attendance) {
        throw new Error("勤怠レコードが見つかりません");
      }

      // 休憩中退勤: 休憩を自動終了
      if (isBreakingAndClockOut) {
        const openBreak = attendance.breaks.find((b) => !b.endAt);
        if (openBreak) {
          await tx.break.update({
            where: { id: openBreak.id },
            data: { endAt: now, isAutoEnded: true },
          });
        }

        // Break_END イベントを自動記録
        await tx.attendanceEvent.create({
          data: {
            organizationId: organization.id,
            storeId: store.id,
            staffId,
            eventType: "BREAK_END",
            clockedAt: now,
            businessDate,
            timezone: store.timezone,
            source: "STORE_URL",
            ipAddress,
            userAgent,
            deviceFingerprint,
            storeUrlToken: token,
            attendanceId: attendance.id,
          },
        });
      }

      // 打刻イベントを記録
      await tx.attendanceEvent.create({
        data: {
          organizationId: organization.id,
          storeId: store.id,
          staffId,
          eventType: action,
          clockedAt: now,
          businessDate,
          timezone: store.timezone,
          source: "STORE_URL",
          ipAddress,
          userAgent,
          deviceFingerprint,
          storeUrlToken: token,
          attendanceId: attendance.id,
        },
      });

      // 休憩開始
      if (action === "BREAK_START") {
        await tx.break.create({
          data: {
            attendanceId: attendance.id,
            startAt: now,
          },
        });
      }

      // 休憩終了
      if (action === "BREAK_END") {
        const openBreak = attendance.breaks.find((b) => !b.endAt);
        if (openBreak) {
          await tx.break.update({
            where: { id: openBreak.id },
            data: { endAt: now },
          });
        }
      }

      // 退勤: 勤怠レコードを完了に更新
      if (action === "CLOCK_OUT") {
        const breaks = await tx.break.findMany({
          where: { attendanceId: attendance.id },
        });

        const breakMinutes = calculateBreakMinutes(
          breaks.map((b) => ({
            startAt: b.startAt,
            endAt: b.endAt ?? now,
          }))
        );

        const workMinutes = calculateWorkMinutes(
          attendance.clockInAt!,
          now,
          breaks.map((b) => ({
            startAt: b.startAt,
            endAt: b.endAt ?? now,
          }))
        );

        // 異常判定
        const anomalyResult = detectAnomalies({
          clockInAt: attendance.clockInAt,
          clockOutAt: now,
          breaks: breaks.map((b) => ({
            startAt: b.startAt,
            endAt: b.endAt ?? now,
          })),
          now,
        });

        await tx.attendance.update({
          where: { id: attendance.id },
          data: {
            clockOutAt: now,
            breakMinutes,
            workMinutes,
            status: "COMPLETED",
            hasAnomaly: anomalyResult.hasAnomaly,
            anomalyReasons: anomalyResult.reasons as any,
          },
        });
      }

      // 監査ログ
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorType: "SYSTEM",
          action: action,
          targetType: "Attendance",
          targetId: attendance?.id,
          storeId: store.id,
          staffId,
          ipAddress,
          userAgent,
          after: { action, clockedAt: now },
        },
      });
    });

    return { success: true, clockedAt: now };
  } catch (error: any) {
    console.error("Clock action failed:", error);
    return { error: error.message ?? "打刻処理に失敗しました" };
  }
}

/**
 * 管理者による勤怠修正
 */
export async function correctAttendance(
  organizationId: string,
  input: CorrectAttendanceInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = correctAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  try {
    const attendance = await db.attendance.findUnique({
      where: { id: parsed.data.attendanceId },
      include: { breaks: true },
    });

    if (!attendance) return { error: "勤怠レコードが見つかりません" };
    if (attendance.organizationId !== organizationId) return { error: "権限がありません" };

    const ctx = await requireAdmin(session.user.id, organizationId);
    const hasAccess = await canAccessStore(ctx.memberId, ctx.role, attendance.storeId);
    if (!hasAccess) return { error: "この店舗へのアクセス権がありません" };

    if (attendance.isLocked) {
      return { error: "この勤怠は締め処理済みのため修正できません" };
    }

    // スナップショット（変更前）
    const before = {
      clockInAt: attendance.clockInAt,
      clockOutAt: attendance.clockOutAt,
      breaks: attendance.breaks,
    };

    await db.$transaction(async (tx) => {
      // 休憩の更新
      if (parsed.data.breaks !== undefined) {
        await tx.break.deleteMany({ where: { attendanceId: attendance.id } });
        if (parsed.data.breaks.length > 0) {
          await tx.break.createMany({
            data: parsed.data.breaks.map((b) => ({
              attendanceId: attendance.id,
              startAt: b.startAt,
              endAt: b.endAt ?? null,
            })),
          });
        }
      }

      const newBreaks = parsed.data.breaks ?? attendance.breaks;
      const clockIn = parsed.data.clockInAt ?? attendance.clockInAt;
      const clockOut = parsed.data.clockOutAt ?? attendance.clockOutAt;

      const breakMinutes = calculateBreakMinutes(
        newBreaks.map((b) => ({
          startAt: (b as any).startAt,
          endAt: (b as any).endAt ?? null,
        }))
      );

      const workMinutes =
        clockIn && clockOut
          ? calculateWorkMinutes(
              clockIn,
              clockOut,
              newBreaks.map((b) => ({
                startAt: (b as any).startAt,
                endAt: (b as any).endAt ?? null,
              }))
            )
          : null;

      const anomalyResult = detectAnomalies({
        clockInAt: clockIn ?? null,
        clockOutAt: clockOut ?? null,
        breaks: newBreaks.map((b) => ({
          startAt: (b as any).startAt,
          endAt: (b as any).endAt ?? null,
        })),
      });

      await tx.attendance.update({
        where: { id: attendance.id },
        data: {
          clockInAt: parsed.data.clockInAt !== undefined ? parsed.data.clockInAt : undefined,
          clockOutAt: parsed.data.clockOutAt !== undefined ? parsed.data.clockOutAt : undefined,
          breakMinutes,
          workMinutes,
          adminNotes: parsed.data.adminNotes ?? attendance.adminNotes,
          hasAnomaly: anomalyResult.hasAnomaly,
          anomalyReasons: anomalyResult.reasons as any,
          status:
            clockIn && clockOut
              ? "COMPLETED"
              : clockIn
                ? "IN_PROGRESS"
                : attendance.status,
        },
      });

      // 修正履歴を記録
      await tx.attendanceCorrection.create({
        data: {
          attendanceId: attendance.id,
          correctedByUserId: session.user!.id,
          reason: parsed.data.reason,
          before: before as any,
          after: {
            clockInAt: parsed.data.clockInAt,
            clockOutAt: parsed.data.clockOutAt,
            breaks: parsed.data.breaks,
          } as any,
        },
      });

      // 監査ログ
      await tx.auditLog.create({
        data: {
          organizationId,
          actorUserId: session.user!.id,
          action: "ATTENDANCE_MODIFY",
          targetType: "Attendance",
          targetId: attendance.id,
          storeId: attendance.storeId,
          staffId: attendance.staffId,
          before: before as any,
          after: {
            clockInAt: parsed.data.clockInAt,
            clockOutAt: parsed.data.clockOutAt,
          } as any,
          reason: parsed.data.reason,
        },
      });
    });

    revalidatePath(`/attendance/${attendance.id}`);
    revalidatePath("/attendance");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "修正に失敗しました" };
  }
}

/**
 * スタッフによる修正申請
 */
export async function createCorrectionRequest(
  userId: string,
  organizationId: string,
  input: CorrectionRequestInput
): Promise<ActionResult> {
  const parsed = correctionRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  try {
    // スタッフの確認（自分の勤怠のみ申請可能）
    const attendance = await db.attendance.findUnique({
      where: { id: parsed.data.attendanceId },
      include: {
        breaks: true,
        staff: true,
      },
    });

    if (!attendance) return { error: "勤怠レコードが見つかりません" };
    if (attendance.organizationId !== organizationId) return { error: "権限がありません" };
    if (attendance.staff.userId !== userId) return { error: "自分の勤怠のみ申請できます" };
    if (attendance.isLocked) return { error: "締め処理済みの勤怠には申請できません" };

    // 既存の申請中チェック
    const existingPending = await db.correctionRequest.findFirst({
      where: {
        attendanceId: parsed.data.attendanceId,
        status: "PENDING",
      },
    });
    if (existingPending) {
      return { error: "この勤怠にはすでに申請中の修正申請があります" };
    }

    const originalData = {
      clockInAt: attendance.clockInAt,
      clockOutAt: attendance.clockOutAt,
      breaks: attendance.breaks,
    };

    const request = await db.correctionRequest.create({
      data: {
        attendanceId: parsed.data.attendanceId,
        staffId: attendance.staffId,
        originalData: originalData as any,
        requestedData: {
          clockInAt: parsed.data.requestedClockInAt,
          clockOutAt: parsed.data.requestedClockOutAt,
          breaks: parsed.data.requestedBreaks,
        } as any,
        reason: parsed.data.reason,
        notes: parsed.data.notes,
      },
    });

    // 管理者への通知は別途実装
    revalidatePath("/my-correction-requests");
    return { success: true, data: { requestId: request.id } };
  } catch (error: any) {
    return { error: error.message ?? "申請に失敗しました" };
  }
}

/**
 * 修正申請を承認または却下する
 */
export async function reviewCorrectionRequest(
  organizationId: string,
  input: ReviewCorrectionRequestInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  const parsed = reviewCorrectionRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  if (parsed.data.action === "REJECT" && !parsed.data.reviewNotes) {
    return { error: "却下理由を入力してください" };
  }

  try {
    const request = await db.correctionRequest.findUnique({
      where: { id: parsed.data.requestId },
      include: {
        attendance: true,
      },
    });

    if (!request) return { error: "申請が見つかりません" };
    if (request.attendance.organizationId !== organizationId) {
      return { error: "権限がありません" };
    }

    if (request.status !== "PENDING") {
      return { error: "この申請はすでに処理済みです" };
    }

    const ctx = await requireAdmin(session.user.id, organizationId);
    const hasAccess = await canAccessStore(
      ctx.memberId,
      ctx.role,
      request.attendance.storeId
    );
    if (!hasAccess) return { error: "この店舗へのアクセス権がありません" };

    await db.$transaction(async (tx) => {
      const newStatus =
        parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED";

      await tx.correctionRequest.update({
        where: { id: request.id },
        data: {
          status: newStatus,
          reviewedByUserId: session.user!.id,
          reviewedAt: new Date(),
          reviewNotes: parsed.data.reviewNotes,
        },
      });

      // 承認の場合、勤怠に反映
      if (parsed.data.action === "APPROVE") {
        const requestedData = request.requestedData as any;

        // 修正前のスナップショット
        const before = request.originalData;

        await tx.attendance.update({
          where: { id: request.attendanceId },
          data: {
            clockInAt: requestedData.clockInAt
              ? new Date(requestedData.clockInAt)
              : undefined,
            clockOutAt: requestedData.clockOutAt
              ? new Date(requestedData.clockOutAt)
              : undefined,
          },
        });

        if (requestedData.breaks) {
          await tx.break.deleteMany({
            where: { attendanceId: request.attendanceId },
          });
          await tx.break.createMany({
            data: requestedData.breaks.map((b: any) => ({
              attendanceId: request.attendanceId,
              startAt: new Date(b.startAt),
              endAt: b.endAt ? new Date(b.endAt) : null,
            })),
          });
        }

        // 修正履歴
        await tx.attendanceCorrection.create({
          data: {
            attendanceId: request.attendanceId,
            correctedByUserId: session.user!.id,
            reason: `修正申請承認: ${request.reason}`,
            before: before as any,
            after: requestedData,
          },
        });

        // 監査ログ
        await tx.auditLog.create({
          data: {
            organizationId,
            actorUserId: session.user!.id,
            action: "CORRECTION_REQUEST_APPROVE",
            targetType: "CorrectionRequest",
            targetId: request.id,
            staffId: request.staffId,
            before: before as any,
            after: requestedData,
          },
        });
      } else {
        // 却下の監査ログ
        await tx.auditLog.create({
          data: {
            organizationId,
            actorUserId: session.user!.id,
            action: "CORRECTION_REQUEST_REJECT",
            targetType: "CorrectionRequest",
            targetId: request.id,
            staffId: request.staffId,
            reason: parsed.data.reviewNotes ?? undefined,
          },
        });
      }
    });

    revalidatePath("/correction-requests");
    return { success: true };
  } catch (error: any) {
    return { error: error.message ?? "処理に失敗しました" };
  }
}
