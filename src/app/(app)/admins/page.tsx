import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { AdminInviteForm } from "./admin-invite-form";
import { AdminRemoveButton } from "./admin-remove-button";
import { MemberPermissionCard } from "@/components/permission/member-permission-card";
import { resolveActiveOrganizationId } from "@/lib/auth/active-org";

export const metadata: Metadata = {
  title: "管理者・権限管理",
};

export default async function AdminsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = await resolveActiveOrganizationId(
    session.user?.id,
    (session as any).activeOrganizationId as string | null
  );
  if (!activeOrgId) redirect("/dashboard");

  try {
    await requireOwner(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const [members, stores] = await Promise.all([
    db.organizationMember.findMany({
      where: { organizationId: activeOrgId, isActive: true },
      include: {
        user: { select: { name: true, email: true } },
        storeScopes: { select: { storeId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.store.findMany({
      where: { organizationId: activeOrgId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const admins = members.filter(
    (m) => m.role === "OWNER" || m.role === "ADMIN"
  );
  const memberStaff = members.filter((m) => m.role === "MEMBER");

  function renderCard(member: (typeof members)[number]) {
    const isSelf = member.userId === session!.user!.id;
    return (
      <MemberPermissionCard
        key={member.id}
        organizationId={activeOrgId!}
        member={{
          id: member.id,
          name: member.user.name ?? "",
          email: member.user.email ?? "",
          role: member.role as "OWNER" | "ADMIN" | "MEMBER",
          isSelf,
          scopeStoreIds: member.storeScopes.map((s) => s.storeId),
        }}
        stores={stores}
        onRemove={
          <AdminRemoveButton
            memberId={member.id}
            memberName={member.user.name ?? member.user.email ?? ""}
            organizationId={activeOrgId!}
          />
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="管理者・権限管理"
        description="組織の管理者を招待し、メンバーの権限や担当店舗を管理します"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "管理者・権限管理" },
        ]}
      />

      {/* 管理者（OWNER / ADMIN） */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">
          管理者
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({admins.length}人)
          </span>
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">{admins.map(renderCard)}</div>
      </section>

      {/* メンバー（スタッフ本人ログイン）。ここから管理者に昇格できる */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">
          メンバー（スタッフ）
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            ({memberStaff.length}人)
          </span>
        </h2>
        {memberStaff.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            ログイン可能なスタッフ（メンバー）はいません。スタッフを管理者にするには、まずそのスタッフにメールアドレスを設定して招待してください。
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              「権限」を「管理者」に切り替えると、そのスタッフを管理者（必要なら特定店舗の店舗管理者）にできます。
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {memberStaff.map(renderCard)}
            </div>
          </>
        )}
      </section>

      {/* 招待フォーム */}
      <section>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-1 text-base font-semibold">管理者を招待</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            既存のみせ勤アカウントを持つ人を管理者として追加します。
          </p>
          <AdminInviteForm organizationId={activeOrgId} stores={stores} />
        </div>
      </section>
    </div>
  );
}
