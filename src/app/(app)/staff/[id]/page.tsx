import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { OrganizationRole } from "@/generated/prisma/client";
import {
  requireAdmin,
  requireStaffEmailEditPermission,
} from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { MemberPermissionCard } from "@/components/permission/member-permission-card";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { StaffStatusActions } from "./staff-status-actions";
import { StaffEditForm } from "./staff-edit-form";
import { StaffInviteButton } from "./staff-invite-button";
import { StaffStoreAddForm } from "./staff-store-add-form";
import { StaffPinForm } from "./staff-pin-form";
import { StaffEmailForm } from "./staff-email-form";
import {
  Mail,
  Phone,
  Hash,
  Calendar,
  Building2,
  KeyRound,
  UserCheck,
  UserX,
} from "lucide-react";
import { resolveActiveOrganizationId } from "@/lib/auth/active-org";

export const metadata: Metadata = {
  title: "スタッフ詳細",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

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

export default async function StaffDetailPage({ params }: PageProps) {
  const { id } = await params;

  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = await resolveActiveOrganizationId(
    session.user?.id,
    (session as any).activeOrganizationId as string | null
  );
  if (!activeOrgId) redirect("/dashboard");

  const orgId = activeOrgId as string;

  let viewerRole: OrganizationRole;
  try {
    const ctx = await requireAdmin(session.user!.id, orgId);
    viewerRole = ctx.role;
  } catch {
    redirect("/dashboard");
  }

  const staff = await db.staff.findUnique({
    where: { id, organizationId: orgId },
    include: {
      staffStores: {
        include: {
          store: { select: { id: true, name: true } },
          wageHistories: {
            orderBy: { effectiveFrom: "desc" },
            take: 5,
          },
        },
        orderBy: [{ isPrimary: "desc" }, { startDate: "asc" }],
      },
    },
  });

  if (!staff) notFound();

  // メールアドレスは基本情報とは権限が異なる（オーナー / 該当店舗の店舗管理者 / 本人のみ）
  let canEditEmail = false;
  try {
    await requireStaffEmailEditPermission(session.user!.id, orgId, staff.id);
    canEditEmail = true;
  } catch {
    canEditEmail = false;
  }

  // 権限（ロール・担当店舗スコープ）は組織の権限構成そのものなので、
  // 管理者・権限ページ (requireOwner) と同じくオーナーだけに見せる。
  // 例外として自分自身の権限は見えてよい。
  const isSelf = !!staff.userId && staff.userId === session.user!.id;
  const canViewPermission = viewerRole === "OWNER" || isSelf;

  // ログインアカウントに紐づくメンバー情報。userId が無いスタッフは権限を持ちえない
  const member =
    staff.userId && canViewPermission
      ? await db.organizationMember.findFirst({
          where: {
            organizationId: orgId,
            userId: staff.userId,
            isActive: true,
          },
          include: {
            user: { select: { name: true, email: true } },
            storeScopes: { select: { storeId: true } },
          },
        })
      : null;

  // 権限カードの担当店舗ピッカー用（オーナーが権限を見るときだけ引く）
  const scopeStores = member
    ? await db.store.findMany({
        where: { organizationId: orgId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  // 未所属の店舗一覧（追加フォーム用）
  const assignedStoreIds = staff.staffStores.map((ss) => ss.storeId);
  const availableStores = await db.store.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
      id: { notIn: assignedStoreIds.length > 0 ? assignedStoreIds : ["__none__"] },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title={staff.displayName}
        description="スタッフの基本情報と所属店舗を管理します"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "スタッフ一覧", href: "/staff" },
          { label: staff.displayName },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${staffStatusColor[staff.status] ?? "bg-gray-100 text-gray-500"}`}
            >
              {staffStatusLabel[staff.status] ?? staff.status}
            </span>
            {staff.status !== "RESIGNED" && (
              <StaffInviteButton
                staffId={staff.id}
                organizationId={orgId}
                staffEmail={staff.email}
              />
            )}
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 基本情報 */}
        <section>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold">基本情報</h2>
            </div>
            <div className="p-6">
              <StaffEditForm
                staff={{
                  id: staff.id,
                  displayName: staff.displayName,
                  fullName: staff.fullName ?? "",
                  phone: staff.phone ?? "",
                  employeeCode: staff.employeeCode ?? "",
                  hireDate: staff.hireDate
                    ? format(staff.hireDate, "yyyy-MM-dd")
                    : "",
                  notes: staff.notes ?? "",
                }}
                organizationId={orgId}
              />
            </div>

            {canEditEmail && (
              <div className="border-t border-border p-6">
                <StaffEmailForm
                  staffId={staff.id}
                  organizationId={orgId}
                  currentEmail={staff.email}
                  hasLoginAccount={!!staff.userId}
                />
              </div>
            )}
          </div>
        </section>

        {/* 状態管理 */}
        <section>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold">在籍状態</h2>
            </div>
            <div className="p-6 space-y-4">
              {/* 現在の状態表示 */}
              <div className="rounded-lg bg-muted/40 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    現在の状態
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${staffStatusColor[staff.status] ?? "bg-gray-100 text-gray-500"}`}
                  >
                    {staffStatusLabel[staff.status] ?? staff.status}
                  </span>
                </div>
              </div>

              {/* 基本情報表示 */}
              <dl className="space-y-3">
                {staff.email && (
                  <div className="flex items-center gap-3">
                    <Mail
                      className="size-4 text-muted-foreground shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="sr-only">メール</dt>
                      <dd className="text-sm">{staff.email}</dd>
                    </div>
                  </div>
                )}
                {staff.phone && (
                  <div className="flex items-center gap-3">
                    <Phone
                      className="size-4 text-muted-foreground shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="sr-only">電話番号</dt>
                      <dd className="text-sm">{staff.phone}</dd>
                    </div>
                  </div>
                )}
                {staff.employeeCode && (
                  <div className="flex items-center gap-3">
                    <Hash
                      className="size-4 text-muted-foreground shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        社員番号
                      </dt>
                      <dd className="text-sm font-mono">
                        {staff.employeeCode}
                      </dd>
                    </div>
                  </div>
                )}
                {staff.hireDate && (
                  <div className="flex items-center gap-3">
                    <Calendar
                      className="size-4 text-muted-foreground shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-xs text-muted-foreground">入社日</dt>
                      <dd className="text-sm">
                        {format(staff.hireDate, "yyyy年M月d日", {
                          locale: ja,
                        })}
                      </dd>
                    </div>
                  </div>
                )}
                {staff.resignDate && (
                  <div className="flex items-center gap-3">
                    <Calendar
                      className="size-4 text-muted-foreground shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <dt className="text-xs text-muted-foreground">退職日</dt>
                      <dd className="text-sm text-muted-foreground">
                        {format(staff.resignDate, "yyyy年M月d日", {
                          locale: ja,
                        })}
                      </dd>
                    </div>
                  </div>
                )}
              </dl>

              {/* 状態変更アクション */}
              <div className="pt-4 border-t border-border">
                <StaffStatusActions
                  staffId={staff.id}
                  staffName={staff.displayName}
                  currentStatus={staff.status}
                  organizationId={orgId}
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 所属店舗一覧 */}
      <section>
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                所属店舗
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({staff.staffStores.length}件)
                </span>
              </h2>
              <StaffStoreAddForm
                staffId={staff.id}
                organizationId={orgId}
                availableStores={availableStores}
              />
            </div>
          </div>
          {staff.staffStores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2
                className="size-10 text-muted-foreground/30 mb-3"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                所属している店舗がありません
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                      店舗名
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      開始日
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      終了日
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      主担当
                    </th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                      打刻可
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      現在時給
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {staff.staffStores.map((ss) => {
                    const latestWage = ss.wageHistories[0];
                    return (
                      <tr
                        key={ss.storeId}
                        className={`hover:bg-muted/20 transition-colors ${!ss.isActive ? "opacity-50" : ""}`}
                      >
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/stores/${ss.store.id}`}
                              className="font-medium hover:text-primary hover:underline"
                            >
                              {ss.store.name}
                            </Link>
                            {!ss.isActive && (
                              <span className="text-xs text-muted-foreground">
                                (無効)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs font-numeric">
                          {format(ss.startDate, "yyyy/MM/dd")}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs font-numeric">
                          {ss.endDate
                            ? format(ss.endDate, "yyyy/MM/dd")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {ss.isPrimary ? (
                            <span className="text-green-600 text-xs font-medium">
                              ✓
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {ss.canClock ? (
                            <span className="text-green-600 text-xs font-medium">
                              ✓
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-numeric text-sm">
                          {latestWage ? (
                            <span>
                              ¥
                              {Number(latestWage.amount).toLocaleString()}
                              /時
                            </span>
                          ) : (
                            <span className="text-muted-foreground">未設定</span>
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
      </section>

      {/* ログイン・権限
          ログイン状態は管理者以上に見せる（誰が招待済みかは現場の管理者も知る必要がある）。
          権限（ロール・担当店舗）は組織の権限構成そのものなのでオーナー（と本人）のみ。 */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">ログイン・権限</h2>

        {/* 第1層: ログイン状態（管理者以上） */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          {staff.userId ? (
            <p className="flex items-center gap-2 text-sm">
              <UserCheck
                className="size-4 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              このスタッフはログインアカウントと連携済みです。
            </p>
          ) : (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm">
                <UserX
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                ログインアカウントが未連携です。打刻はできますが、本人が管理画面やシフト希望を使うことはできません。
              </p>
              <p className="text-xs text-muted-foreground">
                {staff.email
                  ? "ページ上部の「招待メールを送る」から招待してください。本人が登録するとアカウントが連携されます。"
                  : "先にメールアドレスを設定すると招待できるようになります。"}
              </p>
            </div>
          )}
        </div>

        {/* 第2層: 権限（オーナーまたは本人のみ） */}
        {canViewPermission &&
          (member ? (
            <MemberPermissionCard
              organizationId={orgId}
              member={{
                id: member.id,
                name: member.user.name ?? staff.displayName,
                email: member.user.email ?? staff.email ?? "",
                role: member.role,
                isSelf,
                scopeStoreIds: member.storeScopes.map((s) => s.storeId),
              }}
              stores={scopeStores}
            />
          ) : (
            staff.userId && (
              <p className="rounded-xl border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
                この組織のメンバーとして有効化されていないため、権限はありません。
              </p>
            )
          ))}

        {!canViewPermission && staff.userId && (
          <p className="rounded-xl border border-dashed border-border px-5 py-4 text-sm text-muted-foreground">
            権限（ロール・担当店舗）の確認と変更はオーナーのみ行えます。
          </p>
        )}
      </section>

      {/* PIN管理 */}
      {staff.staffStores.filter((ss) => ss.isActive).length > 0 && (
        <section>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-base font-semibold">PIN管理</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                店舗ごとに打刻時のPIN設定を管理します
              </p>
            </div>
            <div className="p-6 grid gap-4 sm:grid-cols-2">
              {staff.staffStores
                .filter((ss) => ss.isActive)
                .map((ss) => (
                  <StaffPinForm
                    key={ss.storeId}
                    staffId={staff.id}
                    organizationId={orgId}
                    storeId={ss.storeId}
                    storeName={ss.store.name}
                    hasPinSet={!!ss.pinHash}
                    requirePin={ss.requirePin}
                  />
                ))}
            </div>
          </div>
        </section>
      )}

      {/* 時給履歴 */}
      {staff.staffStores.some((ss) => ss.wageHistories.length > 0) && (
        <section>
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold">時給履歴</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                      店舗
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      時給
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      適用開始日
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                      適用終了日
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {staff.staffStores.flatMap((ss) =>
                    ss.wageHistories.map((wh) => (
                      <tr
                        key={wh.id}
                        className="hover:bg-muted/20 transition-colors"
                      >
                        <td className="px-6 py-3 font-medium">
                          {ss.store.name}
                        </td>
                        <td className="px-4 py-3 font-numeric">
                          ¥{Number(wh.amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs font-numeric">
                          {format(wh.effectiveFrom, "yyyy/MM/dd")}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs font-numeric">
                          {wh.effectiveTo
                            ? format(wh.effectiveTo, "yyyy/MM/dd")
                            : "現在"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
