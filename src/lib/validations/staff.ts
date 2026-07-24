import { z } from "zod";

export const createStaffSchema = z.object({
  displayName: z.string().min(1, "表示名を入力してください").max(50),
  fullName: z.string().max(50).optional().nullable(),
  email: z
    .string()
    .email("有効なメールアドレスを入力してください")
    .toLowerCase()
    .optional()
    .nullable(),
  phone: z.string().max(20).optional().nullable(),
  employeeCode: z.string().max(20).optional().nullable(),
  hireDate: z.coerce.date().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

/**
 * スタッフの基本情報更新
 * メールアドレスは権限が異なるため updateStaffEmailSchema / updateStaffEmail で扱う
 */
export const updateStaffSchema = createStaffSchema.partial().omit({
  email: true,
});

/**
 * スタッフのメールアドレス変更
 * 空文字は「未設定にする」意図として null に正規化する
 */
export const updateStaffEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("有効なメールアドレスを入力してください")
    .max(254, "メールアドレスが長すぎます")
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export const staffStoreSchema = z.object({
  staffId: z.string().cuid(),
  storeId: z.string().cuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  isPrimary: z.boolean().default(false),
  canClock: z.boolean().default(true),
});

export const setPinSchema = z.object({
  staffId: z.string().cuid(),
  storeId: z.string().cuid(),
  pin: z
    .string()
    .min(4, "PINは4桁以上で設定してください")
    .max(8, "PINは8桁以内で設定してください")
    .regex(/^\d+$/, "PINは数字のみで設定してください"),
});

export const wageHistorySchema = z.object({
  staffStoreId: z.string().cuid(),
  amount: z.number().positive("時給は正の値で入力してください"),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  reason: z.string().max(200).optional().nullable(),
});

export const transportationSchema = z.object({
  staffStoreId: z.string().cuid(),
  type: z.enum(["PER_SHIFT", "MONTHLY", "NONE"]),
  amount: z.number().min(0),
  monthlyLimit: z.number().min(0).optional().nullable(),
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date().optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type UpdateStaffEmailInput = z.infer<typeof updateStaffEmailSchema>;
export type StaffStoreInput = z.infer<typeof staffStoreSchema>;
export type SetPinInput = z.infer<typeof setPinSchema>;
export type WageHistoryInput = z.infer<typeof wageHistorySchema>;
export type TransportationInput = z.infer<typeof transportationSchema>;
