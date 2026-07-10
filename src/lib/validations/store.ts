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

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
