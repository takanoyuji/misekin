import "server-only";

import { db } from "@/lib/db";

import {
  DEFAULT_HEADCOUNT_POLICY,
  salesPerPersonAt,
  suggestHeadcount,
} from "./headcount";
import type { HeadcountSuggestion, Weekday } from "./headcount";

/**
 * 取り込んだ売上から、曜日 × 時間帯の必要人数を出す（画面用）
 *
 * 提案はあくまで目安。確定させるのは店長なので、
 * 根拠（売上の中央値・何日ぶんか）を必ず一緒に返す。
 */

export interface HeadcountCell {
  suggested: number;
  medianSales: number;
  sampleDays: number;
  confidence: HeadcountSuggestion["confidence"];
}

export interface HeadcountGrid {
  /** 実績のある時間帯だけを昇順で（営業していない時間は出さない） */
  hours: string[];
  /** weekday(0=月) → hourBucket → セル */
  cells: Record<Weekday, Record<string, HeadcountCell>>;
  /** 1人がさばける売上（時間帯ごと）。根拠として画面に出す */
  salesPerPerson: Record<string, number>;
  /** 集計に使った営業日の数 */
  totalDays: number;
  /** 売上の期間 */
  from: string | null;
  to: string | null;
  /** 店舗ごとの上限（Store.maxStaffPerSlot） */
  maxPerSlot: number;
}

/**
 * 直近の売上から提案を組み立てる。
 * 売上が1件も無ければ null を返す（画面側で案内を出す）。
 */
export async function getHeadcountGrid(
  storeId: string,
  options?: { months?: number }
): Promise<HeadcountGrid | null> {
  const store = await db.store.findUnique({
    where: { id: storeId },
    select: { maxStaffPerSlot: true },
  });

  // 直近Nヶ月に絞る（古い傾向を引きずらないため）
  const months = options?.months ?? 6;
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  const sinceStr = since.toISOString().slice(0, 10);

  const rows = await db.storeSalesDaily.findMany({
    where: { storeId, businessDate: { gte: sinceStr } },
    select: { businessDate: true, hourBucket: true, amount: true },
  });
  if (rows.length === 0) return null;

  const policy = {
    ...DEFAULT_HEADCOUNT_POLICY,
    maxPerSlot: store?.maxStaffPerSlot ?? DEFAULT_HEADCOUNT_POLICY.maxPerSlot,
  };

  const suggestions = suggestHeadcount(
    rows.map((r) => ({
      businessDate: r.businessDate,
      hourBucket: r.hourBucket,
      amount: r.amount,
    })),
    policy
  );

  const hours = [...new Set(suggestions.map((s) => s.hourBucket))].sort();
  const cells = {} as HeadcountGrid["cells"];
  for (let w = 0 as Weekday; w < 7; w = ((w + 1) as Weekday)) {
    cells[w] = {};
  }
  for (const s of suggestions) {
    cells[s.weekday][s.hourBucket] = {
      suggested: s.suggested,
      medianSales: s.medianSales,
      sampleDays: s.sampleDays,
      confidence: s.confidence,
    };
  }

  const dates = [...new Set(rows.map((r) => r.businessDate))].sort();

  return {
    hours,
    cells,
    salesPerPerson: Object.fromEntries(
      hours.map((h) => [h, salesPerPersonAt(policy, h)])
    ),
    totalDays: dates.length,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
    maxPerSlot: policy.maxPerSlot,
  };
}
