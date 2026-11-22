import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdmin, getAccessibleStoreIds } from "@/lib/auth/permissions";
import { resolveActiveOrganizationId } from "@/lib/auth/active-org";

/**
 * 日報の画面の共通: 管理者か確かめ、見られる店舗（日報を使っている店舗）と選んでいる店舗を返す。
 * 日報を使っている = 設定がオン、または日報が1件でもある（オフにしても過去の分は見られるように）
 */
export async function loadDailyReportContext(storeIdParam?: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const orgId = await resolveActiveOrganizationId(
    session.user.id,
    (session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null
  );
  if (!orgId) redirect("/dashboard");

  let ctx;
  try {
    ctx = await requireAdmin(session.user.id, orgId);
  } catch {
    redirect("/dashboard");
  }
  const accessible = await getAccessibleStoreIds(ctx.memberId, ctx.role, orgId);

  const stores = await db.store.findMany({
    where: {
      organizationId: orgId,
      ...(accessible !== null ? { id: { in: accessible } } : {}),
      OR: [{ requireDailyReport: true }, { dailyReports: { some: {} } }],
    },
    select: { id: true, name: true, requireDailyReport: true },
    orderBy: { name: "asc" },
  });
  const store = stores.find((s) => s.id === storeIdParam) ?? stores[0] ?? null;
  return { orgId, stores, store };
}

/** "2026-11" → その月の営業日の範囲 */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function currentMonthJst(now = new Date()): string {
  const jst = new Date(now.getTime() + 9 * 3600_000);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}`;
}
