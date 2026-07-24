import { z } from "zod";

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "営業日はYYYY-MM-DD形式で指定してください");

/** スタッフの勤務希望提出（1営業日・1時間帯ぶん） */
export const availabilitySchema = z.object({
  storeId: z.string().cuid(),
  slotId: z.string().cuid(),
  businessDate: dateStr,
  type: z.enum(["AVAILABLE", "UNAVAILABLE", "PREFERRED"]),
  note: z.string().max(300).optional().nullable(),
});

/** 店舗・営業日・時間帯の必要人数設定 */
export const requirementSchema = z.object({
  storeId: z.string().cuid(),
  slotId: z.string().cuid(),
  businessDate: dateStr,
  requiredCount: z.number().int().min(0).max(999),
  note: z.string().max(300).optional().nullable(),
});

/** 管理者によるシフト作成（時間帯にスタッフを割り当てる。時刻は時間帯から取る） */
export const createShiftSchema = z.object({
  storeId: z.string().cuid(),
  slotId: z.string().cuid(),
  staffId: z.string().cuid(),
  businessDate: dateStr,
  note: z.string().max(300).optional().nullable(),
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
