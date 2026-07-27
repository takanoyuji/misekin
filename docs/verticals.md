# 業態版（Vertical）の設計

最終更新: 2026-07-26

みせ勤は、コンカフェ版・シーシャ版のように**業態ごとに別サービスのように見せる**が、
中身は同一プラットフォーム。ここではその設計と、版を増やすときの手順をまとめる。

---

## 1. 大前提

**リポジトリもDBも分けない。「版」は表示プリセットにすぎない。**

分けると機能追加もバグ修正も業態の数だけ増える。とくに兼業（コンカフェとシーシャを
両方運営）のとき、組織を分けると**掛け持ちスタッフの横断集計・締め処理・CSV出力**という
既存の強みが壊れる。組織を分けるべきなのは法人が別のときだけで、業態は理由にならない。

### 版ごとに変えるのは3つだけ

| | 変える | 変えない |
|---|---|---|
| 用語 | 画面に出る名詞（キャスト / スタッフ） | DBの値・監査ログ・CSVヘッダー・APIのフィールド名 |
| トンマナ | LPの配色、アプリのアクセント色 | 背景・文字・境界のニュートラル階調、情報構造 |
| 初期プロンプト | シフト時間帯、ルールのテンプレート | 変更後の値（DBに入ったら版と無関係） |

スキーマ・ビジネスロジック・権限・締め処理・打刻・APIはすべて共通。

---

## 2. 3つの関心事と、その置き場所

| 関心事 | 置き場所 | 粒度 | 兼業のとき |
|---|---|---|---|
| **どの版から来たか**（獲得経路） | `Organization.vertical` | 組織 | 最初のまま。**変えない** |
| **表示用語** | `Organization.staffTerm` | 組織 | 「スタッフ」に設定する |
| **シフトの組み方** | `Store.category` → ShiftSlot / ShiftRule に**コピー** | **店舗** | 店舗ごとに正しいものが入る |
| **トンマナ** | 店舗カテゴリから導出 | 組織＋店舗 | 中立配色に落ちる |

`vertical` は「記録」であってモードスイッチではない。あとから変えると獲得分析が壊れるので変えない。
`staffTerm` は「運用設定」なので、いつでも変えられる。この2つを同じカラムに載せると
「兼業になったから用語を変えたい → でも版を変えると分析が壊れる」という矛盾が起きる。

---

## 3. 配色の解決ルール

`src/lib/verticals/index.ts` の `resolveOrganizationThemeKey()` / `resolveStoreThemeKey()`。

```
組織の配色:
  版に対応する業態の店舗が1種類だけ → その版の配色（LPと揃う）
  2種類以上                        → 中立（どの店舗にも寄らない）
  0件（未登録／版のない業態のみ）    → 登録経路の版に従う

店舗ページの配色:
  その店舗の業態に寄せる
  版を持たない業態のときは組織の配色をそのまま使う（画面が浮かないように）
```

中立配色は `globals.css` の既定（インディゴ）と同じ値。どの業態にも寄らないが、
他の版と同じ密度で設計されている。

### 適用のしかた

`ThemeScope`（`src/components/layout/theme-scope.tsx`）が、アクセント系のCSS変数だけを
その要素以下に流し込む。ライト/ダークの両モードぶんを出すので、テーマ切替は壊れない。

- `(app)/layout.tsx` … 組織の配色（サイドバー・ヘッダー含む）
- `stores/[id]/page.tsx` … その店舗の配色（入れ子にすると内側が勝つ）

### 色の制約

CTAとプライマリの文字色は、必ず背景に対して **4.5:1 以上**にすること。

- コンカフェ版のアプリ primary は `#BE4285`（白抜きで4.87:1）。
  LPの `#CE5999` は白抜きだと3.8:1でAA未達なので、アプリではそのまま使わない
- シーシャ版は `#1E7A5E`（白抜きで5.25:1）
- LPのグラフの棒は `#CE5999`（面のコントラスト3.6:1。`dataviz` のバリデータで確認済み）

---

## 4. ルーティング

| | |
|---|---|
| LP | `/concafe` `/shisha`（`src/app/(marketing)/[vertical]/page.tsx`） |
| 旧URL | `/lp` → `/concafe` へリダイレクト |
| 登録・ログイン | `/register?v=<slug>`。版はクッキーで引き継ぐ（下記） |
| アプリ本体 | `/dashboard` など共通。版による分岐なし |

### ログイン前の版の引き継ぎ

LPを見た人が登録に進んだときにトンマナと言葉が途切れないよう、**middleware がクッキー
（`misekin_vertical`、30日）に版を書き込む**。拾う元は2つ:

1. LPのパス（`/shisha`）
2. CTAが付ける `?v=shisha`

`(auth)` と `(onboarding)` のレイアウトは `getVerticalFromCookie()` でこれを読み、
ThemeScope を適用する。クッキーが無ければ既定版に落ちる。

組織を作るとき（`createOrganizationWithStore`）も同じクッキーを読み、
`Organization.vertical` / `staffTerm`、最初の店舗の `category`、シフトの時間帯を決める。
ここでログイン前と後のトンマナがつながる。

`generateStaticParams` + `dynamicParams = false` なので、`/concafe` `/shisha` 以外は404。
静的セグメント（`/login` 等）はApp Routerの優先順位で先に解決されるため競合しない。

`src/middleware.ts` の `PUBLIC_PREFIXES` は `VERTICAL_SLUGS` から生成している。
版を足すと自動で公開パスになる。

> ドメインは1つ。「別サービス感」はパスとトンマナで作り、ブランド（みせ勤）は共通のまま
> ヘッダーに版名バッジを出す。独自ドメインに移すときは `basePath: /dev/misekin` を外すこと。

---

## 5. ファイル構成

```
src/lib/verticals/
  types.ts     … 型定義（Vertical / LpTheme / AppTheme / Terms / VerticalDefaults）
  themes.ts    … 配色。APP_THEMES（concafe/shisha/neutral）と LP_THEME 2種
  content.ts   … 両版で共通のLPコピー。用語と業態名だけ差し込む
  concafe.ts   … コンカフェ版の固有部分
  shisha.ts    … シーシャ版の固有部分
  index.ts     … レジストリと解決ロジック（クライアントからも読める）
  server.ts    … DBに触る解決（getOrgPresentation）。server-only
src/components/layout/theme-scope.tsx
src/app/(marketing)/[vertical]/page.tsx  … LPテンプレート（両版で共有）
public/lp/{concafe,shisha}/              … 各版の画像6枚
```

**LPのコピーは `content.ts` に一本化してある。** ここを直せば両版が同時に良くなる。
版固有ファイルには、ヒーロー・課題・売上の語り口・画像・ルールテンプレートだけを置く。

---

## 6. 版を追加する手順

1. `types.ts` の `VERTICAL_SLUGS` にスラッグを足す
2. `themes.ts` に `APP_THEMES` の1エントリと LP テーマを足す（コントラストを必ず検証）
3. `public/lp/<slug>/` に画像6枚（hero / pains / band / pricing / founder-a / founder-b）
4. `<slug>.ts` を作って `Vertical` を1つ書く
5. `index.ts` の `VERTICALS` と `categoryToThemeKey()` に足す
6. Prisma の `Vertical` enum に値を足し、`migrations.sql` に `ADD VALUE IF NOT EXISTS` を追記
7. `tests/unit/verticals.test.ts` にケースを足す

LPテンプレート・middleware・レイアウトは触らなくてよい。

---

## 7. 実装済みの範囲と、残っていること

### 済み

- Verticalレジストリ（用語・配色・LPコンテンツ・初期値・翻訳器ヒント）
- LPテンプレート化＋シーシャ版（`/concafe` `/shisha` とも静的生成）
- `Organization.vertical` / `Organization.staffTerm`（schema.prisma / schema.sql / migrations.sql）
- アプリ本体への配色適用（組織単位＋店舗ページ単位）
- 店舗作成時にシフト時間帯を業態から**コピー**投入（`src/actions/store.ts`）
- シフトルール画面に業態別テンプレートのプリセット（押すと入力欄に入る）
- 用語の適用: サイドバー、スタッフ一覧・追加・詳細
- ログイン前（登録・ログイン・初期設定）へのトンマナ引き継ぎ（`misekin_vertical` クッキー）
- 登録時に `Organization.vertical` / `staffTerm`、最初の店舗の業態と時間帯を版から決定

### 残っていること

- **用語の適用範囲**。まだ「スタッフ」と直書きの画面が残っている
  （シフト管理、修正申請、交通費申請、使い方ヘルプ、ダッシュボード）。
  対象は画面に出る名詞だけで、監査ログ・CSVヘッダー・APIフィールドは触らないこと
- **`staffTerm` を変更するUI**。いまは既定値のまま。組織設定にセレクトを置く。
  自動では切り替えない（勝手に言葉が変わるのは驚きが大きい）。
  複数業態の店舗ができたら「呼び方を『スタッフ』に揃えますか？」と案内する程度でよい
  （`getOrgPresentation()` が `isMixed` を返すので判定はできる）
- **翻訳器への `translatorHint` の接続**。`shift-rule-translator.ts` の SYSTEM_PROMPT は
  まだ業態を見ていない。ここは「解釈の仕方」なのでコピーせず参照でよい
  （翻訳結果はDBに保存済みのため、あとから改善しても既存ルールは書き換わらない）
- **DBマイグレーションの適用確認**。ローカルにDBもDockerも無く未検証。
  `migrations.sql` は冪等に書いてあるが、本番反映前に検証環境で流すこと

---

## 8. 注意

- **プリセットは参照ではなくコピー**。テンプレートを直したときに既存店のシフト条件が
  勝手に変わらないようにするため。`createStore` で `createMany` している
- **`if (vertical === "concafe")` をコンポーネントに書かない**。3版目で破綻する。必ずレジストリ経由
- **LPページを複製しない**。改善コストが版の数だけ増える
- **表示用語をDBに保存しない**。版や設定を変えた瞬間に過去データの表記が矛盾する
