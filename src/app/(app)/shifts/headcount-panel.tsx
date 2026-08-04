import { TrendingUp, TriangleAlert } from "lucide-react";

import type { HeadcountGrid } from "@/lib/business/headcount-server";
import type { Weekday } from "@/lib/business/headcount";

const WD = ["月", "火", "水", "木", "金", "土", "日"] as const;

/**
 * 売上から出した必要人数の目安
 *
 * 数字を出すだけでなく、根拠（売上の中央値・何日ぶんか）が追えるようにする。
 * 実績が少ない枠は薄く出して、鵜呑みにさせない。
 */
export function HeadcountPanel({
  grid,
  storeName,
}: {
  grid: HeadcountGrid | null;
  storeName: string;
}) {
  if (!grid) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="size-4 text-primary" aria-hidden="true" />
          売上から見た必要人数
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {storeName}の売上がまだ取り込まれていません。売上を入れると、曜日と時間帯ごとに
          「何人立てばいいか」の目安が出ます。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="size-4 text-primary" aria-hidden="true" />
          売上から見た必要人数
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {grid.from}〜{grid.to} の{grid.totalDays}営業日から、曜日×時間帯ごとの
          売上の中央値をもとに算出しています。<strong>目安です。</strong>
          決めるのは店長で、シフトは自由に組めます。
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-center text-sm">
          <caption className="sr-only">
            曜日と時間帯ごとの必要人数の目安
          </caption>
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th
                scope="col"
                className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
              >
                曜日
              </th>
              {grid.hours.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-1 py-2 text-xs font-medium text-muted-foreground tabular-nums"
                >
                  {Number(h)}時
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {WD.map((label, i) => (
              <tr key={label}>
                <th
                  scope="row"
                  className="px-3 py-2 text-left text-xs font-semibold"
                >
                  {label}
                </th>
                {grid.hours.map((h) => {
                  const c = grid.cells[i as Weekday]?.[h];
                  if (!c) {
                    return (
                      <td key={h} className="px-1 py-2 text-xs text-muted-foreground">
                        −
                      </td>
                    );
                  }
                  const low = c.confidence === "low";
                  return (
                    <td key={h} className="px-1 py-2">
                      <span
                        title={`売上の中央値 ${c.medianSales.toLocaleString()}円 / ${c.sampleDays}日ぶん`}
                        className={`inline-flex size-7 items-center justify-center rounded-md text-xs font-bold tabular-nums ${
                          low
                            ? "text-muted-foreground"
                            : c.suggested >= grid.maxPerSlot
                              ? "bg-accent text-accent-foreground"
                              : "bg-muted"
                        }`}
                      >
                        {c.suggested}
                        {low && <span aria-hidden="true">?</span>}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <p className="flex items-start gap-1.5">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>?</strong> は根拠にした営業日が4日未満の枠です。まだ当てにしないでください。
            数字にカーソルを合わせると、根拠にした売上と日数が出ます。
          </span>
        </p>
        <p>
          この目安は「過去にその人数で回していた」という記録から出しています。
          人手が足りていなかった時間帯の値もそのまま含まれるので、
          きつかった時間帯は実感に合わせて増やしてください。
        </p>
      </div>
    </div>
  );
}
