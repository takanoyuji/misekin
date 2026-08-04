import { buildAppThemeCss } from "@/lib/verticals";
import type { ThemeKey } from "@/lib/verticals";

/**
 * 業態版のアクセント色を、この要素以下に流し込む。
 *
 * globals.css の `:root` / `.dark` に定義されたトークンのうち、アクセントだけを上書きする。
 * 背景・文字・境界のニュートラル階調はそのまま使うので、ライト/ダークの切替は壊れない。
 *
 * 入れ子にすると内側が勝つ（店舗ページで、その店舗の業態に寄せるのに使う）。
 */
export function ThemeScope({
  themeKey,
  className,
  children,
}: {
  themeKey: ThemeKey;
  className?: string;
  children: React.ReactNode;
}) {
  const attr = `data-misekin-theme="${themeKey}"`;
  return (
    <div data-misekin-theme={themeKey} className={className}>
      <style>{buildAppThemeCss(themeKey, attr)}</style>
      {children}
    </div>
  );
}
