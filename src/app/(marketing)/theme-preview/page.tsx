/**
 * 業態版のトンマナ確認ページ（開発用）
 *
 * ローカルにDBが無くてもアプリ本体の配色を目視できるようにするための画面。
 * 本番では 404 にしている。ThemeScope が上書きするトークン
 * （primary / accent / ring / sidebar / chart-1）を使う代表的なUIだけを並べる。
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  Clock,
  LayoutDashboard,
  Store,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeScope } from "@/components/layout/theme-scope";
import { APP_THEMES } from "@/lib/verticals";
import type { ThemeKey } from "@/lib/verticals";

export const metadata: Metadata = {
  title: "トンマナ確認（開発用）",
  robots: { index: false, follow: false },
};

const CASES: { key: ThemeKey; title: string; when: string }[] = [
  {
    key: "concafe",
    title: "コンカフェ版",
    when: "コンカフェ／メイドカフェの店舗しかない組織、およびその店舗のページ",
  },
  {
    key: "shisha",
    title: "シーシャ版",
    when: "シーシャ屋の店舗しかない組織、およびその店舗のページ",
  },
  {
    key: "neutral",
    title: "中立",
    when: "複数業態を運営する組織（どの店舗にも寄らない）",
  },
];

export default function ThemePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="min-h-dvh bg-neutral-100 p-6 sm:p-10">
      <header className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-neutral-900">
          業態版のトンマナ確認
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600">
          アプリ本体で上書きしているのは、アクセント系のトークンだけです（primary /
          accent / ring / sidebar / chart-1）。背景・文字・境界のニュートラル階調は
          globals.css のまま使うので、ライトとダークの切替は壊れません。
        </p>
      </header>

      <div className="mx-auto mt-8 max-w-6xl space-y-10">
        {CASES.map((c) => (
          <section key={c.key}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-bold text-neutral-900">{c.title}</h2>
              <p className="text-xs text-neutral-500">{c.when}</p>
              <code className="rounded bg-neutral-200 px-1.5 py-0.5 font-mono text-[11px] text-neutral-700">
                {APP_THEMES[c.key].light.primary}
              </code>
            </div>

            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              <ModeFrame label="ライト">
                <ThemeScope themeKey={c.key}>
                  <Sample />
                </ThemeScope>
              </ModeFrame>
              <ModeFrame label="ダーク" dark>
                <ThemeScope themeKey={c.key}>
                  <Sample />
                </ThemeScope>
              </ModeFrame>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ModeFrame({
  label,
  dark,
  children,
}: {
  label: string;
  dark?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-300 bg-white">
      <p className="border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600">
        {label}
      </p>
      <div className={dark ? "dark" : undefined}>{children}</div>
    </div>
  );
}

const NAV = [
  { label: "ホーム", icon: LayoutDashboard, active: false },
  { label: "勤怠管理", icon: Clock, active: false },
  { label: "シフト管理", icon: CalendarDays, active: true },
  { label: "キャスト", icon: Users, active: false },
  { label: "店舗", icon: Store, active: false },
];

/** アプリ本体の代表的なUI。実際に使っているトークンだけで組んでいる */
function Sample() {
  return (
    <div className="flex bg-background text-foreground">
      {/* サイドバー */}
      <aside className="w-44 shrink-0 border-r border-sidebar-border bg-sidebar p-2.5">
        <p className="flex items-center gap-2 px-2 py-2 text-sm font-bold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Clock className="size-4" />
          </span>
          みせ勤
        </p>
        <nav className="mt-2 flex flex-col gap-0.5">
          {NAV.map((n) => (
            <span
              key={n.label}
              className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm ${
                n.active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <n.icon className="size-4" />
              {n.label}
            </span>
          ))}
        </nav>
      </aside>

      {/* 本文 */}
      <div className="flex-1 space-y-4 p-4">
        <div>
          <h3 className="text-base font-bold">シフト管理</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            希望を集めて、AIでシフトを作成します
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button>AIでシフトを作る</Button>
          <Button variant="outline">下書きを保存</Button>
          <Button variant="secondary">公開する</Button>
          <Button variant="link">シフトルールを開く</Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">7月の遅番</p>
            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
              下書き
            </span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              defaultValue="金土の遅番は4人、平日は2人"
              readOnly
              className="min-h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm ring-2 ring-ring outline-none"
              aria-label="フォーカス時のリングの見え方"
            />
            <Button size="sm">追加</Button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            ↑ 入力欄はフォーカス時の ring を再現しています
          </p>

          {/* 充足状況のバー（chart-1 を使う） */}
          <div className="mt-4 flex h-16 items-end gap-1.5">
            {[42, 38, 45, 52, 88, 100, 61].map((h, i) => (
              <div
                key={i}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <div
                  className="w-full rounded-t-[3px] bg-chart-1"
                  style={{ height: `${h * 0.75}%` }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {["月", "火", "水", "木", "金", "土", "日"][i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ステータス色は業態版で変えない（状態を表す色は共通） */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-working/10 px-2.5 py-1 font-medium text-status-working">
            <span className="size-1.5 rounded-full bg-status-working" />
            勤務中
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-break/10 px-2.5 py-1 font-medium text-status-break">
            <span className="size-1.5 rounded-full bg-status-break" />
            休憩中
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-missing/10 px-2.5 py-1 font-medium text-status-missing">
            <span className="size-1.5 rounded-full bg-status-missing" />
            退勤漏れ
          </span>
        </div>
      </div>
    </div>
  );
}
