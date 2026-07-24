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
