import type { Prisma } from "@/generated/prisma/client";

/**
 * 管理者が見てよい修正申請の絞り込み条件。
 *
 * 申請は2種類あり、組織・店舗のたどり方が違う。
 * - 既存の勤怠の修正: attendance から組織・店舗をたどる
 * - 打刻の付け忘れ: attendance が無い（attendanceId = null）ので、申請自身の store から
 *
 * attendance だけで絞ると付け忘れ申請が一覧から全部消える（2026-11-13 VLL・星狼で発覚）。
 *
 * @param accessibleStoreIds null = 全店舗（OWNER / 店舗スコープ無しの ADMIN）
 */
export function correctionRequestScopeWhere(
  organizationId: string,
  accessibleStoreIds: string[] | null
): Prisma.CorrectionRequestWhereInput {
  const scoped = accessibleStoreIds !== null;
  return {
    OR: [
      {
        attendance: {
          organizationId,
          ...(scoped ? { storeId: { in: accessibleStoreIds } } : {}),
        },
      },
      {
        attendanceId: null,
        store: {
          organizationId,
          ...(scoped ? { id: { in: accessibleStoreIds } } : {}),
        },
      },
    ],
  };
}
