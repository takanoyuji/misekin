import { describe, it, expect } from "vitest";
import {
  normalizeCustomerName,
  similarReason,
  findSimilarCustomerPairs,
  countStoreSales,
  decideDuplicateGroup,
  summarizeDailyReports,
  type SaleRow,
  type ReportForSummary,
} from "@/lib/business/daily-report";
import {
  dailyReportInputSchema,
  dailyReportSettingsSchema,
  checkReportLocations,
  normalizeReportLocation,
} from "@/lib/validations/daily-report";

describe("normalizeCustomerName（表記ゆれの吸収）", () => {
  it("敬称・カタカナ/ひらがな・全角半角・空白の違いを同じキーにする", () => {
    const keys = ["たけしさん", "タケシ様", "ﾀｹｼ", " たけし ちゃん", "たけし　さま", "タケシ君"].map(
      normalizeCustomerName
    );
    expect(new Set(keys)).toEqual(new Set(["たけし"]));
  });

  it("英字は大文字小文字と全角半角をそろえる", () => {
    expect(normalizeCustomerName("ＪＯＨＮさん")).toBe(normalizeCustomerName("john"));
  });

  it("重ねた敬称も外す", () => {
    expect(normalizeCustomerName("ゆうとさま様")).toBe("ゆうと");
  });

  it("敬称だけの名前は消さない", () => {
    expect(normalizeCustomerName("さん")).toBe("さん");
  });

  it("括弧の中は外さない（別人の区別に使われることがある）", () => {
    expect(normalizeCustomerName("ゆうと（常連）")).not.toBe(normalizeCustomerName("ゆうと"));
  });

  it("名前の途中の「さん」は外さない", () => {
    expect(normalizeCustomerName("さんた")).toBe("さんた");
  });
});

describe("similarReason（似た名前の候補）", () => {
  it("括弧の中だけ違う", () => {
    expect(
      similarReason(normalizeCustomerName("ゆうと（常連）"), normalizeCustomerName("ユウト"))
    ).toBe("BRACKET");
  });
  it("片方がもう片方を含む", () => {
    expect(similarReason("たけし", "たけし2")).toBe("CONTAINS");
  });
  it("1文字違い（3文字以上）", () => {
    expect(similarReason("みっちー", "みっちい")).toBe("ONE_CHAR");
  });
  it("短い名前の1文字違いは候補にしない", () => {
    expect(similarReason("ゆう", "ゆき")).toBeNull();
  });
  it("1文字だけの名前は「含む」で拾わない", () => {
    expect(similarReason("あ", "あかり")).toBeNull();
  });
  it("組は1回だけ返す", () => {
    const pairs = findSimilarCustomerPairs([
      { id: "1", normalizedName: "たけし" },
      { id: "2", normalizedName: "たけし2" },
      { id: "3", normalizedName: "そうた" },
    ]);
    expect(pairs.map((p) => [p.a.id, p.b.id])).toEqual([["1", "2"]]);
  });
});

const t = (h: number) => new Date(Date.UTC(2026, 10, 22, h));
const row = (o: Partial<SaleRow> & Pick<SaleRow, "id" | "reportId">): SaleRow => ({
  staffId: o.reportId,
  businessDate: "2026-11-22",
  customerRootId: "c1",
  amount: 1000,
  decision: null,
  submittedAt: t(14),
  ...o,
});

describe("countStoreSales（2人が同じお客様を書いたとき）", () => {
  it("1人だけが書いたお客様はそのまま数える", () => {
    const r = countStoreSales([
      row({ id: "a", reportId: "r1", amount: 8000 }),
      row({ id: "b", reportId: "r2", amount: 3000, customerRootId: "c2" }),
    ]);
    expect(r.duplicates).toHaveLength(0);
    expect(r.counted.get("a")).toBe(8000);
    expect(r.counted.get("b")).toBe(3000);
  });

  it("1つの日報の中で同じお客様が2行あるのは重複にしない", () => {
    const r = countStoreSales([
      row({ id: "a", reportId: "r1", amount: 8000 }),
      row({ id: "b", reportId: "r1", amount: 2000 }),
    ]);
    expect(r.duplicates).toHaveLength(0);
    expect([...r.counted.values()].reduce((x, y) => x + y)).toBe(10000);
  });

  it("別の日なら同じお客様でも重複にしない", () => {
    const r = countStoreSales([
      row({ id: "a", reportId: "r1" }),
      row({ id: "b", reportId: "r2", businessDate: "2026-11-21" }),
    ]);
    expect(r.duplicates).toHaveLength(0);
  });

  it("未確認のうちは、金額が大きい方の日報だけを数える", () => {
    const r = countStoreSales([
      row({ id: "a", reportId: "r1", amount: 8000, submittedAt: t(13) }),
      row({ id: "b", reportId: "r2", amount: 8400, submittedAt: t(14) }),
    ]);
    expect(r.duplicates).toHaveLength(1);
    expect(r.duplicates[0].resolved).toBe(false);
    expect(r.duplicates[0].provisionalReportId).toBe("r2");
    expect(r.counted.get("a")).toBe(0);
    expect(r.counted.get("b")).toBe(8400);
  });

  it("同額なら先に送った日報を数える", () => {
    const r = countStoreSales([
      row({ id: "a", reportId: "r1", amount: 8000, submittedAt: t(15) }),
      row({ id: "b", reportId: "r2", amount: 8000, submittedAt: t(13) }),
    ]);
    expect(r.duplicates[0].provisionalReportId).toBe("r2");
  });

  it("日報ごとの合計で比べる（片方が2行に分けて書いた）", () => {
    const r = countStoreSales([
      row({ id: "a", reportId: "r1", amount: 5000 }),
      row({ id: "a2", reportId: "r1", amount: 4000 }),
      row({ id: "b", reportId: "r2", amount: 8000 }),
    ]);
    expect(r.duplicates[0].countedTotal).toBe(9000);
  });

  it("店長が採用を決めたら、採用した方だけ数える", () => {
    const rows = [
      row({ id: "a", reportId: "r1", amount: 8000 }),
      row({ id: "b", reportId: "r2", amount: 8400 }),
    ];
    const d = decideDuplicateGroup(rows, { adoptReportId: "r1" });
    const r = countStoreSales(rows.map((x) => ({ ...x, decision: d.get(x.id)! })));
    expect(r.duplicates[0].resolved).toBe(true);
    expect(r.counted.get("a")).toBe(8000);
    expect(r.counted.get("b")).toBe(0);
  });

  it("別の会計なら両方数える", () => {
    const rows = [
      row({ id: "a", reportId: "r1", amount: 8000 }),
      row({ id: "b", reportId: "r2", amount: 5000 }),
    ];
    const d = decideDuplicateGroup(rows, "SEPARATE");
    const r = countStoreSales(rows.map((x) => ({ ...x, decision: d.get(x.id)! })));
    expect(r.duplicates[0].countedTotal).toBe(13000);
  });

  it("決めたあとに3人目が書いたら、また未確認に戻る", () => {
    const r = countStoreSales([
      row({ id: "a", reportId: "r1", amount: 8000, decision: "ADOPTED" }),
      row({ id: "b", reportId: "r2", amount: 8000, decision: "EXCLUDED" }),
      row({ id: "c", reportId: "r3", amount: 9000 }),
    ]);
    expect(r.duplicates[0].resolved).toBe(false);
    expect(r.duplicates[0].countedTotal).toBe(9000);
  });
});

describe("summarizeDailyReports（集計）", () => {
  const report = (o: Partial<ReportForSummary> & Pick<ReportForSummary, "id" | "staffId">): ReportForSummary => ({
    staffName: o.staffId,
    businessDate: "2026-11-22",
    noSales: false,
    submittedAt: t(14),
    sales: [],
    backItems: [],
    ...o,
  });

  const reports = [
    report({
      id: "r1",
      staffId: "りあ",
      submittedAt: t(13),
      sales: [
        { id: "s1", customerRootId: "c1", customerRootName: "たけしさん", amount: 8000, decision: null },
        { id: "s2", customerRootId: "c2", customerRootName: "ゆうと", amount: 23500, decision: null },
      ],
      backItems: [
        { productName: "キャストドリンク", unitPrice: 1000, quantity: 5 },
        { productName: "ｷｬｽﾄﾄﾞﾘﾝｸ", unitPrice: 1000, quantity: 1 },
      ],
    }),
    report({
      id: "r2",
      staffId: "まお",
      sales: [{ id: "s3", customerRootId: "c1", customerRootName: "たけしさん", amount: 8000, decision: null }],
      backItems: [{ productName: "チェキ", unitPrice: 1000, quantity: 2 }],
    }),
    report({ id: "r3", staffId: "こはる", noSales: true }),
  ];
  const sum = summarizeDailyReports(reports);

  it("店の売上は重複を1人分にし、日報の合計は書いたまま", () => {
    expect(sum.writtenSales).toBe(39500);
    expect(sum.storeSales).toBe(31500);
    expect(sum.unresolvedDuplicateCount).toBe(1);
  });

  it("お客様は代表のIDで数える", () => {
    expect(sum.customerCount).toBe(2);
    const takeshi = sum.byCustomer.find((c) => c.customerRootId === "c1")!;
    expect(takeshi.amount).toBe(8000);
    expect(takeshi.staffNames.sort()).toEqual(["まお", "りあ"].sort());
  });

  it("キャスト別は書いた額と、店の売上に数えた額を両方出す", () => {
    const mao = sum.byCast.find((c) => c.staffId === "まお")!;
    expect(mao.writtenSales).toBe(8000);
    expect(mao.countedSales).toBe(0);
  });

  it("商品名は全角半角の違いだけまとめる", () => {
    const drink = sum.byItem.find((i) => i.productName === "キャストドリンク")!;
    expect(drink.quantity).toBe(6);
    expect(sum.backTotal).toBe(8000);
  });

  it("売上なしの日報を数える", () => {
    expect(sum.reportCount).toBe(3);
    expect(sum.noSalesCount).toBe(1);
  });
});

describe("dailyReportInputSchema（日報の入力）", () => {
  it("売上も商品もなく「売上なし」でもないのは通さない", () => {
    expect(dailyReportInputSchema.safeParse({ noSales: false, sales: [], backItems: [] }).success).toBe(false);
  });
  it("「売上なし」なら空で通す", () => {
    expect(dailyReportInputSchema.safeParse({ noSales: true, sales: [], backItems: [] }).success).toBe(true);
  });
  it("「売上なし」なのに売上があるのは通さない", () => {
    const r = dailyReportInputSchema.safeParse({
      noSales: true,
      sales: [{ customerName: "たけし", amount: 1000 }],
      backItems: [],
    });
    expect(r.success).toBe(false);
  });
  it("お客様名が空・金額0円の売上は通さない", () => {
    expect(
      dailyReportInputSchema.safeParse({ noSales: false, sales: [{ customerName: " ", amount: 1000 }], backItems: [] })
        .success
    ).toBe(false);
    expect(
      dailyReportInputSchema.safeParse({ noSales: false, sales: [{ customerName: "たけし", amount: 0 }], backItems: [] })
        .success
    ).toBe(false);
  });
  it("商品だけの日報は通す（売上は別のキャストが書いた日）", () => {
    const r = dailyReportInputSchema.safeParse({
      noSales: false,
      sales: [],
      backItems: [{ productName: "チェキ", unitPrice: 1000, quantity: 2 }],
    });
    expect(r.success).toBe(true);
  });
});

describe("どこの店の分か（池袋 / 札幌）", () => {
  const input = (sl?: string, bl?: string) =>
    dailyReportInputSchema.parse({
      noSales: false,
      sales: [{ customerName: "たけし", amount: 1000, ...(sl ? { location: sl } : {}) }],
      backItems: [{ productName: "オリカク", unitPrice: 1500, quantity: 1, ...(bl ? { location: bl } : {}) }],
    });
  const locs = ["池袋", "札幌"];

  it("店が2つ以上なら、売上・商品のどの行にも店が要る", () => {
    expect(checkReportLocations(input(), locs)).toMatch(/売上/);
    expect(checkReportLocations(input("札幌"), locs)).toMatch(/商品/);
    expect(checkReportLocations(input("札幌", "大阪"), locs)).toMatch(/商品/);
    expect(checkReportLocations(input("札幌", "池袋"), locs)).toBeNull();
  });
  it("店が1つ以下なら選ばせない", () => {
    expect(checkReportLocations(input(), [])).toBeNull();
    expect(checkReportLocations(input(), ["池袋"])).toBeNull();
  });
  it("保存する店: 0なら null、1ならその店、2以上なら選んだ店", () => {
    expect(normalizeReportLocation("札幌", [])).toBeNull();
    expect(normalizeReportLocation(undefined, ["池袋"])).toBe("池袋");
    expect(normalizeReportLocation("札幌", locs)).toBe("札幌");
  });
  it("設定: 同じ名前・空の店は通さない", () => {
    const base = { requireDailyReport: true, products: [] };
    expect(dailyReportSettingsSchema.safeParse({ ...base, locations: ["池袋", "池袋"] }).success).toBe(false);
    expect(dailyReportSettingsSchema.safeParse({ ...base, locations: [" "] }).success).toBe(false);
    expect(dailyReportSettingsSchema.safeParse({ ...base, locations: locs }).success).toBe(true);
  });
  it("集計は店ごとにも分ける（重複を除いた額で）", () => {
    const sum = summarizeDailyReports([
      {
        id: "r1", staffId: "a", staffName: "a", businessDate: "2026-11-22", noSales: false, submittedAt: t(13),
        sales: [
          { id: "s1", customerRootId: "c1", customerRootName: "たけし", amount: 8000, decision: null, location: "札幌" },
          { id: "s2", customerRootId: "c2", customerRootName: "ゆうと", amount: 5000, decision: null, location: "池袋" },
        ],
        backItems: [{ productName: "オリカク", unitPrice: 1500, quantity: 2, location: "札幌" }],
      },
      {
        id: "r2", staffId: "b", staffName: "b", businessDate: "2026-11-22", noSales: false, submittedAt: t(14),
        sales: [{ id: "s3", customerRootId: "c1", customerRootName: "たけし", amount: 8000, decision: null, location: "札幌" }],
        backItems: [],
      },
    ]);
    const sap = sum.byLocation.find((l) => l.location === "札幌")!;
    expect(sap.storeSales).toBe(8000);
    expect(sap.writtenSales).toBe(16000);
    expect(sap.backTotal).toBe(3000);
    expect(sum.byLocation.find((l) => l.location === "池袋")!.storeSales).toBe(5000);
  });
});
