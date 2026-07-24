import { z } from "zod";

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "営業日はYYYY-MM-DD形式で指定してください");

/** スタッフの勤務希望提出（1営業日ぶん） */
export const availabilitySchema = z.object({
  storeId: z.string().cuid(),
  businessDate: dateStr,
  type: z.enum(["AVAILABLE", "UNAVAILABLE", "PREFERRED"]),
  // "HH:mm" 形式。終日希望なら省略
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable(),
  note: z.string().max(300).optional().nullable(),
});

/** 店舗・営業日の必要人数設定 */
export const requirementSchema = z.object({
  storeId: z.string().cuid(),
  businessDate: dateStr,
  requiredCount: z.number().int().min(0).max(999),
  note: z.string().max(300).optional().nullable(),
});

/** 管理者によるシフト作成 */
export const createShiftSchema = z
  .object({
    storeId: z.string().cuid(),
    staffId: z.string().cuid(),
    businessDate: dateStr,
    // ISO文字列（クライアントのdatetime-localから変換して渡す）
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    note: z.string().max(300).optional().nullable(),
  })
  .refine((v) => v.endAt > v.startAt, {
    message: "退勤予定は出勤予定より後にしてください",
    path: ["endAt"],
  });

export const updateShiftSchema = z
  .object({
    shiftId: z.string().cuid(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    note: z.string().max(300).optional().nullable(),
  })
  .refine((v) => v.endAt > v.startAt, {
    message: "退勤予定は出勤予定より後にしてください",
    path: ["endAt"],
  });

export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type RequirementInput = z.infer<typeof requirementSchema>;
export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
