import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().min(1, "組織名を入力してください").max(100),
  timezone: z.string(),
  country: z.string().optional(),
  dayChangeHour: z.number().int().min(0).max(23),
  dayChangeMinute: z.number().int().min(0).max(59),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

export const onboardingSchema = z.object({
  organizationName: z.string().min(1, "組織名を入力してください").max(100),
  storeName: z.string().min(1, "店舗名を入力してください").max(100),
  timezone: z.string(),
  dayChangeHour: z.number().int().min(0).max(23),
  dayChangeMinute: z.number().int().min(0).max(59),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
