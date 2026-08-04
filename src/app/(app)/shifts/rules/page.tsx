import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, getAccessibleStoreIds } from "@/lib/auth/permissions";
import { resolveActiveOrganizationId } from "@/lib/auth/active-org";
import { PageHeader } from "@/components/common/page-header";
import { ChevronLeft } from "lucide-react";
import { ShiftRuleManager } from "./shift-rule-manager";
import { verticalForCategory } from "@/lib/verticals";
import { getOrgPresentation } from "@/lib/verticals/server";

export const metadata: Metadata = {
  title: "シフトルール",
};

interface SearchParams {
  storeId?: string;
}

export default async function ShiftRulesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = await resolveActiveOrganizationId(
    session.user?.id,
    (session as any).activeOrganizationId as string | null
  );
  if (!activeOrgId) redirect("/dashboard");

  let ctx;
  try {
    ctx = await requireAdmin(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const accessibleStoreIds = await getAccessibleStoreIds(
    ctx.memberId,
    ctx.role,
    activeOrgId
  );

  const stores = await db.store.findMany({
    where: {
      organizationId: activeOrgId,
      isActive: true,
      ...(accessibleStoreIds ? { id: { in: accessibleStoreIds } } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, category: true },
  });

  if (stores.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="シフトルール" />
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          担当できる店舗がありません。
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const storeId = params.storeId ?? stores[0].id;

  const rules = await db.shiftRule.findMany({
    where: { storeId, organizationId: activeOrgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      ruleType: true,
      weight: true,
      params: true,
      sourceText: true,
      description: true,
      enabled: true,
    },
  });

  // Claude翻訳が使えるか（APIキーの有無）
  const aiEnabled = !!process.env.ANTHROPIC_API_KEY;

  // その店舗の業態に合わせたルールのテンプレート。押すと入力欄に入る
  const presentation = await getOrgPresentation(activeOrgId);
  const selectedStore = stores.find((s) => s.id === storeId);
  const rulePresets = verticalForCategory(
    selectedStore?.category ?? "OTHER",
    presentation.vertical
  ).defaults.rules;

  return (
    <div className="space-y-6">
      <PageHeader
        title="シフトルール"
        description="日本語で入力したルールを、シフト作成に効く形に変換して登録します。"
        breadcrumbs={[
          { label: "シフト管理", href: "/shifts" },
          { label: "シフトルール" },
        ]}
      />

      <Link
        href="/shifts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        シフト管理に戻る
      </Link>

      {stores.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {stores.map((s) => (
            <Link
              key={s.id}
              href={`/shifts/rules?storeId=${s.id}`}
              className={`inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                s.id === storeId
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background hover:bg-muted"
              }`}
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}

      <ShiftRuleManager
        organizationId={activeOrgId}
        storeId={storeId}
        aiEnabled={aiEnabled}
        presets={rulePresets}
        rules={rules.map((r) => ({
          id: r.id,
          ruleType: r.ruleType,
          weight: r.weight,
          params: (r.params ?? {}) as Record<string, unknown>,
          sourceText: r.sourceText,
          description: r.description,
          enabled: r.enabled,
        }))}
      />
    </div>
  );
}
