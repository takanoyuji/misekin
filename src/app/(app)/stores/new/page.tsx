import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { StoreNewForm } from "./store-new-form";

export const metadata: Metadata = {
  title: "店舗を追加",
};

export default async function StoreNewPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = (session as any).activeOrganizationId as string | null;
  if (!activeOrgId) redirect("/dashboard");

  const orgId = activeOrgId as string;

  try {
    await requireAdmin(session.user!.id, orgId);
  } catch {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="店舗を追加"
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "店舗一覧", href: "/stores" },
          { label: "店舗を追加" },
        ]}
      />
      <div className="max-w-md">
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="p-6">
            <StoreNewForm organizationId={orgId} />
          </div>
        </div>
      </div>
    </div>
  );
}
