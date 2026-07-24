import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, getAccessibleStoreIds } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Wallet } from "lucide-react";
import { TransportationReviewActions } from "./transportation-review-actions";
import { resolveActiveOrganizationId } from "@/lib/auth/active-org";

export const metadata: Metadata = {
  title: "交通費申請",
};

const TYPE_LABELS: Record<string, string> = {
  PER_SHIFT: "出勤ごと",
  MONTHLY: "月額",
  NONE: "支給なし",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "承認待ち",
  APPROVED: "承認済み",
  REJECTED: "却下",
  CANCELLED: "取り下げ",
};

const STATUS_CLASSES: Record<string, string> = {
  PENDING: "bg-blue-50 text-blue-700",
  APPROVED: "bg-green-50 text-green-700",
  REJECTED: "bg-red-50 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

function formatAmount(
  type: string,
  amount: number | null,
  limit?: number | null
): string {
  if (type === "NONE") return "支給なし";
  const base = `${TYPE_LABELS[type] ?? type} ¥${(amount ?? 0).toLocaleString()}`;
  return limit ? `${base}（上限 ¥${limit.toLocaleString()}）` : base;
}

export default async function TransportationRequestsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = await resolveActiveOrganizationId(
    session.user?.id,
    (session as any).activeOrganizationId as string | null
  );
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

  // 店舗スコープ付きの管理者は担当店舗の申請のみ扱える
  const accessibleStoreIds = await getAccessibleStoreIds(
    ctx.memberId,
    ctx.role,
    activeOrgId
  );

  const requests = await db.transportationChangeRequest.findMany({
    where: {
      staff: { organizationId: activeOrgId },
      ...(accessibleStoreIds
        ? { staffStore: { storeId: { in: accessibleStoreIds } } }
        : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      status: true,
      currentType: true,
      currentAmount: true,
      requestedType: true,
      requestedAmount: true,
      requestedLimit: true,
      reason: true,
      reviewNotes: true,
      createdAt: true,
      reviewedAt: true,
      staff: { select: { displayName: true } },
      staffStore: { select: { store: { select: { name: true } } } },
    },
  });

  const pending = requests.filter((r) => r.status === "PENDING");
  const reviewed = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      <PageHeader
        title="交通費申請"
        description="スタッフからの交通費変更申請を確認します"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "交通費申請" },
        ]}
      />

      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="mb-3 text-base font-semibold">
          承認待ち（{pending.length}件）
        </h2>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-12 text-center shadow-sm">
            <Wallet
              className="mb-3 size-10 text-muted-foreground/30"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">
              承認待ちの申請はありません
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {pending.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{r.staff.displayName}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {r.staffStore.store.name}
                    </p>
                  </div>
                  <span className="font-numeric text-xs text-muted-foreground">
                    {format(
                      toZonedTime(r.createdAt, "Asia/Tokyo"),
                      "yyyy/MM/dd HH:mm"
                    )}
                  </span>
                </div>

                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-muted/40 px-3 py-2">
                    <dt className="text-xs text-muted-foreground">現在</dt>
                    <dd className="mt-0.5 font-numeric text-sm">
                      {r.currentType
                        ? formatAmount(
                            r.currentType,
                            r.currentAmount ? Number(r.currentAmount) : 0
                          )
                        : "未設定"}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                    <dt className="text-xs text-primary">申請内容</dt>
                    <dd className="mt-0.5 font-numeric text-sm font-medium">
                      {formatAmount(
                        r.requestedType,
                        Number(r.requestedAmount),
                        r.requestedLimit ? Number(r.requestedLimit) : null
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">申請理由</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{r.reason}</p>
                </div>

                <TransportationReviewActions
                  organizationId={activeOrgId}
                  requestId={r.id}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {reviewed.length > 0 && (
        <section aria-labelledby="reviewed-heading">
          <h2 id="reviewed-heading" className="mb-3 text-base font-semibold">
            処理済み
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    スタッフ
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    店舗
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    申請内容
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    状態
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    処理日時
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reviewed.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">{r.staff.displayName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.staffStore.store.name}
                    </td>
                    <td className="px-4 py-3 font-numeric">
                      {formatAmount(
                        r.requestedType,
                        Number(r.requestedAmount),
                        r.requestedLimit ? Number(r.requestedLimit) : null
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_CLASSES[r.status] ?? "bg-gray-100"
                        }`}
                      >
                        {STATUS_LABELS[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-numeric text-muted-foreground">
                      {r.reviewedAt
                        ? format(
                            toZonedTime(r.reviewedAt, "Asia/Tokyo"),
                            "yyyy/MM/dd HH:mm"
                          )
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
