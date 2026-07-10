import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "初期設定 | みせ勤",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
