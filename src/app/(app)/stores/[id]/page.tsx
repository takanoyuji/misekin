import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, canAccessStore } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { StoreEditForm } from "./store-edit-form";
import { ClockUrlSection } from "./clock-url-section";

export const metadata: Metadata = {
  title: "店舗詳細",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StoreDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = (session as any).activeOrganizationId as string | null;
  if (!activeOrgId) redirect("/dashboard");

  const orgId = activeOrgId as string;

  let ctx;
  try {
    ctx = await requireAdmin(session.user!.id, orgId);
  } catch {
    redirect("/dashboard");
  }

  const hasAccess = await canAccessStore(ctx!.memberId, ctx!.role, id);
  if (!hasAccess) redirect("/stores");

  const store = await db.store.findUnique({
    where: { id, organizationId: orgId },
    include: {
      clockUrls: {
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      staffStores: {
        where: { isActive: true },
        include: {
          staff: { select: { id: true, displayName: true, status: true } },
        },
        orderBy: { staff: { displayName: "asc" } },
      },
    },
  });

  if (!store) notFound();

  const activeClockUrl = store.clockUrls[0] ?? null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const clockUrlFull = activeClockUrl
    ? `${appUrl}/clock/${activeClockUrl.token}`
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={store.name}
        description="店舗情報の表示・編集"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "店舗一覧", href: "/stores" },
          { label: store.name },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 店舗情報編集フォーム */}
        <section>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold">店舗情報</h2>
            </div>
            <div className="p-6">
              <StoreEditForm
                store={{
                  id: store.id,
                  name: store.name,
                  code: store.code ?? "",
                  address: store.address ?? "",
                  timezone: store.timezone,
                  dayChangeHour: store.dayChangeHour,
                  dayChangeMinute: store.dayChangeMinute,
                  isActive: store.isActive,
                }}
                organizationId={orgId}
              />
            </div>
          </div>
        </section>

        {/* 打刻URL・QRコードセクション */}
        <section>
          <ClockUrlSection
            storeId={store.id}
            storeName={store.name}
            organizationId={activeOrgId}
            clockUrlFull={clockUrlFull}
            clockUrlToken={activeClockUrl?.token ?? null}
          />
        </section>
      </div>

      {/* 所属スタッフ */}
      <section>
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold">
              所属スタッフ
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({store.staffStores.length}人)
              </span>
            </h2>
          </div>
          {store.staffStores.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              所属スタッフがいません
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                      スタッフ名
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      在籍状態
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {store.staffStores.map((ss) => (
                    <tr
                      key={ss.staff.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-6 py-3 font-medium">
                        {ss.staff.displayName}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            ss.staff.status === "ACTIVE"
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {ss.staff.status === "ACTIVE"
                            ? "在籍"
                            : ss.staff.status === "ON_LEAVE"
                              ? "休職中"
                              : ss.staff.status === "RESIGNED"
                                ? "退職"
                                : ss.staff.status === "SUSPENDED"
                                  ? "停止中"
                                  : "招待中"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`/staff/${ss.staff.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          詳細
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
