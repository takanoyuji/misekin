import { z } from "zod";

const yenInt = (label: string, max: number) =>
  z
    .number({ message: `${label}を数字で入れてください` })
    .int(`${label}は整数で入れてください`)
    .min(0, `${label}は0円以上にしてください`)
    .max(max, `${label}が大きすぎます`);

export const dailyReportSaleSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, "お客様名が空の売上があります")
    .max(50, "お客様名は50文字までです"),
  amount: yenInt("金額", 10_000_000).refine((v) => v > 0, "金額が0円の売上があります"),
  /** どこの店の分か（店舗設定で選ぶものがあるときだけ。checkReportLocations で確かめる） */
  location: z.string().trim().max(30).optional(),
});

export const dailyReportBackItemSchema = z.object({
  productName: z
    .string()
    .trim()
    .min(1, "商品名が空の行があります")
    .max(50, "商品名は50文字までです"),
  unitPrice: yenInt("単価", 1_000_000),
  quantity: z
    .number()
    .int()
    .min(1, "個数は1以上にしてください")
    .max(999, "個数は999までです"),
  /** どこの店の分か（店舗設定で選ぶものがあるときだけ。checkReportLocations で確かめる） */
  location: z.string().trim().max(30).optional(),
});

/** キャストが退勤のときに送る日報 */
export const dailyReportInputSchema = z
  .object({
    noSales: z.boolean(),
    sales: z.array(dailyReportSaleSchema).max(50, "売上は50行までです"),
    backItems: z.array(dailyReportBackItemSchema).max(50, "商品は50行までです"),
  })
  .superRefine((v, ctx) => {
    if (v.noSales && (v.sales.length > 0 || v.backItems.length > 0)) {
      ctx.addIssue({
        code: "custom",
        message: "「今日は売上なし」にしたときは、売上と商品を空にしてください",
      });
    }
    if (!v.noSales && v.sales.length === 0 && v.backItems.length === 0) {
      ctx.addIssue({
        code: "custom",
        message:
          "売上か商品を1つ以上入れてください。売上がなかった日は「今日は売上なし」にチェックしてください",
      });
    }
  });

export type DailyReportInput = z.infer<typeof dailyReportInputSchema>;

/** 店舗設定: 日報の「よく出る商品」 */
export const dailyReportProductSchema = z.object({
  name: z.string().trim().min(1, "商品名が空の行があります").max(50),
  price: yenInt("単価", 1_000_000),
});

/** 店舗設定: 日報の行ごとに選ぶ「どこの店の分か」。2つ以上あるときだけ選ばせる */
export const dailyReportLocationsSchema = z
  .array(z.string().trim().min(1, "店の名前が空の行があります").max(30, "店の名前は30文字までです"))
  .max(10, "店は10個までです")
  .refine((a) => new Set(a).size === a.length, "同じ名前の店が2つあります");

export const dailyReportSettingsSchema = z.object({
  requireDailyReport: z.boolean(),
  products: z.array(dailyReportProductSchema).max(30, "よく出る商品は30個までです"),
  locations: dailyReportLocationsSchema,
});

export type DailyReportProduct = z.infer<typeof dailyReportProductSchema>;

/** DBの JSON を安全に読む。壊れていたら空 */
export function parseDailyReportProducts(json: unknown): DailyReportProduct[] {
  const r = z.array(dailyReportProductSchema).safeParse(json);
  return r.success ? r.data : [];
}

/** DBの JSON を安全に読む。壊れていたら空 */
export function parseDailyReportLocations(json: unknown): string[] {
  const r = dailyReportLocationsSchema.safeParse(json);
  return r.success ? r.data : [];
}

/**
 * 行ごとの「どこの店の分か」を店舗設定と突き合わせる。問題なければ null。
 * - 店が2つ以上: どの行にも、設定にある店を選んでいること
 * - それ以外（0か1）: 選ばせない。1つだけならその店を入れ、0なら null にする（normalizeReportLocations）
 */
export function checkReportLocations(input: DailyReportInput, locations: string[]): string | null {
  if (locations.length < 2) return null;
  const ok = (l: string | undefined) => l !== undefined && locations.includes(l);
  if (input.sales.some((s) => !ok(s.location))) return "売上の行ごとに、どこの店の分かを選んでください";
  if (input.backItems.some((b) => !ok(b.location))) return "商品の行ごとに、どこの店の分かを選んでください";
  return null;
}

/** 保存する location を決める（checkReportLocations を通したあとに呼ぶ） */
export function normalizeReportLocation(location: string | undefined, locations: string[]): string | null {
  if (locations.length === 0) return null;
  if (locations.length === 1) return locations[0];
  return location ?? null;
}
