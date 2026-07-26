import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  ClipboardCheck,
  Clock4,
  Coffee,
  FileSpreadsheet,
  KeyRound,
  Languages,
  Moon,
  QrCode,
  ScrollText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Timer,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";

import heroNeon from "../../../../public/lp/hero-neon.jpg";
import kabukicho from "../../../../public/lp/kabukicho.jpg";
import storePink from "../../../../public/lp/store-pink.jpg";
import counterMagenta from "../../../../public/lp/counter-magenta.jpg";
import phoneNeon from "../../../../public/lp/phone-neon.jpg";
import holo from "../../../../public/lp/holo.jpg";

/* ------------------------------------------------------------------ */
/* メタデータ                                                          */
/* ------------------------------------------------------------------ */

const TITLE = "みせ勤 — コンカフェのための勤怠＆シフト管理";
const DESCRIPTION =
  "コンカフェ・メイドカフェ・ガールズバー専用の勤怠＆シフト管理。深夜0時をまたぐ勤務も1営業日にまとめ、LINEでバラバラに届くシフト希望も1画面で集めて自動で組みます。スタッフはアプリ不要、今は無料。";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    images: [{ url: "/lp/hero-neon.jpg", width: 1920, height: 1280 }],
  },
};

/* ------------------------------------------------------------------ */
/* データ                                                              */
/* ------------------------------------------------------------------ */

/** 対応業態（プロダクトの店舗カテゴリに対応） */
const CATEGORIES = [
  "コンカフェ",
  "メイドカフェ",
  "ガールズバー",
  "キャバクラ",
  "クラブ・ラウンジ",
  "スナック",
  "バー",
  "シーシャ屋",
] as const;

/** 課題（Problem / Affinity） */
const PAINS = [
  "LINEに届いた「この日入れます」を、手でカレンダーに並べ直している",
  "20時〜翌3時の勤務が、0時をまたいだ瞬間に2日ぶんに割れる",
  "退勤の押し忘れに気づくのが、いつも締め日の夜",
  "掛け持ちしているキャストの総労働時間が、月末まで分からない",
  "時給を上げたら、先月ぶんまで新しい時給で計算されてしまった",
] as const;

/** 比較表（社名は出さず、公開されている価格帯のみで比較） */
const COMPARE_ROWS = [
  {
    label: "深夜0時をまたぐ勤務",
    generic: { ok: false, text: "2日に分割される" },
    pos: { ok: true, text: "対応するものが多い" },
    misekin: { ok: true, text: "店舗ごとの切替時刻で1営業日" },
  },
  {
    label: "早番・遅番ごとのシフト",
    generic: { ok: false, text: "時間帯の概念が薄い" },
    pos: { ok: false, text: "会計が主役でシフトは弱い" },
    misekin: { ok: true, text: "時間帯を店舗ごとに定義できる" },
  },
  {
    label: "シフトの自動生成",
    generic: { ok: false, text: "手で組む前提" },
    pos: { ok: false, text: "手で組む前提" },
    misekin: { ok: true, text: "希望と法令条件から自動で作成" },
  },
  {
    label: "スタッフ側の準備",
    generic: { ok: false, text: "アカウント登録が要ることが多い" },
    pos: { ok: false, text: "専用端末が要ることがある" },
    misekin: { ok: true, text: "QRを読んでPINだけ。アプリ不要" },
  },
  {
    label: "月額の目安",
    generic: { ok: true, text: "1人あたり200〜330円" },
    pos: { ok: false, text: "1店舗あたり15,000円〜" },
    misekin: { ok: true, text: "先行導入の間は無料" },
  },
] as const;

/** シフト運用の3ステップ */
const SHIFT_STEPS = [
  {
    no: "01",
    icon: Smartphone,
    title: "希望はスマホから集まる",
    body: "スタッフは日付と時間帯ごとに「希望／可／不可」を押すだけ。LINEのトーク画面を遡って書き写す作業がなくなります。提出できる期間は店舗ごとに決められます。",
  },
  {
    no: "02",
    icon: Sparkles,
    title: "ボタン1つで下書きができる",
    body: "集まった希望と、必要人数と、法令の条件から、割り当てを自動で作ります。「希望」は優先、「可」は補欠。人が足りない時間帯は色で分かります。",
  },
  {
    no: "03",
    icon: BadgeCheck,
    title: "直して、公開する",
    body: "自動生成はあくまで下書きです。気になるところを＋／−で直してから公開すると、その瞬間にスタッフの画面へ確定シフトが出ます。",
  },
] as const;

/** 機能一覧 */
const FEATURES = [
  {
    icon: Moon,
    title: "営業日の切替時刻",
    body: "店舗ごとに切替時刻（既定は朝6時）を設定。深夜0時〜早朝の打刻は、前日の営業日に自動で紐づきます。",
  },
  {
    icon: QrCode,
    title: "QRとPINだけの打刻",
    body: "店舗のQRをバックヤードに貼るだけ。スタッフは自分を選んでPINを入れます。アプリのインストールも、アカウント作成も不要です。",
  },
  {
    icon: CalendarClock,
    title: "早番・遅番のシフト",
    body: "時間帯の名前と開始・終了時刻を店舗ごとに定義。希望の収集も、シフトの作成も、この時間帯を単位に動きます。",
  },
  {
    icon: Sparkles,
    title: "シフトの自動生成",
    body: "希望・必要人数・ルールを入力に、最適化エンジンが割り当てを作成。法令に関わる条件は必ず守り、希望はできるだけ叶えます。",
  },
  {
    icon: Languages,
    title: "日本語で書くシフトルール",
    body: "「連勤は5日まで」「深夜上がりの翌日は昼から」。日本語で書いたルールをそのまま登録すると、自動生成の条件に変換されます。",
  },
  {
    icon: TriangleAlert,
    title: "打刻漏れの自動検知",
    body: "退勤漏れ・休憩終了漏れ・時刻の逆転・長時間勤務・二重打刻を検知して通知。締め日ではなく、その日のうちに気づけます。",
  },
  {
    icon: ClipboardCheck,
    title: "修正申請と交通費申請",
    body: "押し忘れも交通費の変更も、スタッフから申請して管理者が承認する形に。実際の打刻は上書きせず、履歴として残します。",
  },
  {
    icon: Users,
    title: "掛け持ちと複数店舗",
    body: "1人を複数店舗に所属させ、交通費は店舗ごとに設定。勤怠は店舗をまたいで1つの一覧で見られます。同時刻の二重勤務も検知します。",
  },
  {
    icon: FileSpreadsheet,
    title: "締め処理とCSV出力",
    body: "期間を締めて勤怠をロックし、給与計算の対象を確定。CSVはBOM付きUTF-8なので、Excelで開いても文字化けしません。",
  },
] as const;

/** 法改正（2027年施行見込み） */
const LAW_ITEMS = [
  {
    icon: Timer,
    title: "勤務間インターバル11時間",
    body: "深夜4時に上がったら、次に入れるのは15時以降。手で組んだシフト表では、まず気づけません。",
  },
  {
    icon: CalendarClock,
    title: "連続勤務は13日まで",
    body: "繁忙期に人気キャストへ寄せていくと、簡単に超えます。組んだ時点で警告が出る仕組みが要ります。",
  },
  {
    icon: ScrollText,
    title: "週44時間の特例は廃止の検討",
    body: "10人未満の飲食店が使ってきた特例です。なくなると、労働時間の管理はより厳密になります。",
  },
] as const;

/** 信頼性 */
const TRUST = [
  {
    icon: ScrollText,
    title: "消せない監査ログ",
    body: "誰が・いつ・何を・なぜ変えたかを、変更前後の値とセットで記録。ログそのものは編集も削除もできません。",
  },
  {
    icon: ShieldCheck,
    title: "店舗ごとの権限",
    body: "管理者ごとに触れる店舗を限定できます。画面の出し分けだけでなく、サーバー側で毎回検証します。",
  },
  {
    icon: BadgeCheck,
    title: "消さずに残す設計",
    body: "店舗もスタッフも物理削除せず無効化。過去の勤怠とのつながりを保ったまま、退職や閉店を扱えます。",
  },
  {
    icon: KeyRound,
    title: "給与ソフトへの連携",
    body: "CSVに加えて、APIキー認証のREST APIでも取得できます。キーごとに読める店舗を制限できます。",
  },
] as const;

/** FAQ */
const FAQS = [
  {
    q: "深夜0時をまたぐ勤務は、どちらの日に集計されますか？",
    a: "店舗に設定した営業日の切替時刻で決まります。切替が朝6時なら、1月15日20時〜16日3時の勤務はすべて「1月15日の営業日」として1件にまとまります。0時で分割されることはありません。切替時刻は店舗ごとに違ってかまいません。",
  },
  {
    q: "キャストにアプリを入れてもらう必要はありますか？",
    a: "ありません。店舗に貼ったQRを読み、自分の名前を選んでPINを入れれば打刻できます。共用のタブレットやスマホでの運用を想定していて、打刻が終われば個人の情報は画面に残りません。シフト希望の提出も、同じくスマホのブラウザからできます。",
  },
  {
    q: "シフトの自動生成は、そのまま公開して大丈夫ですか？",
    a: "下書きとして使ってください。連続勤務や勤務間インターバルなど法令に関わる条件は必ず守る条件として扱い、スタッフの「希望」はできるだけ叶えるように最適化します。ただし現場の事情まではデータに入っていないので、必ず目で確認し、＋／−で直してから公開する運用をおすすめします。",
  },
  {
    q: "「連勤は5日まで」のようなルールも設定できますか？",
    a: "できます。シフトルールのページに日本語のまま書いて登録すると、内容を読み取って自動生成の条件に変換します。法令に関わるものは必ず守る条件、店舗の判断によるものは努力目標として扱い分けます。",
  },
  {
    q: "1人が複数の店舗を掛け持ちしていても使えますか？",
    a: "使えます。1人のスタッフを複数店舗に所属させると、それぞれの打刻URLから打刻できます。交通費は店舗ごとに設定でき、勤怠は店舗をまたいで一覧・集計できます。同じ時間帯に2店舗で勤務中になっている状態も検知します。",
  },
  {
    q: "時給を変えたら、過去の勤怠まで新しい時給になりませんか？",
    a: "なりません。時給は「いつから適用するか」を持った履歴として保存します。7月から時給を上げても、6月ぶんの集計は6月の時給のまま計算されます。",
  },
  {
    q: "料金はいくらですか？",
    a: "先行導入いただいている間は無料です。有料プランを始めるときは、事前にご案内してから切り替えます。使っている途中で勝手に課金が始まることはありません。",
  },
  {
    q: "今の勤怠データを移せますか？",
    a: "スタッフ・店舗・時給の登録は画面から行えます。過去の勤怠の一括取り込みは準備中のため、まずは今月ぶんから使い始めていただくのが確実です。移行でお困りのことがあれば、アカウント作成後にご相談ください。",
  },
] as const;

/* ------------------------------------------------------------------ */
/* ページ                                                              */
/* ------------------------------------------------------------------ */

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function LandingPage() {
  return (
    <div
      className="flex min-h-dvh flex-col bg-[var(--lp-bg)] font-sans text-[var(--lp-text)] antialiased"
      style={
        {
          "--lp-bg": "#0B0614",
          "--lp-surface": "#160D24",
          "--lp-surface-2": "#1E1230",
          "--lp-line": "rgba(255,255,255,0.12)",
          "--lp-text": "#F6F1FF",
          "--lp-muted": "#BCA9DC",
          "--lp-pink": "#FF2E88",
          "--lp-pink-soft": "#FF8AC0",
          "--lp-cyan": "#45E7DC",
          "--lp-violet": "#A970FF",
          "--lp-yellow": "#FFD84D",
        } as React.CSSProperties
      }
    >
      {/* LPだけダークで固定する（アプリ本体のテーマ設定には影響しない） */}
      <style>{`html{background:#0B0614;color-scheme:dark}`}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />

      <SiteHeader />

      <main id="main-content" className="flex-1">
        <Hero />
        <CategoryBar />
        <Pains />
        <WhyNotGeneric />
        <BusinessDay />
        <ShiftFlow />
        <LawSection />
        <Features />
        <Pricing />
        <Founder />
        <Trust />
        <Faq />
        <FinalCta />
      </main>

      <SiteFooter />
      <StickyCta />
    </div>
  );
}

/* ------------------------------- Header ------------------------------ */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--lp-line)] bg-[rgba(11,6,20,0.82)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <p className="flex items-center gap-2.5 text-base font-bold tracking-tight">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--lp-pink),var(--lp-violet))] text-[#1A0620] shadow-[0_0_24px_rgba(255,46,136,0.45)]"
          >
            <Clock4 className="size-5" strokeWidth={2.4} />
          </span>
          みせ勤
          <span className="hidden rounded-full border border-[rgba(255,46,136,0.5)] px-2.5 py-1 text-[11px] font-semibold text-[var(--lp-pink-soft)] sm:inline">
            コンカフェ専用
          </span>
        </p>

        <div className="flex items-center gap-1.5">
          <Link
            href="/login"
            className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-medium text-[var(--lp-muted)] transition-colors duration-200 hover:text-[var(--lp-text)] sm:inline-flex"
          >
            ログイン
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--lp-pink)] px-4 text-sm font-extrabold text-[#1A0620] shadow-[0_0_24px_rgba(255,46,136,0.4)] transition-transform duration-200 hover:scale-[1.03]"
          >
            無料ではじめる
            <ArrowRight className="size-4" aria-hidden="true" strokeWidth={2.6} />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* -------------------------------- Hero ------------------------------- */

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <Image
        src={heroNeon}
        alt=""
        fill
        priority
        placeholder="blur"
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(11,6,20,0.86)_0%,rgba(11,6,20,0.74)_40%,rgba(11,6,20,0.96)_100%)]"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:gap-12">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,46,136,0.45)] bg-[rgba(255,46,136,0.12)] px-3.5 py-1.5 text-xs font-semibold text-[var(--lp-pink-soft)] sm:text-sm">
            <Moon className="size-4" aria-hidden="true" />
            コンカフェ・メイドカフェ・ガールズバーのための勤怠＆シフト
          </p>

          <h1 className="mt-6 text-[2.1rem] font-extrabold leading-[1.24] tracking-tight text-balance sm:text-[2.6rem] lg:text-[2.95rem]">
            深夜3時に上がっても、
            <br />
            ぜんぶ<Mark>「その日」</Mark>の勤務。
          </h1>

          <p className="mt-6 max-w-xl text-base leading-[1.85] text-[#E4D9F5] sm:text-lg">
            0時をまたぐ勤務は1営業日にまとまり、LINEでバラバラに届くシフト希望は1画面に集まります。
            早番・遅番のシフトはボタン1つで下書きができる。夜のお店の1ヶ月を、そのままの形で扱えるツールです。
          </p>

          <div className="mt-9">
            <Link
              href="/register"
              className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(100deg,var(--lp-pink),#FF6A3D)] px-8 text-lg font-extrabold text-[#1A0620] shadow-[0_10px_40px_rgba(255,46,136,0.45)] transition-transform duration-200 hover:scale-[1.02] sm:w-auto"
            >
              無料ではじめる
              <ArrowRight className="size-5" aria-hidden="true" strokeWidth={2.8} />
            </Link>
            <p className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--lp-muted)]">
              {[
                "クレジットカード不要",
                "店舗の登録は3分",
                "スタッフはアプリ不要",
              ].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check
                    className="size-4 text-[var(--lp-cyan)]"
                    aria-hidden="true"
                    strokeWidth={3}
                  />
                  {t}
                </span>
              ))}
            </p>
          </div>

          <p className="mt-8 flex items-start gap-2.5 rounded-2xl border border-[var(--lp-line)] bg-[rgba(255,255,255,0.05)] p-4 text-sm leading-relaxed text-[#E4D9F5]">
            <Sparkles
              className="mt-0.5 size-4.5 shrink-0 text-[var(--lp-yellow)]"
              aria-hidden="true"
            />
            <span>
              作っている会社が、
              <strong className="font-bold text-[var(--lp-yellow)]">
                自分たちのコンカフェ6店舗で毎日使っています
              </strong>
              。現場で困ったことから機能が増えていきます。
            </span>
          </p>
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
        className="absolute -inset-6 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_50%_35%,rgba(255,46,136,0.5),transparent_70%)] blur-2xl"
      />
      <div
        role="img"
        aria-label="打刻画面のイメージ。深夜2時14分、営業日は1月15日のまま。勤務中のスタッフが休憩開始か退勤を選べる画面。"
        className="rounded-[1.75rem] border border-[rgba(255,255,255,0.18)] bg-[rgba(22,13,36,0.92)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl"
      >
        <div className="flex items-center justify-between text-xs text-[var(--lp-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="size-3.5" aria-hidden="true" />
            歌舞伎町店
          </span>
          <span className="rounded-full bg-[rgba(69,231,220,0.14)] px-2 py-1 font-semibold text-[var(--lp-cyan)] tabular-nums">
            営業日 1/15
          </span>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-[var(--lp-muted)]">星野 あかり さん</p>
          <p className="mt-1.5 font-mono text-[3.5rem] font-bold leading-none tabular-nums tracking-tight text-white [text-shadow:0_0_28px_rgba(255,46,136,0.6)]">
            02:14
          </p>
          <p className="mt-2 text-xs text-[var(--lp-muted)] tabular-nums">
            1月16日（火）— 切替6:00より前なので、まだ15日
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[rgba(69,231,220,0.14)] px-3.5 py-1.5 text-sm font-semibold text-[var(--lp-cyan)]">
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-[var(--lp-cyan)] shadow-[0_0_10px_var(--lp-cyan)]"
            />
            勤務中 ・ 20:00 出勤
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--lp-line)] bg-[rgba(255,255,255,0.06)] text-sm font-semibold">
            <Coffee className="size-4" aria-hidden="true" />
            休憩開始
          </div>
          <div className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--lp-pink)] text-sm font-extrabold text-[#1A0620]">
            <Clock4 className="size-4" aria-hidden="true" />
            退勤
          </div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-[var(--lp-muted)]">
          <QrCode className="size-3.5" aria-hidden="true" />
          店舗のQRを読んで、PINを入れるだけ
        </p>
      </div>
    </div>
  );
}

/* ----------------------------- 対応業態バー ---------------------------- */

function CategoryBar() {
  return (
    <section className="border-y border-[var(--lp-line)] bg-[var(--lp-surface)]">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
        <p className="text-center text-xs font-semibold tracking-wider text-[var(--lp-muted)]">
          対応している業態
        </p>
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {CATEGORIES.map((c) => (
            <li
              key={c}
              className="rounded-full border border-[var(--lp-line)] bg-[rgba(255,255,255,0.05)] px-3.5 py-1.5 text-sm font-medium text-[#E4D9F5]"
            >
              {c}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------- 課題 -------------------------------- */

function Pains() {
  return (
    <section className="relative isolate overflow-hidden">
      <Image
        src={kabukicho}
        alt=""
        fill
        placeholder="blur"
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(11,6,20,0.94),rgba(11,6,20,0.88))]"
      />

      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="text-sm font-bold text-[var(--lp-pink-soft)]">
          よくある夜
        </p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
          こんな夜、ありませんか。
        </h2>

        <ul className="mt-10 space-y-3">
          {PAINS.map((p) => (
            <li
              key={p}
              className="flex items-start gap-3.5 rounded-2xl border border-[var(--lp-line)] bg-[rgba(22,13,36,0.75)] p-4 backdrop-blur-sm sm:p-5"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-[rgba(255,46,136,0.18)] text-[var(--lp-pink)]"
              >
                <X className="size-4" strokeWidth={3} />
              </span>
              <span className="text-base leading-relaxed text-[#E4D9F5]">
                {p}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-lg font-bold leading-relaxed text-balance sm:text-xl">
          どれか1つでも当てはまるなら、
          <Mark>あなたが悪いのではなく、ツールが夜に合っていません。</Mark>
        </p>
      </div>
    </section>
  );
}

/* --------------------------- 比較（空白地帯） -------------------------- */

function WhyNotGeneric() {
  return (
    <Section
      eyebrow="なぜ合わないのか"
      title="夜のお店は、朝9時のお店とは別の生き物"
      lead="一般的な勤怠アプリは「9時〜18時」を前提に作られています。ナイト向けのPOSは会計が主役で、しかも小さなお店には大きすぎる。その真ん中が、ずっと空いていました。"
    >
      {/* モバイルはカード表示（横スクロールだと「みせ勤」列が画面外に出るため） */}
      <ul className="space-y-3 md:hidden">
        {COMPARE_ROWS.map((row) => (
          <li
            key={row.label}
            className="rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-surface)] p-5"
          >
            <p className="font-bold">{row.label}</p>
            <ul className="mt-3.5 space-y-2.5">
              <MobileCompareItem
                name="みせ勤"
                value={row.misekin}
                highlight
              />
              <MobileCompareItem
                name="一般的な勤怠アプリ"
                value={row.generic}
              />
              <MobileCompareItem name="ナイト向けPOS" value={row.pos} />
            </ul>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">
            一般的な勤怠アプリ・ナイト向けPOS・みせ勤の比較
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-[22%] p-3" />
              <th
                scope="col"
                className="w-[26%] rounded-t-xl bg-[var(--lp-surface)] p-4 text-sm font-semibold text-[var(--lp-muted)]"
              >
                一般的な勤怠アプリ
              </th>
              <th
                scope="col"
                className="w-[26%] rounded-t-xl bg-[var(--lp-surface)] p-4 text-sm font-semibold text-[var(--lp-muted)]"
              >
                ナイト向けPOS
              </th>
              <th
                scope="col"
                className="w-[26%] rounded-t-xl bg-[rgba(255,46,136,0.18)] p-4 text-base font-extrabold text-[var(--lp-pink-soft)]"
              >
                みせ勤
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row, i) => (
              <tr key={row.label}>
                <th
                  scope="row"
                  className="p-4 align-top text-sm font-semibold text-[var(--lp-text)]"
                >
                  {row.label}
                </th>
                <Cell
                  value={row.generic}
                  last={i === COMPARE_ROWS.length - 1}
                />
                <Cell value={row.pos} last={i === COMPARE_ROWS.length - 1} />
                <Cell
                  value={row.misekin}
                  highlight
                  last={i === COMPARE_ROWS.length - 1}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[var(--lp-muted)]">
        価格帯は各社の公開情報をもとにした目安です（2026年7月時点）。機能の有無は製品や
        プランによって異なります。導入前にご確認ください。
      </p>
    </Section>
  );
}

/** 比較表のモバイル版1行 */
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
      className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-relaxed ${
        highlight
          ? "bg-[rgba(255,46,136,0.12)] text-[var(--lp-text)]"
          : "bg-[rgba(255,255,255,0.04)] text-[var(--lp-muted)]"
      }`}
    >
      {value.ok ? (
        <Check
          className={`mt-0.5 size-4 shrink-0 ${
            highlight ? "text-[var(--lp-pink)]" : "text-[var(--lp-cyan)]"
          }`}
          aria-hidden="true"
          strokeWidth={3}
        />
      ) : (
        <X
          className="mt-0.5 size-4 shrink-0 text-[#8B7BA8]"
          aria-hidden="true"
          strokeWidth={3}
        />
      )}
      <span>
        <span
          className={`font-bold ${highlight ? "text-[var(--lp-pink-soft)]" : ""}`}
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
        "border-t border-[rgba(255,255,255,0.08)] p-4 align-top text-sm leading-relaxed",
        highlight
          ? `bg-[rgba(255,46,136,0.1)] text-[#F6F1FF] ${last ? "rounded-b-xl" : ""}`
          : `bg-[var(--lp-surface)] text-[var(--lp-muted)] ${last ? "rounded-b-xl" : ""}`,
      ].join(" ")}
    >
      <span className="flex items-start gap-2">
        {value.ok ? (
          <Check
            className={`mt-0.5 size-4 shrink-0 ${
              highlight ? "text-[var(--lp-pink)]" : "text-[var(--lp-cyan)]"
            }`}
            aria-hidden="true"
            strokeWidth={3}
          />
        ) : (
          <X
            className="mt-0.5 size-4 shrink-0 text-[#8B7BA8]"
            aria-hidden="true"
            strokeWidth={3}
          />
        )}
        {value.text}
      </span>
    </td>
  );
}

/* --------------------------- 営業日の考え方 ---------------------------- */

function BusinessDay() {
  return (
    <section className="border-y border-[var(--lp-line)] bg-[var(--lp-surface)]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="text-sm font-bold text-[var(--lp-cyan)]">
              仕組み その1
            </p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
              1日の区切りは0時じゃなく、
              <Mark color="cyan">お店が閉まったあと</Mark>
            </h2>
            <p className="mt-6 leading-[1.85] text-[#E4D9F5]">
              店舗ごとに切替時刻を決めると、それより前の打刻は前日の営業日として扱われます。
              切替を朝6時にすれば、深夜0時から6時までの打刻はぜんぶ前の日。
              日をまたぐシフトが、はじめから1件の勤怠として記録されます。
            </p>
            <dl className="mt-9 space-y-5">
              {[
                {
                  t: "切替時刻は店舗ごと",
                  d: "朝6時のお店も、朝5時のお店も、同じ組織の中で並べて運用できます。",
                },
                {
                  t: "打たれた時刻はそのまま",
                  d: "営業日は判定して付けるだけ。実際の打刻時刻を書き換えることはありません。",
                },
                {
                  t: "集計もCSVも同じ基準",
                  d: "画面も出力も営業日でそろうので、あとから突き合わせる手間が出ません。",
                },
              ].map((item) => (
                <div key={item.t} className="flex gap-3">
                  <Check
                    className="mt-0.5 size-5 shrink-0 text-[var(--lp-cyan)]"
                    aria-hidden="true"
                    strokeWidth={3}
                  />
                  <div>
                    <dt className="font-bold">{item.t}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-[var(--lp-muted)]">
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
    { time: "20:00", label: "出勤", day: "1/15", on: false },
    { time: "24:00", label: "日付が変わる", day: "1/16", on: false },
    { time: "03:00", label: "退勤", day: "1/16", on: false },
    { time: "06:00", label: "ここで営業日が切り替わる", day: "1/16", on: true },
  ];

  return (
    <figure className="rounded-[1.75rem] border border-[var(--lp-line)] bg-[var(--lp-surface-2)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:p-8">
      <figcaption className="text-sm font-semibold text-[var(--lp-muted)]">
        切替時刻を6:00にしたお店の記録
      </figcaption>

      <ol className="mt-6">
        {marks.map((m, i) => (
          <li key={m.time} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                aria-hidden="true"
                className={`size-3.5 shrink-0 rounded-full ${
                  m.on
                    ? "bg-[var(--lp-cyan)] shadow-[0_0_16px_var(--lp-cyan)]"
                    : "bg-[rgba(255,255,255,0.28)]"
                }`}
              />
              {i < marks.length - 1 && (
                <span
                  aria-hidden="true"
                  className="w-px flex-1 bg-[rgba(255,255,255,0.18)]"
                />
              )}
            </div>
            <div className={i < marks.length - 1 ? "pb-8" : ""}>
              <p className="font-mono text-sm font-bold tabular-nums">
                {m.time}
                <span className="ml-2 font-sans text-xs font-normal text-[var(--lp-muted)] tabular-nums">
                  {m.day}
                </span>
              </p>
              <p className="mt-0.5 text-sm text-[var(--lp-muted)]">{m.label}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-2 rounded-2xl border border-[rgba(69,231,220,0.35)] bg-[rgba(69,231,220,0.1)] p-4">
        <p className="text-sm font-extrabold text-[var(--lp-cyan)]">
          記録される勤怠：1月15日の営業日 ／ 実働6時間 ／ 1件
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-[#E4D9F5]">
          0時をまたいでも2日に分かれません。退勤の3:00は切替の6:00より前なので、前日1月15日の勤務として扱われます。
        </p>
      </div>
    </figure>
  );
}

/* ------------------------------ シフト ------------------------------- */

function ShiftFlow() {
  return (
    <Section
      eyebrow="仕組み その2"
      title="LINEを遡って書き写す作業が、3ステップになる"
      lead="シフト希望の収集から公開まで、みせ勤の中で完結します。集めた希望はそのまま自動生成の入力になるので、転記も突き合わせも要りません。"
    >
      <ol className="grid gap-4 sm:grid-cols-3">
        {SHIFT_STEPS.map(({ no, icon: Icon, title, body }) => (
          <li
            key={no}
            className="rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-surface)] p-6"
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,rgba(255,46,136,0.25),rgba(169,112,255,0.25))] text-[var(--lp-pink-soft)]"
              >
                <Icon className="size-5" />
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-[var(--lp-muted)]">
                STEP {no}
              </span>
            </div>
            <h3 className="mt-4 text-lg font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">
              {body}
            </p>
          </li>
        ))}
      </ol>

      {/* 日本語ルール */}
      <div className="mt-6 grid gap-6 rounded-[1.75rem] border border-[var(--lp-line)] bg-[var(--lp-surface)] p-6 sm:p-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-[rgba(255,216,77,0.14)] px-3 py-1.5 text-xs font-bold text-[var(--lp-yellow)]">
            <Languages className="size-4" aria-hidden="true" />
            ルールは日本語のままでいい
          </p>
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight text-balance">
            設定画面と格闘しなくても、
            <br />
            書いたとおりに組まれる
          </h3>
          <p className="mt-4 leading-[1.85] text-[#E4D9F5]">
            チェックボックスを探して回る必要はありません。ふだん店長が口で言っていることを、そのまま文章で登録します。
            法令に関わるものは必ず守る条件、お店の判断によるものは努力目標として、自動で分けて扱います。
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-bg)] p-5">
          <p className="text-xs font-semibold text-[var(--lp-muted)]">
            入力するのは、こんな文章
          </p>
          <ul className="mt-3 space-y-2.5">
            {[
              "連勤は5日まで",
              "遅番の翌日に早番は入れない",
              "新人は1人で遅番に入れない",
              "土日はホールに最低3人",
            ].map((r) => (
              <li
                key={r}
                className="rounded-xl border border-[var(--lp-line)] bg-[rgba(255,255,255,0.05)] px-3.5 py-2.5 text-sm text-[#E4D9F5]"
              >
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[var(--lp-muted)]">
            <Sparkles
              className="mt-0.5 size-3.5 shrink-0 text-[var(--lp-yellow)]"
              aria-hidden="true"
            />
            登録した文章は自動生成の条件に変換されます。読み取った内容は画面で確認・修正できます。
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------ 法改正 ------------------------------- */

function LawSection() {
  return (
    <section className="relative isolate overflow-hidden border-y border-[var(--lp-line)]">
      <Image
        src={phoneNeon}
        alt=""
        fill
        placeholder="blur"
        sizes="100vw"
        className="-z-20 object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(11,6,20,0.93),rgba(11,6,20,0.97))]"
      />

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-bold text-[var(--lp-yellow)]">
            2027年に向けて
          </p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            次の法改正は、シフト制のお店を
            <Mark color="yellow">まっすぐ直撃します</Mark>
          </h2>
          <p className="mt-6 leading-[1.85] text-[#E4D9F5]">
            厚生労働省の研究会が示した方向のとおりに進めば、深夜営業のシフトは今のままでは組めなくなります。
            手書きの表とLINEでは、そもそも違反しているかどうかに気づけません。
          </p>
        </div>

        <ul className="mt-12 grid gap-4 sm:grid-cols-3">
          {LAW_ITEMS.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="rounded-2xl border border-[rgba(255,216,77,0.28)] bg-[rgba(22,13,36,0.8)] p-6 backdrop-blur-sm"
            >
              <span
                aria-hidden="true"
                className="flex size-11 items-center justify-center rounded-xl bg-[rgba(255,216,77,0.14)] text-[var(--lp-yellow)]"
              >
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">
                {body}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-[var(--lp-muted)]">
          出典：厚生労働省「労働基準関係法制研究会 報告書」（2025年1月）。
          いずれも施行前の検討段階の内容であり、最終的な制度は今後の法案・省令で変わる可能性があります。
          みせ勤は、シフト作成時に条件として設定・チェックできる形で対応します。
        </p>
      </div>
    </section>
  );
}

/* ------------------------------ 機能一覧 ------------------------------ */

function Features() {
  return (
    <Section
      eyebrow="できること"
      title="夜のお店の1ヶ月が、これで一周する"
      lead="希望の収集から打刻、修正の承認、締め処理、給与ソフトへの受け渡しまで。途中でExcelに戻る場面をなくしました。"
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-surface)] p-6 transition-colors duration-200 hover:border-[rgba(255,46,136,0.5)]"
          >
            <span
              aria-hidden="true"
              className="flex size-11 items-center justify-center rounded-xl bg-[rgba(169,112,255,0.18)] text-[var(--lp-violet)]"
            >
              <Icon className="size-5" />
            </span>
            <h3 className="mt-4 text-lg font-bold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">
              {body}
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ------------------------------- 料金 -------------------------------- */

function Pricing() {
  return (
    <section className="border-y border-[var(--lp-line)] bg-[var(--lp-surface)]">
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <p className="text-sm font-bold text-[var(--lp-pink-soft)]">料金</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
          先行して使ってくださる間は、
          <Mark>無料</Mark>
        </h2>
        <p className="mx-auto mt-6 max-w-xl leading-[1.85] text-[#E4D9F5]">
          いま優先しているのは、売上より現場の声です。使ってみて「ここが違う」と言ってくれるお店を探しています。
          店舗数もスタッフ数も、機能の制限もありません。
        </p>

        <ul className="mx-auto mt-10 grid max-w-2xl gap-3 text-left sm:grid-cols-3">
          {[
            "初期費用は0円",
            "クレジットカードの登録なし",
            "やめるときの違約金なし",
          ].map((t) => (
            <li
              key={t}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--lp-line)] bg-[rgba(255,255,255,0.05)] px-4 py-3.5 text-sm font-medium"
            >
              <Check
                className="size-4 shrink-0 text-[var(--lp-cyan)]"
                aria-hidden="true"
                strokeWidth={3}
              />
              {t}
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm leading-relaxed text-[var(--lp-muted)]">
          有料プランを始めるときは、事前にご案内してから切り替えます。使っている途中で勝手に課金が始まることはありません。
        </p>

        <div className="mt-10">
          <CtaButton />
          <CtaMicroCopy />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- 当事者ストーリー -------------------------- */

function Founder() {
  return (
    <Section
      eyebrow="作っている人たち"
      title="自分たちの6店舗で、毎日使っています"
    >
      <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-12">
        <div className="space-y-5 leading-[1.85] text-[#E4D9F5]">
          <p>
            みせ勤を作っているのは、コンカフェを含む6店舗を実際に運営している会社です。
            もともとは、自分たちの店の締め作業がつらすぎて作りました。
          </p>
          <p>
            月末にスプレッドシートを開いて、LINEを遡って、0時で割れた勤務をつなぎ直す。
            退勤の押し忘れを本人に聞いても「たしか3時くらい……」しか返ってこない。
            その2晩をなくすために作ったので、
            <strong className="font-bold text-[var(--lp-pink-soft)]">
              機能はぜんぶ、現場で困ったところから増えています
            </strong>
            。
          </p>
          <p>
            だから、汎用の勤怠アプリのように「まず自分のお店に合わせて設定してください」とは言いません。
            深夜営業とキャストの掛け持ちを、最初からある前提として作ってあります。
          </p>
          <ul className="grid gap-3 pt-2 sm:grid-cols-2">
            {[
              "自社6店舗で日々稼働中",
              "コンカフェ・ガールズバー等を運営",
              "現場の要望から機能を追加",
              "困ったときは開発者に直接届く",
            ].map((t) => (
              <li
                key={t}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--lp-line)] bg-[var(--lp-surface)] px-4 py-3 text-sm font-medium"
              >
                <Check
                  className="size-4 shrink-0 text-[var(--lp-pink)]"
                  aria-hidden="true"
                  strokeWidth={3}
                />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid gap-4">
          <Image
            src={counterMagenta}
            alt="ネオンで照らされた店舗のカウンター"
            placeholder="blur"
            sizes="(min-width: 1024px) 46vw, 100vw"
            className="h-56 w-full rounded-2xl border border-[var(--lp-line)] object-cover sm:h-64"
          />
          <Image
            src={storePink}
            alt="ネオンサインと花で飾られた店内"
            placeholder="blur"
            sizes="(min-width: 1024px) 46vw, 100vw"
            className="h-56 w-full rounded-2xl border border-[var(--lp-line)] object-cover sm:h-64"
          />
        </div>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-[var(--lp-muted)]">
        掲載している写真はイメージです（フリー素材）。実際の店舗の写真ではありません。
      </p>
    </Section>
  );
}

/* ------------------------------- 信頼性 ------------------------------- */

function Trust() {
  return (
    <section className="border-y border-[var(--lp-line)] bg-[var(--lp-surface)]">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading
          eyebrow="安心して任せるために"
          title="勤怠は、給与の根拠になるデータ"
          lead="あとから「誰が何を変えたのか」を説明できることを前提に設計しています。"
        />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {TRUST.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex gap-4 rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-surface-2)] p-6"
            >
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(69,231,220,0.14)] text-[var(--lp-cyan)]"
              >
                <Icon className="size-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--lp-muted)]">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* -------------------------------- FAQ -------------------------------- */

function Faq() {
  return (
    <section className="scroll-mt-20">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <SectionHeading eyebrow="よくある質問" title="はじめる前の疑問" />

        <div className="mt-10 space-y-3">
          {FAQS.map(({ q, a }) => (
            <details
              key={q}
              name="misekin-faq"
              className="group rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-surface)] px-5"
            >
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-bold marker:content-none">
                {q}
                <span
                  aria-hidden="true"
                  className="grid size-7 shrink-0 place-items-center rounded-full border border-[var(--lp-line)] text-[var(--lp-pink-soft)] transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
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
              <p className="pb-5 text-sm leading-[1.8] text-[var(--lp-muted)]">
                {a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ 最終CTA ------------------------------ */

function FinalCta() {
  return (
    <section className="px-4 pb-24 sm:px-6 sm:pb-28">
      <div className="relative isolate mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-[rgba(255,255,255,0.18)]">
        <Image
          src={holo}
          alt=""
          fill
          placeholder="blur"
          sizes="(min-width: 1024px) 64rem, 100vw"
          className="-z-20 object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(160deg,rgba(11,6,20,0.9),rgba(11,6,20,0.82))]"
        />

        <div className="px-6 py-16 text-center sm:px-12 sm:py-20">
          <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-[2.75rem] sm:leading-[1.2]">
            今夜の打刻から、
            <br className="sm:hidden" />
            <Mark>始められます。</Mark>
          </h2>
          <p className="mx-auto mt-5 max-w-xl leading-[1.85] text-[#E4D9F5]">
            店舗を1つ登録して、QRを貼るだけ。今日の出勤から記録が残ります。
            今月の締めを、去年と同じやり方でやる必要はありません。
          </p>
          <div className="mt-9">
            <CtaButton />
            <CtaMicroCopy />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Footer ------------------------------ */

function SiteFooter() {
  return (
    <footer className="border-t border-[var(--lp-line)] pb-24 md:pb-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-9 text-sm text-[var(--lp-muted)] sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2.5 font-bold text-[var(--lp-text)]">
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--lp-pink),var(--lp-violet))] text-[#1A0620]"
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
                  className="min-h-11 leading-[2.75rem] hover:text-[var(--lp-text)]"
                >
                  ログイン
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="min-h-11 leading-[2.75rem] hover:text-[var(--lp-text)]"
                >
                  無料ではじめる
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

/** モバイルのみ、画面下部に常時表示するCTA */
function StickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--lp-line)] bg-[rgba(11,6,20,0.92)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden">
      <Link
        href="/register"
        className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(100deg,var(--lp-pink),#FF6A3D)] text-base font-extrabold text-[#1A0620]"
      >
        無料ではじめる
        <ArrowRight className="size-5" aria-hidden="true" strokeWidth={2.8} />
      </Link>
      <p className="mt-1.5 text-center text-xs text-[var(--lp-muted)]">
        クレジットカード不要・登録は3分
      </p>
    </div>
  );
}

/* ------------------------------ Primitives --------------------------- */

/** 蛍光ペンで引いたようなハイライト */
function Mark({
  children,
  color = "pink",
}: {
  children: React.ReactNode;
  color?: "pink" | "cyan" | "yellow";
}) {
  const bg =
    color === "cyan"
      ? "rgba(69,231,220,0.3)"
      : color === "yellow"
        ? "rgba(255,216,77,0.3)"
        : "rgba(255,46,136,0.34)";
  return (
    <span className="relative inline-block whitespace-nowrap">
      <span
        aria-hidden="true"
        className="absolute inset-x-[-0.08em] bottom-[0.04em] block h-[0.34em] -rotate-1 rounded-[2px]"
        style={{ backgroundColor: bg }}
      />
      <span className="relative">{children}</span>
    </span>
  );
}

function CtaButton() {
  return (
    <Link
      href="/register"
      className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(100deg,var(--lp-pink),#FF6A3D)] px-8 text-lg font-extrabold text-[#1A0620] shadow-[0_10px_40px_rgba(255,46,136,0.45)] transition-transform duration-200 hover:scale-[1.02] sm:w-auto"
    >
      無料ではじめる
      <ArrowRight className="size-5" aria-hidden="true" strokeWidth={2.8} />
    </Link>
  );
}

function CtaMicroCopy() {
  return (
    <p className="mt-3.5 text-sm text-[var(--lp-muted)]">
      クレジットカード不要・店舗の登録は3分・スタッフのアプリは要りません
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
      <p className="text-sm font-bold text-[var(--lp-pink-soft)]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {lead && (
        <p className="mt-5 leading-[1.85] text-[#E4D9F5]">{lead}</p>
      )}
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
