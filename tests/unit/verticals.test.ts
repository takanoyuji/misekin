import { describe, it, expect } from "vitest";
import {
  categoryToThemeKey,
  getVertical,
  resolveOrganizationThemeKey,
  resolveStoreThemeKey,
  verticalForCategory,
  verticalSlugFromDb,
} from "@/lib/verticals";

describe("getVertical", () => {
  it("スラッグから版を引ける", () => {
    expect(getVertical("shisha").slug).toBe("shisha");
    expect(getVertical("concafe").terms.staff).toBe("キャスト");
  });

  it("未知の値は既定版に落ちる", () => {
    expect(getVertical("unknown").slug).toBe("concafe");
    expect(getVertical(undefined).slug).toBe("concafe");
  });
});

describe("verticalSlugFromDb", () => {
  it("DBの大文字とURLの小文字を橋渡しする", () => {
    expect(verticalSlugFromDb("SHISHA")).toBe("shisha");
    expect(verticalSlugFromDb("CONCAFE")).toBe("concafe");
  });

  it("null は既定版になる", () => {
    expect(verticalSlugFromDb(null)).toBe("concafe");
  });
});

describe("categoryToThemeKey", () => {
  it("メイドカフェもコンカフェ版の配色にまとめる", () => {
    expect(categoryToThemeKey("CONCAFE")).toBe("concafe");
    expect(categoryToThemeKey("MAID_CAFE")).toBe("concafe");
    expect(categoryToThemeKey("SHISHA")).toBe("shisha");
  });

  it("版を持たない業態は中立になる", () => {
    expect(categoryToThemeKey("BAR")).toBe("neutral");
    expect(categoryToThemeKey("OTHER")).toBe("neutral");
  });
});

describe("resolveOrganizationThemeKey", () => {
  it("1業態だけならその版の配色（LPと揃う）", () => {
    expect(
      resolveOrganizationThemeKey({
        vertical: "concafe",
        storeCategories: ["CONCAFE", "MAID_CAFE"],
      })
    ).toBe("concafe");
  });

  it("複数業態ならどの店舗にも寄らない中立の配色", () => {
    expect(
      resolveOrganizationThemeKey({
        vertical: "concafe",
        storeCategories: ["CONCAFE", "SHISHA"],
      })
    ).toBe("neutral");
  });

  it("コンカフェとシーシャの兼業は中立", () => {
    expect(
      resolveOrganizationThemeKey({
        vertical: "shisha",
        storeCategories: ["SHISHA", "CONCAFE", "BAR"],
      })
    ).toBe("neutral");
  });

  it("店舗が未登録なら登録経路の版に従う", () => {
    expect(
      resolveOrganizationThemeKey({ vertical: "shisha", storeCategories: [] })
    ).toBe("shisha");
  });

  it("版を持たない業態しかないときも登録経路の版に従う", () => {
    expect(
      resolveOrganizationThemeKey({
        vertical: "concafe",
        storeCategories: ["BAR", "SNACK"],
      })
    ).toBe("concafe");
  });
});

describe("resolveStoreThemeKey", () => {
  it("店舗ページはその店舗の業態に寄せる（組織が中立でも）", () => {
    expect(resolveStoreThemeKey("SHISHA", "neutral")).toBe("shisha");
    expect(resolveStoreThemeKey("CONCAFE", "neutral")).toBe("concafe");
  });

  it("版を持たない業態のときは組織の配色をそのまま使う", () => {
    expect(resolveStoreThemeKey("BAR", "concafe")).toBe("concafe");
  });
});

describe("verticalForCategory", () => {
  it("店舗の業態に対応する初期値を返す", () => {
    const v = verticalForCategory("SHISHA", "concafe");
    expect(v.slug).toBe("shisha");
    expect(v.defaults.slots.map((s) => s.name)).toEqual(["昼", "夜"]);
  });

  it("版を持たない業態は組織の版の初期値に落ちる", () => {
    const v = verticalForCategory("BAR", "concafe");
    expect(v.slug).toBe("concafe");
    expect(v.defaults.slots.map((s) => s.name)).toEqual(["早番", "遅番"]);
  });

  it("両版ともルールのテンプレートを12種持つ", () => {
    expect(verticalForCategory("CONCAFE", "concafe").defaults.rules).toHaveLength(12);
    expect(verticalForCategory("SHISHA", "concafe").defaults.rules).toHaveLength(12);
  });
});
