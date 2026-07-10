import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { ApiKeyCreateForm } from "./api-key-create-form";
import { ApiKeyRevokeButton } from "./api-key-revoke-button";

export const metadata: Metadata = {
  title: "APIキー管理",
};

export default async function ApiKeysPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = (session as any).activeOrganizationId as string | null;
  if (!activeOrgId) redirect("/dashboard");

  let ctx;
  try {
    ctx = await requireOwner(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const apiKeys = await db.apiKey.findMany({
    where: { organizationId: activeOrgId },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const stores = await db.store.findMany({
    where: { organizationId: activeOrgId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="APIキー管理"
        description="外部システム連携用のAPIキーを管理します"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "APIキー管理" },
        ]}
        actions={
          <ApiKeyCreateForm
            organizationId={activeOrgId}
            stores={stores}
          />
        }
      />

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {apiKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground text-sm">
              APIキーがまだ発行されていません
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              「APIキーを発行」ボタンから新しいキーを作成できます
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    キー名
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    説明
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    プレフィックス
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">
                    読取専用
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    店舗スコープ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    最終使用日
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    有効期限
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    状態
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    発行者
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {apiKeys.map((key) => {
                  const isExpired =
                    key.expiresAt && key.expiresAt < new Date();
                  const storeScope = key.storeScope as string[] | null;

                  return (
                    <tr
                      key={key.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {key.name}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {key.description ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                          {key.keyPrefix}...
                        </code>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {key.isReadOnly ? (
                          <span className="text-green-600">○</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {storeScope && storeScope.length > 0
                          ? `${storeScope.length}店舗`
                          : "全店舗"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {key.lastUsedAt
                          ? format(
                              new Date(key.lastUsedAt),
                              "yyyy/MM/dd HH:mm",
                              { locale: ja }
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {key.expiresAt ? (
                          <span
                            className={
                              isExpired
                                ? "text-red-500"
                                : "text-muted-foreground"
                            }
                          >
                            {format(new Date(key.expiresAt), "yyyy/MM/dd", {
                              locale: ja,
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">無期限</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!key.isActive ? (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            無効
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                            期限切れ
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            有効
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {key.createdBy?.name ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        {key.isActive && !isExpired ? (
                          <ApiKeyRevokeButton
                            apiKeyId={key.id}
                            apiKeyName={key.name}
                            organizationId={activeOrgId}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className="text-sm font-semibold text-amber-800 mb-1">
          セキュリティに関する注意
        </h3>
        <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
          <li>APIキーは発行時にのみ表示されます。紛失した場合は再発行が必要です。</li>
          <li>APIキーをソースコードやバージョン管理システムに含めないでください。</li>
          <li>不要になったAPIキーはすぐに無効化してください。</li>
        </ul>
      </div>
    </div>
  );
}
