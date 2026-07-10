import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { format } from "date-fns";
import { AdminInviteForm } from "./admin-invite-form";
import { AdminRemoveButton } from "./admin-remove-button";

export const metadata: Metadata = {
  title: "管理者管理",
};

export default async function AdminsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = (session as any).activeOrganizationId as string | null;
  if (!activeOrgId) redirect("/dashboard");

  try {
    await requireOwner(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const members = await db.organizationMember.findMany({
    where: { organizationId: activeOrgId, isActive: true },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const roleLabel: Record<string, string> = {
    OWNER: "オーナー",
    ADMIN: "管理者",
    VIEWER: "閲覧者",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="管理者管理"
        description="組織の管理者を招待・管理します"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "管理者管理" },
        ]}
      />

      {/* メンバー一覧 */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">
            管理者一覧
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({members.length}人)
            </span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-5 py-3 text-left font-medium text-muted-foreground">名前</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">メール</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">権限</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">参加日</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-muted/20">
                  <td className="px-5 py-3 font-medium">
                    {member.user.name ?? "—"}
                    {member.userId === session.user!.id && (
                      <span className="ml-2 text-xs text-muted-foreground">(あなた)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{member.user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      member.role === "OWNER"
                        ? "bg-purple-50 text-purple-700"
                        : "bg-blue-50 text-blue-700"
                    }`}>
                      {roleLabel[member.role] ?? member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {format(member.createdAt, "yyyy/MM/dd")}
                  </td>
                  <td className="px-4 py-3">
                    {member.role !== "OWNER" && member.userId !== session.user!.id && (
                      <AdminRemoveButton
                        memberId={member.id}
                        memberName={member.user.name ?? member.user.email ?? ""}
                        organizationId={activeOrgId}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 招待フォーム */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold mb-4">管理者を招待</h2>
        <AdminInviteForm organizationId={activeOrgId} />
      </div>
    </div>
  );
}
