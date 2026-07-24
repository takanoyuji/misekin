import { z } from "zod";

export const createStoreSchema = z.object({
  name: z.string().min(1, "店舗名を入力してください").max(100),
  code: z.string().max(20).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  timezone: z.string().default("Asia/Tokyo"),
  dayChangeHour: z.number().int().min(0).max(23).default(6),
  dayChangeMinute: z.number().int().min(0).max(59).default(0),
});

export const updateStoreSchema = createStoreSchema.partial();

/** シフト希望の提出期間設定 */
export const shiftPeriodSettingsSchema = z
  .object({
    shiftPeriodUnit: z.enum(["MONTHLY", "WEEKLY"]),
    // MONTHLY: 1-28 / WEEKLY: 0-6
    shiftPeriodStartDay: z.number().int().min(0).max(28),
  })
  .refine(
    (v) =>
      v.shiftPeriodUnit === "MONTHLY"
        ? v.shiftPeriodStartDay >= 1 && v.shiftPeriodStartDay <= 28
        : v.shiftPeriodStartDay >= 0 && v.shiftPeriodStartDay <= 6,
    {
      message: "区切り日が期間の種類に合っていません",
      path: ["shiftPeriodStartDay"],
    }
  );

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
export type ShiftPeriodSettingsInput = z.infer<
  typeof shiftPeriodSettingsSchema
>;
