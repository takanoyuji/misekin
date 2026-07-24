import { z } from "zod";

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "時刻はHH:mm形式で入力してください");

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
