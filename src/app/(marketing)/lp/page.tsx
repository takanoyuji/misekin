import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  ClipboardList,
  Clock4,
  Coffee,
  FileSpreadsheet,
  KeyRound,
  LogIn,
  MailCheck,
  Moon,
  QrCode,
  ScrollText,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: "みせ勤 — 深夜営業のための勤怠管理",
  description:
    "日またぎ勤務・複数店舗の掛け持ちに対応した勤怠管理。営業日切替時刻を設定するだけで、深夜0時をまたぐシフトも1営業日として正しく集計できます。",
  robots: { index: true, follow: true },
  openGraph: {
    title: "みせ勤 — 深夜営業のための勤怠管理",
    description:
      "日またぎ勤務・複数店舗の掛け持ちに対応した勤怠管理。深夜0時をまたぐシフトも1営業日として集計。",
    type: "website",
  },
};

/* ------------------------------------------------------------------ */
/* データ                                                              */
/* ------------------------------------------------------------------ */

const PROBLEMS = [
  {
    icon: CalendarClock,
    title: "0時で勤務が分断される",
    body: "20時〜翌3時の勤務が2日分に割れてしまう。手作業でつなぎ直すたびに、集計ミスと確認の往復が増えていく。",
  },
  {
    icon: Building2,
    title: "掛け持ちの実態が見えない",
    body: "同じスタッフが複数店舗に入ると、店舗ごとの表を突き合わせるまで総労働時間が分からない。",
  },
  {
    icon: TriangleAlert,
    title: "打刻漏れに気づくのが締め日",
    body: "退勤忘れ・休憩終了忘れが月末にまとめて発覚。本人の記憶も曖昧で、確認に時間がかかる。",
  },
] as const;

const FEATURES = [
  {
    icon: Moon,
    title: "営業日切替時刻",
    body: "店舗ごとに切替時刻（既定は朝6時）を設定。深夜0時〜早朝の打刻は前日の営業日に自動で紐づきます。",
  },
  {
    icon: QrCode,
    title: "店舗URL + PIN打刻",
    body: "店舗専用の打刻URLをQRで掲示。スタッフは自分を選んでPINを入れるだけ。アプリのインストールも管理者ログインも不要です。",
  },
  {
    icon: Users,
    title: "複数店舗の掛け持ち",
    body: "1人のスタッフを複数店舗に所属させ、店舗ごとに交通費を設定。勤怠は横断して1つの一覧で確認できます。",
  },
  {
    icon: TriangleAlert,
    title: "異常の自動検知",
    body: "退勤漏れ・休憩終了漏れ・時刻の逆転・長時間勤務・同時刻の重複打刻を検知して通知。締め日前に手が打てます。",
  },
  {
    icon: ClipboardList,
    title: "修正申請と承認",
    body: "スタッフが打刻の修正を申請し、管理者が承認・却下。実打刻は上書きせず、修正履歴と分けて保全します。",
  },
  {
    icon: FileSpreadsheet,
    title: "締め処理とCSV出力",
    body: "期間を締めて勤怠をロックし、給与計算の対象を確定。CSVはBOM付きUTF-8で、Excelでも文字化けしません。",
  },
] as const;

const STEPS = [
  {
    no: "01",
    icon: Building2,
    title: "店舗を登録する",
    body: "店舗名・タイムゾーン・営業日の切替時刻を設定します。切替時刻は後からでも店舗ごとに変更できます。",
  },
  {
    no: "02",
    icon: MailCheck,
    title: "スタッフを招待する",
    body: "メールで招待し、所属店舗・時給・交通費・打刻用PINを設定。時給は適用期間付きの履歴として残ります。",
  },
  {
    no: "03",
    icon: QrCode,
    title: "打刻URLを掲示する",
    body: "発行された打刻URLのQRコードをバックヤードに掲示。あとはスタッフが出退勤を打つだけです。",
  },
] as const;

const TRUST = [
  {
    icon: ScrollText,
    title: "消せない監査ログ",
    body: "誰が・いつ・何を・なぜ変更したかを、変更前後の値とあわせて記録。ログ自体は編集も削除もできません。",
  },
  {
    icon: ShieldCheck,
    title: "サーバー側で権限を検証",
    body: "画面の出し分けだけに頼らず、すべての操作で組織・店舗のスコープを検証。他組織のデータには到達できません。",
  },
  {
    icon: BadgeCheck,
    title: "消さずに残す設計",
    body: "店舗もスタッフも物理削除せず無効化。過去の勤怠との関連を保ったまま、退職・閉店を扱えます。",
  },
  {
    icon: KeyRound,
    title: "外部連携用のREST API",
    body: "APIキー認証のREST APIで勤怠・スタッフ・店舗を取得。キーごとにアクセスできる店舗を制限できます。",
  },
] as const;

const FAQS = [
  {
    q: "深夜0時をまたぐ勤務は、どちらの日に集計されますか？",
    a: "店舗に設定した営業日切替時刻で決まります。切替時刻が6時なら、1月15日20時〜16日3時の勤務はすべて「1月15日の営業日」として1件にまとまります。0時で分割されることはありません。",
  },
  {
    q: "スタッフにアプリのインストールやアカウント登録は必要ですか？",
    a: "打刻だけであれば不要です。店舗の打刻URLを開き、自分の名前を選んでPINを入力すれば打刻できます。共用のタブレットやスマートフォンでの運用を想定し、打刻後は個人の情報を画面に残しません。",
  },
  {
    q: "打刻を忘れたときはどうすればいいですか？",
    a: "退勤漏れは自動で検知して通知します。修正は、スタッフからの修正申請を管理者が承認するか、管理者が理由を添えて直接修正します。いずれの場合も実際の打刻時刻はそのまま保全され、修正内容は監査ログに残ります。",
  },
  {
    q: "1人のスタッフが複数の店舗で働いていても使えますか？",
    a: "使えます。スタッフを複数店舗に所属させると、それぞれの打刻URLから打刻できます。交通費は店舗ごとに設定でき、勤怠は店舗をまたいで一覧・集計できます。同じ時間帯に複数店舗で勤務中になっている状態も検知します。",
  },
  {
    q: "給与計算ソフトに取り込めますか？",
    a: "期間を締めて確定した勤怠をCSVで出力できます。BOM付きUTF-8のため、Excelで開いても文字化けしません。APIキーを発行すればREST API経由での取得も可能です。",
  },
] as const;

/* ------------------------------------------------------------------ */
/* ページ                                                              */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />

      <main id="main-content" className="flex-1">
        <Hero />
        <Problems />
        <BusinessDay />
        <Features />
        <Steps />
        <Trust />
        <Faq />
        <FinalCta />
      </main>

      <SiteFooter />
    </div>
  );
}

/* ------------------------------- Header ------------------------------ */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/lp"
          className="flex items-center gap-2 rounded-md text-base font-bold tracking-tight"
        >
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          >
            <Clock4 className="size-4.5" strokeWidth={2} />
          </span>
          みせ勤
        </Link>

        <nav aria-label="ページ内ナビゲーション" className="hidden md:block">
          <ul className="flex items-center gap-1 text-sm">
            {[
              { href: "#problems", label: "課題" },
              { href: "#business-day", label: "営業日の考え方" },
              { href: "#features", label: "機能" },
              { href: "#steps", label: "使い方" },
              { href: "#faq", label: "よくある質問" },
            ].map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="rounded-md px-3 py-2 text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground sm:inline-flex"
          >
            ログイン
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary/90"
          >
            アカウント作成
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------- Hero ------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_32rem_at_70%_-10%,var(--accent),transparent)]"
      />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Moon className="size-3.5 text-primary" aria-hidden="true" />
            深夜営業・日またぎ勤務のための勤怠管理
          </p>

          <h1 className="mt-6 text-4xl font-bold leading-[1.2] tracking-tight text-balance sm:text-5xl lg:text-[3.25rem]">
            日付が変わっても、
            <br />
            <span className="text-primary">営業日は変わらない。</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            20時から翌3時までの勤務も、みせ勤なら1営業日ぶんの勤怠として集計されます。
            店舗ごとに営業日の切替時刻を決めるだけ。深夜0時での分断も、月末の手作業でのつなぎ直しも、もう必要ありません。
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary/90"
            >
              アカウントを作成する
              <ArrowRight className="size-4.5" aria-hidden="true" />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 text-base font-semibold transition-colors duration-200 hover:bg-secondary"
            >
              <LogIn className="size-4.5" aria-hidden="true" />
              ログイン
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {[
              "スタッフはアプリ不要",
              "複数店舗の掛け持ちに対応",
              "CSV / REST API 連携",
            ].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <Check className="size-4 text-primary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <ClockMock />
      </div>
    </section>
  );
}

/** 打刻画面のイメージ（実データではない静的モック） */
function ClockMock() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div
        aria-hidden="true"
        className="absolute -inset-4 -z-10 rounded-[2rem] bg-primary/10 blur-2xl"
      />
      <div
        role="img"
        aria-label="打刻画面のイメージ。新宿店で勤務中のスタッフが、休憩開始または退勤を選べる画面。"
        className="rounded-2xl border border-border bg-card p-5 shadow-xl shadow-foreground/5"
      >
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="size-3.5" aria-hidden="true" />
            新宿店
          </span>
          <span className="tabular-nums">営業日 1/15（切替 6:00）</span>
        </div>

        <div className="mt-5 text-center">
          <p className="text-sm text-muted-foreground">佐藤 花子 さん</p>
          <p className="mt-2 font-mono text-5xl font-bold tabular-nums tracking-tight">
            02:14
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            1月16日（火）
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-status-working/10 px-3 py-1 text-sm font-medium text-status-working">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-status-working"
            />
            勤務中 ・ 20:00 出勤
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-secondary text-sm font-semibold">
            <Coffee className="size-4" aria-hidden="true" />
            休憩開始
          </div>
          <div className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            <Clock4 className="size-4" aria-hidden="true" />
            退勤
          </div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <Smartphone className="size-3.5" aria-hidden="true" />
          店舗の共用端末から、PIN入力だけで打刻
        </p>
      </div>
    </div>
  );
}

/* ------------------------------ Problems ----------------------------- */

function Problems() {
  return (
    <Section
      id="problems"
      eyebrow="よくある困りごと"
      title="夜の店舗の勤怠は、一般的なツールだと合わない"
      lead="0時で日付が変わる前提のツールを使う限り、深夜営業の勤怠は毎月どこかで手作業に戻ってしまいます。"
    >
      <ul className="grid gap-4 sm:grid-cols-3">
        {PROBLEMS.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
            >
              <Icon className="size-5" />
            </span>
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* --------------------------- Business day ---------------------------- */

function BusinessDay() {
  return (
    <section
      id="business-day"
      className="scroll-mt-20 border-y border-border bg-secondary/40"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="text-sm font-semibold text-primary">
              みせ勤の考え方
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              1日の区切りは、0時ではなく「営業日の切替時刻」
            </h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              店舗ごとに切替時刻を設定すると、その時刻より前の打刻は前日の営業日として扱われます。
              切替を6時にすれば、深夜0時〜朝6時の打刻はすべて前日の営業日。
              日をまたぐシフトが、はじめから1件の勤怠として記録されます。
            </p>
            <dl className="mt-8 space-y-4">
              {[
                {
                  t: "切替時刻は店舗ごとに設定",
                  d: "朝6時の店舗も、朝5時の店舗も、同じ組織内で並行して運用できます。",
                },
                {
                  t: "打刻された時刻はそのまま保全",
                  d: "営業日は判定して付与するだけ。実際に打たれた時刻は書き換えません。",
                },
                {
                  t: "集計・CSV・APIも営業日基準",
                  d: "一覧も出力も同じ基準で揃うため、突き合わせの手間が発生しません。",
                },
              ].map((item) => (
                <div key={item.t} className="flex gap-3">
                  <Check
                    className="mt-0.5 size-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div>
                    <dt className="font-medium">{item.t}</dt>
                    <dd className="mt-1 text-sm text-muted-foreground">
                      {item.d}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>

          <BusinessDayDiagram />
        </div>
      </div>
    </section>
  );
}

/** 営業日判定のタイムライン図 */
function BusinessDayDiagram() {
  const marks = [
    { time: "20:00", label: "出勤", day: "1/15" },
    { time: "24:00", label: "日付が変わる", day: "1/16" },
    { time: "03:00", label: "退勤", day: "1/16" },
    { time: "06:00", label: "営業日が切り替わる", day: "1/16" },
  ];

  return (
    <figure className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <figcaption className="text-sm font-medium text-muted-foreground">
        切替時刻 6:00 の店舗での記録例
      </figcaption>

      <ol className="mt-6 space-y-0">
        {marks.map((m, i) => (
          <li key={m.time} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={`size-3 shrink-0 rounded-full ring-4 ring-card ${
                  i === 3 ? "bg-primary" : "bg-border"
                }`}
              />
              {i < marks.length - 1 && (
                <span
                  aria-hidden="true"
                  className="w-px flex-1 bg-gradient-to-b from-border to-border/40"
                />
              )}
            </div>
            <div className={i < marks.length - 1 ? "pb-8" : ""}>
              <p className="font-mono text-sm font-semibold tabular-nums">
                {m.time}
                <span className="ml-2 font-sans text-xs font-normal text-muted-foreground tabular-nums">
                  {m.day}
                </span>
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">{m.label}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-semibold text-primary">
          記録される勤怠：1月15日の営業日 / 実働 6時間
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          0時をまたいでも2日に分かれません。退勤の3:00は切替時刻6:00より前のため、前日1月15日の勤務として扱われます。
        </p>
      </div>
    </figure>
  );
}

/* ------------------------------ Features ----------------------------- */

function Features() {
  return (
    <Section
      id="features"
      eyebrow="機能"
      title="現場で必要なところだけ、きちんと"
      lead="打刻から締め処理・出力まで、深夜営業の店舗運営に必要な流れを一通りカバーします。"
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="group rounded-xl border border-border bg-card p-6 shadow-sm transition-colors duration-200 hover:border-primary/40"
          >
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground"
            >
              <Icon className="size-5" />
            </span>
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* -------------------------------- Steps ------------------------------ */

function Steps() {
  return (
    <section
      id="steps"
      className="scroll-mt-20 border-y border-border bg-secondary/40"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="使い方"
          title="3ステップで、今日から打刻できます"
          lead="設定するのは店舗とスタッフだけ。特別な端末も、スタッフ側のアカウント登録も必要ありません。"
        />

        <ol className="mt-12 grid gap-4 sm:grid-cols-3">
          {STEPS.map(({ no, icon: Icon, title, body }) => (
            <li
              key={no}
              className="relative rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
                >
                  <Icon className="size-5" />
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
                  STEP {no}
                </span>
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------- Trust ------------------------------ */

function Trust() {
  return (
    <Section
      id="trust"
      eyebrow="安心して使うために"
      title="勤怠は、給与の根拠になるデータ"
      lead="あとから「誰が何を変えたのか」を説明できることを前提に設計しています。"
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {TRUST.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="flex gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <Icon className="size-5" />
            </span>
            <div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* --------------------------------- FAQ ------------------------------- */

function Faq() {
  return (
    <section
      id="faq"
      className="scroll-mt-20 border-t border-border bg-secondary/40"
    >
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading eyebrow="よくある質問" title="導入前の疑問" />

        <div className="mt-10 space-y-3">
          {FAQS.map(({ q, a }) => (
            <details
              key={q}
              name="misekin-faq"
              className="group rounded-xl border border-border bg-card px-5 shadow-sm"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium marker:content-none">
                {q}
                <span
                  aria-hidden="true"
                  className="grid size-6 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                >
                  <svg viewBox="0 0 12 12" className="size-3" fill="none">
                    <path
                      d="M6 1v10M1 6h10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </summary>
              <p className="pb-5 text-sm leading-relaxed text-muted-foreground">
                {a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Final CTA ---------------------------- */

function FinalCta() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-6 py-14 text-center shadow-sm sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(40rem_20rem_at_50%_0%,var(--accent),transparent)]"
          />
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            今月の締めから、手作業をやめませんか
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
            店舗を1つ登録すれば、その日のうちに打刻を始められます。
            深夜営業の勤怠を、深夜営業の前提のまま扱えるツールです。
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary/90"
            >
              アカウントを作成する
              <ArrowRight className="size-4.5" aria-hidden="true" />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border px-6 text-base font-semibold transition-colors duration-200 hover:bg-secondary"
            >
              <LogIn className="size-4.5" aria-hidden="true" />
              ログイン
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Footer ------------------------------ */

function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          >
            <Clock4 className="size-4" />
          </span>
          みせ勤
        </p>
        <nav aria-label="フッターナビゲーション">
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <li>
              <a href="#features" className="hover:text-foreground">
                機能
              </a>
            </li>
            <li>
              <a href="#faq" className="hover:text-foreground">
                よくある質問
              </a>
            </li>
            <li>
              <Link href="/login" className="hover:text-foreground">
                ログイン
              </Link>
            </li>
          </ul>
        </nav>
        <p className="tabular-nums">© 2026 みせ勤</p>
      </div>
    </footer>
  );
}

/* ------------------------------ Primitives --------------------------- */

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
      <p className="text-sm font-semibold text-primary">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {lead && (
        <p className="mt-4 leading-relaxed text-muted-foreground">{lead}</p>
      )}
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}
