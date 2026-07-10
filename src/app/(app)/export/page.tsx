import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, getAccessibleStoreIds } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { ExportForm } from "./export-form";

export const metadata: Metadata = {
  title: "CSVエクスポート",
};

export default async function ExportPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = (session as any).activeOrganizationId as string | null;
  if (!activeOrgId) redirect("/dashboard");

  let ctx;
  try {
    ctx = await requireAdmin(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const accessibleStoreIds = await getAccessibleStoreIds(ctx.memberId, ctx.role, activeOrgId);

  const stores = await db.store.findMany({
    where: {
      organizationId: activeOrgId,
      isActive: true,
      ...(accessibleStoreIds !== null ? { id: { in: accessibleStoreIds } } : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="CSVエクスポート"
        description="勤怠データをCSV形式でダウンロードします"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "CSVエクスポート" },
        ]}
      />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <ExportForm stores={stores} organizationId={activeOrgId} />
      </div>

      <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">CSVフォーマット</p>
        <p>勤務日, スタッフ名, 社員コード, 店舗名, 出勤時刻, 退勤時刻, 休憩(分), 実労働(分), ステータス</p>
      </div>
    </div>
  );
}
