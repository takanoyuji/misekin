"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clockCookieName, verifyClockSession } from "@/lib/clock-session";
import { requireAdmin, canAccessStore } from "@/lib/auth/permissions";
import {
  correctAttendanceSchema,
  correctionRequestSchema,
  missingAttendanceRequestSchema,
  reviewCorrectionRequestSchema,
  type CorrectAttendanceInput,
  type CorrectionRequestInput,
  type MissingAttendanceRequestInput,
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

interface ActionResult {
  success?: boolean;
  error?: string;
  data?: unknown;
}

interface ClockActionParams {
  token: string;
  staffId: string;
  action: "CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT";
  memo?: string;
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
  const { token, staffId, action, memo, ipAddress, userAgent, deviceFingerprint } =
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

  // PINは verifyClockPin で検証済み。ここではその結果である短命セッションCookieを確認する。
  // PIN必須スタッフはセッションが無ければ打刻を拒否（PIN入力画面へ戻す想定）。
  if (staffStore.requirePin) {
    const cookieStore = await cookies();
    const session = cookieStore.get(clockCookieName(token))?.value;
    if (!verifyClockSession(session, staffStore.id, Date.now())) {
      return { error: "PIN認証の有効期限が切れました。PINを入力し直してください" };
    }
  }

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
            clockOutMemo: memo ?? null,
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
  organizationId: string,
  input: CorrectionRequestInput
): Promise<ActionResult> {
  // 呼び出し側から渡された userId は信用できないため、セッションから取得する
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };
  const userId = session.user.id;

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
 * 打刻の付け忘れを申請する (勤怠レコードが存在しない日)
 *
 * 承認されると勤怠レコードが新規作成される。打刻イベントを伴わない勤怠になるため、
 * 承認時に監査ログと修正履歴を残して経緯を追えるようにする。
 */
export async function createMissingAttendanceRequest(
  organizationId: string,
  input: MissingAttendanceRequestInput
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };
  const userId = session.user.id;

  const parsed = missingAttendanceRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };
  }

  const { storeId, businessDate, requestedClockInAt, requestedClockOutAt } =
    parsed.data;

  if (requestedClockOutAt <= requestedClockInAt) {
    return { error: "退勤時刻は出勤時刻より後にしてください" };
  }

  try {
    const staff = await db.staff.findFirst({
      where: { userId, organizationId },
      select: { id: true },
    });
    if (!staff) return { error: "スタッフ情報が見つかりません" };

    // 自分が所属している店舗のみ申請できる
    const staffStore = await db.staffStore.findFirst({
      where: { staffId: staff.id, storeId, isActive: true },
      select: { id: true },
    });
    if (!staffStore) {
      return { error: "所属していない店舗の申請はできません" };
    }

    // 既に勤怠がある日は「付け忘れ」ではないので通常の修正申請を使ってもらう
    const existing = await db.attendance.findFirst({
      where: { staffId: staff.id, storeId, businessDate },
      select: { id: true, isLocked: true },
    });
    if (existing) {
      return {
        error:
          "この日の勤怠は既に登録されています。勤怠一覧から修正申請してください",
      };
    }

    // 締め済み期間には申請できない
    const closed = await db.closingPeriod.findFirst({
      where: {
        organizationId,
        closedAt: { not: null },
        periodStart: { lte: businessDate },
        periodEnd: { gte: businessDate },
        OR: [{ storeId }, { storeId: null }],
      },
      select: { id: true },
    });
    if (closed) {
      return { error: "締め処理済みの期間には申請できません" };
    }

    const duplicatePending = await db.correctionRequest.findFirst({
      where: {
        staffId: staff.id,
        storeId,
        businessDate,
        status: "PENDING",
      },
      select: { id: true },
    });
    if (duplicatePending) {
      return { error: "この日の申請は既に審査中です" };
    }

    const request = await db.correctionRequest.create({
      data: {
        attendanceId: null,
        staffId: staff.id,
        storeId,
        businessDate,
        // 勤怠が存在しないため修正前の値は無い
        originalData: { clockInAt: null, clockOutAt: null, breaks: [] } as any,
        requestedData: {
          clockInAt: requestedClockInAt,
          clockOutAt: requestedClockOutAt,
          breaks: parsed.data.requestedBreaks ?? [],
        } as any,
        reason: parsed.data.reason,
        notes: parsed.data.notes,
      },
      select: { id: true },
    });

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

    // 付け忘れ申請は勤怠が無いため、申請自身が持つ店舗・営業日を使う
    const isMissingAttendanceRequest = request.attendanceId === null;
    const targetStoreId = request.attendance?.storeId ?? request.storeId;
    const targetBusinessDate =
      request.attendance?.businessDate ?? request.businessDate;

    if (!targetStoreId || !targetBusinessDate) {
      return { error: "申請の対象が不正です" };
    }

    if (request.attendance) {
      if (request.attendance.organizationId !== organizationId) {
        return { error: "権限がありません" };
      }
    } else {
      const store = await db.store.findFirst({
        where: { id: targetStoreId, organizationId },
        select: { id: true },
      });
      if (!store) return { error: "権限がありません" };
    }

    if (request.status !== "PENDING") {
      return { error: "この申請はすでに処理済みです" };
    }

    const ctx = await requireAdmin(session.user.id, organizationId);
    const hasAccess = await canAccessStore(
      ctx.memberId,
      ctx.role,
      targetStoreId
    );
    if (!hasAccess) return { error: "この店舗へのアクセス権がありません" };

    // 承認までの間に打刻されて勤怠が作られている場合は二重登録を防ぐ
    if (isMissingAttendanceRequest && parsed.data.action === "APPROVE") {
      const existing = await db.attendance.findFirst({
        where: {
          staffId: request.staffId,
          storeId: targetStoreId,
          businessDate: targetBusinessDate,
        },
        select: { id: true },
      });
      if (existing) {
        return {
          error:
            "この日の勤怠は既に登録されています。申請を却下し、勤怠一覧から直接修正してください",
        };
      }
    }

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

        const breaksInput: { startAt: Date; endAt: Date | null }[] = (
          requestedData.breaks ?? []
        ).map((b: any) => ({
          startAt: new Date(b.startAt),
          endAt: b.endAt ? new Date(b.endAt) : null,
        }));

        // 付け忘れ申請は勤怠を新規作成する
        let attendanceId = request.attendanceId;

        if (!attendanceId) {
          const clockInAt = new Date(requestedData.clockInAt);
          const clockOutAt = new Date(requestedData.clockOutAt);

          const created = await tx.attendance.create({
            data: {
              organizationId,
              storeId: targetStoreId,
              staffId: request.staffId,
              businessDate: targetBusinessDate,
              clockInAt,
              clockOutAt,
              breakMinutes: calculateBreakMinutes(breaksInput),
              workMinutes: calculateWorkMinutes(
                clockInAt,
                clockOutAt,
                breaksInput
              ),
              status: "COMPLETED",
              // 打刻イベントを伴わない勤怠であることを残す
              adminNotes: `打刻の付け忘れ申請を承認して作成 (申請理由: ${request.reason})`,
            },
            select: { id: true },
          });
          attendanceId = created.id;

          if (breaksInput.length > 0) {
            await tx.break.createMany({
              data: breaksInput.map((b) => ({
                attendanceId: created.id,
                startAt: b.startAt,
                endAt: b.endAt,
              })),
            });
          }

          // 申請と作成された勤怠を紐付ける
          await tx.correctionRequest.update({
            where: { id: request.id },
            data: { attendanceId: created.id },
          });
        } else {
          await tx.attendance.update({
            where: { id: attendanceId },
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
              where: { attendanceId },
            });
            await tx.break.createMany({
              data: breaksInput.map((b) => ({
                attendanceId: attendanceId!,
                startAt: b.startAt,
                endAt: b.endAt,
              })),
            });
          }
        }

        // 修正履歴
        await tx.attendanceCorrection.create({
          data: {
            attendanceId,
            correctedByUserId: session.user!.id,
            reason: isMissingAttendanceRequest
              ? `打刻の付け忘れ申請を承認: ${request.reason}`
              : `修正申請承認: ${request.reason}`,
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
