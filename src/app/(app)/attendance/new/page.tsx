import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, getAccessibleStoreIds } from "@/lib/auth/permissions";
import { resolveActiveOrganizationId } from "@/lib/auth/active-org";
import { AttendanceNewForm } from "./attendance-new-form";

export const metadata: Metadata = {
  title: "勤怠を追加",
};

/**
 * 管理者が勤怠を手入力で作る画面（打刻漏れの代行）。
 * スタッフの「付け忘れ申請」を待たずに、店長がその場で入れられるようにする。
 */
export default async function AttendanceNewPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; staffId?: string; date?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = await resolveActiveOrganizationId(
    session.user?.id,
    (session as any).activeOrganizationId as string | null
  );
  if (!activeOrgId) redirect("/dashboard");

  let ctx;
  try {
    ctx = await requireAdmin(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const accessibleStoreIds = await getAccessibleStoreIds(
    ctx.memberId,
    ctx.role,
    activeOrgId
  );

  // 担当できる店舗と、その所属スタッフ（在籍中のみ）
  const stores = await db.store.findMany({
    where: {
      organizationId: activeOrgId,
      isActive: true,
      ...(accessibleStoreIds !== null ? { id: { in: accessibleStoreIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      timezone: true,
      dayChangeHour: true,
      dayChangeMinute: true,
      staffStores: {
        where: { isActive: true, staff: { status: "ACTIVE" } },
        select: { staff: { select: { id: true, displayName: true } } },
        orderBy: { staff: { displayName: "asc" } },
      },
    },
    orderBy: { name: "asc" },
  });

  const params = await searchParams;

  return (
    <AttendanceNewForm
      organizationId={activeOrgId}
      stores={stores.map((s) => ({
        id: s.id,
        name: s.name,
        timezone: s.timezone ?? "Asia/Tokyo",
        dayChangeHour: s.dayChangeHour,
        dayChangeMinute: s.dayChangeMinute,
        staff: s.staffStores.map((ss) => ss.staff),
      }))}
      initial={{
        storeId: params.storeId ?? "",
        staffId: params.staffId ?? "",
        date: params.date ?? "",
      }}
    />
  );
}
