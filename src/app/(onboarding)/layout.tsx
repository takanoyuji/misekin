import type { Metadata } from "next";

import { ThemeScope } from "@/components/layout/theme-scope";
import { getVerticalFromCookie } from "@/lib/verticals/server";

export const metadata: Metadata = {
  title: "初期設定 | みせ勤",
};

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 組織を作る直前まで、LPから来たトンマナを保つ
  const vertical = await getVerticalFromCookie();

  return <ThemeScope themeKey={vertical.themeKey}>{children}</ThemeScope>;
}
