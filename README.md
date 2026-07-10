# みせ勤 (Miseki) - 勤怠管理システム

## 概要

深夜営業対応の飲食店・エンタメ施設向け勤怠管理 Web アプリ。

コンカフェ・メイドカフェ・ガールズバーなど、営業時間が深夜にまたがる店舗の勤怠管理を目的として設計されています。
日付変更時刻 (dayChangeHour) を設定することで、例えば「午前 6 時以前は前日の営業日」として集計できます。

## 機能

- **打刻**: 店舗ごとの打刻 URL + スタッフ PIN 認証による出退勤打刻
- **深夜営業対応**: 営業日判定 (dayChangeHour) による日付跨ぎシフトの正確な集計
- **勤怠管理**: 管理者による勤怠一覧・修正・承認
- **修正申請**: スタッフによる打刻修正申請と管理者レビュー
- **締め処理**: 期間ロック機能による給与計算対象の確定
- **外部 API**: APIキー認証による REST API (勤怠・スタッフ・店舗一覧)
- **CSV エクスポート**: 勤怠データの CSV 出力
- **通知**: 管理者・スタッフへの通知 (メール / アプリ内)
- **異常検知**: 退勤打刻漏れ・長時間勤務の自動検知

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | TypeScript |
| ORM | Prisma 7 (PostgreSQL) |
| 認証 | Auth.js v5 |
| UI | Tailwind CSS v4 + shadcn/ui + Radix UI |
| メール | Resend + React Email |
| 日時 | date-fns + date-fns-tz |
| バリデーション | Zod v4 |
| フォーム | React Hook Form |

## セットアップ

### 前提条件

- Node.js 20 以上
- PostgreSQL 15 以上
- npm または互換パッケージマネージャー

### インストール

```bash
# 依存パッケージインストール
npm install

# 環境変数設定
cp .env.example .env.local
# .env.local を編集 (DATABASE_URL 等を設定)

# データベースマイグレーション & Prisma クライアント生成
npx prisma migrate dev
npx prisma generate

# シードデータ投入
npx tsx prisma/seed.ts

# 開発サーバー起動
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## 環境変数

`.env.local` に以下の変数を設定してください。

| 変数名 | 説明 | 例 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 接続 URL | `postgresql://user:pass@localhost:5432/misekin` |
| `AUTH_SECRET` | Auth.js シークレット (32 文字以上のランダム文字列) | `openssl rand -base64 32` で生成 |
| `NEXTAUTH_URL` | アプリの公開 URL | `http://localhost:3000` |
| `RESEND_API_KEY` | Resend API キー (メール送信) | `re_xxxxxxxxxxxx` |
| `NEXT_PUBLIC_APP_URL` | フロントエンドから参照する公開 URL | `http://localhost:3000` |

## シードデータ

`npx tsx prisma/seed.ts` を実行すると以下のテストデータが投入されます。

### アカウント

| ロール | メール | パスワード |
|---|---|---|
| 管理者 (OWNER) | admin@example.com | password123 |

### 店舗

| 店舗名 | コード |
|---|---|
| 新宿店 | SHINJUKU |
| 渋谷店 | SHIBUYA |
| 池袋店 | IKEBUKURO |

### スタッフ (10 名)

全スタッフの PIN は `1234` です。

| 名前 | メール | 主な所属店舗 |
|---|---|---|
| 佐藤 花子 | hanako@example.com | 新宿店, 池袋店 |
| 田中 美咲 | misaki@example.com | 新宿店, 池袋店 |
| 鈴木 愛 | ai@example.com | 新宿店 |
| 伊藤 優花 | yuka@example.com | 新宿店 |
| 渡辺 さくら | sakura@example.com | 渋谷店, 新宿店 |
| 小林 麻衣 | mai@example.com | 渋谷店 |
| 加藤 莉子 | riko@example.com | 渋谷店 |
| 吉田 ひなた | hinata@example.com | 渋谷店, 池袋店 |
| 山田 のの | nono@example.com | 池袋店 |
| 中村 れな | rena@example.com | 池袋店 |

勤怠データは過去 7 日間分が生成されます (時給: 1,100 円/時)。

シード実行時にコンソールへテスト用 API キーが出力されます。再表示はできないため安全な場所に保管してください。

## 外部 API

外部システムとの連携用 REST API です。

### 認証

```
Authorization: Bearer {APIキー}
```

API キーはアプリの管理画面から発行します。キーごとに店舗スコープ (アクセス可能な店舗) を制限できます。

### エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/v1/attendance` | 勤怠一覧 |
| GET | `/api/v1/staff` | スタッフ一覧 |
| GET | `/api/v1/stores` | 店舗一覧 |

### GET /api/v1/attendance

**クエリパラメータ**

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `storeId` | string | - | 店舗 ID でフィルタ |
| `staffId` | string | - | スタッフ ID でフィルタ |
| `from` | string (YYYY-MM-DD) | - | 開始営業日 |
| `to` | string (YYYY-MM-DD) | - | 終了営業日 |
| `page` | number | 1 | ページ番号 |
| `limit` | number | 50 | 1 ページあたり件数 (最大 100) |

### GET /api/v1/staff

**クエリパラメータ**

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `storeId` | string | - | 店舗 ID でフィルタ |
| `status` | string | - | ステータスでフィルタ (ACTIVE / INVITED / ON_LEAVE / RESIGNED) |
| `page` | number | 1 | ページ番号 |
| `limit` | number | 50 | 1 ページあたり件数 (最大 100) |

### GET /api/v1/stores

**クエリパラメータ**

| パラメータ | 型 | デフォルト | 説明 |
|---|---|---|---|
| `page` | number | 1 | ページ番号 |
| `limit` | number | 50 | 1 ページあたり件数 (最大 100) |

### レスポンス形式

すべてのエンドポイントは以下の共通形式で返します。

```json
{
  "data": [ ... ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 50,
    "hasNextPage": true
  }
}
```

エラー時:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "..."
  }
}
```

## ディレクトリ構成

```
misekin/
├── prisma/
│   ├── schema.prisma       # Prisma スキーマ
│   ├── migrations/         # マイグレーションファイル
│   └── seed.ts             # シードデータ
├── src/
│   ├── app/
│   │   ├── (app)/          # 管理者向け画面 (ダッシュボード・勤怠・スタッフ管理等)
│   │   ├── (auth)/         # 認証画面 (ログイン・パスワードリセット)
│   │   ├── (onboarding)/   # 初期設定 (組織作成・店舗設定)
│   │   ├── clock/          # 打刻画面 (スタッフ向け)
│   │   └── api/
│   │       ├── auth/       # Auth.js ハンドラー
│   │       └── v1/         # 外部 REST API
│   │           ├── attendance/
│   │           ├── staff/
│   │           └── stores/
│   ├── actions/            # Server Actions
│   │   ├── attendance.ts
│   │   ├── auth.ts
│   │   ├── organization.ts
│   │   ├── staff.ts
│   │   └── store.ts
│   ├── components/         # UI コンポーネント
│   ├── generated/
│   │   └── prisma/         # Prisma 生成クライアント (@/generated/prisma)
│   └── lib/
│       ├── api/
│       │   └── api-key.ts  # APIキー生成・検証
│       ├── auth/           # Auth.js 設定・権限チェック
│       ├── business/       # ビジネスロジック
│       │   ├── attendance.ts
│       │   ├── anomaly-detection.ts
│       │   ├── business-day.ts
│       │   └── time-clock.ts
│       ├── db/
│       │   └── index.ts    # Prisma クライアントシングルトン
│       ├── email/          # Resend メール送信
│       └── validations/    # Zod スキーマ
├── docs/                   # 設計ドキュメント
├── emails/                 # React Email テンプレート
├── package.json
├── prisma.config.ts
└── tsconfig.json
```

## 開発ガイド

### データベースリセット

```bash
# マイグレーションをリセットしてシードを再投入
npx prisma migrate reset
```

### Prisma Studio

```bash
npx prisma studio
```

### 型チェック

```bash
npx tsc --noEmit
```

### 営業日ロジック

`dayChangeHour` (デフォルト 6) を基準に営業日を判定します。

例: `dayChangeHour=6` の場合
- 2024-01-15 06:00 (JST) 以降 → businessDate = `2024-01-15`
- 2024-01-15 05:59 (JST) 以前 → businessDate = `2024-01-14` (前日扱い)

深夜 0 時〜早朝 6 時の打刻は前日の営業日に紐付けられます。
