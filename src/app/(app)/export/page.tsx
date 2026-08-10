import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, getAccessibleStoreIds } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { ExportForm } from "./export-form";
import { resolveActiveOrganizationId } from "@/lib/auth/active-org";

export const metadata: Metadata = {
  title: "CSVエクスポート",
};

export default async function ExportPage() {
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

      <div className="space-y-3 rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        <div>
          <p className="mb-1 font-medium text-foreground">CSVフォーマット</p>
          <p>
            勤務日, スタッフ名, 社員コード, 店舗名, 出勤時刻, 退勤時刻, 休憩(分),
            実労働(分), 交通費, ステータス
          </p>
        </div>
        {/* 金額の欄は、何が入っていて何が入っていないかを書いておかないと
            そのまま給与に使われて事故る */}
        <div>
          <p className="mb-1 font-medium text-foreground">交通費について</p>
          <p>
            「出勤ごと」で登録した金額を、出勤の記録がある日に1回ぶんずつ入れています。
            退勤を押し忘れた日も、来ている以上は入ります。
          </p>
          <p className="mt-1">
            <strong className="text-foreground">月額と月の上限には未対応です。</strong>
            どちらで登録していても、この欄は0になります。
          </p>
          <p className="mt-1">
            時給と深夜時間はこのCSVに入っていません。給与額の計算は給与ソフト側で行ってください。
          </p>
        </div>
      </div>
    </div>
  );
}
