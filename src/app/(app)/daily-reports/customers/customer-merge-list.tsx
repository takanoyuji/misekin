"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mergeCustomers, unmergeCustomer } from "@/actions/daily-report";

export interface CustomerView {
  id: string;
  name: string;
  aliases: { id: string; name: string; count: number }[];
  saleCount: number;
  amount: number;
  lastDate: string | null;
}

type Pair = {
  a: { id: string; name: string };
  b: { id: string; name: string };
  reason: "BRACKET" | "CONTAINS" | "ONE_CHAR";
};

const REASON: Record<Pair["reason"], string> = {
  BRACKET: "括弧の中だけ違う",
  CONTAINS: "片方がもう片方を含む",
  ONE_CHAR: "1文字だけ違う",
};

const yen = (n: number) => "¥" + n.toLocaleString("ja-JP");
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export function CustomerMergeList({
  organizationId,
  customers,
  pairs,
}: {
  organizationId: string;
  customers: CustomerView[];
  pairs: Pair[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [target, setTarget] = useState<Record<string, string>>({});

  const run = (fn: () => Promise<{ error?: string }>, ok: string) => {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setMessage({ type: "error", text: r.error });
      else {
        setMessage({ type: "ok", text: ok });
        router.refresh();
      }
    });
  };
  const merge = (sourceId: string, targetId: string, label: string) =>
    run(() => mergeCustomers(organizationId, { sourceId, targetId }), `「${label}」にまとめました`);

  return (
    <div className="space-y-6">
      {message && (
        <p
          className={message.type === "ok" ? "text-sm text-green-600" : "text-sm text-destructive"}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}

      {pairs.length > 0 && (
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">同じ人かもしれない名前</h2>
            <p className="text-xs text-muted-foreground">同じ人なら、残す名前の方のボタンを押してください。別の人なら何もしなくてかまいません。</p>
          </div>
          <ul className="divide-y divide-border">
            {pairs.map((p) => (
              <li key={`${p.a.id}-${p.b.id}`} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <span className="font-medium">{p.a.name}</span>
                <span className="text-muted-foreground">と</span>
                <span className="font-medium">{p.b.name}</span>
                <span className="text-xs text-muted-foreground">（{REASON[p.reason]}）</span>
                <span className="ml-auto flex gap-2">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => merge(p.b.id, p.a.id, p.a.name)}
                    className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-40"
                  >
                    「{p.a.name}」にまとめる
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => merge(p.a.id, p.b.id, p.b.name)}
                    className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-40"
                  >
                    「{p.b.name}」にまとめる
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">お客様（{customers.length}人）</h2>
        </div>
        {customers.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">まだ日報にお客様が書かれていません</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">名前</th>
                  <th className="px-4 py-2 font-medium">まとめた名前</th>
                  <th className="px-4 py-2 text-right font-medium">売上</th>
                  <th className="px-4 py-2 text-right font-medium">最後に書かれた日</th>
                  <th className="px-4 py-2 font-medium">ほかのお客様にまとめる</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b border-border align-top">
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-1">
                        {c.aliases.map((a) => (
                          <span key={a.id} className="flex items-center gap-2 text-xs">
                            <span>{a.name}</span>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() =>
                                run(() => unmergeCustomer(organizationId, { customerId: a.id }), `「${a.name}」を分けました`)
                              }
                              className="text-muted-foreground underline-offset-2 hover:underline disabled:opacity-40"
                            >
                              分ける
                            </button>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {yen(c.amount)}
                      <span className="block text-xs text-muted-foreground">{c.saleCount}件</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.lastDate ? md(c.lastDate) : "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-2">
                        <select
                          aria-label={`${c.name}をまとめる先`}
                          value={target[c.id] ?? ""}
                          onChange={(e) => setTarget((t) => ({ ...t, [c.id]: e.target.value }))}
                          className="min-h-8 max-w-44 rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="">選ぶ</option>
                          {customers
                            .filter((o) => o.id !== c.id)
                            .map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          disabled={isPending || !target[c.id]}
                          onClick={() => {
                            const t = customers.find((o) => o.id === target[c.id]);
                            if (t) merge(c.id, t.id, t.name);
                          }}
                          className="rounded-md border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-40"
                        >
                          まとめる
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
