import { z } from "zod";

export const clockActionSchema = z.object({
  token: z.string().min(1), // 打刻URL トークン
  staffId: z.string().cuid(),
  pin: z.string().min(4).max(8).regex(/^\d+$/),
  action: z.enum(["CLOCK_IN", "BREAK_START", "BREAK_END", "CLOCK_OUT"]),
});

export const correctAttendanceSchema = z.object({
  attendanceId: z.string().cuid(),
  clockInAt: z.coerce.date().optional().nullable(),
  clockOutAt: z.coerce.date().optional().nullable(),
  breaks: z
    .array(
      z.object({
        id: z.string().optional(),
        startAt: z.coerce.date(),
        endAt: z.coerce.date().optional().nullable(),
      })
    )
    .optional(),
  adminNotes: z.string().max(500).optional().nullable(),
  reason: z.string().min(1, "修正理由を入力してください").max(500),
});

export const correctionRequestSchema = z.object({
  attendanceId: z.string().cuid(),
  requestedClockInAt: z.coerce.date().optional().nullable(),
  requestedClockOutAt: z.coerce.date().optional().nullable(),
  requestedBreaks: z
    .array(
      z.object({
        startAt: z.coerce.date(),
        endAt: z.coerce.date().optional().nullable(),
      })
    )
    .optional(),
  reason: z.string().min(1, "申請理由を入力してください").max(500),
  notes: z.string().max(500).optional().nullable(),
});

export const reviewCorrectionRequestSchema = z.object({
  requestId: z.string().cuid(),
  action: z.enum(["APPROVE", "REJECT"]),
  reviewNotes: z.string().max(500).optional().nullable(),
});

export type ClockActionInput = z.infer<typeof clockActionSchema>;
export type CorrectAttendanceInput = z.infer<typeof correctAttendanceSchema>;

/**
 * 管理者による勤怠の手入力（打刻漏れの代行）
 *
 * スタッフの「付け忘れ申請」を待たずに、店長がその場で勤怠を作る。
 * 出勤・退勤とも必須（作った瞬間から完了した勤怠として給与計算に載るため、片方だけは認めない）。
 */
export const createAttendanceSchema = z
  .object({
    storeId: z.string().cuid(),
    staffId: z.string().cuid(),
    clockInAt: z.coerce.date({ message: "出勤時刻を入力してください" }),
    clockOutAt: z.coerce.date({ message: "退勤時刻を入力してください" }),
    breaks: z
      .array(
        z.object({
          startAt: z.coerce.date(),
          endAt: z.coerce.date().optional().nullable(),
        })
      )
      .optional(),
    reason: z.string().trim().min(1, "登録理由を入力してください").max(500),
    adminNotes: z.string().max(500).optional().nullable(),
  })
  .refine((v) => v.clockOutAt > v.clockInAt, {
    message: "退勤時刻は出勤時刻より後にしてください",
    path: ["clockOutAt"],
  })
  .refine(
    (v) =>
      (v.breaks ?? []).every(
        (b) => b.startAt >= v.clockInAt && (!b.endAt || b.endAt <= v.clockOutAt)
      ),
    { message: "休憩は出勤〜退勤の間に収めてください", path: ["breaks"] }
  );

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
/**
 * 打刻の付け忘れ申請 (勤怠レコードが存在しない日)
 * 既存勤怠の修正とは対象が異なるため別スキーマにする
 */
export const missingAttendanceRequestSchema = z.object({
  storeId: z.string().cuid(),
  businessDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "営業日はYYYY-MM-DD形式で指定してください"),
  requestedClockInAt: z.coerce.date({
    message: "出勤時刻を入力してください",
  }),
  requestedClockOutAt: z.coerce.date({
    message: "退勤時刻を入力してください",
  }),
  requestedBreaks: z
    .array(
      z.object({
        startAt: z.coerce.date(),
        endAt: z.coerce.date().optional().nullable(),
      })
    )
    .optional(),
  reason: z.string().trim().min(1, "申請理由を入力してください").max(500),
  notes: z.string().max(500).optional().nullable(),
});

export type CorrectionRequestInput = z.infer<typeof correctionRequestSchema>;
export type MissingAttendanceRequestInput = z.infer<
  typeof missingAttendanceRequestSchema
>;
export type ReviewCorrectionRequestInput = z.infer<
  typeof reviewCorrectionRequestSchema
>;
