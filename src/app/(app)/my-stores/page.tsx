import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { format } from "date-fns";
import { Store, KeyRound } from "lucide-react";

export const metadata: Metadata = {
  title: "担当店舗",
};

export default async function MyStoresPage() {
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

  try {
    await requireOrgMember(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const staff = await db.staff.findFirst({
    where: { userId: session.user!.id, organizationId: activeOrgId },
    select: { id: true, displayName: true },
  });

  if (!staff) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">
          スタッフ情報が見つかりません。管理者にお問い合わせください。
        </p>
      </div>
    );
  }

  const staffStores = await db.staffStore.findMany({
    where: { staffId: staff.id, isActive: true },
    include: {
      store: true,
      wageHistories: {
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
    },
    orderBy: [{ isPrimary: "desc" }, { startDate: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="担当店舗"
        description="あなたが担当している店舗の一覧です"
      />

      {staffStores.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center shadow-sm">
          <Store
            className="size-12 text-muted-foreground/30 mb-4"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            担当店舗が割り当てられていません
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            管理者にお問い合わせください
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staffStores.map((ss) => {
            const currentWage = ss.wageHistories[0] ?? null;
            const hasPinSet = !!ss.pinHash;

            return (
              <div
                key={ss.id}
                className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4"
              >
                {/* 店舗名・主担当バッジ */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold">{ss.store.name}</h2>
                    {ss.store.address && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {ss.store.address}
                      </p>
                    )}
                  </div>
                  {ss.isPrimary && (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      主担当
                    </span>
                  )}
                </div>

                {/* 詳細情報 */}
                <dl className="space-y-2 text-sm border-t border-border pt-3">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">入店日</dt>
                    <dd className="font-numeric">
                      {format(new Date(ss.startDate), "yyyy/MM/dd")}
                    </dd>
                  </div>
                  {ss.endDate && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">終了日</dt>
                      <dd className="font-numeric text-muted-foreground">
                        {format(new Date(ss.endDate), "yyyy/MM/dd")}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">打刻</dt>
                    <dd>
                      {ss.canClock ? (
                        <span className="text-green-600 font-medium">可能</span>
                      ) : (
                        <span className="text-muted-foreground">不可</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">時給</dt>
                    <dd className="font-numeric font-medium">
                      {currentWage
                        ? `¥${Number(currentWage.amount).toLocaleString()}`
                        : "未設定"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="flex items-center gap-1 text-muted-foreground">
                      <KeyRound className="size-3" aria-hidden="true" />
                      PIN
                    </dt>
                    <dd>
                      {hasPinSet ? (
                        <span className="text-green-600 font-medium">設定済み</span>
                      ) : (
                        <span className="text-amber-600 font-medium">未設定</span>
                      )}
                    </dd>
                  </div>
                  {ss.store.code && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">店舗コード</dt>
                      <dd className="font-mono text-xs">{ss.store.code}</dd>
                    </div>
                  )}
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
