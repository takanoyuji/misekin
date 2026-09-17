import { z } from "zod";

export const createStoreSchema = z.object({
  name: z.string().min(1, "店舗名を入力してください").max(100),
  code: z.string().max(20).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  timezone: z.string().default("Asia/Tokyo"),
  dayChangeHour: z.number().int().min(0).max(23).default(6),
  dayChangeMinute: z.number().int().min(0).max(59).default(0),
  category: z
    .enum([
      "CONCAFE",
      "MAID_CAFE",
      "GIRLS_BAR",
      "CABARET",
      "CLUB_LOUNGE",
      "SNACK",
      "BAR",
      "SHISHA",
      "OTHER",
    ])
    .optional(),
  /** 必要人数の提案で立てる上限（1時間あたり） */
  maxStaffPerSlot: z
    .number()
    .int()
    .min(1, "1人以上にしてください")
    .max(20, "20人以下にしてください")
    .optional(),
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

/**
 * 打刻の位置設定。
 * 通常の店舗編集とは別経路にする（お金ではないが、全スタッフの勤怠フラグに効く設定なので
 * 他項目のついで操作で変わると気づけない）。
 */
export const storeLocationSettingsSchema = z
  .object({
    locationTrackingEnabled: z.boolean(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    // null = 記録のみで判定しない。まず実分布を観測してから閾値を決めるため既定は null
    geofenceRadiusMeters: z
      .number()
      .int()
      .min(20, "20m以上にしてください")
      .max(5000, "5000m以下にしてください")
      .nullable(),
  })
  .refine((v) => (v.latitude == null) === (v.longitude == null), {
    message: "緯度と経度は両方入力してください",
    path: ["latitude"],
  })
  .refine(
    (v) =>
      v.geofenceRadiusMeters == null ||
      (v.locationTrackingEnabled && v.latitude != null && v.longitude != null),
    {
      message:
        "判定距離を設定するには、位置情報の記録を有効にして店舗の座標を入れてください",
      path: ["geofenceRadiusMeters"],
    }
  );

export type StoreLocationSettingsInput = z.infer<
  typeof storeLocationSettingsSchema
>;

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
export type ShiftPeriodSettingsInput = z.infer<
  typeof shiftPeriodSettingsSchema
>;
