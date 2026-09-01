import { z } from "zod";

// 24:00 や 99:99 を通さない。24:00 は 00:00 と書く（翌日跨ぎは end<=start で表す）
const hhmm = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    "時刻は00:00〜23:59のHH:mm形式で入力してください（24:00は00:00と書きます）"
  );

export const createSlotSchema = z.object({
  storeId: z.string().cuid(),
  name: z.string().trim().min(1, "名前を入力してください").max(30),
  startTime: hhmm,
  endTime: hhmm,
  sortOrder: z.number().int().min(0).max(99).default(0),
});

export const updateSlotSchema = z.object({
  slotId: z.string().cuid(),
  name: z.string().trim().min(1, "名前を入力してください").max(30),
  startTime: hhmm,
  endTime: hhmm,
  sortOrder: z.number().int().min(0).max(99),
});

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;
