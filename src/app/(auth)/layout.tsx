import { ThemeScope } from "@/components/layout/theme-scope";
import { getVerticalFromCookie } from "@/lib/verticals/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // LPから来た人のトンマナと言葉を引き継ぐ（middleware がクッキーに入れている）
  const vertical = await getVerticalFromCookie();

  return (
    <ThemeScope
      themeKey={vertical.themeKey}
      className="min-h-screen bg-background flex flex-col items-center justify-center p-4"
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">みせ勤</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {vertical.industry}のためのシフト＆勤怠管理
          </p>
        </div>
        {children}
      </div>
    </ThemeScope>
  );
}
