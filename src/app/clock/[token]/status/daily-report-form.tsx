"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clockAction } from "@/actions/attendance";
import { checkSameDayCustomers, type SameDayCustomerHit } from "@/actions/daily-report";
import {
  dailyReportInputSchema,
  type DailyReportProduct,
} from "@/lib/validations/daily-report";

export interface DailyReportConfig {
  products: DailyReportProduct[];
  /** この店のお客様（入力候補） */
  customerNames: string[];
  /** 見出しに出す「11月22日 19:02〜」 */
  headline: string;
  /** 書きかけを残す sessionStorage のキー（PINのセッション切れ・再読み込みで消えないように） */
  draftKey: string;
}

interface SaleRow {
  customerName: string;
  amount: string;
}
interface BackRow {
  productName: string;
  unitPrice: string;
  quantity: number;
}
interface Draft {
  sales: SaleRow[];
  backs: BackRow[];
  noSales: boolean;
  memo: string;
}

const emptyDraft = (): Draft => ({
  sales: [{ customerName: "", amount: "" }],
  backs: [],
  noSales: false,
  memo: "",
});

const yen = (n: number) => "¥" + n.toLocaleString("ja-JP");
const digits = (s: string) => s.normalize("NFKC").replace(/[^\d]/g, "").slice(0, 8);
const isBlankSale = (r: SaleRow) => !r.customerName.trim() && !r.amount;
const isBlankBack = (r: BackRow) => !r.productName.trim() && !r.unitPrice;

function loadDraft(key: string): Draft | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function saveDraft(key: string, d: Draft) {
  try {
    sessionStorage.setItem(key, JSON.stringify(d));
  } catch {
    /* 保存できなくても入力は続けられる */
  }
}
function clearDraft(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

export function DailyReportForm({
  token,
  staffId,
  staffName,
  config,
  onBreak,
  onClose,
}: {
  token: string;
  staffId: string;
  staffName: string;
  config: DailyReportConfig;
  onBreak: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // 書きかけを戻す（PINを入れ直して戻ってきたとき・再読み込みしたとき）。
  // この画面は退勤ボタンを押してから開くので、初回描画からブラウザで読める
  const [draft, setDraft] = useState<Draft>(() => loadDraft(config.draftKey) ?? emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [hits, setHits] = useState<SameDayCustomerHit[]>([]);
  const lastFocus = useRef<string | null>(null);

  useEffect(() => {
    saveDraft(config.draftKey, draft);
  }, [draft, config.draftKey]);

  useEffect(() => {
    if (lastFocus.current) {
      document.getElementById(lastFocus.current)?.focus();
      lastFocus.current = null;
    }
  });

  const update = (fn: (d: Draft) => Draft) => {
    setError(null);
    setDraft((d) => fn(structuredClone(d)));
  };

  const salesTotal = draft.noSales
    ? 0
    : draft.sales.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const backTotal = draft.noSales
    ? 0
    : draft.backs.reduce((a, r) => a + (Number(r.unitPrice) || 0) * r.quantity, 0);

  const runSameDayCheck = (sales: SaleRow[]) => {
    const names = sales.map((r) => r.customerName.trim()).filter(Boolean);
    if (names.length === 0) {
      setHits([]);
      return;
    }
    checkSameDayCustomers({ token, staffId, names })
      .then((r) => setHits(r.hits))
      .catch(() => setHits([]));
  };

  const addPreset = (p: DailyReportProduct) =>
    update((d) => {
      const ex = d.backs.find((b) => b.productName === p.name);
      if (ex) ex.quantity = Math.min(999, ex.quantity + 1);
      else {
        d.backs = d.backs.filter((b) => !isBlankBack(b));
        d.backs.push({ productName: p.name, unitPrice: String(p.price), quantity: 1 });
      }
      return d;
    });

  const submit = () => {
    if (!draft.noSales) {
      if (draft.sales.some((r) => !isBlankSale(r) && !r.amount)) {
        setError("金額が空の売上があります");
        return;
      }
      if (draft.backs.some((r) => !isBlankBack(r) && !r.unitPrice)) {
        setError("単価が空の行があります");
        return;
      }
    }
    const input = draft.noSales
      ? { noSales: true, sales: [], backItems: [] }
      : {
          noSales: false,
          sales: draft.sales
            .filter((r) => !isBlankSale(r))
            .map((r) => ({
              customerName: r.customerName.trim(),
              amount: Number(r.amount),
            })),
          backItems: draft.backs
            .filter((r) => !isBlankBack(r))
            .map((r) => ({
              productName: r.productName.trim(),
              unitPrice: Number(r.unitPrice),
              quantity: r.quantity,
            })),
        };
    const parsed = dailyReportInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "日報の内容を確かめてください");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await clockAction({
        token,
        staffId,
        action: "CLOCK_OUT",
        memo: draft.memo.trim() || undefined,
        dailyReport: parsed.data,
      });
      if (result.error) {
        // PINのセッション（5分）が切れた。書いた内容は sessionStorage に残っているので、PINを入れ直せば戻る
        if (result.error.includes("PIN")) {
          router.push(`/clock/${token}/pin?staffId=${staffId}`);
          return;
        }
        setError(result.error);
        return;
      }
      clearDraft(config.draftKey);
      const clockedAt = result.clockedAt
        ? new Date(result.clockedAt).toISOString()
        : new Date().toISOString();
      const q = new URLSearchParams({
        action: "CLOCK_OUT",
        staffName,
        clockedAt,
        reportSales: String(parsed.data.noSales ? 0 : salesTotal),
        reportBack: String(parsed.data.noSales ? 0 : backTotal),
        reportNoSales: parsed.data.noSales ? "1" : "0",
      });
      router.push(`/clock/${token}/complete?${q.toString()}`);
    });
  };

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";
  const disabledSec = draft.noSales ? "opacity-40 pointer-events-none" : "";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-report-title"
    >
      {/* 見出し */}
      <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xl text-gray-500 hover:bg-gray-100"
          aria-label="打刻画面に戻る"
        >
          ←
        </button>
        <div>
          <h2 id="daily-report-title" className="text-base font-bold text-gray-900">
            今日の日報
          </h2>
          <p className="text-xs text-gray-500">
            {config.headline} / {staffName}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-4">
          {onBreak && (
            <p className="rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
              休憩中です。送ると休憩を終えて退勤します
            </p>
          )}

          {/* 売上 */}
          <section className={disabledSec} aria-labelledby="sales-h">
            <div className="flex items-baseline justify-between">
              <h3 id="sales-h" className="font-bold text-gray-900">売上</h3>
              <span className="tabular-nums font-bold text-gray-900">{yen(salesTotal)}</span>
            </div>
            <p className="mb-2 text-xs text-gray-500">
              お客様ごとに1行。同じお客様の売上は、ついたキャストのうち1人だけが書きます
            </p>
            <div className="flex flex-col gap-2">
              {draft.sales.map((r, i) => {
                const rowHits = hits.filter((h) => h.customerName === r.customerName.trim());
                return (
                  <div key={i} className="relative rounded-xl border border-gray-200 p-3">
                    <button
                      type="button"
                      onClick={() => {
                        const next = draft.sales.filter((_, j) => j !== i);
                        update((d) => ({ ...d, sales: next }));
                        runSameDayCheck(next);
                      }}
                      className="absolute right-2 top-2 px-1 text-xs text-gray-400 hover:text-red-600"
                      aria-label={`${i + 1}行目の売上を消す`}
                    >
                      ✕ 削除
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor={`sale-name-${i}`} className="text-[11px] text-gray-500">
                          お客様名
                        </label>
                        <input
                          id={`sale-name-${i}`}
                          className={inputCls}
                          list="daily-report-customers"
                          value={r.customerName}
                          maxLength={50}
                          placeholder="例: たけしさん"
                          onChange={(e) =>
                            update((d) => {
                              d.sales[i].customerName = e.target.value;
                              return d;
                            })
                          }
                          onBlur={() => runSameDayCheck(draft.sales)}
                        />
                      </div>
                      <div>
                        <label htmlFor={`sale-amount-${i}`} className="text-[11px] text-gray-500">
                          金額（円）
                        </label>
                        <input
                          id={`sale-amount-${i}`}
                          className={`${inputCls} text-right tabular-nums`}
                          inputMode="numeric"
                          value={r.amount ? Number(r.amount).toLocaleString("ja-JP") : ""}
                          placeholder="0"
                          onChange={(e) =>
                            update((d) => {
                              d.sales[i].amount = digits(e.target.value);
                              return d;
                            })
                          }
                        />
                      </div>
                    </div>
                    {rowHits.length > 0 && (
                      <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
                        {rowHits
                          .map((h) => `${h.writtenBy}さんが「${h.writtenName} ${yen(h.amount)}」を書いています`)
                          .join("。")}
                        。同じ会計なら、この行は消してください
                      </p>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  lastFocus.current = `sale-name-${draft.sales.length}`;
                  update((d) => ({ ...d, sales: [...d.sales, { customerName: "", amount: "" }] }));
                }}
                className="w-full rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 py-2.5 text-sm font-bold text-blue-600"
              >
                ＋ 売上を追加
              </button>
            </div>
            <datalist id="daily-report-customers">
              {config.customerNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </section>

          {/* バック発生商品 */}
          <section className={disabledSec} aria-labelledby="back-h">
            <div className="flex items-baseline justify-between">
              <h3 id="back-h" className="font-bold text-gray-900">バック発生商品</h3>
              <span className="tabular-nums font-bold text-gray-900">{yen(backTotal)}</span>
            </div>
            {config.products.length > 0 && (
              <>
                <p className="mb-2 text-xs text-gray-500">押すと1個ずつ増えます</p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {config.products.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => addPreset(p)}
                      className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-800 hover:bg-gray-50"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="flex flex-col gap-2">
              {draft.backs.map((r, i) => (
                <div key={i} className="relative rounded-xl border border-gray-200 p-3">
                  <button
                    type="button"
                    onClick={() => update((d) => ({ ...d, backs: d.backs.filter((_, j) => j !== i) }))}
                    className="absolute right-2 top-2 px-1 text-xs text-gray-400 hover:text-red-600"
                    aria-label={`${i + 1}行目の商品を消す`}
                  >
                    ✕ 削除
                  </button>
                  <label htmlFor={`back-name-${i}`} className="text-[11px] text-gray-500">
                    商品名
                  </label>
                  <input
                    id={`back-name-${i}`}
                    className={`${inputCls} w-[calc(100%-4rem)]`}
                    list="daily-report-products"
                    value={r.productName}
                    maxLength={50}
                    placeholder="例: キャストドリンク"
                    onChange={(e) =>
                      update((d) => {
                        d.backs[i].productName = e.target.value;
                        const p = config.products.find((x) => x.name === e.target.value);
                        if (p && !d.backs[i].unitPrice) d.backs[i].unitPrice = String(p.price);
                        return d;
                      })
                    }
                  />
                  <div className="mt-2 grid grid-cols-[1.3fr_1fr] items-end gap-2">
                    <div>
                      <label htmlFor={`back-price-${i}`} className="text-[11px] text-gray-500">
                        単価（円）
                      </label>
                      <input
                        id={`back-price-${i}`}
                        className={`${inputCls} text-right tabular-nums`}
                        inputMode="numeric"
                        value={r.unitPrice ? Number(r.unitPrice).toLocaleString("ja-JP") : r.unitPrice}
                        placeholder="0"
                        onChange={(e) =>
                          update((d) => {
                            d.backs[i].unitPrice = digits(e.target.value);
                            return d;
                          })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor={`back-qty-${i}`} className="text-[11px] text-gray-500">
                        個数
                      </label>
                      <div className="flex overflow-hidden rounded-lg border border-gray-300">
                        <button
                          type="button"
                          className="w-10 bg-gray-100 text-lg"
                          aria-label="1つ減らす"
                          onClick={() =>
                            update((d) => {
                              d.backs[i].quantity = Math.max(1, d.backs[i].quantity - 1);
                              return d;
                            })
                          }
                        >
                          −
                        </button>
                        <input
                          id={`back-qty-${i}`}
                          className="w-full min-w-0 py-2.5 text-center text-base tabular-nums focus:outline-none"
                          inputMode="numeric"
                          value={r.quantity}
                          onChange={(e) =>
                            update((d) => {
                              d.backs[i].quantity = Math.min(999, Math.max(1, Number(digits(e.target.value)) || 1));
                              return d;
                            })
                          }
                        />
                        <button
                          type="button"
                          className="w-10 bg-gray-100 text-lg"
                          aria-label="1つ増やす"
                          onClick={() =>
                            update((d) => {
                              d.backs[i].quantity = Math.min(999, d.backs[i].quantity + 1);
                              return d;
                            })
                          }
                        >
                          ＋
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 text-right text-xs text-gray-500">
                    小計{" "}
                    <b className="tabular-nums text-gray-900">
                      {yen((Number(r.unitPrice) || 0) * r.quantity)}
                    </b>
                  </p>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  lastFocus.current = `back-name-${draft.backs.length}`;
                  update((d) => ({
                    ...d,
                    backs: [...d.backs, { productName: "", unitPrice: "", quantity: 1 }],
                  }));
                }}
                className="w-full rounded-xl border-2 border-dashed border-blue-200 bg-blue-50 py-2.5 text-sm font-bold text-blue-600"
              >
                ＋ 商品を追加
              </button>
            </div>
            <datalist id="daily-report-products">
              {config.products.map((p) => (
                <option key={p.name} value={p.name} />
              ))}
            </datalist>
          </section>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              className="size-4"
              checked={draft.noSales}
              onChange={(e) => update((d) => ({ ...d, noSales: e.target.checked }))}
            />
            今日は売上なし
          </label>

          <section>
            <label htmlFor="daily-report-memo" className="font-bold text-gray-900">
              申し送り（任意）
            </label>
            <textarea
              id="daily-report-memo"
              rows={2}
              maxLength={500}
              value={draft.memo}
              placeholder="例: シャンパンの在庫あと1本"
              onChange={(e) => update((d) => ({ ...d, memo: e.target.value }))}
              className="mt-1 w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </section>
        </div>
      </div>

      {/* 合計と送信 */}
      <div className="border-t border-gray-200 bg-white px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-md flex-col gap-2">
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            <div>
              売上合計
              <strong className="block text-lg tabular-nums text-gray-900">{yen(salesTotal)}</strong>
            </div>
            <div>
              バック対象合計
              <strong className="block text-lg tabular-nums text-gray-900">{yen(backTotal)}</strong>
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert" aria-live="assertive">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="w-full rounded-2xl bg-blue-500 py-4 text-lg font-bold text-white shadow-md transition-all active:scale-95 disabled:opacity-60"
          >
            {isPending ? "送信中…" : "日報を送って退勤する"}
          </button>
        </div>
      </div>
    </div>
  );
}
