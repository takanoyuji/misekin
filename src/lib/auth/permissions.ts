import { db } from "@/lib/db";
import { OrganizationRole } from "@/generated/prisma/client";

export interface UserOrgContext {
  userId: string;
  organizationId: string;
  role: OrganizationRole;
  isActive: boolean;
  memberId: string;
}

/**
 * ユーザーの組織メンバーシップを取得する
 * @throws Error if not a member
 */
export async function requireOrgMember(
  userId: string,
  organizationId: string
): Promise<UserOrgContext> {
  const member = await db.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
      isActive: true,
    },
  });

  if (!member) {
    throw new Error("FORBIDDEN: Not a member of this organization");
  }

  return {
    userId,
    organizationId,
    role: member.role,
    isActive: member.isActive,
    memberId: member.id,
  };
}

/**
 * オーナー権限が必要な操作のガード
 */
export async function requireOwner(
  userId: string,
  organizationId: string
): Promise<UserOrgContext> {
  const ctx = await requireOrgMember(userId, organizationId);
  if (ctx.role !== "OWNER") {
    throw new Error("FORBIDDEN: Owner permission required");
  }
  return ctx;
}

/**
 * 管理者以上の権限が必要な操作のガード
 */
export async function requireAdmin(
  userId: string,
  organizationId: string
): Promise<UserOrgContext> {
  const ctx = await requireOrgMember(userId, organizationId);
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") {
    throw new Error("FORBIDDEN: Admin permission required");
  }
  return ctx;
}

/**
 * 管理者が特定の店舗にアクセスできるか確認する
 * - OWNERは全店舗アクセス可
 * - ADMINはStoreAdminスコープに基づく（レコードなし = 全店舗, レコードあり = 指定店舗のみ）
 */
export async function canAccessStore(
  memberId: string,
  role: OrganizationRole,
  storeId: string
): Promise<boolean> {
  if (role === "OWNER") return true;

  // 管理者のスコープ確認
  const scopeCount = await db.storeAdmin.count({
    where: { organizationMemberId: memberId },
  });

  // スコープ設定なし = 全店舗アクセス可
  if (scopeCount === 0) return true;

  // スコープ設定あり = 指定店舗のみ
  const scope = await db.storeAdmin.findFirst({
    where: { organizationMemberId: memberId, storeId },
  });

  return scope !== null;
}

/**
 * 管理者のアクセス可能な店舗IDリストを取得する
 */
export async function getAccessibleStoreIds(
  memberId: string,
  role: OrganizationRole,
  organizationId: string
): Promise<string[] | null> {
  // null = 全店舗アクセス可
  if (role === "OWNER") return null;

  const scopes = await db.storeAdmin.findMany({
    where: { organizationMemberId: memberId },
    select: { storeId: true },
  });

  if (scopes.length === 0) return null; // スコープ設定なし = 全店舗

  return scopes.map((s) => s.storeId);
}

/** スタッフのメールアドレスを変更できる主体の種別 */
export type StaffEmailEditorScope = "SELF" | "OWNER" | "STORE_ADMIN";

/**
 * スタッフのメールアドレスを変更する権限を確認する
 *
 * 変更できるのは以下の3者に限る。
 * - 本人 (Staff.userId が自分) … 自分のスタッフ情報のみ
 * - 組織オーナー … 組織内の全スタッフ
 * - 店舗管理者 (ADMIN) … そのスタッフの所属店舗を1つでも管理していれば可
 *
 * @throws Error if 権限がない / スタッフが存在しない
 */
export async function requireStaffEmailEditPermission(
  userId: string,
  organizationId: string,
  staffId: string
): Promise<StaffEmailEditorScope> {
  const staff = await db.staff.findFirst({
    where: { id: staffId, organizationId },
    select: {
      userId: true,
      staffStores: { select: { storeId: true } },
    },
  });

  if (!staff) {
    throw new Error("NOT_FOUND: スタッフが見つかりません");
  }

  // 本人は自分のスタッフ情報のみ変更できる
  if (staff.userId && staff.userId === userId) {
    return "SELF";
  }

  const ctx = await requireAdmin(userId, organizationId);

  if (ctx.role === "OWNER") {
    return "OWNER";
  }

  // 店舗管理者は、所属店舗のいずれかを管理していれば変更できる
  const accessibleStoreIds = await getAccessibleStoreIds(
    ctx.memberId,
    ctx.role,
    organizationId
  );

  // null = スコープ未設定 (全店舗管理者) のため、店舗未所属のスタッフも変更できる
  if (accessibleStoreIds === null) {
    return "STORE_ADMIN";
  }

  const isAccessible = staff.staffStores.some((s) =>
    accessibleStoreIds.includes(s.storeId)
  );

  if (isAccessible) {
    return "STORE_ADMIN";
  }

  throw new Error("FORBIDDEN: このスタッフを編集する権限がありません");
}

/**
 * ユーザーが唯一のオーナーかどうか確認する
 */
export async function isLastOwner(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const ownerCount = await db.organizationMember.count({
    where: {
      organizationId,
      role: "OWNER",
      isActive: true,
    },
  });

  if (ownerCount > 1) return false;

  // 残り1人のオーナーが自分かどうか確認
  const member = await db.organizationMember.findFirst({
    where: {
      organizationId,
      role: "OWNER",
      isActive: true,
    },
  });

  return member?.userId === userId;
}
