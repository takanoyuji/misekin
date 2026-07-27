/**
 * 業態版（Vertical）レジストリ
 *
 * 「版」は別プロダクトではない。同一のスキーマ・ロジック・権限の上に載る表示プリセット。
 * 版ごとに変えるのは用語・トンマナ・初期プロンプトの3つだけ。
 */

import type { StoreCategory } from "@/lib/store-category";

import { CONCAFE } from "./concafe";
import { SHISHA } from "./shisha";
import { verticalSlugForCategory } from "./defaults";
import { VERTICAL_SLUGS } from "./types";
import type { ThemeKey, Vertical, VerticalSlug } from "./types";

export * from "./types";
export { APP_THEMES, buildAppThemeCss, lpThemeVars } from "./themes";
export { buildSharedContent } from "./content";
export {
  VERTICAL_DEFAULTS,
  defaultsForCategory,
  verticalSlugForCategory,
} from "./defaults";
export type {
  SharedContent,
  CompareRow,
  StepIcon,
  FeatureIcon,
  TrustIcon,
} from "./content";

export const VERTICALS: Record<VerticalSlug, Vertical> = {
  concafe: CONCAFE,
  shisha: SHISHA,
};

/** 版が分からないときの既定。最初に立ち上げた版 */
export const DEFAULT_VERTICAL_SLUG: VerticalSlug = "concafe";

export function isVerticalSlug(value: unknown): value is VerticalSlug {
  return (
    typeof value === "string" &&
    (VERTICAL_SLUGS as readonly string[]).includes(value)
  );
}

/** スラッグから版を引く。未知の値は既定版に落とす */
export function getVertical(slug: unknown): Vertical {
  return isVerticalSlug(slug)
    ? VERTICALS[slug]
    : VERTICALS[DEFAULT_VERTICAL_SLUG];
}

/* ------------------------------------------------------------------ */
/* DBの enum との対応                                                   */
/* ------------------------------------------------------------------ */

/**
 * Prisma の `Vertical` enum（CONCAFE / SHISHA）とスラッグを行き来する。
 * DBには大文字、URLには小文字、という住み分け。
 */
export function verticalSlugFromDb(value: string | null | undefined): VerticalSlug {
  const slug = (value ?? "").toLowerCase();
  return isVerticalSlug(slug) ? slug : DEFAULT_VERTICAL_SLUG;
}

export function verticalSlugToDb(slug: VerticalSlug): string {
  return slug.toUpperCase();
}

/* ------------------------------------------------------------------ */
/* 配色の解決                                                           */
/* ------------------------------------------------------------------ */

/**
 * 店舗カテゴリ → 配色。
 * 版を持たないカテゴリは "neutral" を返す（ここでは「決められない」の意味）。
 */
export function categoryToThemeKey(category: StoreCategory | string): ThemeKey {
  return verticalSlugForCategory(category) ?? "neutral";
}

/**
 * 組織全体の配色を決める。
 *
 *  - 版に対応する業態の店舗が1種類だけ → その版の配色（LPと揃う）
 *  - 2種類以上                        → 中立（どの店舗にも寄らない）
 *  - 0件（未登録／版のない業態のみ）    → 登録経路の版に従う
 */
export function resolveOrganizationThemeKey(params: {
  vertical: VerticalSlug;
  storeCategories: (StoreCategory | string)[];
}): ThemeKey {
  const keys = new Set(
    params.storeCategories
      .map(categoryToThemeKey)
      .filter((k): k is Exclude<ThemeKey, "neutral"> => k !== "neutral")
  );

  if (keys.size === 1) return [...keys][0];
  if (keys.size === 0) return VERTICALS[params.vertical].themeKey;
  return "neutral";
}

/**
 * 店舗の業態に対応する版を返す。版を持たない業態のときは組織の版に落とす。
 * 初期値（シフト時間帯・ルールテンプレート）の供給元を決めるのに使う。
 */
export function verticalForCategory(
  category: StoreCategory | string,
  organizationVertical: VerticalSlug
): Vertical {
  const key = categoryToThemeKey(category);
  return VERTICALS[key === "neutral" ? organizationVertical : key];
}

/**
 * 店舗ページの配色。その店舗の業態に寄せる。
 * 版を持たない業態のときは、組織の配色をそのまま使う（画面が浮かないように）。
 */
export function resolveStoreThemeKey(
  category: StoreCategory | string,
  organizationThemeKey: ThemeKey
): ThemeKey {
  const key = categoryToThemeKey(category);
  return key === "neutral" ? organizationThemeKey : key;
}
