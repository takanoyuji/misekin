import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export const registerSchema = z
  .object({
    name: z.string().min(1, "お名前を入力してください").max(50),
    email: z
      .string()
      .email("有効なメールアドレスを入力してください")
      .toLowerCase(),
    password: z
      .string()
      .min(8, "パスワードは8文字以上で設定してください")
      .regex(
        /^(?=.*[a-zA-Z])(?=.*\d)/,
        "パスワードには英字と数字を含めてください"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  });

export const resetPasswordRequestSchema = z.object({
  email: z
    .string()
    .email("有効なメールアドレスを入力してください")
    .toLowerCase(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .min(8, "パスワードは8文字以上で設定してください")
      .regex(
        /^(?=.*[a-zA-Z])(?=.*\d)/,
        "パスワードには英字と数字を含めてください"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "パスワードが一致しません",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ResetPasswordRequestInput = z.infer<
  typeof resetPasswordRequestSchema
>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
