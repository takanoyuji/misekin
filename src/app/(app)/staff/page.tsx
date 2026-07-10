import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { Users, Plus } from "lucide-react";
import { format } from "date-fns";
import type { Prisma } from "@/generated/prisma/client";

export const metadata: Metadata = {
  title: "スタッフ一覧",
};

const staffStatusLabel: Record<string, string> = {
  INVITED: "招待中",
  ACTIVE: "在籍",
  ON_LEAVE: "休職中",
  RESIGNED: "退職",
  SUSPENDED: "停止中",
};

const staffStatusColor: Record<string, string> = {
  INVITED: "bg-yellow-50 text-yellow-700",
  ACTIVE: "bg-green-50 text-green-700",
  ON_LEAVE: "bg-orange-50 text-orange-700",
  RESIGNED: "bg-gray-100 text-gray-500",
  SUSPENDED: "bg-red-50 text-red-700",
};

interface SearchParams {
  status?: string;
  q?: string;
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
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

  try {
    await requireAdmin(session.user!.id, orgId);
  } catch {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const statusFilter = params.status || undefined;
  const query = params.q?.trim() || undefined;

  const whereClause: Prisma.StaffWhereInput = {
    organizationId: orgId,
  };
  if (statusFilter) {
    whereClause.status = statusFilter as Prisma.EnumStaffStatusFilter;
  }
  if (query) {
    whereClause.OR = [
      { displayName: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
      { employeeCode: { contains: query, mode: "insensitive" } },
    ];
  }

  const staffList = await db.staff.findMany({
    where: whereClause,
    include: {
      staffStores: {
        where: { isActive: true },
        include: { store: { select: { name: true } } },
      },
    },
    orderBy: [{ status: "asc" }, { displayName: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="スタッフ一覧"
        description="組織のスタッフを管理します"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "スタッフ一覧" },
        ]}
        actions={
          <Link
            href="/staff/invite"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50 transition-colors"
          >
            <Plus className="size-4" aria-hidden="true" />
            スタッフを招待
          </Link>
        }
      />

      {/* フィルター */}
      <form
        method="GET"
        action="/staff"
        className="flex flex-wrap items-end gap-3"
      >
        <div className="space-y-1">
          <label
            htmlFor="staff-search"
            className="block text-xs font-medium text-muted-foreground"
          >
            検索
          </label>
          <input
            id="staff-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="名前・メール・社員番号"
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-56 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="staff-status"
            className="block text-xs font-medium text-muted-foreground"
          >
            状態
          </label>
          <select
            id="staff-status"
            name="status"
            defaultValue={statusFilter ?? ""}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">すべて</option>
            <option value="ACTIVE">在籍</option>
            <option value="INVITED">招待中</option>
            <option value="ON_LEAVE">休職中</option>
            <option value="RESIGNED">退職</option>
            <option value="SUSPENDED">停止中</option>
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          絞り込む
        </button>
        <a
          href="/staff"
          className="rounded-md border border-input px-4 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          リセット
        </a>
      </form>

      {/* テーブル */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <p className="text-sm text-muted-foreground">
            全{" "}
            <span className="font-medium text-foreground">
              {staffList.length}
            </span>{" "}
            件
          </p>
        </div>

        {staffList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users
              className="size-12 text-muted-foreground/30 mb-4"
              aria-hidden="true"
            />
            <p className="text-muted-foreground">
              {query || statusFilter
                ? "条件に一致するスタッフがいません"
                : "スタッフがまだいません"}
            </p>
            {!query && !statusFilter && (
              <Link
                href="/staff/invite"
                className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus className="size-4" />
                スタッフを招待する
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                    表示名
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    社員番号
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    メール
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    所属店舗
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    入社日
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    状態
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {staffList.map((staff) => (
                  <tr
                    key={staff.id}
                    className="hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/staff/${staff.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {staff.displayName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {staff.employeeCode ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {staff.email}
                    </td>
                    <td className="px-4 py-3">
                      {staff.staffStores.length === 0 ? (
                        <span className="text-muted-foreground text-xs">
                          未所属
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {staff.staffStores.map((ss) => (
                            <span
                              key={ss.storeId}
                              className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs"
                            >
                              {ss.store.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs font-numeric">
                      {staff.hireDate
                        ? format(staff.hireDate, "yyyy/MM/dd")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${staffStatusColor[staff.status] ?? "bg-gray-100 text-gray-500"}`}
                      >
                        {staffStatusLabel[staff.status] ?? staff.status}
                      </span>
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
