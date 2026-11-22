"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideSaleDuplicate } from "@/actions/daily-report";
import { cn } from "@/lib/utils";

export interface DuplicateView {
  businessDate: string;
  customerRootId: string;
  customerName: string;
  resolved: boolean;
  countedTotal: number;
  provisionalReportId: string | null;
  rows: {
    saleId: string;
    reportId: string;
    staffName: string;
    writtenName: string;
    amount: number;
    decision: "ADOPTED" | "EXCLUDED" | "SEPARATE" | null;
  }[];
}

const yen = (n: number) => "¥" + n.toLocaleString("ja-JP");
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export function DuplicateList({
  organizationId,
  storeId,
  groups,
}: {
  organizationId: string;
  storeId: string;
  groups: DuplicateView[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const decide = (
    g: DuplicateView,
    choice: { adoptReportId: string } | "SEPARATE" | "RESET"
  ) => {
    setError(null);
    startTransition(async () => {
      const r = await decideSaleDuplicate(organizationId, {
        storeId,
        businessDate: g.businessDate,
        customerRootId: g.customerRootId,
        choice,
      });
      if (r.error) setError(r.error);
      else router.refresh();
    });
  };

  // 1つの日報に同じお客様が2行あることもあるので、日報ごとにまとめて出す
  const byReport = (g: DuplicateView) => {
    const m = new Map<string, { staffName: string; names: string[]; amount: number; decision: DuplicateView["rows"][number]["decision"] }>();
    for (const r of g.rows) {
      const cur = m.get(r.reportId);
      if (cur) {
        cur.names.push(r.writtenName);
        cur.amount += r.amount;
      } else {
        m.set(r.reportId, { staffName: r.staffName, names: [r.writtenName], amount: r.amount, decision: r.decision });
      }
    }
    return [...m.entries()];
  };

  return (
    <div className="divide-y divide-border">
      {error && (
        <p className="px-4 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {groups.map((g) => {
        const separate = g.rows.every((r) => r.decision === "SEPARATE");
        return (
          <div key={`${g.businessDate}-${g.customerRootId}`} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tabular-nums text-sm text-muted-foreground">{md(g.businessDate)}</span>
              <span className="font-medium">{g.customerName}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  g.resolved ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                )}
              >
                {g.resolved ? (separate ? "別の会計として両方数える" : "決定済み") : "未確認"}
              </span>
              <span className="ml-auto text-sm">
                店の売上に数える額 <b className="tabular-nums">{yen(g.countedTotal)}</b>
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {byReport(g).map(([reportId, r]) => {
                const counted = g.resolved
                  ? r.decision !== "EXCLUDED"
                  : reportId === g.provisionalReportId;
                return (
                  <div
                    key={reportId}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="min-w-24 font-medium">{r.staffName}</span>
                    <span className="text-muted-foreground">「{r.names.join("」「")}」</span>
                    <span className="tabular-nums">{yen(r.amount)}</span>
                    <span className={cn("text-xs", counted ? "text-green-700" : "text-muted-foreground")}>
                      {counted ? (g.resolved ? "数える" : "仮に数えている") : "数えない"}
                    </span>
                    <button
                      type="button"
                      disabled={isPending || (g.resolved && r.decision === "ADOPTED")}
                      onClick={() => decide(g, { adoptReportId: reportId })}
                      className="ml-auto rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-40"
                    >
                      こちらを採用
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isPending || separate}
                onClick={() => decide(g, "SEPARATE")}
                className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-40"
              >
                別の会計なので両方数える
              </button>
              {g.resolved && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => decide(g, "RESET")}
                  className="rounded-md px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  決めたのを取り消す
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
