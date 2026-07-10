import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "みせ勤",
    template: "%s | みせ勤",
  },
  description: "複数店舗対応の勤怠管理システム。深夜営業・日またぎ勤務に対応。",
  robots: {
    index: false, // 業務ツールのため検索エンジンからは非表示
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansJP.variable} h-full`}
      style={{
        "--font-sans":
          "var(--font-geist-sans), var(--font-noto-sans-jp), ui-sans-serif, system-ui, sans-serif",
      } as React.CSSProperties}
    >
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">
          メインコンテンツへスキップ
        </a>
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
