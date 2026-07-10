import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, getAccessibleStoreIds } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Lock, CheckCircle } from "lucide-react";
import { ClosingForm } from "./closing-form";
import { ClosingExecuteButton } from "./closing-execute-button";

export const metadata: Metadata = {
  title: "締め処理",
};

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, "/");
}

function formatDateTime(date: Date, timezone = "Asia/Tokyo"): string {
  return format(toZonedTime(date, timezone), "yyyy/MM/dd HH:mm");
}

export default async function ClosingPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = (session as any).activeOrganizationId as string | null;
  if (!activeOrgId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">所属組織が設定されていません。</p>
      </div>
    );
  }

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

  // 締め期間一覧
  const closingPeriods = await db.closingPeriod.findMany({
    where: {
      organizationId: activeOrgId,
      ...(accessibleStoreIds !== null
        ? {
            OR: [
              { storeId: { in: accessibleStoreIds } },
              { storeId: null },
            ],
          }
        : {}),
    },
    include: {
      store: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // アクセス可能な店舗一覧（フォーム用）
  const stores = await db.store.findMany({
    where: {
      organizationId: activeOrgId,
      isActive: true,
      ...(accessibleStoreIds !== null
        ? { id: { in: accessibleStoreIds } }
        : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const pendingPeriods = closingPeriods.filter((p) => !p.closedAt);
  const closedPeriods = closingPeriods.filter((p) => p.closedAt);

  return (
    <div className="space-y-8">
      <PageHeader
        title="締め処理"
        description="対象期間の勤怠記録をロックします。締め後は管理者も修正できません。"
      />

      {/* 新しい締め期間の作成 */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold">新しい締め期間を作成</h2>
        <ClosingForm organizationId={activeOrgId} stores={stores} />
      </section>

      {/* 未実行の締め期間 */}
      {pendingPeriods.length > 0 && (
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4">
            <Lock className="size-4 text-orange-500" aria-hidden="true" />
            <h2 className="text-base font-semibold">締め待ち</h2>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">
              {pendingPeriods.length}件
            </span>
          </div>
          <div className="divide-y divide-border">
            {pendingPeriods.map((period) => (
              <div
                key={period.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-medium">{period.name}</p>
                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>
                      期間: {formatDate(period.periodStart)} 〜{" "}
                      {formatDate(period.periodEnd)}
                    </span>
                    {period.store && (
                      <span>店舗: {period.store.name}</span>
                    )}
                    {!period.store && (
                      <span>対象: 全店舗</span>
                    )}
                  </div>
                </div>
                <ClosingExecuteButton
                  organizationId={activeOrgId}
                  closingPeriodId={period.id}
                  periodName={period.name}
                  periodStart={period.periodStart}
                  periodEnd={period.periodEnd}
                  storeName={period.store?.name ?? "全店舗"}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 締め済み一覧 */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <CheckCircle className="size-4 text-green-500" aria-hidden="true" />
          <h2 className="text-base font-semibold">締め済み</h2>
        </div>
        {closedPeriods.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            締め済みの期間がありません
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    締め期間名
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    対象期間
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    店舗
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    締め実行日時
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {closedPeriods.map((period) => (
                  <tr key={period.id} className="hover:bg-muted/20">
                    <td className="px-5 py-3 font-medium">{period.name}</td>
                    <td className="px-4 py-3 font-numeric text-muted-foreground">
                      {formatDate(period.periodStart)} 〜{" "}
                      {formatDate(period.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {period.store?.name ?? "全店舗"}
                    </td>
                    <td className="px-4 py-3 font-numeric text-muted-foreground">
                      {period.closedAt
                        ? formatDateTime(period.closedAt)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
