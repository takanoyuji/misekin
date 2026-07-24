/** 店舗の業態カテゴリ（ナイト系中心） */
export const STORE_CATEGORIES = [
  "CONCAFE",
  "MAID_CAFE",
  "GIRLS_BAR",
  "CABARET",
  "CLUB_LOUNGE",
  "SNACK",
  "BAR",
  "SHISHA",
  "OTHER",
] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
  CONCAFE: "コンカフェ",
  MAID_CAFE: "メイドカフェ",
  GIRLS_BAR: "ガールズバー",
  CABARET: "キャバクラ",
  CLUB_LOUNGE: "クラブ・ラウンジ",
  SNACK: "スナック",
  BAR: "バー",
  SHISHA: "シーシャ屋",
  OTHER: "その他",
};

export function storeCategoryLabel(category: string): string {
  return STORE_CATEGORY_LABELS[category as StoreCategory] ?? "その他";
}
