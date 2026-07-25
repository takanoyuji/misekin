import { z } from "zod";

/** メンバーのロール変更（OWNERは対象外・付与不可） */
export const changeMemberRoleSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(["ADMIN", "MEMBER"]),
});
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;

/** 店舗管理者の担当店舗スコープ（空配列 = 全店舗） */
export const setStoreScopeSchema = z.object({
  memberId: z.string().min(1),
  storeIds: z.array(z.string().min(1)),
});
export type SetStoreScopeInput = z.infer<typeof setStoreScopeSchema>;

/** 管理者招待（担当店舗の指定は任意。未指定=全店舗） */
export const inviteAdminSchema = z.object({
  email: z
    .string()
    .email("有効なメールアドレスを入力してください")
    .max(255),
  storeIds: z.array(z.string().min(1)).optional(),
});
export type InviteAdminInput = z.infer<typeof inviteAdminSchema>;
