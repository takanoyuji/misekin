/**
 * 業態版をログイン前の導線で引き継ぐためのクッキー
 *
 * LP（/shisha）を見た人が登録に進んだとき、トンマナと用語が途切れないようにする。
 * middleware から読み書きするので、重い依存を持たせないこと。
 */

import { VERTICAL_SLUGS } from "./types";
import type { VerticalSlug } from "./types";

export const VERTICAL_COOKIE = "misekin_vertical";

/** 30日。LPを見てから登録するまでの間だけ持てばよい */
export const VERTICAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** クッキーやクエリの値を、既知のスラッグに正規化する。未知なら null */
export function normalizeVerticalSlug(
  value: string | null | undefined
): VerticalSlug | null {
  if (!value) return null;
  const slug = value.toLowerCase();
  return (VERTICAL_SLUGS as readonly string[]).includes(slug)
    ? (slug as VerticalSlug)
    : null;
}
