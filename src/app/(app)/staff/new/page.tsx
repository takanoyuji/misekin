import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { StaffNewForm } from "./staff-new-form";

export const metadata: Metadata = {
  title: "スタッフを招待",
};

export default async function StaffNewPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = (session as any).activeOrganizationId as string | null;
  if (!activeOrgId) redirect("/dashboard");

  try {
    await requireAdmin(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="スタッフを招待"
        description="新しいスタッフをメールで招待します"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "スタッフ一覧", href: "/staff" },
          { label: "スタッフを招待" },
        ]}
      />
      <div className="max-w-md">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="p-6">
            <StaffNewForm organizationId={activeOrgId} />
          </div>
        </div>
      </div>
    </div>
  );
}
