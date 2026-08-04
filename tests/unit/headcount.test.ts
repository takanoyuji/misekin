import { describe, it, expect } from "vitest";
import {
  DEFAULT_HEADCOUNT_POLICY,
  median,
  salesPerPersonAt,
  suggestHeadcount,
  weekdayIndex,
  weekdayOf,
} from "@/lib/business/headcount";
import type { HeadcountPolicy } from "@/lib/business/headcount";

/** テスト用に一律の係数を作る（時間帯別の既定値の影響を受けないようにする） */
const flat = (
  perPerson: number,
  minPerSlot = 1,
  maxPerSlot = 6
): HeadcountPolicy => ({
  salesPerPersonByHour: {},
  salesPerPersonDefault: perPerson,
  minPerSlot,
  maxPerSlot,
});

describe("weekdayOf", () => {
  it("0=月 で返す", () => {
    expect(weekdayOf("2026-07-27")).toBe(0); // 月曜
    expect(weekdayOf("2026-08-01")).toBe(5); // 土曜
    expect(weekdayOf("2026-08-02")).toBe(6); // 日曜
  });
});

describe("median", () => {
  it("奇数個は真ん中", () => {
    expect(median([1, 100, 5])).toBe(5);
  });
  it("偶数個は平均", () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });
  it("空なら0", () => {
    expect(median([])).toBe(0);
  });
});

describe("salesPerPersonAt", () => {
  it("時間帯ごとの係数を引く", () => {
    const p = flat(1_000);
    p.salesPerPersonByHour["22"] = 5_000;
    expect(salesPerPersonAt(p, "22")).toBe(5_000);
  });

  it("実績が無い時間帯は既定値にフォールバックする", () => {
    expect(salesPerPersonAt(flat(1_000), "11")).toBe(1_000);
  });

  it("既定の上限は2人（店舗ごとに Store.maxStaffPerSlot で上書きする）", () => {
    expect(DEFAULT_HEADCOUNT_POLICY.maxPerSlot).toBe(2);
    // 売上がいくら大きくても既定では2人を超えない
    const s = suggestHeadcount(
      [{ businessDate: "2026-07-04", hourBucket: "22", amount: 1_000_000 }],
      DEFAULT_HEADCOUNT_POLICY
    );
    expect(s[0].suggested).toBe(2);
  });

  it("店舗ごとの上限で上書きできる", () => {
    const s = suggestHeadcount(
      [{ businessDate: "2026-07-04", hourBucket: "22", amount: 1_000_000 }],
      { ...DEFAULT_HEADCOUNT_POLICY, maxPerSlot: 5 }
    );
    expect(s[0].suggested).toBe(5);
  });

  it("既定ポリシーは深夜のほうが1人あたりの売上が大きい", () => {
    // 深夜は少人数で回している実績が出ているので、昼と同じ係数だと人数を過大に見積もる
    const noon = salesPerPersonAt(DEFAULT_HEADCOUNT_POLICY, "15");
    const midnight = salesPerPersonAt(DEFAULT_HEADCOUNT_POLICY, "03");
    expect(midnight).toBeGreaterThan(noon);
  });
});

describe("suggestHeadcount", () => {
  // 土曜だけ売上が高い店を想定
  const points = [
    // 土曜4回: 20万
    { businessDate: "2026-07-04", hourBucket: "22", amount: 200_000 },
    { businessDate: "2026-07-11", hourBucket: "22", amount: 200_000 },
    { businessDate: "2026-07-18", hourBucket: "22", amount: 200_000 },
    { businessDate: "2026-07-25", hourBucket: "22", amount: 200_000 },
    // 火曜4回: 4万
    { businessDate: "2026-07-07", hourBucket: "22", amount: 40_000 },
    { businessDate: "2026-07-14", hourBucket: "22", amount: 40_000 },
    { businessDate: "2026-07-21", hourBucket: "22", amount: 40_000 },
    { businessDate: "2026-07-28", hourBucket: "22", amount: 40_000 },
  ];

  it("忙しい曜日ほど多い人数を提案する", () => {
    const s = suggestHeadcount(points, flat(50_000));
    const sat = s.find((x) => x.weekday === 5)!;
    const tue = s.find((x) => x.weekday === 1)!;
    expect(sat.suggested).toBe(4); // 20万 / 5万
    expect(tue.suggested).toBe(1); // 4万 / 5万 → 切り上げ1
    expect(sat.suggested).toBeGreaterThan(tue.suggested);
  });

  it("上限と下限で丸める", () => {
    const s = suggestHeadcount(points, flat(10_000, 2, 3));
    expect(s.every((x) => x.suggested >= 2 && x.suggested <= 3)).toBe(true);
  });

  it("外れ値1回に引きずられない（平均ではなく中央値）", () => {
    const withOutlier = [
      ...points,
      // 火曜に貸切で100万入った日を1回混ぜる
      { businessDate: "2026-08-04", hourBucket: "22", amount: 1_000_000 },
    ];
    const s = suggestHeadcount(withOutlier, flat(50_000, 1, 20));
    const tue = s.find((x) => x.weekday === 1)!;
    expect(tue.medianSales).toBe(40_000); // 平均なら232,000になる
    expect(tue.suggested).toBe(1);
  });

  it("同じ営業日・同じ枠の明細は合算してから中央値を取る", () => {
    const s = suggestHeadcount(
      [
        { businessDate: "2026-07-04", hourBucket: "22", amount: 30_000 },
        { businessDate: "2026-07-04", hourBucket: "22", amount: 30_000 },
      ],
      flat(20_000, 1, 9)
    );
    expect(s[0].medianSales).toBe(60_000);
    expect(s[0].suggested).toBe(3);
  });

  it("サンプルが少ない枠は confidence が low になる", () => {
    const s = suggestHeadcount([
      { businessDate: "2026-07-04", hourBucket: "22", amount: 100_000 },
    ]);
    expect(s[0].sampleDays).toBe(1);
    expect(s[0].confidence).toBe("low");
  });

  it("時間帯ごとに分けて提案する", () => {
    const s = suggestHeadcount(
      [
        { businessDate: "2026-07-04", hourBucket: "15", amount: 10_000 },
        { businessDate: "2026-07-04", hourBucket: "22", amount: 100_000 },
      ],
      flat(50_000, 1, 9)
    );
    expect(s).toHaveLength(2);
    expect(s.find((x) => x.hourBucket === "22")!.suggested).toBe(2);
    expect(s.find((x) => x.hourBucket === "15")!.suggested).toBe(1);
  });

  it("同じ売上でも時間帯によって提案人数が変わる", () => {
    // 一律の係数だと深夜を過大に見積もるため、時間帯別に持っている
    const policy: HeadcountPolicy = {
      salesPerPersonByHour: { "18": 3_000, "03": 9_000 },
      salesPerPersonDefault: 3_000,
      minPerSlot: 1,
      maxPerSlot: 9,
    };
    const s = suggestHeadcount(
      [
        { businessDate: "2026-07-04", hourBucket: "18", amount: 9_000 },
        { businessDate: "2026-07-04", hourBucket: "03", amount: 9_000 },
      ],
      policy
    );
    expect(s.find((x) => x.hourBucket === "18")!.suggested).toBe(3);
    expect(s.find((x) => x.hourBucket === "03")!.suggested).toBe(1);
  });
});

describe("weekdayIndex", () => {
  it("最大の曜日を100とした指数を返す", () => {
    const i = weekdayIndex([
      { businessDate: "2026-07-04", hourBucket: "22", amount: 100 }, // 土
      { businessDate: "2026-07-07", hourBucket: "22", amount: 50 }, // 火
    ]);
    expect(i[5]).toBe(100);
    expect(i[1]).toBe(50);
    expect(i[0]).toBe(0); // 実績なし
  });
});
