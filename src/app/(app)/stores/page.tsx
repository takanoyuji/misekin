import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, getAccessibleStoreIds } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { Plus, Building2, ExternalLink } from "lucide-react";
import { StoreDeactivateButton } from "./store-deactivate-button";

export const metadata: Metadata = {
  title: "店舗一覧",
};

export default async function StoresPage() {
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

  const orgId = activeOrgId as string;

  let ctx;
  try {
    ctx = await requireAdmin(session.user!.id, orgId);
  } catch {
    redirect("/dashboard");
  }

  const accessibleStoreIds = await getAccessibleStoreIds(
    ctx!.memberId,
    ctx!.role,
    orgId
  );

  const storeWhereClause = accessibleStoreIds !== null
    ? { organizationId: orgId, id: { in: accessibleStoreIds } }
    : { organizationId: orgId };

  const stores = await db.store.findMany({
    where: storeWhereClause,
    include: {
      clockUrls: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { staffStores: { where: { isActive: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="店舗一覧"
        description="組織の店舗を管理します"
        breadcrumbs={[{ label: "ホーム", href: "/dashboard" }, { label: "店舗一覧" }]}
        actions={
          <Link
            href="/stores/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50 transition-colors"
          >
            <Plus className="size-4" aria-hidden="true" />
            店舗を追加
          </Link>
        }
      />

      <div className="rounded-xl border border-border bg-card shadow-sm">
        {stores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Building2
              className="size-12 text-muted-foreground/30 mb-4"
              aria-hidden="true"
            />
            <p className="text-muted-foreground">店舗がまだありません</p>
            <Link
              href="/stores/new"
              className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <Plus className="size-4" />
              最初の店舗を追加する
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    店舗名
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    コード
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    タイムゾーン
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    所属スタッフ
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    状態
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stores.map((store) => (
                  <tr
                    key={store.id}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{store.name}</span>
                        {store.clockUrls[0] && (
                          <a
                            href={`/clock/${store.clockUrls[0].token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary transition-colors"
                            aria-label={`${store.name}の打刻URLを開く`}
                          >
                            <ExternalLink className="size-3.5" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                      {store.address && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {store.address}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {store.code ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {store.timezone}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-numeric text-sm">
                        {store._count.staffStores}人
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          store.isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {store.isActive ? "有効" : "無効"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/stores/${store.id}`}
                          className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        >
                          詳細・編集
                        </Link>
                        {store.isActive && (
                          <StoreDeactivateButton
                            storeId={store.id}
                            storeName={store.name}
                            organizationId={orgId}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
