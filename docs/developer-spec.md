# みせ勤 開発者向け仕様書

## 1. プロジェクト概要

多店舗・多組織対応の勤怠管理SaaS。店舗スタッフはトークンベースの打刻URLから打刻し、管理者はWebUIで勤怠を管理する。外部システム向けのREST APIも提供する。

### 技術スタック

| 項目 | 技術 |
|------|------|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | TypeScript |
| ORM | Prisma 7 + `@prisma/adapter-pg` (pg driver adapter) |
| 認証 | Auth.js v5 (next-auth) — JWT strategy |
| DB | PostgreSQL 16 |
| メール | Resend API |
| バリデーション | Zod v4 |
| スタイリング | Tailwind CSS v4 |
| テスト | Vitest |
| デプロイ | Docker Compose (Next.js standalone build) |

### 重要な制約・注意点

- **Prismaのimport**: `@/generated/prisma` （`@prisma/client` ではない）
- **Zod v4**: エラーは `.issues`（`.errors` は存在しない）。スキーマの `.default()` はフォームで使わず、formの `defaultValues` で代替
- **Server Actions**: ファイル先頭に `"use server"` ディレクティブ必須
- **セッションのorgId**: `(session as any).activeOrganizationId as string | null`（cookieから取得）
- **basePath**: `/dev/misekin`。Auth.jsの `signIn({ redirectTo })` にはbasePath込みのパスを渡すこと
- **Next.js 16**: 破壊的変更あり。`node_modules/next/dist/docs/` 参照

---

## 2. アーキテクチャ

### ディレクトリ構成

```
src/
├── app/
│   ├── (app)/          # 管理者UI（要認証）
│   │   ├── dashboard/
│   │   ├── attendance/
│   │   ├── staff/
│   │   ├── stores/
│   │   ├── admins/
│   │   ├── closing/
│   │   ├── correction-requests/
│   │   ├── export/
│   │   ├── api-keys/
│   │   ├── audit-logs/
│   │   ├── organization/
│   │   ├── account/
│   │   ├── my-attendance/
│   │   ├── my-correction-requests/
│   │   ├── my-stores/
│   │   ├── notifications/
│   │   └── help/
│   ├── (auth)/         # 認証フロー（未ログイン）
│   │   ├── login/
│   │   ├── register/
│   │   ├── verify-email/
│   │   └── reset-password/
│   ├── (onboarding)/   # 初回セットアップ
│   │   └── onboarding/
│   ├── clock/          # 打刻UI（public, token認証）
│   │   └── [token]/
│   │       ├── page.tsx        # スタッフ選択
│   │       ├── pin/            # PIN入力
│   │       ├── status/         # 現在状態表示
│   │       └── complete/       # 打刻完了
│   ├── api/
│   │   ├── auth/[...nextauth]/ # Auth.js ハンドラ
│   │   └── v1/                 # 外部REST API
│   │       ├── attendance/
│   │       ├── staff/
│   │       └── stores/
│   └── page.tsx        # ルート（ログイン状態に応じてリダイレクト）
├── actions/            # Server Actions
│   ├── attendance.ts
│   ├── staff.ts
│   ├── store.ts
│   ├── organization.ts
│   ├── admin.ts
│   ├── closing.ts
│   ├── api-key.ts
│   ├── auth.ts
│   └── account.ts
├── lib/
│   ├── auth/
│   │   ├── index.ts    # NextAuth設定（JWT strategy）
│   │   ├── config.ts   # Edge Runtime互換のベース設定
│   │   ├── permissions.ts
│   │   └── audit.ts
│   ├── business/
│   │   ├── time-clock.ts
│   │   ├── anomaly-detection.ts
│   │   ├── business-day.ts
│   │   └── attendance.ts
│   ├── db/index.ts     # Prismaクライアント
│   ├── email/index.ts  # Resend APIラッパー
│   └── validations/    # Zodスキーマ
└── types/
    └── next-auth.d.ts  # session.user.id の型補強
```

---

## 3. データモデル

### エンティティ関係

```
Organization
  ├── OrganizationMember (User → Organization, role: OWNER/ADMIN)
  │   └── StoreAdmin (Member → Store, スコープ制限)
  ├── Store
  │   ├── StoreClockUrl (打刻用トークン)
  │   └── StaffStore (Staff ↔ Store の中間テーブル)
  │       ├── WageHistory (時給履歴)
  │       └── TransportationHistory (交通費履歴)
  ├── Staff
  │   └── (同上 StaffStore)
  └── Attendance
      ├── AttendanceEvent (打刻イベントログ)
      ├── Break (休憩記録)
      ├── AttendanceCorrection (修正履歴)
      └── CorrectionRequest (スタッフからの修正申請)
```

### 主要テーブル詳細

#### Staff
```prisma
model Staff {
  id             String      @id @default(cuid())
  organizationId String
  userId         String?     // ログインアカウントとの紐付け（任意）
  displayName    String      // 打刻画面表示名
  fullName       String?
  email          String?     // 任意。招待に使用
  phone          String?
  employeeCode   String?
  hireDate       DateTime?
  resignDate     DateTime?
  status         StaffStatus @default(ACTIVE)
  notes          String?
  // ...
}
```

#### StaffStore（中間テーブル）
```prisma
model StaffStore {
  staffId        String
  storeId        String
  startDate      DateTime
  endDate        DateTime?
  isPrimary      Boolean    @default(false)
  canClock       Boolean    @default(true)
  isActive       Boolean    @default(true)
  requirePin     Boolean    @default(true)   // PIN認証を必須とするか
  pinHash        String?                     // bcryptハッシュ
  pinFailCount   Int        @default(0)
  pinLockedUntil DateTime?
  // ...
}
```

#### Attendance
```prisma
model Attendance {
  id              String           @id @default(cuid())
  organizationId  String
  storeId         String
  staffId         String
  businessDate    String           // 営業日 YYYY-MM-DD
  clockInAt       DateTime?
  clockOutAt      DateTime?
  breakMinutes    Int              @default(0)
  workMinutes     Int?
  status          AttendanceStatus @default(IN_PROGRESS)
  hasAnomaly      Boolean          @default(false)
  anomalyReasons  Json             @default("[]")
  adminNotes      String?
  clockOutMemo    String?          // 退勤時のスタッフメモ
  isLocked        Boolean          @default(false)
  closingPeriodId String?
  // ...
}
```

### ステータスEnum

```typescript
// スタッフ在籍状態
enum StaffStatus { INVITED, ACTIVE, ON_LEAVE, RESIGNED, SUSPENDED }

// 勤怠状態
enum AttendanceStatus {
  IN_PROGRESS,        // 勤務中
  COMPLETED,          // 正常完了
  MISSING_CLOCK_OUT,  // 退勤未打刻
  MISSING_BREAK_END,  // 休憩未終了
  ANOMALY             // その他異常
}

// 打刻イベント種別
enum ClockEventType { CLOCK_IN, BREAK_START, BREAK_END, CLOCK_OUT }

// 打刻ソース
enum ClockSource { STORE_URL, ADMIN, SYSTEM }

// 修正申請状態
enum CorrectionRequestStatus { PENDING, APPROVED, REJECTED }
```

---

## 4. 認証・認可

### セッション管理

Auth.js v5 + JWT strategy。セッションはCookieに保存されたJWTで管理する。

```typescript
// src/lib/auth/index.ts
export const ACTIVE_ORG_COOKIE = "misekin-active-org";

// JWTコールバック: user.idをtokenに保存
async jwt({ token, user }) {
  if (user) token.userId = user.id;
  return token;
}

// セッションコールバック: cookieからactiveOrganizationIdを取得
async session({ session, token }) {
  session.user.id = token.userId as string;
  (session as any).activeOrganizationId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  return session;
}
```

アクティブ組織は `misekin-active-org` cookieで管理。組織切り替え時に `organization.ts` の `switchOrganization()` でcookieを更新する。

### ミドルウェア（`src/middleware.ts`）

Cookieの存在だけで認証チェックを行うカスタムミドルウェア。Auth.jsミドルウェアは使わない。

**パブリックパス**（認証不要）:
- `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`
- `/clock/**` — 打刻UI
- `/api/auth/**` — Auth.jsハンドラ
- `/api/v1/**` — 外部REST API（Bearer tokenで独自認証）

> **注意**: JWTが無効になってもCookieが残っているとリダイレクトループが起きる可能性がある。そのため、ミドルウェアでは「ログイン済みユーザーをloginページからdashboardへリダイレクト」は行わない（ページ側でauth()を呼んで判断する）。

### 権限チェック（`src/lib/auth/permissions.ts`）

Server Actionやページで使用する権限チェック関数:

```typescript
// 組織メンバーであることを確認
await requireOrgMember(userId, organizationId)

// 管理者（ADMIN/OWNER）であることを確認
const ctx = await requireAdmin(userId, organizationId)
// => { memberId, role, organizationId }

// オーナーのみ
await requireOwner(userId, organizationId)

// 特定店舗へのアクセス権チェック
const hasAccess = await canAccessStore(memberId, role, storeId)
// OWNER: 全店舗OK
// ADMIN(スコープなし): 全店舗OK
// ADMIN(スコープあり): 指定店舗のみOK
```

### API認証（外部REST API）

Bearer tokenをDBの `ApiKey` テーブルで検証する。

```typescript
// Authorization: Bearer mk_live_xxxxx
const authHeader = req.headers.get("Authorization");
const token = authHeader?.replace("Bearer ", "");
const apiKey = await db.apiKey.findFirst({
  where: { keyHash: hash(token), isActive: true },
});
if (!apiKey || apiKey.expiresAt < now) return 401;
// storeId スコープチェック
if (apiKey.storeIds.length > 0 && !apiKey.storeIds.includes(params.storeId)) return 403;
```

---

## 5. ビジネスロジック

### 打刻状態機械（`src/lib/business/time-clock.ts`）

```typescript
type ClockState =
  | "NOT_CLOCKED_IN"
  | "WORKING"
  | "ON_BREAK"
  | "CLOCKED_OUT";

type ClockAction = "CLOCK_IN" | "BREAK_START" | "BREAK_END" | "CLOCK_OUT";

// 有効なアクション取得
getAvailableActions(state: ClockState): ClockAction[]

// 状態遷移バリデーション (エラーメッセージ or null)
validateClockTransition(state: ClockState, action: ClockAction): string | null

// イベント列から現在状態を計算
calculateClockState(events: AttendanceEvent[]): ClockState
```

**状態遷移**:
```
NOT_CLOCKED_IN --[CLOCK_IN]--> WORKING
WORKING --[BREAK_START]--> ON_BREAK
WORKING --[CLOCK_OUT]--> CLOCKED_OUT
ON_BREAK --[BREAK_END]--> WORKING
ON_BREAK --[CLOCK_OUT]--> CLOCKED_OUT  ※休憩を自動終了してから退勤
```

### 営業日計算（`src/lib/business/business-day.ts`）

日付変わり時刻（`dayChangeHour`）を跨いだ打刻を前日の営業日として扱う。

```typescript
// UTC時刻 + タイムゾーン + 日付変わり時刻 → 営業日 YYYY-MM-DD
getBusinessDate(now: Date, timezone: string, dayChangeHour: number, dayChangeMinute: number): string

// 例: dayChangeHour=6, timezone=Asia/Tokyo の場合
// 2026-07-12 05:59 JST → businessDate "2026-07-11"
// 2026-07-12 06:00 JST → businessDate "2026-07-12"
```

### 異常検出（`src/lib/business/anomaly-detection.ts`）

```typescript
detectAnomalies({ clockInAt, clockOutAt, breaks, now }): {
  hasAnomaly: boolean;
  reasons: string[];
}
```

| 異常コード | 検出条件 |
|-----------|---------|
| MISSING_CLOCK_OUT | `clockOutAt` が null かつ 24時間以上経過 |
| MISSING_BREAK_END | 終了していない休憩がある |
| CLOCK_OUT_BEFORE_CLOCK_IN | 退勤時刻 < 出勤時刻 |
| LONG_SHIFT | 勤務時間 ≥ 12時間 |
| DUPLICATE_CLOCK_IN | CLOCK_INイベントが2件以上 |

退勤時に `detectAnomalies()` を呼び、結果を `Attendance.hasAnomaly` / `anomalyReasons` に保存する。

---

## 6. Server Actions パターン

全Server Actionは以下のパターンに従う:

```typescript
"use server";

interface ActionResult {
  success?: boolean;
  error?: string;
  data?: unknown;
}

export async function someAction(orgId: string, input: SomeInput): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { error: "ログインが必要です" };

  // 入力バリデーション
  const parsed = someSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "入力値が不正です" };

  try {
    // 権限チェック
    await requireAdmin(session.user.id, orgId);

    // DB操作
    const result = await db.something.create({ data: { ... } });

    // 監査ログ
    await createAuditLog({ ... });

    // キャッシュ無効化
    revalidatePath("/some-page");

    return { success: true, data: result };
  } catch (error: any) {
    return { error: error.message ?? "操作に失敗しました" };
  }
}
```

---

## 7. 打刻フロー（詳細）

```
[スタッフ] /clock/[token]
  → storeClockUrl 検証（存在・有効期限）
  → isActive なスタッフ一覧表示

[スタッフ選択]
  → requirePin == true: /clock/[token]/pin?staffId=xxx
  → requirePin == false: /clock/[token]/status?staffId=xxx

[PIN入力]
  → pinHash と bcrypt.compare()
  → 失敗5回 → 15分ロック
  → 成功 → /clock/[token]/status?staffId=xxx&pin=xxx

[status ページ]
  → clockAction({ token, staffId, pin, action })
  → PIN再検証（status直アクセス対策）
  → 状態遷移バリデーション
  → 別店舗勤務中チェック（CLOCK_IN時）
  → DB更新（AttendanceEvent作成, Attendance更新）
  → 異常検出（CLOCK_OUT時）
  → /clock/[token]/complete?action=xxx&...
```

`pin` はURLのクエリパラメータとして受け渡す（平文のまま。HTTPSのため問題ない）。

---

## 8. メール送信（`src/lib/email/index.ts`）

Resend APIを使用。`sendStaffInvitationEmail`, `sendVerificationEmail`, `sendPasswordResetEmail` の3種類。

```typescript
const APP_URL = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
```

> **注意**: `NEXT_PUBLIC_*` 変数はビルド時に埋め込まれるため、サーバーサイドのメール送信では使わない。

---

## 9. 環境変数

### ローカル開発（`.env.local`）

```env
DATABASE_URL="postgresql://misekin:misekin@localhost:5432/misekin"
AUTH_SECRET="dev-secret-key-change-in-production-32chars"
NEXTAUTH_URL="http://localhost:3000"
RESEND_API_KEY="re_development_key"
EMAIL_FROM="みせ勤 <noreply@localhost>"
```

### 本番（`.env` — サーバー上で手動管理、絶対に上書きしないこと）

```env
POSTGRES_PASSWORD=<強力なパスワード>
AUTH_SECRET=<openssl rand -base64 32 で生成>
NEXTAUTH_URL=https://dataraw.jp/dev/misekin
RESEND_API_KEY=re_xxxxxx
EMAIL_FROM=みせ勤 <noreply@dataraw.jp>
```

| 変数 | 用途 |
|------|------|
| `DATABASE_URL` | Prisma接続文字列 |
| `AUTH_SECRET` | JWTの署名・暗号化キー。変更すると全セッション無効化 |
| `NEXTAUTH_URL` | Auth.jsのベースURL。メールのリンク生成にも使用 |
| `NEXT_PUBLIC_BASE_PATH` | Next.jsのbasePath (`/dev/misekin`)。ビルド時に設定 |
| `RESEND_API_KEY` | メール送信API |
| `POSTGRES_PASSWORD` | docker-compose用のDBパスワード |

---

## 10. デプロイ手順

### Docker Compose構成（本番サーバー: 219.94.244.166）

- アプリ: `/opt/apps/misekin/`
- ポート: `127.0.0.1:3003` → nginx経由で `https://dataraw.jp/dev/misekin`
- DB: Postgresコンテナ（volumeで永続化）

### デプロイ手順

```bash
# 1. ソースコードのみ転送（.envは絶対に含めない）
rsync -av --exclude='.env*' --exclude='node_modules' --exclude='.next' --exclude='.git' \
  src/ ubuntu@219.94.244.166:/opt/apps/misekin/src/
rsync -av -e "..." prisma/schema.sql ubuntu@219.94.244.166:/opt/apps/misekin/prisma/schema.sql

# 2. ビルド
ssh ubuntu@219.94.244.166 "cd /opt/apps/misekin && docker compose build app"

# 3. 再起動
ssh ubuntu@219.94.244.166 "cd /opt/apps/misekin && docker compose up -d app"
```

### DBスキーマ変更

Prisma migrateは使わず、`prisma/schema.sql` にDDLを追記管理する。

```bash
# カラム追加例
docker compose exec db psql -U misekin -d misekin \
  -c 'ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "clockOutMemo" TEXT;'
```

`schema.sql` の末尾にも `ADD COLUMN IF NOT EXISTS` として追記しておくこと（コンテナ初期化時に適用されるため）。

---

## 11. テスト

```bash
npm run test  # Vitest 37件
```

テストファイル: `tests/unit/`
- `business-day.test.ts` — 営業日計算
- `time-clock.test.ts` — 打刻状態機械
- `anomaly-detection.test.ts` — 異常検出

`vitest.config.ts` で `@/ → ./src/` のエイリアス設定済み。

---

## 12. 既知の問題・注意事項

### basePath + Auth.js の組み合わせ
Auth.jsの `signIn({ redirectTo })` にはbasePath込みのパスを渡す必要がある。

```typescript
// NG
await signIn("credentials", { ..., redirectTo: "/dashboard" });

// OK
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
await signIn("credentials", { ..., redirectTo: `${BASE_PATH}/dashboard` });
```

### AUTH_SECRET を変更した場合
既存のJWTが全て無効になる。古いCookieが残っているユーザーはリダイレクトループに陥る可能性がある。ミドルウェアでCookieの存在だけでログイン済み判定してリダイレクトしないこと。

### Prisma未生成時のTypeScriptエラー
`npx prisma generate` 前はIDEが71件程度のTS型エラーを表示するが、これは正常。ビルド前に必ず `generate` を実行すること。

### VerificationTokenの複合キー
`VerificationToken` は `identifier + token` の複合ユニークキー。同一メールに複数トークンを発行する場合は先に `deleteMany` で旧トークンを削除すること。

### email フィールドはnullable
`Staff.email` は任意項目（nullable）。メールアドレスなしのスタッフは招待メールを送れない。
