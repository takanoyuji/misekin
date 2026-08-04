import "server-only";

import { cookies } from "next/headers";

import { db } from "@/lib/db";

import {
  DEFAULT_VERTICAL_SLUG,
  VERTICALS,
  resolveOrganizationThemeKey,
  verticalSlugFromDb,
} from ".";
import { VERTICAL_COOKIE, normalizeVerticalSlug } from "./cookie";
import type { Vertical } from "./types";
import type { Terms, ThemeKey, VerticalSlug } from "./types";

/** DBの StaffTerm と画面表示の対応 */
export const STAFF_TERM_LABELS: Record<string, string> = {
  CAST: "キャスト",
  STAFF: "スタッフ",
};

/**
 * 組織の「見せ方」。配色と用語をまとめて返す。
 *
 * 配色は組織が扱う業態から決まる（1業態ならその版、複数業態なら中立）。
 * 用語は組織の設定値をそのまま使う（自動では切り替えない。勝手に言葉が変わるのは驚きが大きいため）。
 */
export interface OrgPresentation {
  themeKey: ThemeKey;
  terms: Terms;
  /** 登録経路の版。分析とオンボーディングの初期値に使う */
  vertical: VerticalSlug;
  /** 版に対応する業態の店舗が2種類以上あるか（設定画面の案内に使う） */
  isMixed: boolean;
}

const FALLBACK: OrgPresentation = {
  themeKey: "neutral",
  terms: { staff: STAFF_TERM_LABELS.CAST },
  vertical: DEFAULT_VERTICAL_SLUG,
  isMixed: false,
};

export async function getOrgPresentation(
  organizationId: string | null | undefined
): Promise<OrgPresentation> {
  if (!organizationId) return FALLBACK;

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      vertical: true,
      staffTerm: true,
      stores: { where: { isActive: true }, select: { category: true } },
    },
  });
  if (!org) return FALLBACK;

  return buildPresentation(org);
}

/**
 * すでに組織を読み込んでいる場合に、追加のクエリなしで組み立てる。
 * レイアウトのように1回のクエリで済ませたい場所で使う。
 */
export function buildPresentation(org: {
  vertical: string;
  staffTerm: string;
  stores: { category: string }[];
}): OrgPresentation {
  const vertical = verticalSlugFromDb(org.vertical);
  const storeCategories = org.stores.map((s) => s.category);
  const themeKey = resolveOrganizationThemeKey({ vertical, storeCategories });

  const themed = new Set(
    storeCategories.filter((c) => c === "CONCAFE" || c === "MAID_CAFE" || c === "SHISHA")
      .map((c) => (c === "SHISHA" ? "shisha" : "concafe"))
  );

  return {
    themeKey,
    terms: { staff: STAFF_TERM_LABELS[org.staffTerm] ?? STAFF_TERM_LABELS.CAST },
    vertical,
    isMixed: themed.size > 1,
  };
}

/**
 * ログイン前の画面で使う版。
 *
 * LPを見たときに middleware がクッキーへ入れているので、
 * 登録・ログイン画面でもトンマナと用語が途切れない。
 * 直接来た人には既定版を返す。
 */
export async function getVerticalFromCookie(): Promise<Vertical> {
  const store = await cookies();
  const slug =
    normalizeVerticalSlug(store.get(VERTICAL_COOKIE)?.value) ??
    DEFAULT_VERTICAL_SLUG;
  return VERTICALS[slug];
}
