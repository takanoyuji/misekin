import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { requireOrgMember } from "@/lib/auth/permissions";
import { resolveActiveOrganizationId } from "@/lib/auth/active-org";
import { PageHeader } from "@/components/common/page-header";
import {
  CalendarClock,
  Clock,
  FileEdit,
  HelpCircle,
  Key,
  Lock,
  Rocket,
  Users,
  Wallet,
} from "lucide-react";

export const metadata: Metadata = {
  title: "使い方・ヘルプ",
};

/* ------------------------------- 手順ガイド ------------------------------- */

interface Step {
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
}

function GettingStarted({
  title,
  description,
  steps,
}: {
  title: string;
  description: string;
  steps: Step[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Rocket className="size-4 text-primary" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <p className="px-5 pt-4 text-sm text-muted-foreground">{description}</p>
      <ol className="space-y-4 p-5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary font-numeric text-xs font-semibold text-primary-foreground"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">{s.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
              {s.href && (
                <Link
                  href={s.href}
                  className="inline-flex min-h-9 items-center text-xs font-medium text-primary hover:underline"
                >
                  {s.hrefLabel ?? "開く"} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* --------------------------------- FAQ --------------------------------- */

interface HelpSectionProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: { q: string; a: string }[];
}

function HelpSection({ icon: Icon, title, items }: HelpSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-border">
        {items.map((item, i) => (
          <div key={i} className="space-y-1 px-5 py-4">
            <p className="text-sm font-medium text-foreground">Q. {item.q}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A. {item.a}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ メンバー向け ------------------------------ */

function MemberHelp() {
  return (
    <>
      <GettingStarted
        title="はじめての使い方（スタッフ向け）"
        description="みせ勤でやることは大きく2つ、「打刻」と「シフト希望の提出」です。上から順に見れば一通り使えます。"
        steps={[
          {
            title: "① 店舗の打刻URL（QR）から自分を選ぶ",
            body: "店舗に掲示された打刻用のQRコードをスマホで読み取り、スタッフ一覧から自分の名前を選びます。みせ勤へのログインは不要です。",
          },
          {
            title: "② PINを入力して出勤・休憩・退勤を打刻",
            body: "自分の名前を選んだあと、4〜8桁のPINを入力すると打刻できます。PINが分からないときは店舗の管理者に発行してもらってください。",
          },
          {
            title: "③ シフト希望を出す",
            body: "「シフト希望」ページで、日ごと・時間帯ごと（早番/遅番など）に「希望／可／不可」を選びます。同じボタンをもう一度押すと取り消せます。提出できる期間は店舗ごとに決まっています。",
            href: "/my-shifts",
            hrefLabel: "シフト希望を開く",
          },
          {
            title: "④ 公開されたシフトを確認",
            body: "管理者がシフトを公開すると、同じ「シフト希望」ページに自分の確定シフト（時間帯・時刻）が表示されます。",
            href: "/my-shifts",
            hrefLabel: "シフトを確認",
          },
          {
            title: "⑤ 間違いは「修正申請」で直す",
            body: "打刻の押し忘れ・時刻の間違いや、交通費の変更は自分で申請できます。管理者が承認すると反映されます。",
            href: "/my-correction-requests",
            hrefLabel: "修正申請を開く",
          },
        ]}
      />

      <HelpSection
        icon={CalendarClock}
        title="シフト希望について"
        items={[
          {
            q: "「希望」と「可」は何が違いますか？",
            a: "「希望」はできれば入りたい枠、「可」は入れるけど特に希望はしない枠です。管理者が自動でシフトを組むとき、「希望」を優先的に割り当てます。「不可」はその時間帯に入れないという意味です。",
          },
          {
            q: "早番・遅番などの時間帯は誰が決めますか？",
            a: "店舗ごとに管理者が設定します。店舗によって時間帯の数や時刻は異なります。表示されている時間帯ごとに希望を出してください。",
          },
          {
            q: "いつまでにシフト希望を出せばいいですか？",
            a: "提出できる期間は店舗ごとに設定されています（月ごと・週ごとなど）。「シフト希望」ページに提出可能な期間が表示されるので、その範囲で入力してください。",
          },
        ]}
      />

      <HelpSection
        icon={Clock}
        title="打刻について"
        items={[
          {
            q: "打刻はどこからしますか？",
            a: "店舗に掲示された打刻用QRコード（またはURL）を開き、自分を選んでPINを入力します。出勤・休憩開始・休憩終了・退勤の操作ができます。",
          },
          {
            q: "PINを忘れてしまいました。",
            a: "PINは店舗の管理者が発行します。管理者に連絡して、新しいPINを設定してもらってください。",
          },
          {
            q: "退勤の打刻を忘れました。",
            a: "「修正申請」から退勤時刻の修正を申請できます。理由を添えて申請すると、管理者が確認して反映します。",
          },
        ]}
      />

      <HelpSection
        icon={Wallet}
        title="交通費・給与について"
        items={[
          {
            q: "交通費を変えたいです。",
            a: "「交通費申請」から変更を申請できます。金額を勝手に変えるのではなく、管理者が承認する形で反映されます。",
          },
          {
            q: "自分の勤務時間や給与はどこで見られますか？",
            a: "「自分の勤怠」ページで勤務記録を確認できます。給与は締め処理で確定した分のみ表示されます。",
          },
        ]}
      />
    </>
  );
}

/* ------------------------------ 管理者向け ------------------------------ */

function AdminHelp() {
  return (
    <>
      <GettingStarted
        title="はじめての方へ（管理者向け）"
        description="初めて使うときは、この順番で設定するとスムーズです。各ステップのリンクからその画面へ移動できます。"
        steps={[
          {
            title: "① 店舗を作る",
            body: "まず管理する店舗を登録します。営業日の切替時刻（深夜営業の日付判定）もここで設定します。",
            href: "/stores",
            hrefLabel: "店舗一覧を開く",
          },
          {
            title: "② スタッフを登録してPINを配る",
            body: "スタッフを登録し、打刻用のPIN（4〜8桁）を設定します。スタッフはみせ勤アカウント不要で、PINだけで打刻できます。",
            href: "/staff",
            hrefLabel: "スタッフ一覧を開く",
          },
          {
            title: "③ 打刻URL（QRコード）を店舗に掲示",
            body: "店舗詳細の「打刻URL」からQRコードを表示・印刷し、店舗に掲示します。スタッフはこれを読み取って打刻します。",
            href: "/stores",
            hrefLabel: "店舗詳細から発行",
          },
          {
            title: "④ シフトの時間帯を決める",
            body: "店舗詳細の「シフトの時間帯」で、早番・遅番などの時間帯（名前と開始/終了時刻）を定義します。シフト希望もシフトも、この時間帯ごとに扱います。",
            href: "/stores",
            hrefLabel: "店舗詳細で設定",
          },
          {
            title: "⑤ 希望を集めてシフトを自動生成・公開",
            body: "スタッフから希望が集まったら、「シフト」ページで期間を指定して自動生成します。生成後に手直しして「公開」すると、スタッフに確定シフトが見えます。",
            href: "/shifts",
            hrefLabel: "シフトを開く",
          },
          {
            title: "⑥ 月末に締め処理してエクスポート",
            body: "期間の勤怠を確定（ロック）し、給与計算用にCSVでエクスポートします。締め処理はオーナー権限が必要です。",
            href: "/closing",
            hrefLabel: "締め処理を開く",
          },
        ]}
      />

      <HelpSection
        icon={CalendarClock}
        title="シフト管理について"
        items={[
          {
            q: "早番・遅番などの時間帯はどこで設定しますか？",
            a: "「店舗一覧」→ 各店舗の詳細画面にある「シフトの時間帯」で設定します。名前と開始/終了時刻を登録すると、その時間帯ごとにスタッフが希望を出し、シフトも時間帯単位で組めます。店舗ごとに時間帯を変えられます。",
          },
          {
            q: "シフト希望の提出期間はどう決めますか？",
            a: "店舗詳細の「シフト希望の提出期間」で、月ごと・週ごとなどの単位と開始日を設定します。既定は月次です。スタッフの「シフト希望」ページには、この設定に沿った提出可能期間が表示されます。",
          },
          {
            q: "シフトの自動生成はどう動きますか？",
            a: "「シフト」ページで期間を指定して自動生成すると、最適化エンジンが割り当てを作ります。連続勤務や勤務間インターバルなど法令に関わる制約は必ず守る条件として扱い、スタッフの「希望」はできるだけ叶えるよう最適化します。生成結果はあくまで下書きなので、必ず確認・調整してください。",
          },
          {
            q: "自動生成の後で手直しできますか？",
            a: "できます。「シフト」ページで時間帯タブを切り替え、各セルの＋／−で個別にシフトを追加・削除できます。必要人数を満たしていない時間帯は警告で分かります。",
          },
          {
            q: "「1日13連勤まで」などのルールを日本語で設定できますか？",
            a: "「シフトルール」ページで、日本語で書いたルールを登録できます。内容を構造化して自動生成の条件に反映します。法令に関わるものは必ず守る条件、店舗判断のものは努力目標として扱います。",
          },
        ]}
      />

      <HelpSection
        icon={Clock}
        title="打刻について"
        items={[
          {
            q: "スタッフはどうやって出勤打刻をしますか？",
            a: "店舗の打刻URLにアクセスし、スタッフ一覧から自分を選択してPINを入力します。出勤・休憩・退勤の操作ができます。打刻URLはQRコードとして印刷して店舗に掲示することをお勧めします。",
          },
          {
            q: "打刻URLはどこで確認できますか？",
            a: "「店舗一覧」→ 各店舗の詳細画面にある「打刻URL」セクションで確認できます。QRコードの表示やURLのコピー、再発行も同じ画面から行えます。",
          },
          {
            q: "PINを忘れたスタッフはどうすればいいですか？",
            a: "管理者が「スタッフ詳細」→「PIN設定」から新しいPINを設定してください。4〜8桁の数字で設定できます。",
          },
          {
            q: "深夜の勤務はどの営業日として記録されますか？",
            a: "「日付切替時刻」の設定に基づいて判定されます。例えば切替時刻が06:00の場合、翌日5:59までの打刻は前日の勤務として記録されます。",
          },
          {
            q: "退勤打刻を忘れた場合はどうなりますか？",
            a: "「退勤漏れ」ステータスとなり、管理者ダッシュボードに表示されます。管理者が「勤怠修正」から手動で退勤時刻を入力してください。",
          },
        ]}
      />

      <HelpSection
        icon={FileEdit}
        title="勤怠修正・修正申請について"
        items={[
          {
            q: "管理者が勤怠を修正するにはどうすればいいですか？",
            a: "「勤怠一覧」から対象の勤怠レコードを選択し、「修正する」ボタンをクリックします。修正理由の入力が必要です。修正履歴は自動的に保存されます。",
          },
          {
            q: "スタッフが自分で修正申請できますか？",
            a: "「自分の勤怠」ページから修正申請が可能です。付け忘れ（打刻漏れ）の申請にも対応しています。申請には理由の入力が必要で、管理者が承認または却下します。",
          },
          {
            q: "締め処理後は修正できますか？",
            a: "締め処理（ロック）済みの勤怠は修正できません。締めを解除するにはオーナー権限が必要です。",
          },
        ]}
      />

      <HelpSection
        icon={Lock}
        title="締め処理について"
        items={[
          {
            q: "締め処理とは何ですか？",
            a: "指定した期間の勤怠データを確定し、それ以上修正できないようにロックする機能です。給与計算などの締め作業に使用します。",
          },
          {
            q: "締め処理はどこから行いますか？",
            a: "「締め処理」ページで期間を指定して締め期間を作成し、「ロックする」ボタンで実行します。オーナー権限が必要です。",
          },
        ]}
      />

      <HelpSection
        icon={Key}
        title="外部APIについて"
        items={[
          {
            q: "外部APIとは何ですか？",
            a: "給与計算ソフトや他のシステムと連携するためのREST APIです。APIキーを使って認証します。",
          },
          {
            q: "APIキーはどこで発行できますか？",
            a: "「APIキー管理」ページ（オーナー限定）でAPIキーを発行できます。発行時に表示されるキーは一度しか確認できないため、安全な場所に保存してください。",
          },
          {
            q: "利用可能なAPIエンドポイントは何ですか？",
            a: "GET /api/v1/attendance（勤怠一覧）、GET /api/v1/staff（スタッフ一覧）、GET /api/v1/stores（店舗一覧）が利用可能です。認証はAuthorizationヘッダーにBearer {APIキー}を指定してください。",
          },
        ]}
      />

      <HelpSection
        icon={Users}
        title="スタッフ・管理者について"
        items={[
          {
            q: "スタッフと管理者の違いは何ですか？",
            a: "管理者はみせ勤にログインして勤怠・シフトの管理を行います。スタッフは打刻URLからのPIN認証で打刻・シフト希望を行うのみです（みせ勤アカウント不要）。スタッフを管理者として招待することも可能です。",
          },
          {
            q: "管理者の店舗アクセスを制限できますか？",
            a: "可能です。ADMIN権限の管理者は特定の店舗のみ管理できるよう制限できます（OWNER権限は全店舗アクセス可能）。",
          },
        ]}
      />

      <HelpSection
        icon={HelpCircle}
        title="よくある質問"
        items={[
          {
            q: "複数の組織を管理できますか？",
            a: "はい。右上のユーザーメニューから組織を切り替えることができます。",
          },
          {
            q: "データはCSVでエクスポートできますか？",
            a: "「エクスポート」ページから勤怠データをCSV形式でダウンロードできます。期間や店舗での絞り込みも可能です。",
          },
          {
            q: "お問い合わせはどこにすればいいですか？",
            a: "GitHub のIssueページからご連絡ください。",
          },
        ]}
      />
    </>
  );
}

/* --------------------------------- Page --------------------------------- */

export default async function HelpPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = await resolveActiveOrganizationId(
    session.user?.id,
    (session as any).activeOrganizationId as string | null
  );

  let isMember = false;
  if (activeOrgId) {
    try {
      const ctx = await requireOrgMember(session.user!.id, activeOrgId);
      isMember = ctx.role === "MEMBER";
    } catch {
      // 組織メンバーでない場合は管理者向け（既定）を表示
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="使い方・ヘルプ"
        description={
          isMember
            ? "みせ勤の使い方をまとめています。打刻とシフト希望の出し方はこちら。"
            : "みせ勤の使い方とよくある質問をまとめています。初めての方は上の「はじめての方へ」から。"
        }
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "使い方・ヘルプ" },
        ]}
      />

      {isMember ? <MemberHelp /> : <AdminHelp />}
    </div>
  );
}
