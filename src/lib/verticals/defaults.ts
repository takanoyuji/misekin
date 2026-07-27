/**
 * 業態版の初期値（シフトの時間帯とルールのテンプレート）
 *
 * 画像を読み込まない独立したモジュールにしてある。
 * Vertical 本体は LP の画像を静的インポートするため、Next の外（シードスクリプトや
 * 素の tsx 実行）からは読めない。初期値だけはそういう場所からも使いたいので分けている。
 */

import type { StoreCategory } from "@/lib/store-category";

import type { VerticalDefaults, VerticalSlug } from "./types";

const CONCAFE_DEFAULTS: VerticalDefaults = {
  dayChangeHour: 6,
  storeCategory: "CONCAFE",
  slots: [
    { name: "早番", startTime: "17:00", endTime: "22:00" },
    { name: "遅番", startTime: "22:00", endTime: "05:00" },
  ],
  rules: [
    { text: "売上の多い曜日は人を厚くする", tag: "売上" },
    { text: "指名の多い子は繁忙日に優先して入れる", tag: "売上" },
    { text: "金土の遅番は4人、平日は2人", tag: "人数" },
    { text: "人気の子は同じ日に固めない", tag: "配分" },
    { text: "同じ子ばかり土日に入れない", tag: "公平" },
    { text: "新人はひとりで遅番に入れない", tag: "教育" },
    { text: "この2人は同じ日に入れない", tag: "相性" },
    { text: "締めの担当を毎日1人は入れる", tag: "運営" },
    { text: "イベントの日は全員に声をかける", tag: "イベント" },
    { text: "週に2回以上は入ってもらう", tag: "定着" },
    { text: "連勤は5日まで", tag: "法令" },
    { text: "遅番の翌日に早番は入れない", tag: "法令" },
  ],
};

const SHISHA_DEFAULTS: VerticalDefaults = {
  dayChangeHour: 5,
  storeCategory: "SHISHA",
  slots: [
    { name: "昼", startTime: "13:00", endTime: "19:00" },
    { name: "夜", startTime: "19:00", endTime: "02:00" },
  ],
  rules: [
    { text: "売上の多い曜日は人を厚くする", tag: "売上" },
    { text: "回転の速い時間帯は慣れている人を優先して入れる", tag: "売上" },
    { text: "金土の夜は3人、平日は2人", tag: "人数" },
    { text: "シーシャを作れる人を各時間帯に必ず1人入れる", tag: "技能" },
    { text: "新人はひとりで夜に入れない", tag: "教育" },
    { text: "同じ人ばかり土日に入れない", tag: "公平" },
    { text: "この2人は同じ日に入れない", tag: "相性" },
    { text: "仕込みの担当を毎日1人は入れる", tag: "運営" },
    { text: "締めの担当を毎日1人は入れる", tag: "運営" },
    { text: "週に2回以上は入ってもらう", tag: "定着" },
    { text: "連勤は5日まで", tag: "法令" },
    { text: "深夜上がりの翌日に昼は入れない", tag: "法令" },
  ],
};

export const VERTICAL_DEFAULTS: Record<VerticalSlug, VerticalDefaults> = {
  concafe: CONCAFE_DEFAULTS,
  shisha: SHISHA_DEFAULTS,
};

/** 店舗カテゴリ → 版のスラッグ。版を持たない業態は null */
export function verticalSlugForCategory(
  category: StoreCategory | string
): VerticalSlug | null {
  switch (category) {
    case "CONCAFE":
    case "MAID_CAFE":
      return "concafe";
    case "SHISHA":
      return "shisha";
    default:
      return null;
  }
}

/**
 * 店舗の業態に対応する初期値。版を持たない業態のときは組織の版に落ちる。
 * 画像を読まないので、シードスクリプトからも呼べる。
 */
export function defaultsForCategory(
  category: StoreCategory | string,
  organizationVertical: VerticalSlug
): VerticalDefaults {
  return VERTICAL_DEFAULTS[
    verticalSlugForCategory(category) ?? organizationVertical
  ];
}
