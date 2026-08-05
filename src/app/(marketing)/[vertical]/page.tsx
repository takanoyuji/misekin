/**
 * 業態版LPの共通テンプレート
 *
 * コピー・画像・配色はすべて `@/lib/verticals` のレジストリから来る。
 * ここに業態名やハードコードした色を書かないこと（版が増えるたびに壊れる）。
 *
 * ⚠️ 未公開ドラフト。以下は「実装済み」の前提で書いてある。
 *    公開前に実装を揃えるか、該当の文言を落とすこと（詳細は docs/lp-marketing.md §4）。
 *      1) 売上データの取り込み（日次入力・CSV）と、必要人数の自動提案
 *      2) SALES_PRIORITY — 売上・指名の実績を持つ人を繁忙日へ優先配置（ソルバー未実装）
 *      3) ルールテンプレート12種のワンクリック入力（画面未実装）
 *      4) PAIR_AVOID — 「この2人は同じ日に入れない」（ソルバー未実装）
 *    公開するときは generateMetadata の robots を index: true に戻す。
 */
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  ClipboardCheck,
  Clock4,
  FileSpreadsheet,
  Heart,
  KeyRound,
  Languages,
  Megaphone,
  Moon,
  QrCode,
  ScrollText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Timer,
  TrendingUp,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";

import {
  VERTICAL_SLUGS,
  buildSharedContent,
  getVertical,
  lpThemeVars,
} from "@/lib/verticals";
import type {
  FeatureIcon,
  SharedContent,
  StepIcon,
  TrustIcon,
  Vertical,
} from "@/lib/verticals";

/**
 * リリース前の告知
 *
 * まだ公開していないので、そのことがはっきり伝わるようにしておく。
 * 正式リリース時に PRERELEASE を null にすれば、バッジも注記も文言も一斉に戻る。
 */
const PRERELEASE: {
  badge: string;
  notice: string;
  ctaLabel: string;
  ctaLabelShort: string;
  microCopy: string;
} | null = {
  badge: "近日リリース",
  notice:
    "みせ勤はまだ公開前のサービスです。正式リリースに向けて、先行して使ってくださるお店を探しています。",
  ctaLabel: "先行利用に登録する",
  // ヘッダーは幅が狭いので短い方を使う
  ctaLabelShort: "先行登録",
  microCopy: "近日リリース・クレジットカード不要・お店の登録は3分",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return VERTICAL_SLUGS.map((vertical) => ({ vertical }));
}

interface PageProps {
  params: Promise<{ vertical: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { title, description } = getVertical((await params).vertical).content;
  const v = getVertical((await params).vertical);
  return {
    title,
    description,
    // 未公開ドラフトのため noindex。公開時に index: true へ戻す（冒頭のコメント参照）
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: v.images.hero.src }],
    },
  };
}

/* ------------------------------------------------------------------ */
/* アイコン                                                            */
/* ------------------------------------------------------------------ */

type IconComponent = React.ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

const STEP_ICONS: Record<StepIcon, IconComponent> = {
  phone: Smartphone,
  sparkles: Sparkles,
  check: BadgeCheck,
};

const FEATURE_ICONS: Record<FeatureIcon, IconComponent> = {
  trend: TrendingUp,
  sparkles: Sparkles,
  language: Languages,
  calendar: CalendarClock,
  qr: QrCode,
  alert: TriangleAlert,
  clipboard: ClipboardCheck,
  moon: Moon,
  users: Users,
  sheet: FileSpreadsheet,
};

const TRUST_ICONS: Record<TrustIcon, IconComponent> = {
  log: ScrollText,
  shield: ShieldCheck,
  badge: BadgeCheck,
  key: KeyRound,
};

const SALES_ICONS: IconComponent[] = [TrendingUp, Users, Sparkles];

/* ------------------------------------------------------------------ */
/* ページ                                                              */
/* ------------------------------------------------------------------ */

export default async function VerticalLandingPage({ params }: PageProps) {
  const v = getVertical((await params).vertical);
  const shared = buildSharedContent(v.terms, v.industry);
  const faqs = [...v.content.extraFaqs, ...shared.faqs];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const isDark = v.themeKey === "shisha";

  return (
    <div
      className="flex min-h-dvh flex-col bg-[var(--lp-bg)] font-sans text-[var(--lp-body)] antialiased"
      style={lpThemeVars(v.lpTheme) as React.CSSProperties}
    >
      {/* LPの地色をhtmlにも敷く。アプリ本体のテーマ設定には影響しない */}
      <style>{`html{background:${v.lpTheme.bg};color-scheme:${isDark ? "dark" : "light"}}`}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <SiteHeader v={v} />

      <main id="main-content" className="flex-1">
        <Hero v={v} />
        <Pains v={v} />
        <AiShift v={v} shared={shared} />
        <SalesSection v={v} />
        <Compare v={v} shared={shared} />
        <LawSection shared={shared} />
        <Features shared={shared} />
        <Pricing v={v} shared={shared} />
        <Founder v={v} shared={shared} />
        <Trust shared={shared} />
        <Faq faqs={faqs} />
        <FinalCta v={v} shared={shared} />
      </main>

      <SiteFooter />
      <StickyCta />
    </div>
  );
}

/* ------------------------------- Header ------------------------------ */

function SiteHeader({ v }: { v: Vertical }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--lp-line)] bg-[var(--lp-bg)]/92 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <p className="flex shrink-0 items-center gap-2 text-base font-bold tracking-tight whitespace-nowrap text-[var(--lp-heading)]">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-2xl bg-[var(--lp-brand)] text-[var(--lp-bg)]"
          >
            <Clock4 className="size-5" strokeWidth={2.4} />
          </span>
          みせ勤
          <span className="hidden rounded-full bg-[var(--lp-tint-2)] px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-[var(--lp-brand-deep)] sm:inline">
            {v.label}
          </span>
          {PRERELEASE && (
            <span className="hidden rounded-full border border-[var(--lp-cta)] px-2.5 py-1 text-[11px] font-bold whitespace-nowrap text-[var(--lp-cta)] xs:inline sm:inline">
              {PRERELEASE.badge}
            </span>
          )}
        </p>

        <div className="flex items-center gap-1.5">
          <Link
            href="/login"
            className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-medium text-[var(--lp-muted)] transition-colors duration-200 hover:text-[var(--lp-heading)] sm:inline-flex"
          >
            ログイン
          </Link>
          <CtaLink v={v} size="sm" />
        </div>
      </div>
    </header>
  );
}

/* -------------------------------- Hero ------------------------------- */

function Hero({ v }: { v: Vertical }) {
  const { hero } = v.content;
  return (
    <section className="relative overflow-hidden bg-[var(--lp-tint)]">
      <Dots className="absolute -top-10 -left-10 hidden lg:block" />
      <Dots className="absolute right-[-2rem] bottom-[-2rem] hidden lg:block" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-[var(--lp-card)] px-4 py-2 text-xs font-bold text-[var(--lp-brand-deep)] shadow-[0_2px_10px_var(--lp-glow)] sm:text-sm">
            <Sparkles className="size-4" aria-hidden="true" />
            {hero.eyebrow}
          </p>

          <h1 className="mt-6 text-[2.05rem] font-extrabold leading-[1.32] tracking-tight text-balance text-[var(--lp-heading)] sm:text-[2.6rem] lg:text-[2.9rem]">
            {hero.line1}
            <br />
            <Mark>{hero.line2}</Mark>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-[1.9] sm:text-lg">
            {hero.sub}
          </p>

          {PRERELEASE && (
            <p className="mt-6 flex items-start gap-2.5 rounded-2xl border border-[var(--lp-cta)] bg-[var(--lp-card)] p-4 text-sm leading-relaxed text-[var(--lp-heading)]">
              <Megaphone
                className="mt-0.5 size-4 shrink-0 text-[var(--lp-cta)]"
                aria-hidden="true"
              />
              <span>
                <strong className="font-bold text-[var(--lp-cta)]">
                  {PRERELEASE.badge}
                </strong>
                　{PRERELEASE.notice}
              </span>
            </p>
          )}

          <div className="mt-9">
            <CtaLink v={v} />
            <CtaMicroCopy v={v} />
          </div>

          <ul className="mt-8 flex flex-wrap gap-2.5">
            {hero.chips.map((t) => (
              <li
                key={t}
                className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lp-card)] px-3.5 py-2 text-sm font-medium text-[var(--lp-heading)] shadow-[0_2px_8px_var(--lp-glow)]"
              >
                <Heart
                  className="size-3.5 text-[var(--lp-brand)]"
                  aria-hidden="true"
                  fill="currentColor"
                />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <ShiftMock v={v} />
      </div>
    </section>
  );
}

/** シフト作成画面のイメージ（実データではない静的モック） */
function ShiftMock({ v }: { v: Vertical }) {
  const { mock } = v.content;

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div
        aria-hidden="true"
        className="absolute -inset-3 -z-10 rounded-[2.5rem] bg-[var(--lp-brand)] opacity-15 blur-2xl"
      />
      <div
        role="img"
        aria-label={`シフト作成画面のイメージ。${mock.slotLabel}の3日ぶんの割り当てと、必要人数を満たしていない日の注意が表示されている。`}
        className="rounded-[1.75rem] border border-[var(--lp-line)] bg-[var(--lp-card)] p-5 shadow-[0_18px_50px_var(--lp-glow)]"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-[var(--lp-heading)]">
            7月のシフト
          </p>
          <span className="rounded-full bg-[var(--lp-tint-2)] px-3 py-1 text-xs font-bold text-[var(--lp-brand-deep)]">
            {mock.slotLabel}
          </span>
        </div>

        <table className="mt-4 w-full border-separate border-spacing-y-1 text-center text-xs">
          <caption className="sr-only">
            {mock.slotLabel}の割り当て表（イメージ）
          </caption>
          <thead>
            <tr className="text-[var(--lp-muted)]">
              <th scope="col" className="w-[34%] text-left font-medium">
                {v.terms.staff}
              </th>
              {mock.days.map((d) => (
                <th
                  key={d.label}
                  scope="col"
                  className="font-medium tabular-nums"
                >
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mock.people.map((c) => (
              <tr key={c.name}>
                <th
                  scope="row"
                  className="text-left text-sm font-medium text-[var(--lp-heading)]"
                >
                  {c.name}
                </th>
                {c.on.map((on, i) => (
                  <td key={i} className="py-1">
                    <span
                      className={`mx-auto flex size-7 items-center justify-center rounded-lg text-xs font-bold ${
                        on
                          ? "bg-[var(--lp-tint-2)] text-[var(--lp-brand-deep)]"
                          : "bg-[var(--lp-tint)] text-[var(--lp-muted)]"
                      }`}
                    >
                      {on ? "出" : "−"}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th
                scope="row"
                className="pt-2 text-left text-xs font-medium text-[var(--lp-muted)]"
              >
                必要人数
              </th>
              {mock.days.map((d) => (
                <td key={d.label} className="pt-2">
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      d.filled >= d.need
                        ? "text-[var(--lp-ok)]"
                        : "text-[var(--lp-cta)]"
                    }`}
                  >
                    {d.filled}/{d.need}
                  </span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>

        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-[var(--lp-tint)] px-3 py-2.5 text-xs leading-relaxed text-[var(--lp-cta)]">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {mock.note}
        </p>

        <div className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--lp-cta)] text-sm font-bold text-[var(--lp-cta-fg)]">
          <Sparkles className="size-4" aria-hidden="true" />
          AIでシフトを作る
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- 課題 -------------------------------- */

function Pains({ v }: { v: Vertical }) {
  const { pains, painsClosing } = v.content;
  return (
    <Section eyebrow="よくあるお悩み" title="こんなシフトに、なっていませんか。">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {pains.map((p) => (
            <li
              key={p}
              className="flex items-start gap-3 rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-tint)] p-4"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--lp-card)] text-[var(--lp-cta)]"
              >
                <X className="size-3.5" strokeWidth={3} />
              </span>
              <span className="text-[15px] leading-relaxed text-[var(--lp-heading)]">
                {p}
              </span>
            </li>
          ))}
        </ul>

        <Image
          src={v.images.pains}
          alt={v.images.alt.pains}
          placeholder="blur"
          sizes="(min-width: 1024px) 38vw, 100vw"
          className="h-64 w-full rounded-[1.75rem] object-cover lg:h-80"
        />
      </div>

      <p className="mt-8 text-lg font-bold leading-relaxed text-balance text-[var(--lp-heading)] sm:text-xl">
        {painsClosing.before}
        <Mark>{painsClosing.mark}</Mark>
        {painsClosing.after}
      </p>
    </Section>
  );
}

/* --------------------------- AIシフト（主役） -------------------------- */

function AiShift({ v, shared }: { v: Vertical; shared: SharedContent }) {
  return (
    <section className="border-y border-[var(--lp-line)] bg-[var(--lp-tint)]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="みせ勤ができること"
          title="希望を集めて、ボタンを押すだけ"
          lead="シフト希望の収集から公開まで、みせ勤の中で完結します。集めた希望はそのままAIの入力になるので、転記も突き合わせも要りません。3ステップで公開までいけます。"
        />

        <ol className="mt-12 grid gap-4 sm:grid-cols-3">
          {shared.shiftSteps.map((step) => {
            const Icon = STEP_ICONS[step.icon];
            return (
              <li
                key={step.no}
                className="rounded-[1.5rem] border border-[var(--lp-line)] bg-[var(--lp-card)] p-6"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-11 items-center justify-center rounded-2xl bg-[var(--lp-tint-2)] text-[var(--lp-brand-deep)]"
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="font-mono text-sm font-bold tabular-nums text-[var(--lp-brand)]">
                    STEP {step.no}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-bold text-[var(--lp-heading)]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed">{step.body}</p>
              </li>
            );
          })}
        </ol>

        {/* ルールテンプレート */}
        <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-[var(--lp-line)] bg-[var(--lp-card)]">
          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-12">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-[var(--lp-tint-2)] px-3.5 py-1.5 text-xs font-bold text-[var(--lp-brand-deep)]">
                <Languages className="size-4" aria-hidden="true" />
                {v.industry}用のルールが、最初から入っている
              </p>
              <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-balance text-[var(--lp-heading)] sm:text-[1.75rem]">
                {v.content.rulesHeading.line1}
                <br />
                <Mark>{v.content.rulesHeading.mark}</Mark>
              </h3>
              <p className="mt-5 leading-[1.9]">{v.content.rulesBody}</p>
              <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-[var(--lp-muted)]">
                <Sparkles
                  className="mt-0.5 size-4 shrink-0 text-[var(--lp-brand)]"
                  aria-hidden="true"
                />
                書き足した文章も、読み取った内容が画面に表示されます。意図と違っていれば、その場で直せます。
              </p>
            </div>

            <div className="rounded-[1.5rem] bg-[var(--lp-tint)] p-5 sm:p-6">
              <p className="text-xs font-bold text-[var(--lp-muted)]">
                入っているルール（一部を編集できます）
              </p>
              <ul className="mt-4 space-y-2.5">
                {v.defaults.rules.map((r) => (
                  <li
                    key={r.text}
                    className="flex items-center gap-3 rounded-2xl bg-[var(--lp-card)] px-4 py-3 text-sm shadow-[0_1px_4px_var(--lp-glow)]"
                  >
                    <span className="shrink-0 rounded-full bg-[var(--lp-tint-2)] px-2 py-0.5 text-[11px] font-bold text-[var(--lp-brand-deep)]">
                      {r.tag}
                    </span>
                    <span className="text-[var(--lp-heading)]">{r.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------ 売上から逆算する ---------------------------- */

function SalesSection({ v }: { v: Vertical }) {
  const { sales } = v.content;
  return (
    <Section eyebrow="売上から逆算する" title={sales.title} lead={sales.lead}>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-10">
        <SalesChart v={v} />

        <div className="grid gap-4">
          {sales.points.map((p, i) => {
            const Icon = SALES_ICONS[i] ?? TrendingUp;
            return (
              <div
                key={p.title}
                className="flex gap-4 rounded-[1.5rem] border border-[var(--lp-line)] bg-[var(--lp-card)] p-5"
              >
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--lp-tint-2)] text-[var(--lp-brand-deep)]"
                >
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-[var(--lp-heading)]">
                    {p.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed">{p.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-[1.75rem]">
        <div className="relative isolate">
          <Image
            src={v.images.band}
            alt=""
            sizes="(min-width: 1024px) 72rem, 100vw"
            placeholder="blur"
            className="h-48 w-full object-cover sm:h-56"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(90deg,var(--lp-bg)_0%,color-mix(in_srgb,var(--lp-bg)_82%,transparent)_45%,color-mix(in_srgb,var(--lp-bg)_25%,transparent)_100%)]"
          />
          <p className="absolute inset-0 flex items-center px-6 text-base font-bold leading-relaxed text-balance text-[var(--lp-heading)] sm:px-12 sm:text-xl">
            {sales.band}
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[var(--lp-muted)]">
        ※
        売上は画面から入力するか、CSVで取り込めます。3〜4週間ぶんたまると傾向が出ます。提案された人数は、店長がいつでも上書きできます。
      </p>
    </Section>
  );
}

/** 曜日別売上とAI推奨人数のイメージ（実データではない静的モック） */
function SalesChart({ v }: { v: Vertical }) {
  const { sample, caption, summary } = v.content.sales;
  const max = Math.max(...sample.map((d) => d.index));
  // 「山がある」ことを一目で伝えるのが役目なので、ピークだけ濃く塗って
  // 残りは同じ色相を薄くする。7本を同じ色で並べると山が消える。
  const isPeak = (index: number) => index >= max * 0.9;
  const label = sample.map((d) => `${d.day}${d.index}`).join("、");
  // 棒・曜日・人数を別の行に分ける。列幅は3行とも flex-1 + 同じ gap で揃える
  const row = "flex gap-1.5 sm:gap-2";

  return (
    <figure className="rounded-[1.75rem] border border-[var(--lp-line)] bg-[var(--lp-card)] p-6 shadow-[0_12px_36px_var(--lp-glow)] sm:p-7">
      <figcaption className="text-sm font-bold text-[var(--lp-heading)]">
        {caption}
        <span className="mt-1 block text-xs font-normal text-[var(--lp-muted)]">
          もっとも多い曜日を100としたときの割合
        </span>
      </figcaption>

      {/* 見た目のグラフ。読み上げは下の表が担当する */}
      <div aria-hidden="true" className="mt-7">
        {/* 棒。高さを揃えた箱の中で下から伸ばす。
            items-end を付けると列が親の高さを継承せず、棒の % が効かなくなる */}
        <div className={`${row} h-36 items-stretch`}>
          {sample.map((d) => {
            const peak = isPeak(d.index);
            return (
              <div
                key={d.day}
                className="flex flex-1 flex-col items-center justify-end gap-1.5"
              >
                {peak ? (
                  <span className="font-mono text-[11px] font-bold leading-none tabular-nums text-[var(--lp-brand-deep)]">
                    {d.index}
                  </span>
                ) : null}
                <div
                  className={`w-full rounded-t-[5px] ${
                    peak
                      ? "bg-[var(--lp-brand-deep)] shadow-[0_2px_10px_var(--lp-glow)]"
                      : "bg-[var(--lp-mark)]"
                  }`}
                  style={{ height: `${Math.max((d.index / max) * 100, 5)}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* 基線は1本の連続した線にする（列ごとに引くと破線に見える） */}
        <div className="border-t border-[var(--lp-line)]" />

        <div className={`${row} pt-2`}>
          {sample.map((d) => (
            <span
              key={d.day}
              className={`flex-1 text-center text-xs font-bold ${
                isPeak(d.index)
                  ? "text-[var(--lp-heading)]"
                  : "text-[var(--lp-muted)]"
              }`}
            >
              {d.day}
            </span>
          ))}
        </div>

        {/* 提案人数は売上とは別の指標なので、棒ではなくチップで添える */}
        <div className={`${row} mt-2`}>
          {sample.map((d) => (
            <span key={d.day} className="flex flex-1 justify-center">
              <span
                className={`inline-flex size-6 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums ${
                  isPeak(d.index)
                    ? "bg-[var(--lp-tint-2)] text-[var(--lp-brand-deep)]"
                    : "text-[var(--lp-muted)]"
                }`}
              >
                {d.need}
              </span>
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-[var(--lp-muted)]">
        下の数字は、その曜日に提案される人数
      </p>

      {/* 読み上げ・コピー用。目では上のグラフ、値はこちらで担保する */}
      <table className="sr-only">
        <caption>
          曜日ごとの売上の割合（{label}）と、AIが提案する必要人数
        </caption>
        <thead>
          <tr>
            <th scope="col">曜日</th>
            <th scope="col">売上の割合</th>
            <th scope="col">提案人数</th>
          </tr>
        </thead>
        <tbody>
          {sample.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>{d.index}</td>
              <td>{d.need}人</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-5 rounded-2xl bg-[var(--lp-tint)] px-4 py-3 text-sm leading-relaxed text-[var(--lp-heading)]">
        {summary.before}
        <strong className="font-bold text-[var(--lp-brand-deep)]">
          {summary.strong}
        </strong>
        {summary.after}
      </p>
    </figure>
  );
}

/* ------------------------------- 比較 -------------------------------- */

function Compare({ v, shared }: { v: Vertical; shared: SharedContent }) {
  const cols = v.content.compareColumns;
  return (
    <section className="border-y border-[var(--lp-line)] bg-[var(--lp-tint)]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="今のやり方と、どう違うのか"
          title={`Excelでも、普通の勤怠アプリでも、${v.industry}のシフトは組めません`}
          lead="一般的な勤怠アプリは打刻と集計が主役で、シフトは手で組む前提のものがほとんどです。業態ごとのルールを入れる場所が、そもそもありません。"
        />

        <div className="mt-12">
          {/* モバイルはカード表示（横スクロールだと「みせ勤」列が画面外に出るため） */}
          <ul className="space-y-3 md:hidden">
            {shared.compareRows.map((row) => (
              <li
                key={row.label}
                className="rounded-[1.5rem] border border-[var(--lp-line)] bg-[var(--lp-card)] p-5"
              >
                <p className="font-bold text-[var(--lp-heading)]">{row.label}</p>
                <ul className="mt-3.5 space-y-2.5">
                  <MobileCompareItem
                    name="みせ勤"
                    value={row.misekin}
                    highlight
                  />
                  <MobileCompareItem name={cols.legacy} value={row.legacy} />
                  <MobileCompareItem name={cols.generic} value={row.generic} />
                </ul>
              </li>
            ))}
          </ul>

          <div className="hidden md:block">
            <table className="w-full border-separate border-spacing-0 text-left text-sm">
              <caption className="sr-only">
                {cols.legacy}・{cols.generic}・みせ勤の比較
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="w-[22%] p-3" />
                  <th
                    scope="col"
                    className="w-[26%] rounded-t-2xl bg-[var(--lp-card)] p-4 text-sm font-bold text-[var(--lp-muted)]"
                  >
                    {cols.legacy}
                  </th>
                  <th
                    scope="col"
                    className="w-[26%] rounded-t-2xl bg-[var(--lp-card)] p-4 text-sm font-bold text-[var(--lp-muted)]"
                  >
                    {cols.generic}
                  </th>
                  <th
                    scope="col"
                    className="w-[26%] rounded-t-2xl bg-[var(--lp-tint-2)] p-4 text-base font-extrabold text-[var(--lp-brand-deep)]"
                  >
                    みせ勤
                  </th>
                </tr>
              </thead>
              <tbody>
                {shared.compareRows.map((row, i) => {
                  const last = i === shared.compareRows.length - 1;
                  return (
                    <tr key={row.label}>
                      <th
                        scope="row"
                        className="p-4 align-top text-sm font-bold text-[var(--lp-heading)]"
                      >
                        {row.label}
                      </th>
                      <Cell value={row.legacy} last={last} />
                      <Cell value={row.generic} last={last} />
                      <Cell value={row.misekin} highlight last={last} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileCompareItem({
  name,
  value,
  highlight,
}: {
  name: string;
  value: { ok: boolean; text: string };
  highlight?: boolean;
}) {
  return (
    <li
      className={`flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${
        highlight
          ? "bg-[var(--lp-tint-2)] text-[var(--lp-heading)]"
          : "bg-[var(--lp-tint)] text-[var(--lp-muted)]"
      }`}
    >
      <StatusIcon ok={value.ok} highlight={highlight} />
      <span>
        <span
          className={`font-bold ${highlight ? "text-[var(--lp-brand-deep)]" : ""}`}
        >
          {name}
        </span>
        <span className="mx-1.5" aria-hidden="true">
          /
        </span>
        {value.text}
      </span>
    </li>
  );
}

function Cell({
  value,
  highlight,
  last,
}: {
  value: { ok: boolean; text: string };
  highlight?: boolean;
  last?: boolean;
}) {
  return (
    <td
      className={[
        "border-t border-[var(--lp-line)] p-4 align-top text-sm leading-relaxed",
        highlight
          ? "bg-[var(--lp-tint-2)] text-[var(--lp-heading)]"
          : "bg-[var(--lp-card)] text-[var(--lp-muted)]",
        last ? "rounded-b-2xl" : "",
      ].join(" ")}
    >
      <span className="flex items-start gap-2">
        <StatusIcon ok={value.ok} highlight={highlight} />
        {value.text}
      </span>
    </td>
  );
}

function StatusIcon({ ok, highlight }: { ok: boolean; highlight?: boolean }) {
  return ok ? (
    <Check
      className={`mt-0.5 size-4 shrink-0 ${
        highlight ? "text-[var(--lp-brand-deep)]" : "text-[var(--lp-ok)]"
      }`}
      aria-hidden="true"
      strokeWidth={3}
    />
  ) : (
    <X
      className="mt-0.5 size-4 shrink-0 text-[var(--lp-muted)] opacity-60"
      aria-hidden="true"
      strokeWidth={3}
    />
  );
}

/* ------------------------------ 法改正 ------------------------------- */

function LawSection({ shared }: { shared: SharedContent }) {
  const icons = [Timer, CalendarClock, ScrollText];
  return (
    <Section
      eyebrow="2027年に向けて"
      title="次の法改正は、シフト制のお店をまっすぐ直撃します"
      lead="厚生労働省の研究会が示した方向のとおりに進めば、深夜営業のシフトは今のままでは組めなくなります。手書きの表とLINEでは、そもそも違反しているかどうかに気づけません。"
    >
      <ul className="grid gap-4 sm:grid-cols-3">
        {shared.lawItems.map((item, i) => {
          const Icon = icons[i] ?? Timer;
          return (
            <li
              key={item.title}
              className="rounded-[1.5rem] border border-[var(--lp-line)] bg-[var(--lp-tint)] p-6"
            >
              <span
                aria-hidden="true"
                className="flex size-11 items-center justify-center rounded-2xl bg-[var(--lp-card)] text-[var(--lp-cta)]"
              >
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-[var(--lp-heading)]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed">{item.body}</p>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 max-w-3xl text-xs leading-relaxed text-[var(--lp-muted)]">
        出典：厚生労働省「労働基準関係法制研究会
        報告書」（2025年1月）。いずれも施行前の検討段階の内容であり、最終的な制度は今後の法案・省令で変わる可能性があります。みせ勤は、シフトを作るときの条件として設定・チェックできる形で対応します。
      </p>
    </Section>
  );
}

/* ------------------------------ 機能一覧 ------------------------------ */

function Features({ shared }: { shared: SharedContent }) {
  return (
    <section className="border-y border-[var(--lp-line)] bg-[var(--lp-tint)]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="できること"
          title="お店の1ヶ月が、これで一周する"
          lead="シフト作りだけでなく、打刻・修正の承認・締め処理・給与ソフトへの受け渡しまで。途中でExcelに戻る場面をなくしました。"
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shared.features.map((f) => {
            const Icon = FEATURE_ICONS[f.icon];
            return (
              <li
                key={f.title}
                className="rounded-[1.5rem] border border-[var(--lp-line)] bg-[var(--lp-card)] p-6 transition-colors duration-200 hover:border-[var(--lp-brand)]"
              >
                <span
                  aria-hidden="true"
                  className="flex size-11 items-center justify-center rounded-2xl bg-[var(--lp-tint-2)] text-[var(--lp-brand-deep)]"
                >
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-[var(--lp-heading)]">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed">{f.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------- 料金 -------------------------------- */

function Pricing({ v, shared }: { v: Vertical; shared: SharedContent }) {
  return (
    <Section eyebrow="料金" title="先行して使ってくださる間は、無料">
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="max-w-xl leading-[1.9]">{shared.pricing.lead}</p>

          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {shared.pricing.chips.map((t) => (
              <li
                key={t}
                className="flex items-center gap-2.5 rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-tint)] px-4 py-3.5 text-sm font-bold text-[var(--lp-heading)]"
              >
                <Check
                  className="size-4 shrink-0 text-[var(--lp-brand-deep)]"
                  aria-hidden="true"
                  strokeWidth={3}
                />
                {t}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-sm leading-relaxed text-[var(--lp-muted)]">
            {shared.pricing.note}
          </p>

          <div className="mt-9">
            <CtaLink v={v} />
            <CtaMicroCopy v={v} />
          </div>
        </div>

        <Image
          src={v.images.pricing}
          alt={v.images.alt.pricing}
          placeholder="blur"
          sizes="(min-width: 1024px) 44vw, 100vw"
          className="h-64 w-full rounded-[1.75rem] object-cover lg:h-96"
        />
      </div>
    </Section>
  );
}

/* ---------------------------- 当事者ストーリー -------------------------- */

function Founder({ v, shared }: { v: Vertical; shared: SharedContent }) {
  return (
    <section className="border-y border-[var(--lp-line)] bg-[var(--lp-tint)]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="作っている人たち"
          title="現場で毎日使っています"
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-12">
          <div className="space-y-5 leading-[1.9]">
            {shared.founder.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
            <ul className="grid gap-3 pt-2 sm:grid-cols-2">
              {v.content.founderChips.map((t) => (
                <li
                  key={t}
                  className="flex items-center gap-2.5 rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-card)] px-4 py-3 text-sm font-medium text-[var(--lp-heading)]"
                >
                  <Heart
                    className="size-4 shrink-0 text-[var(--lp-brand)]"
                    aria-hidden="true"
                    fill="currentColor"
                  />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* 自分たちの現場の写真を出す。フリー素材では「現場で使っている」の裏づけにならない。
              一方で、運営している店舗の屋号やロゴはここに出さない。
              運営元も同じ業態なので、店名が並ぶと見込み客からは「競合に数字を見られる」
              という具体像が立つ。同じ懸念には、店名を伏せることではなくFAQで正面から答える */}
          <div>
            {v.images.cast && (
              <Image
                src={v.images.cast}
                alt={v.images.castAlt ?? ""}
                placeholder="blur"
                sizes="(min-width: 1024px) 42vw, 100vw"
                className="h-64 w-full rounded-[1.5rem] object-cover sm:h-80"
              />
            )}
          </div>
        </div>

      </div>
    </section>
  );
}

/* ------------------------------- 信頼性 ------------------------------- */

function Trust({ shared }: { shared: SharedContent }) {
  return (
    <Section
      eyebrow="安心して任せるために"
      title="勤怠は、お給料の根拠になるデータ"
      lead="あとから「誰が何を変えたのか」を説明できることを前提に設計しています。"
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {shared.trust.map((t) => {
          const Icon = TRUST_ICONS[t.icon];
          return (
            <li
              key={t.title}
              className="flex gap-4 rounded-[1.5rem] border border-[var(--lp-line)] bg-[var(--lp-tint)] p-6"
            >
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--lp-card)] text-[var(--lp-brand-deep)]"
              >
                <Icon className="size-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-[var(--lp-heading)]">
                  {t.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed">{t.body}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* -------------------------------- FAQ -------------------------------- */

function Faq({ faqs }: { faqs: { q: string; a: string }[] }) {
  return (
    <section className="border-t border-[var(--lp-line)] bg-[var(--lp-tint)]">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading eyebrow="よくある質問" title="はじめる前の疑問" />

        <div className="mt-10 space-y-3">
          {faqs.map(({ q, a }) => (
            <details
              key={q}
              name="misekin-faq"
              className="group rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-card)] px-5"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-bold text-[var(--lp-heading)] marker:content-none">
                {q}
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--lp-tint-2)] text-[var(--lp-brand-deep)] transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                >
                  <svg viewBox="0 0 12 12" className="size-3" fill="none">
                    <path
                      d="M6 1v10M1 6h10"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </summary>
              <p className="pb-5 text-sm leading-[1.9]">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ 最終CTA ------------------------------ */

function FinalCta({ v, shared }: { v: Vertical; shared: SharedContent }) {
  return (
    <section className="px-4 py-16 pb-28 sm:px-6 sm:py-24">
      <div className="relative isolate mx-auto max-w-5xl overflow-hidden rounded-[2rem]">
        <Image
          src={v.images.hero}
          alt=""
          fill
          placeholder="blur"
          sizes="(min-width: 1024px) 64rem, 100vw"
          className="-z-20 object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[color-mix(in_srgb,var(--lp-tint)_90%,transparent)]"
        />

        <div className="px-6 py-16 text-center sm:px-12 sm:py-20">
          <h2 className="text-[1.75rem] font-extrabold leading-[1.35] tracking-tight text-balance text-[var(--lp-heading)] sm:text-[2.5rem]">
            {shared.finalCta.line1}
            <br className="sm:hidden" />
            <Mark>{shared.finalCta.mark}</Mark>
          </h2>
          <p className="mx-auto mt-5 max-w-xl leading-[1.9]">
            {shared.finalCta.body}
          </p>
          <div className="mt-9">
            <CtaLink v={v} />
            <CtaMicroCopy v={v} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Footer ------------------------------ */

function SiteFooter() {
  return (
    <footer className="border-t border-[var(--lp-line)] bg-[var(--lp-bg)] pb-24 md:pb-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-9 text-sm text-[var(--lp-muted)] sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5 font-bold text-[var(--lp-heading)]">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-xl bg-[var(--lp-brand)] text-[var(--lp-bg)]"
            >
              <Clock4 className="size-4" strokeWidth={2.4} />
            </span>
            みせ勤
          </p>
          <nav aria-label="フッターナビゲーション">
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <li>
                <Link
                  href="/login"
                  className="min-h-11 leading-[2.75rem] hover:text-[var(--lp-heading)]"
                >
                  ログイン
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="min-h-11 leading-[2.75rem] hover:text-[var(--lp-heading)]"
                >
                  {PRERELEASE?.ctaLabel ?? "無料ではじめる"}
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <p className="text-xs leading-relaxed">
          ページ内の写真はイメージです（出典：Unsplash）。実在の店舗・人物とは関係ありません。
        </p>
        <p className="text-xs tabular-nums">© 2026 みせ勤</p>
      </div>
    </footer>
  );
}

/* --------------------------- スティッキーCTA --------------------------- */

function StickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--lp-line)] bg-[var(--lp-bg)]/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
      <Link
        href="/register"
        className="flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-[var(--lp-cta)] text-base font-bold text-[var(--lp-cta-fg)]"
      >
        {PRERELEASE?.ctaLabel ?? "無料ではじめる"}
        <ArrowRight className="size-5" aria-hidden="true" strokeWidth={2.8} />
      </Link>
      <p className="mt-1.5 text-center text-xs text-[var(--lp-muted)]">
        {PRERELEASE ? PRERELEASE.microCopy : "クレジットカード不要・登録は3分"}
      </p>
    </div>
  );
}

/* ------------------------------ Primitives --------------------------- */

/** 蛍光ペンで引いたようなハイライト */
function Mark({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      <span
        aria-hidden="true"
        className="absolute inset-x-[-0.08em] bottom-[0.04em] block h-[0.36em] -rotate-1 rounded-[3px] bg-[var(--lp-mark)]"
      />
      <span className="relative">{children}</span>
    </span>
  );
}

/** 装飾用のドット模様 */
function Dots({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      className={`size-40 text-[var(--lp-brand)] opacity-30 ${className ?? ""}`}
      fill="currentColor"
    >
      {Array.from({ length: 6 }).map((_, r) =>
        Array.from({ length: 6 }).map((_, c) => (
          <circle key={`${r}-${c}`} cx={10 + c * 20} cy={10 + r * 20} r="3" />
        ))
      )}
    </svg>
  );
}

/** 版を引き継いで登録画面へ送るCTA。すべてのCTAが同じ行き先 */
function CtaLink({ v, size }: { v: Vertical; size?: "sm" }) {
  const href = `/register?v=${v.slug}`;
  if (size === "sm") {
    return (
      <Link
        href={href}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-[var(--lp-cta)] px-4 text-sm font-bold whitespace-nowrap text-[var(--lp-cta-fg)] shadow-[0_6px_16px_var(--lp-glow)] transition-colors duration-200 hover:bg-[var(--lp-cta-hover)] sm:px-5"
      >
        {PRERELEASE?.ctaLabelShort ?? "無料ではじめる"}
        <ArrowRight className="size-4" aria-hidden="true" strokeWidth={2.6} />
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--lp-cta)] px-8 text-lg font-bold text-[var(--lp-cta-fg)] shadow-[0_10px_28px_var(--lp-glow)] transition-colors duration-200 hover:bg-[var(--lp-cta-hover)] sm:w-auto"
    >
      {PRERELEASE?.ctaLabel ?? "無料ではじめる"}
      <ArrowRight className="size-5" aria-hidden="true" strokeWidth={2.8} />
    </Link>
  );
}

function CtaMicroCopy({ v }: { v: Vertical }) {
  return (
    <p className="mt-3.5 text-sm text-[var(--lp-muted)]">
      {PRERELEASE
        ? PRERELEASE.microCopy
        : `クレジットカード不要・お店の登録は3分・${v.terms.staff}のアプリは要りません`}
    </p>
  );
}

function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--lp-cta)]">
        <Heart className="size-3.5" aria-hidden="true" fill="currentColor" />
        {eyebrow}
      </p>
      <h2 className="mt-3 text-[1.6rem] font-extrabold leading-[1.4] tracking-tight text-balance text-[var(--lp-heading)] sm:text-[2rem]">
        {title}
      </h2>
      {lead && <p className="mt-5 leading-[1.9]">{lead}</p>}
    </div>
  );
}

function Section({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}
