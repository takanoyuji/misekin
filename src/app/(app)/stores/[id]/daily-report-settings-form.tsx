"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDailyReportSettings } from "@/actions/daily-report";
import { NotebookPen, Loader2, Trash2, Plus } from "lucide-react";

interface Props {
  organizationId: string;
  storeId: string;
  initialRequire: boolean;
  initialProducts: { name: string; price: number }[];
}

type Row = { name: string; price: string };

export function DailyReportSettingsForm({
  organizationId,
  storeId,
  initialRequire,
  initialProducts,
}: Props) {
  const router = useRouter();
  const [requireReport, setRequireReport] = useState(initialRequire);
  const [rows, setRows] = useState<Row[]>(
    initialProducts.map((p) => ({ name: p.name, price: String(p.price) }))
  );
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const products = rows
      .filter((r) => r.name.trim() || r.price)
      .map((r) => ({ name: r.name.trim(), price: Number(r.price || "NaN") }));
    if (products.some((p) => !Number.isFinite(p.price))) {
      setMessage({ type: "error", text: "単価が空の商品があります" });
      return;
    }
    startTransition(async () => {
      const result = await updateDailyReportSettings(organizationId, storeId, {
        requireDailyReport: requireReport,
        products,
      });
      if (result.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMessage({ type: "success", text: "日報の設定を保存しました" });
      router.refresh();
    });
  }

  const inputCls =
    "min-h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-base font-semibold">退勤の日報</h2>
      </div>

      <label className="flex items-start gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={requireReport}
          onChange={(e) => setRequireReport(e.target.checked)}
          className="mt-0.5 size-4 rounded border-input"
        />
        <span>
          退勤のときに日報を書いてもらう
          <span className="block text-xs font-normal text-muted-foreground">
            売上（お客様名と金額）とバック発生商品（商品名・単価・個数）を書かないと退勤できなくなります。売上がない日は「今日は売上なし」で退勤できます。
          </span>
        </span>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">よく出る商品</legend>
        <p className="text-xs text-muted-foreground">
          日報の画面にボタンで出ます。押すと単価が入ります（キャストがその場で直せます）。
        </p>
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              aria-label={`${i + 1}行目の商品名`}
              value={r.name}
              maxLength={50}
              placeholder="商品名"
              onChange={(e) => setRow(i, { name: e.target.value })}
              className={`${inputCls} min-w-0 flex-1`}
            />
            <div className="relative w-28">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                ¥
              </span>
              <input
                aria-label={`${i + 1}行目の単価`}
                inputMode="numeric"
                value={r.price}
                placeholder="0"
                onChange={(e) =>
                  setRow(i, { price: e.target.value.normalize("NFKC").replace(/[^\d]/g, "").slice(0, 7) })
                }
                className={`${inputCls} w-full pl-6 text-right tabular-nums`}
              />
            </div>
            <button
              type="button"
              onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
              aria-label={`${i + 1}行目の商品を消す`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, { name: "", price: "" }])}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          <Plus className="size-4" aria-hidden="true" />
          商品を追加
        </button>
      </fieldset>

      {message && (
        <p
          className={`text-sm ${message.type === "success" ? "text-green-600" : "text-destructive"}`}
          role={message.type === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        保存する
      </button>
    </form>
  );
}
