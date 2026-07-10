import type { Metadata } from "next";
import { PageHeader } from "@/components/common/page-header";
import { Clock, FileEdit, Key, HelpCircle, Lock, QrCode, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "ヘルプ",
};

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
          <div key={i} className="px-5 py-4 space-y-1">
            <p className="text-sm font-medium text-foreground">Q. {item.q}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">A. {item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="ヘルプ"
        description="みせ勤の使い方についてよくある質問をまとめています"
        breadcrumbs={[{ label: "ホーム", href: "/dashboard" }, { label: "ヘルプ" }]}
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
            a: "「自分の勤怠」ページから修正申請が可能です。申請には理由の入力が必要で、管理者が承認または却下します。",
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
            a: "管理者はみせ勤にログインして勤怠管理を行います。スタッフは打刻URLからのPIN認証で打刻するのみです（みせ勤アカウント不要）。スタッフを管理者として招待することも可能です。",
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
    </div>
  );
}
