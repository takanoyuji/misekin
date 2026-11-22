import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/common/page-header";
import { findSimilarCustomerPairs } from "@/lib/business/daily-report";
import { loadDailyReportContext } from "../context";
import { CustomerMergeList, type CustomerView } from "./customer-merge-list";

export const metadata: Metadata = { title: "お客様の名前をまとめる" };

export default async function DailyReportCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string }>;
}) {
  const params = await searchParams;
  const { orgId, stores, store } = await loadDailyReportContext(params.storeId);
  if (!store) {
    return (
      <div className="space-y-6">
        <PageHeader title="お客様の名前をまとめる" />
        <p className="text-sm text-muted-foreground">日報を使っている店舗がありません。</p>
      </div>
    );
  }

  const [customers, sales] = await Promise.all([
    db.customer.findMany({
      where: { organizationId: orgId, storeId: store.id },
      select: { id: true, name: true, normalizedName: true, mergedIntoId: true },
      orderBy: { createdAt: "asc" },
    }),
    db.dailyReportSale.findMany({
      where: { report: { organizationId: orgId, storeId: store.id } },
      select: { customerId: true, amount: true, report: { select: { businessDate: true } } },
    }),
  ]);

  const stat = new Map<string, { count: number; amount: number; last: string }>();
  for (const s of sales) {
    const cur = stat.get(s.customerId) ?? { count: 0, amount: 0, last: "" };
    cur.count++;
    cur.amount += s.amount;
    if (s.report.businessDate > cur.last) cur.last = s.report.businessDate;
    stat.set(s.customerId, cur);
  }

  const roots = customers.filter((c) => !c.mergedIntoId);
  const views: CustomerView[] = roots
    .map((r) => {
      const members = [r, ...customers.filter((c) => c.mergedIntoId === r.id)];
      const agg = members.reduce(
        (a, m) => {
          const s = stat.get(m.id);
          if (s) {
            a.count += s.count;
            a.amount += s.amount;
            if (s.last > a.last) a.last = s.last;
          }
          return a;
        },
        { count: 0, amount: 0, last: "" }
      );
      return {
        id: r.id,
        name: r.name,
        aliases: members
          .filter((m) => m.id !== r.id)
          .map((m) => ({ id: m.id, name: m.name, count: stat.get(m.id)?.count ?? 0 })),
        saleCount: agg.count,
        amount: agg.amount,
        lastDate: agg.last || null,
      };
    })
    .sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? "") || b.amount - a.amount);

  const pairs = findSimilarCustomerPairs(roots).map((p) => ({
    a: { id: p.a.id, name: p.a.name },
    b: { id: p.b.id, name: p.b.name },
    reason: p.reason,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="お客様の名前をまとめる"
        description="同じお客様が別の名前で書かれていたら、1人にまとめます。日報に書かれた名前はそのまま残り、あとから分けられます。"
        breadcrumbs={[
          { label: "日報", href: `/daily-reports?storeId=${store.id}` },
          { label: "お客様の名前をまとめる" },
        ]}
      />

      {stores.length > 1 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {stores.map((s) => (
            <Link
              key={s.id}
              href={`/daily-reports/customers?storeId=${s.id}`}
              aria-current={s.id === store.id ? "page" : undefined}
              className={
                s.id === store.id
                  ? "rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
                  : "rounded-md border border-border px-3 py-1.5 hover:bg-muted"
              }
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        「さん」「様」「ちゃん」などの敬称、カタカナとひらがな、全角と半角、空白の違いは、書いた時点で自動で同じ人になっています。ここに出るのはそれ以外の違いです。
      </p>

      <CustomerMergeList organizationId={orgId} customers={views} pairs={pairs} />
    </div>
  );
}
