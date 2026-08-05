/**
 * 業態版（Vertical）の型定義
 *
 * 「版」は別プロダクトではなく、同一プラットフォームの表示プリセット。
 * 版ごとに変えるのは次の3つだけで、スキーマ・ロジック・権限は共通。
 *   1. 用語（terms）        … キャスト / スタッフ
 *   2. トンマナ（theme）    … LPとアプリの配色
 *   3. 初期プロンプト       … シフト時間帯とルールのテンプレート
 */

import type { StaticImageData } from "next/image";

import type { StoreCategory } from "@/lib/store-category";

/** LPを持つ業態版のスラッグ。URL（/concafe, /shisha）にそのまま出る */
export const VERTICAL_SLUGS = ["concafe", "shisha"] as const;
export type VerticalSlug = (typeof VERTICAL_SLUGS)[number];

/**
 * 配色のキー。
 * "neutral" はLPを持たない。複数業態を運営する組織のための、どの業態にも寄らない配色。
 */
export type ThemeKey = VerticalSlug | "neutral";

/* ------------------------------------------------------------------ */
/* 配色                                                                */
/* ------------------------------------------------------------------ */

/**
 * アプリ本体で上書きするトークン。
 * 背景・文字・境界などのニュートラル階調は globals.css のまま使い、
 * アクセントだけを版ごとに差し替える（ライト/ダークの両モードを保つため）。
 */
export interface AccentTokens {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  ring: string;
  chart1: string;
  sidebar: string;
  sidebarAccent: string;
}

export interface AppTheme {
  light: AccentTokens;
  dark: AccentTokens;
}

/**
 * LP専用の配色。`--lp-*` のCSS変数にそのまま入る。
 * 明度の前提を持たせていないので、ライト基調でもダーク基調でも同じ形で書ける。
 */
export interface LpTheme {
  /** ページ全体の背景 */
  bg: string;
  /** カード・パネルの面 */
  card: string;
  /** セクションを交互に塗る淡い面 */
  tint: string;
  /** バッジ・タグの面 */
  tint2: string;
  /** 境界線 */
  line: string;
  /** 見出しの文字色 */
  heading: string;
  /** 本文の文字色 */
  body: string;
  /** 補助テキストの文字色 */
  muted: string;
  /** ブランド色（ロゴ・アイコン） */
  brand: string;
  /** ブランドの濃い側（バッジ文字・グラフの棒） */
  brandDeep: string;
  /** CTAの背景と文字。白抜きが成立しない色を選ばないこと（AA 4.5:1） */
  cta: string;
  ctaHover: string;
  ctaFg: string;
  /** 充足・OKを示す色 */
  ok: string;
  /** 蛍光ペン風ハイライトの色 */
  mark: string;
  /** 影・グローに使う半透明色 */
  glow: string;
}

/* ------------------------------------------------------------------ */
/* 用語                                                                */
/* ------------------------------------------------------------------ */

/**
 * 表示用語。画面に出る名詞だけを扱う。
 * DBに保存する値・監査ログのアクション名・CSVヘッダー・APIのフィールド名は対象外
 * （過去データとの互換が壊れるため）。
 */
export interface Terms {
  /** キャスト / スタッフ */
  staff: string;
}

/* ------------------------------------------------------------------ */
/* 初期値（登録時にDBへコピーするもの）                                  */
/* ------------------------------------------------------------------ */

/** シフトの時間帯テンプレート。店舗作成時に ShiftSlot として投入する */
export interface SlotTemplate {
  name: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

/** シフトルールのテンプレート。店舗作成時に文章として投入する */
export interface RuleTemplate {
  /** 店長が編集できる日本語の文章 */
  text: string;
  /** 画面上の分類ラベル */
  tag: string;
}

export interface VerticalDefaults {
  /** 営業日の切替時刻（時） */
  dayChangeHour: number;
  /** 店舗カテゴリの既定値 */
  storeCategory: StoreCategory;
  slots: SlotTemplate[];
  rules: RuleTemplate[];
}

/* ------------------------------------------------------------------ */
/* LPコンテンツ                                                        */
/* ------------------------------------------------------------------ */

export interface LpImageSet {
  /** 最終CTAの背景 */
  hero: StaticImageData;
  /** 課題セクションの横 */
  pains: StaticImageData;
  /** 売上セクションの帯 */
  band: StaticImageData;
  /** 料金セクションの横 */
  pricing: StaticImageData;
  /** 「作っている人たち」の2枚 */
  founderA: StaticImageData;
  founderB: StaticImageData;
  /** 実際のキャストの集合写真。載せる版だけ持つ（肖像の扱いがあるため必須にしない） */
  cast?: StaticImageData;
  castAlt?: string;
  /** alt テキスト */
  alt: { pains: string; pricing: string; founderA: string; founderB: string };
}

/** シフト表モックに出す名前と割り当て（実データではない） */
export interface MockRoster {
  slotLabel: string;
  days: { label: string; need: number; filled: number }[];
  people: { name: string; on: boolean[] }[];
  note: string;
}

/** 曜日別売上のイメージデータ */
export interface SalesSample {
  day: string;
  index: number;
  need: number;
}

export interface LpContent {
  /** <title> と description */
  title: string;
  description: string;
  /** ファーストビュー */
  hero: {
    eyebrow: string;
    /** 見出し1行目 */
    line1: string;
    /** 見出し2行目（蛍光ペンが引かれる） */
    line2: string;
    sub: string;
    chips: string[];
  };
  mock: MockRoster;
  /** 課題（Problem / Affinity） */
  pains: string[];
  painsClosing: { before: string; mark: string; after: string };
  /** ルールテンプレートの見せ方 */
  rulesHeading: { line1: string; mark: string };
  rulesBody: string;
  /** 売上セクション */
  sales: {
    title: string;
    lead: string;
    points: { title: string; body: string }[];
    sample: SalesSample[];
    caption: string;
    summary: { before: string; strong: string; after: string };
    band: string;
  };
  /** 比較セクションで自社以外の列に出す名前 */
  compareColumns: { legacy: string; generic: string };
  /** 「作っている人たち」 */
  founderChips: string[];
  /** 版ごとに差し替えるFAQ（共通FAQの前に差し込まれる） */
  extraFaqs: { q: string; a: string }[];
}

/* ------------------------------------------------------------------ */
/* Vertical 本体                                                       */
/* ------------------------------------------------------------------ */

export interface Vertical {
  slug: VerticalSlug;
  /** 「コンカフェ版」など。共通ブランド（みせ勤）の下につく版名 */
  label: string;
  /** 対象業態の呼び方。「コンカフェ」「シーシャ屋」 */
  industry: string;
  themeKey: ThemeKey;
  terms: Terms;
  /** 登録時に Organization.staffTerm へ入れる既定値（DBの enum 値） */
  defaultStaffTerm: "CAST" | "STAFF";
  lpTheme: LpTheme;
  images: LpImageSet;
  content: LpContent;
  defaults: VerticalDefaults;
  /**
   * シフトルール翻訳器のシステムプロンプトに差し込む業態の説明。
   * これは「解釈の仕方」なのでコピーせず参照でよい（翻訳結果はDBに保存済みのため、
   * あとから改善しても既存ルールは書き換わらない）。
   */
  translatorHint: string;
}
