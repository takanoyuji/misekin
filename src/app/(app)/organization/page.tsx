import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { OrganizationForm } from "./organization-form";
import { format } from "date-fns";

export const metadata: Metadata = {
  title: "組織設定",
};

export default async function OrganizationPage() {
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

  const org = await db.organization.findUnique({
    where: { id: activeOrgId },
    include: {
      _count: { select: { members: { where: { isActive: true } } } },
    },
  });

  if (!org) redirect("/dashboard");

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="組織設定"
        description="組織の基本情報を設定します"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "組織設定" },
        ]}
      />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 grid grid-cols-2 gap-4 text-sm rounded-lg bg-muted/40 p-4">
          <div>
            <p className="text-xs text-muted-foreground">組織ID</p>
            <p className="font-mono text-xs mt-0.5">{org.id}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">メンバー数</p>
            <p className="font-medium mt-0.5">{org._count.members}人</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">作成日</p>
            <p className="mt-0.5">{format(org.createdAt, "yyyy/MM/dd")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">ステータス</p>
            <span className={`inline-flex mt-0.5 items-center rounded-full px-2 py-0.5 text-xs font-medium ${org.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {org.isActive ? "有効" : "無効"}
            </span>
          </div>
        </div>

        <OrganizationForm
          organizationId={org.id}
          name={org.name}
          timezone={org.timezone}
          dayChangeHour={org.dayChangeHour}
        />
      </div>
    </div>
  );
}
