import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { BASE_PATH } from "@/lib/base-path";
import { PageHeader } from "@/components/common/page-header";
import { cn } from "@/lib/utils";
import { summarizeDailyReports, type ReportForSummary } from "@/lib/business/daily-report";
import { rootCustomerId } from "@/lib/daily-report/server";
import { currentMonthJst, loadDailyReportContext, monthRange } from "./context";
import { DuplicateList, type DuplicateView } from "./duplicate-list";

export const metadata: Metadata = { title: "日報" };

const TABS = [
  { key: "cast", label: "キャスト別" },
  { key: "item", label: "商品別" },
  { key: "customer", label: "お客様別" },
  { key: "day", label: "日別" },
  { key: "list", label: "日報一覧" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const yen = (n: number) => "¥" + n.toLocaleString("ja-JP");
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export default async function DailyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ storeId?: string; month?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const { orgId, stores, store } = await loadDailyReportContext(params.storeId);

  if (!store) {
    return (
      <div className="space-y-6">
        <PageHeader title="日報" />
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          日報を使っている店舗がありません。店舗の設定で「退勤のときに日報を書いてもらう」をオンにすると、ここに集計が出ます。
        </div>
      </div>
    );
  }

  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : currentMonthJst();
  const tab: TabKey = (TABS.find((t) => t.key === params.tab)?.key ?? "cast") as TabKey;
  const { from, to } = monthRange(month);

  const reports = await db.dailyReport.findMany({
    where: { organizationId: orgId, storeId: store.id, businessDate: { gte: from, lte: to } },
    include: {
      staff: { select: { displayName: true } },
      sales: {
        orderBy: { sortOrder: "asc" },
        include: {
          customer: {
            select: { id: true, name: true, mergedIntoId: true, mergedInto: { select: { name: true } } },
          },
        },
      },
      backItems: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ businessDate: "desc" }, { submittedAt: "desc" }],
  });

  const forSummary: ReportForSummary[] = reports.map((r) => ({
    id: r.id,
    staffId: r.staffId,
    staffName: r.staff.displayName,
    businessDate: r.businessDate,
    noSales: r.noSales,
    submittedAt: r.submittedAt,
    sales: r.sales.map((s) => ({
      id: s.id,
      customerRootId: rootCustomerId(s.customer),
      customerRootName: s.customer.mergedInto?.name ?? s.customer.name,
      amount: s.amount,
      decision: s.duplicateDecision,
    })),
    backItems: r.backItems,
  }));
  const sum = summarizeDailyReports(forSummary);

  // 日報なしの退勤: 日報を使い始めてから（その店の最初の日報以降）に退勤したのに日報が無い勤怠
  const firstReport = await db.dailyReport.findFirst({
    where: { storeId: store.id },
    orderBy: { submittedAt: "asc" },
    select: { submittedAt: true },
  });
  const missing = firstReport
    ? await db.attendance.findMany({
        where: {
          organizationId: orgId,
          storeId: store.id,
          businessDate: { gte: from, lte: to },
          clockOutAt: { gte: firstReport.submittedAt },
          dailyReport: null,
        },
        select: {
          id: true,
          businessDate: true,
          staff: { select: { displayName: true } },
        },
        orderBy: { businessDate: "desc" },
      })
    : [];

  const reportById = new Map(reports.map((r) => [r.id, r]));
  const duplicateViews: DuplicateView[] = sum.duplicates.map((d) => {
    const first = reports
      .flatMap((r) => r.sales)
      .find((s) => rootCustomerId(s.customer) === d.customerRootId)!;
    return {
      businessDate: d.businessDate,
      customerRootId: d.customerRootId,
      customerName: first.customer.mergedInto?.name ?? first.customer.name,
      resolved: d.resolved,
      countedTotal: d.countedTotal,
      provisionalReportId: d.provisionalReportId,
      rows: d.rows.map((row) => {
        const rep = reportById.get(row.reportId)!;
        const sale = rep.sales.find((s) => s.id === row.id)!;
        return {
          saleId: row.id,
          reportId: row.reportId,
          staffName: rep.staff.displayName,
          writtenName: sale.customerName,
          amount: row.amount,
          decision: row.decision,
        };
      }),
    };
  });

  const qs = (o: Record<string, string>) =>
    "/daily-reports?" + new URLSearchParams({ storeId: store.id, month, tab, ...o }).toString();
  const prevMonth = (() => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  })();
  const nextMonth = (() => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  })();

  const th = "px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap";
  const td = "px-3 py-2.5 align-top";
  const num = "tabular-nums text-right whitespace-nowrap";
  const maxCast = Math.max(1, ...sum.byCast.map((c) => c.writtenSales));

  return (
    <div className="space-y-6">
      <PageHeader
        title="日報"
        description="退勤のときにキャストが書いた売上とバック発生商品の集計"
        actions={
          <Link
            href={`/daily-reports/customers?storeId=${store.id}`}
            className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
          >
            お客様の名前をまとめる
          </Link>
        }
      />

      {/* 店舗と月 */}
      <form
        method="GET"
        action={`${BASE_PATH}/daily-reports`}
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <input type="hidden" name="tab" value={tab} />
        <div className="flex flex-col gap-1">
          <label htmlFor="dr-store" className="text-xs text-muted-foreground">店舗</label>
          <select
            id="dr-store"
            name="storeId"
            defaultValue={store.id}
            className="min-h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.requireDailyReport ? "" : "（日報オフ）"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dr-month" className="text-xs text-muted-foreground">月</label>
          <input
            id="dr-month"
            type="month"
            name="month"
            defaultValue={month}
            className="min-h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <button type="submit" className="min-h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          表示
        </button>
        <div className="ml-auto flex gap-2 text-sm">
          <Link href={qs({ month: prevMonth })} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">前の月</Link>
          <Link href={qs({ month: nextMonth })} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted">次の月</Link>
        </div>
      </form>

      {/* 要約 */}
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:grid-cols-4">
        <div className="border-b border-r border-border p-4 lg:border-b-0">
          <p className="text-xs text-muted-foreground">店の売上</p>
          <p className="text-2xl font-bold tabular-nums">{yen(sum.storeSales)}</p>
          <p className="text-xs text-muted-foreground">
            {sum.writtenSales !== sum.storeSales
              ? `日報の合計 ${yen(sum.writtenSales)} から重複を除いた額`
              : `お客様 ${sum.customerCount}人`}
          </p>
        </div>
        <div className="border-b border-border p-4 lg:border-b-0 lg:border-r">
          <p className="text-xs text-muted-foreground">バック対象合計</p>
          <p className="text-2xl font-bold tabular-nums">{yen(sum.backTotal)}</p>
          <p className="text-xs text-muted-foreground">商品 {sum.backQuantity}点</p>
        </div>
        <div className="border-r border-border p-4">
          <p className="text-xs text-muted-foreground">日報</p>
          <p className="text-2xl font-bold tabular-nums">{sum.reportCount}件</p>
          <p className="text-xs text-muted-foreground">うち売上なし {sum.noSalesCount}件</p>
        </div>
        <div className="p-4">
          <p className="text-xs text-muted-foreground">確かめること</p>
          <p className={cn("text-2xl font-bold tabular-nums", (sum.unresolvedDuplicateCount > 0 || missing.length > 0) && "text-amber-600")}>
            {sum.unresolvedDuplicateCount + missing.length}件
          </p>
          <p className="text-xs text-muted-foreground">
            重複の疑い {sum.unresolvedDuplicateCount}件 / 日報なしの退勤 {missing.length}件
          </p>
        </div>
      </div>

      {/* 重複の疑い */}
      {duplicateViews.length > 0 && (
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">同じお客様の売上を2人が書いている日</h2>
            <p className="text-xs text-muted-foreground">
              売上はどちらか1人が書く決まりです。決めるまでは、金額が大きい方の日報だけを店の売上に数えています。
            </p>
          </div>
          <DuplicateList organizationId={orgId} storeId={store.id} groups={duplicateViews} />
        </section>
      )}

      {/* 集計 */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-3" aria-label="集計の切り替え">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={qs({ tab: t.key })}
              aria-current={tab === t.key ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm",
                tab === t.key
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="overflow-x-auto p-2">
          {reports.length === 0 && missing.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">この月の日報はまだありません</p>
          ) : tab === "cast" ? (
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-border">
                <th className={th}>キャスト</th><th className={cn(th, "text-right")}>日報</th><th className={cn(th, "text-right")}>お客様</th>
                <th className={th}>売上（書いた額）</th><th className={cn(th, "text-right")}>うち店の売上に数えた額</th><th className={cn(th, "text-right")}>バック対象</th>
              </tr></thead>
              <tbody>
                {sum.byCast.map((c) => (
                  <tr key={c.staffId} className="border-b border-border">
                    <td className={td}>{c.staffName}</td>
                    <td className={cn(td, num)}>{c.reportCount}件</td>
                    <td className={cn(td, num)}>{c.customerCount}人</td>
                    <td className={cn(td, "min-w-40")}>
                      <span className="tabular-nums">{yen(c.writtenSales)}</span>
                      <div className="mt-1 h-1.5 overflow-hidden rounded bg-primary/10">
                        <div className="h-full bg-primary" style={{ width: `${(c.writtenSales / maxCast) * 100}%` }} />
                      </div>
                    </td>
                    <td className={cn(td, num)}>{yen(c.countedSales)}</td>
                    <td className={cn(td, num)}>{yen(c.backTotal)}</td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold">
                  <td className={td}>合計</td><td className={cn(td, num)}>{sum.reportCount}件</td><td className={td} />
                  <td className={cn(td, "tabular-nums")}>{yen(sum.writtenSales)}</td>
                  <td className={cn(td, num)}>{yen(sum.storeSales)}</td><td className={cn(td, num)}>{yen(sum.backTotal)}</td>
                </tr>
              </tbody>
            </table>
          ) : tab === "item" ? (
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-border">
                <th className={th}>商品名</th><th className={cn(th, "text-right")}>個数</th><th className={cn(th, "text-right")}>金額</th>
                <th className={cn(th, "text-right")}>構成比</th><th className={th}>出したキャスト</th>
              </tr></thead>
              <tbody>
                {sum.byItem.map((i) => (
                  <tr key={i.productName} className="border-b border-border">
                    <td className={td}>{i.productName}</td>
                    <td className={cn(td, num)}>{i.quantity}</td>
                    <td className={cn(td, num)}>{yen(i.amount)}</td>
                    <td className={cn(td, num)}>{sum.backTotal ? ((i.amount / sum.backTotal) * 100).toFixed(1) : "0.0"}%</td>
                    <td className={cn(td, "text-xs text-muted-foreground")}>{i.staffNames.join("、")}</td>
                  </tr>
                ))}
                <tr className="bg-muted/40 font-semibold">
                  <td className={td}>合計</td><td className={cn(td, num)}>{sum.backQuantity}</td><td className={cn(td, num)}>{yen(sum.backTotal)}</td><td className={td} /><td className={td} />
                </tr>
              </tbody>
            </table>
          ) : tab === "customer" ? (
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-border">
                <th className={th}>お客様</th><th className={cn(th, "text-right")}>売上</th><th className={cn(th, "text-right")}>来店日数</th><th className={th}>ついたキャスト</th>
              </tr></thead>
              <tbody>
                {sum.byCustomer.map((c) => (
                  <tr key={c.customerRootId} className="border-b border-border">
                    <td className={td}>{c.name}</td>
                    <td className={cn(td, num)}>{yen(c.amount)}</td>
                    <td className={cn(td, num)}>{c.visitDays}日</td>
                    <td className={cn(td, "text-xs text-muted-foreground")}>{c.staffNames.join("、")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === "day" ? (
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="border-b border-border">
                <th className={th}>日付</th><th className={cn(th, "text-right")}>日報</th><th className={cn(th, "text-right")}>店の売上</th>
                <th className={cn(th, "text-right")}>バック対象</th><th className={th}>出勤したキャスト</th>
              </tr></thead>
              <tbody>
                {sum.byDay.map((d) => (
                  <tr key={d.businessDate} className="border-b border-border">
                    <td className={cn(td, "tabular-nums")}>{md(d.businessDate)}</td>
                    <td className={cn(td, num)}>{d.reportCount}件</td>
                    <td className={cn(td, num)}>{yen(d.sales)}</td>
                    <td className={cn(td, num)}>{yen(d.backTotal)}</td>
                    <td className={cn(td, "text-xs text-muted-foreground")}>{d.staffNames.join("、")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="border-b border-border">
                <th className={th}>日付</th><th className={th}>キャスト</th><th className={th}>売上</th><th className={th}>バック発生商品</th>
                <th className={cn(th, "text-right")}>売上計</th><th className={cn(th, "text-right")}>バック対象計</th>
              </tr></thead>
              <tbody>
                {missing.map((m) => (
                  <tr key={m.id} className="border-b border-border">
                    <td className={cn(td, "tabular-nums")}>{md(m.businessDate)}</td>
                    <td className={td}>{m.staff.displayName}</td>
                    <td className={td} colSpan={4}>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">日報なし</span>{" "}
                      <span className="text-xs text-muted-foreground">管理画面で打刻を入れた・直した勤怠などで、日報が書かれていません</span>
                    </td>
                  </tr>
                ))}
                {reports.map((r) => (
                  <tr key={r.id} className="border-b border-border">
                    <td className={cn(td, "tabular-nums")}>{md(r.businessDate)}</td>
                    <td className={td}>{r.staff.displayName}</td>
                    <td className={cn(td, "text-xs leading-relaxed")}>
                      {r.noSales ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">売上なし</span>
                      ) : (
                        r.sales.map((s) => (
                          <div key={s.id}>
                            <span className="font-medium">{s.customerName}</span>{" "}
                            <span className="tabular-nums text-muted-foreground">{yen(s.amount)}</span>
                            {s.duplicateDecision === "EXCLUDED" && (
                              <span className="ml-1 text-amber-700">（重複のため数えない）</span>
                            )}
                          </div>
                        ))
                      )}
                    </td>
                    <td className={cn(td, "text-xs leading-relaxed text-muted-foreground")}>
                      {r.backItems.map((b) => (
                        <div key={b.id}>{b.productName} {yen(b.unitPrice)}×{b.quantity}</div>
                      ))}
                    </td>
                    <td className={cn(td, num)}>{yen(r.sales.reduce((a, s) => a + s.amount, 0))}</td>
                    <td className={cn(td, num)}>{yen(r.backItems.reduce((a, b) => a + b.unitPrice * b.quantity, 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {tab === "cast" && (
          <p className="px-4 pb-4 text-xs text-muted-foreground">
            バック対象は、日報に入った「単価×個数」の合計です。バック率をかけた支払額ではありません。
          </p>
        )}
        {tab === "customer" && (
          <p className="px-4 pb-4 text-xs text-muted-foreground">
            名前はキャストの記入どおりです。同じ人が別の名前で入っていたら「お客様の名前をまとめる」でまとめてください。
          </p>
        )}
      </section>
    </div>
  );
}
