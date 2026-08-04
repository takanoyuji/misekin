import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { db } from "@/lib/db";
import { StaffNewForm } from "./staff-new-form";
import { resolveActiveOrganizationId } from "@/lib/auth/active-org";
import { getOrgPresentation } from "@/lib/verticals/server";

export const metadata: Metadata = {
  title: "スタッフを追加",
};

export default async function StaffNewPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = await resolveActiveOrganizationId(
    session.user?.id,
    (session as any).activeOrganizationId as string | null
  );
  if (!activeOrgId) redirect("/dashboard");
  const { terms } = await getOrgPresentation(activeOrgId);

  try {
    await requireAdmin(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const stores = await db.store.findMany({
    where: { organizationId: activeOrgId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${terms.staff}を追加`}
        description={`新しい${terms.staff}を追加します`}
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: `${terms.staff}一覧`, href: "/staff" },
          { label: `${terms.staff}を追加` },
        ]}
      />
      <div className="max-w-md">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="p-6">
            <StaffNewForm organizationId={activeOrgId} stores={stores} />
          </div>
        </div>
      </div>
    </div>
  );
}
