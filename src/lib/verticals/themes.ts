/**
 * 業態版ごとの配色
 *
 * 値は16進で書く。LPの配色をそのまま持ち込むためで、globals.css の oklch と
 * 混在しても CSS カスタムプロパティとしては等価に扱える。
 *
 * CTAとプライマリの文字色は、必ず背景に対して 4.5:1 以上になる組み合わせにすること。
 * 明るいピンクに白抜き（3.8:1）はAA未達になる。
 */

import type { AppTheme, LpTheme, ThemeKey } from "./types";

/* ------------------------------------------------------------------ */
/* アプリ本体（アクセントのみ上書き）                                    */
/* ------------------------------------------------------------------ */

/**
 * 中立テーマ。複数業態を運営する組織で使う。
 * 値は globals.css の既定（インディゴ）と同じで、実質「上書きしない」状態。
 * どの業態にも寄らないが、他の版と同じ密度で設計された配色。
 */
const NEUTRAL_APP: AppTheme = {
  light: {
    primary: "oklch(0.513 0.234 264.585)",
    primaryForeground: "oklch(0.985 0 0)",
    accent: "oklch(0.94 0.04 264.585)",
    accentForeground: "oklch(0.513 0.234 264.585)",
    ring: "oklch(0.513 0.234 264.585)",
    chart1: "oklch(0.513 0.234 264.585)",
    sidebar: "oklch(0.98 0.005 264.585)",
    sidebarAccent: "oklch(0.94 0.04 264.585)",
  },
  dark: {
    primary: "oklch(0.673 0.18 264.585)",
    primaryForeground: "oklch(0.145 0 0)",
    accent: "oklch(0.25 0.04 264.585)",
    accentForeground: "oklch(0.673 0.18 264.585)",
    ring: "oklch(0.673 0.18 264.585)",
    chart1: "oklch(0.673 0.18 264.585)",
    sidebar: "oklch(0.18 0.01 264.585)",
    sidebarAccent: "oklch(0.25 0.04 264.585)",
  },
};

/** コンカフェ版：白×ピンク。#BE4285 は白抜きで 4.87:1（#CE5999 だと 3.8:1 で足りない） */
const CONCAFE_APP: AppTheme = {
  light: {
    primary: "#BE4285",
    primaryForeground: "#FFFFFF",
    accent: "#FDEFF6",
    accentForeground: "#A93A75",
    ring: "#BE4285",
    chart1: "#CE5999",
    sidebar: "#FFF9FC",
    sidebarAccent: "#FDEFF6",
  },
  dark: {
    primary: "#E77FB4",
    primaryForeground: "#1A0620",
    accent: "#3A1E2E",
    accentForeground: "#E77FB4",
    ring: "#E77FB4",
    chart1: "#E77FB4",
    sidebar: "#1B1218",
    sidebarAccent: "#3A1E2E",
  },
};

/** シーシャ版：深いグリーン×琥珀。#1E7A5E は白抜きで 5.25:1 */
const SHISHA_APP: AppTheme = {
  light: {
    primary: "#1E7A5E",
    primaryForeground: "#FFFFFF",
    accent: "#E6F3ED",
    accentForeground: "#186349",
    ring: "#1E7A5E",
    chart1: "#1E7A5E",
    sidebar: "#F7FBF9",
    sidebarAccent: "#E6F3ED",
  },
  dark: {
    primary: "#4FBF95",
    primaryForeground: "#07160F",
    accent: "#143024",
    accentForeground: "#4FBF95",
    ring: "#4FBF95",
    chart1: "#4FBF95",
    sidebar: "#0E1A15",
    sidebarAccent: "#143024",
  },
};

export const APP_THEMES: Record<ThemeKey, AppTheme> = {
  neutral: NEUTRAL_APP,
  concafe: CONCAFE_APP,
  shisha: SHISHA_APP,
};

/** CSS変数名。globals.css の :root / .dark で定義されているものを上書きする */
const APP_TOKEN_VARS: Record<keyof AppTheme["light"], string[]> = {
  primary: ["--primary", "--sidebar-primary"],
  primaryForeground: ["--primary-foreground", "--sidebar-primary-foreground"],
  accent: ["--accent"],
  accentForeground: ["--accent-foreground", "--sidebar-accent-foreground"],
  ring: ["--ring", "--sidebar-ring"],
  chart1: ["--chart-1"],
  sidebar: ["--sidebar"],
  sidebarAccent: ["--sidebar-accent"],
};

/**
 * アプリ本体に流し込むCSSを組み立てる。
 * ライトは要素スコープ、ダークは `.dark` 配下という前提で2ブロック出す。
 */
export function buildAppThemeCss(themeKey: ThemeKey, scopeAttr: string): string {
  const theme = APP_THEMES[themeKey];
  const decls = (mode: "light" | "dark") =>
    (Object.keys(APP_TOKEN_VARS) as (keyof AppTheme["light"])[])
      .flatMap((key) => APP_TOKEN_VARS[key].map((v) => `${v}:${theme[mode][key]}`))
      .join(";");

  return `[${scopeAttr}]{${decls("light")}}.dark [${scopeAttr}]{${decls("dark")}}`;
}

/* ------------------------------------------------------------------ */
/* LP                                                                  */
/* ------------------------------------------------------------------ */

/** コンカフェ版：白×ソフトピンク（配色は con-cafe.jp を参考にコントラストだけ調整） */
export const CONCAFE_LP: LpTheme = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  tint: "#FEF9FC",
  tint2: "#FDEFF6",
  line: "#F3E4EE",
  heading: "#3D3339",
  body: "#575757",
  muted: "#6E6269",
  brand: "#E498BD",
  brandDeep: "#CE5999",
  cta: "#D6335C",
  ctaHover: "#C22B51",
  ctaFg: "#FFFFFF",
  ok: "#4FB8A6",
  mark: "#FBDCEB",
  glow: "rgba(228,152,189,0.28)",
};

/** シーシャ版：深いグリーンの地に琥珀。落ち着いた暗色基調 */
export const SHISHA_LP: LpTheme = {
  bg: "#0B1512",
  card: "#12211C",
  tint: "#0E1B17",
  tint2: "#173029",
  line: "rgba(255,255,255,0.10)",
  heading: "#F2F7F4",
  body: "#C3D2CA",
  muted: "#9CB0A5",
  brand: "#4FBF95",
  brandDeep: "#7FD3B2",
  cta: "#D79A2B",
  ctaHover: "#C48A22",
  ctaFg: "#12211C",
  ok: "#4FBF95",
  // ハイライトはブランド色側で引く。琥珀を暗い地に重ねると濁って見えるため
  mark: "rgba(79,191,149,0.26)",
  glow: "rgba(79,191,149,0.22)",
};

/** LPのCSS変数（`--lp-*`）を style 属性用のオブジェクトにする */
export function lpThemeVars(theme: LpTheme): Record<string, string> {
  return {
    "--lp-bg": theme.bg,
    "--lp-card": theme.card,
    "--lp-tint": theme.tint,
    "--lp-tint-2": theme.tint2,
    "--lp-line": theme.line,
    "--lp-heading": theme.heading,
    "--lp-body": theme.body,
    "--lp-muted": theme.muted,
    "--lp-brand": theme.brand,
    "--lp-brand-deep": theme.brandDeep,
    "--lp-cta": theme.cta,
    "--lp-cta-hover": theme.ctaHover,
    "--lp-cta-fg": theme.ctaFg,
    "--lp-ok": theme.ok,
    "--lp-mark": theme.mark,
    "--lp-glow": theme.glow,
  };
}
