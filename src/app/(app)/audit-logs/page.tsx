import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export const metadata: Metadata = {
  title: "監査ログ",
};

interface SearchParams {
  action?: string;
  targetType?: string;
  staffId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const TARGET_TYPES = [
  "Attendance",
  "CorrectionRequest",
  "Staff",
  "Store",
  "ApiKey",
  "OrganizationMember",
];

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = (session as any).activeOrganizationId as string | null;
  if (!activeOrgId) redirect("/dashboard");

  try {
    await requireAdmin(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const logs = await db.auditLog.findMany({
    where: {
      organizationId: activeOrgId,
      ...(params.action ? { action: { contains: params.action } } : {}),
      ...(params.targetType ? { targetType: params.targetType } : {}),
      ...(params.staffId ? { staffId: params.staffId } : {}),
      ...(params.dateFrom || params.dateTo
        ? {
            createdAt: {
              ...(params.dateFrom
                ? { gte: new Date(params.dateFrom) }
                : {}),
              ...(params.dateTo
                ? { lte: new Date(params.dateTo + "T23:59:59") }
                : {}),
            },
          }
        : {}),
    },
    include: {
      actor: { select: { name: true } },
      store: { select: { name: true } },
      staff: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const actorTypeLabel: Record<string, string> = {
    USER: "ユーザー",
    SYSTEM: "システム",
    API: "API",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="監査ログ"
        description="組織内の操作履歴を確認します（最新100件）"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "監査ログ" },
        ]}
      />

      {/* フィルター */}
      <form
        method="get"
        className="rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              htmlFor="filter-action"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              アクション
            </label>
            <input
              id="filter-action"
              type="text"
              name="action"
              defaultValue={params.action ?? ""}
              placeholder="例: ATTENDANCE"
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label
              htmlFor="filter-target-type"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              対象種別
            </label>
            <select
              id="filter-target-type"
              name="targetType"
              defaultValue={params.targetType ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 bg-white"
            >
              <option value="">すべて</option>
              {TARGET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="filter-date-from"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              開始日
            </label>
            <input
              id="filter-date-from"
              type="date"
              name="dateFrom"
              defaultValue={params.dateFrom ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label
              htmlFor="filter-date-to"
              className="block text-xs font-medium text-muted-foreground mb-1"
            >
              終了日
            </label>
            <input
              id="filter-date-to"
              type="date"
              name="dateTo"
              defaultValue={params.dateTo ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            絞り込む
          </button>
          <a
            href="/audit-logs"
            className="rounded-lg border border-border px-4 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            リセット
          </a>
        </div>
      </form>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground text-sm">
              ログが見つかりませんでした
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    日時
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    アクター
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    アクション
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    対象種別
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    対象ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    店舗
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    スタッフ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    変更理由
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.createdAt), "yyyy/MM/dd HH:mm:ss", {
                        locale: ja,
                      })}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>{log.actor?.name ?? "-"}</div>
                      <div className="text-muted-foreground">
                        {actorTypeLabel[log.actorType] ?? log.actorType}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {log.action}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {log.targetType}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {log.targetId ? (
                        <span
                          title={log.targetId}
                          className="font-mono"
                        >
                          {log.targetId.slice(0, 8)}...
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {log.store?.name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {log.staff?.displayName ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                      {log.reason ? (
                        <span
                          className="truncate block max-w-[160px]"
                          title={log.reason}
                        >
                          {log.reason}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {logs.length === 100 && (
        <p className="text-xs text-muted-foreground text-center">
          表示件数の上限（100件）に達しています。期間を絞り込んでください。
        </p>
      )}
    </div>
  );
}
