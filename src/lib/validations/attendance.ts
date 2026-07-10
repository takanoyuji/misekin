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
export type CorrectionRequestInput = z.infer<typeof correctionRequestSchema>;
export type ReviewCorrectionRequestInput = z.infer<
  typeof reviewCorrectionRequestSchema
>;
