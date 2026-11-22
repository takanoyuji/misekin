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

export const dailyReportSettingsSchema = z.object({
  requireDailyReport: z.boolean(),
  products: z.array(dailyReportProductSchema).max(30, "よく出る商品は30個までです"),
});

export type DailyReportProduct = z.infer<typeof dailyReportProductSchema>;

/** DBの JSON を安全に読む。壊れていたら空 */
export function parseDailyReportProducts(json: unknown): DailyReportProduct[] {
  const r = z.array(dailyReportProductSchema).safeParse(json);
  return r.success ? r.data : [];
}
