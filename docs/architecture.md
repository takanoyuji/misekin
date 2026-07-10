# アーキテクチャ設計書 — みせ勤

## 1. 技術スタック

### フロントエンド・バックエンド
| 技術 | バージョン | 採用理由 |
|------|-----------|---------|
| Next.js | 15.x (App Router) | SSR/RSC/API Routes/Server Actions を統合 |
| TypeScript | 5.x | 型安全性、保守性向上 |
| Tailwind CSS | 4.x | ユーティリティファーストCSS |
| shadcn/ui | latest | 高品質UIコンポーネント、カスタマイズ性高 |
| Lucide Icons | latest | シンプルで一貫したアイコン |
| React Hook Form | 7.x | パフォーマンス重視のフォーム管理 |
| Zod | 3.x | スキーマバリデーション（共有型定義） |

### データベース
| 技術 | 採用理由 |
|------|---------|
| PostgreSQL 16 | 信頼性、全文検索、JSON支援、トランザクション |
| Prisma ORM 5.x | 型安全クエリ、マイグレーション管理 |

### 認証
| 技術 | 採用理由 |
|------|---------|
| Auth.js v5 (next-auth) | Next.js公式対応、OAuth拡張可能 |
| bcrypt | パスワードハッシュ |

### メール
| 技術 | 採用理由 |
|------|---------|
| Resend | Next.js親和性が高い、安定 |
| React Email | メールテンプレートのコンポーネント化 |

### テスト
| 技術 | 採用理由 |
|------|---------|
| Vitest | Vite連携、高速、TypeScript対応 |
| Playwright | クロスブラウザE2E |

### その他
| 技術 | 採用理由 |
|------|---------|
| date-fns | 軽量、タイムゾーン対応（date-fns-tz） |
| qrcode | QRコード生成 |
| @hono/zod-openapi | OpenAPI仕様生成 |
| swagger-ui-react | APIドキュメントUI |
| ESLint + Prettier | コード品質統一 |

## 2. ディレクトリ構成

```
misekin/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (auth)/                   # 認証ルートグループ
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── verify-email/
│   │   │   └── reset-password/
│   │   ├── (onboarding)/             # オンボーディング
│   │   │   └── onboarding/
│   │   ├── (app)/                    # 認証済みルートグループ
│   │   │   ├── layout.tsx            # 共通レイアウト（サイドバー等）
│   │   │   ├── dashboard/            # 管理画面ホーム
│   │   │   ├── organization/         # 組織設定
│   │   │   ├── stores/               # 店舗管理
│   │   │   ├── staff/                # スタッフ管理
│   │   │   ├── attendance/           # 勤怠管理
│   │   │   ├── correction-requests/  # 修正申請
│   │   │   ├── closing/              # 締め処理
│   │   │   ├── export/               # CSVエクスポート
│   │   │   ├── api-keys/             # APIキー管理
│   │   │   ├── audit-logs/           # 監査ログ
│   │   │   ├── notifications/        # 通知
│   │   │   ├── account/              # アカウント設定
│   │   │   └── help/                 # 使い方ページ
│   │   ├── (staff)/                  # スタッフ向けルートグループ
│   │   │   ├── my-attendance/        # 自分の勤怠
│   │   │   ├── my-correction-requests/
│   │   │   └── my-stores/
│   │   ├── clock/                    # 打刻ページ（認証不要）
│   │   │   └── [token]/              # 店舗別打刻URL
│   │   └── api/                      # API Routes
│   │       ├── auth/                 # Auth.js ハンドラ
│   │       ├── v1/                   # 外部API v1
│   │       └── internal/             # 内部API
│   ├── components/
│   │   ├── ui/                       # shadcn/ui ベースコンポーネント
│   │   ├── layout/                   # レイアウトコンポーネント
│   │   ├── forms/                    # フォームコンポーネント
│   │   ├── attendance/               # 勤怠関連コンポーネント
│   │   ├── clock/                    # 打刻関連コンポーネント
│   │   └── common/                   # 共通コンポーネント
│   ├── lib/
│   │   ├── auth/                     # 認証ユーティリティ
│   │   ├── db/                       # Prismaクライアント
│   │   ├── validations/              # Zodスキーマ
│   │   ├── business/                 # ビジネスロジック
│   │   │   ├── attendance.ts         # 勤怠計算
│   │   │   ├── business-day.ts       # 営業日計算
│   │   │   ├── time-clock.ts         # 打刻状態遷移
│   │   │   └── anomaly-detection.ts  # 異常検出
│   │   ├── api/                      # 外部APIユーティリティ
│   │   └── email/                    # メール送信
│   ├── actions/                      # Server Actions
│   │   ├── auth.ts
│   │   ├── organization.ts
│   │   ├── store.ts
│   │   ├── staff.ts
│   │   ├── attendance.ts
│   │   ├── correction-request.ts
│   │   ├── closing.ts
│   │   └── api-key.ts
│   ├── hooks/                        # カスタムReact Hooks
│   └── types/                        # 型定義
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── tests/
│   ├── unit/                         # Vitestユニットテスト
│   ├── integration/                  # Vitest統合テスト
│   └── e2e/                          # Playwright E2E
├── emails/                           # React Emailテンプレート
├── public/
├── docs/
├── .env.example
├── .env.local                        # gitignore済み
└── ...設定ファイル
```

## 3. データフロー

### 打刻フロー
```
打刻URL（/clock/{token}）
  → トークン検証（公開アクセス）
  → スタッフ選択
  → PIN検証（レート制限付き）
  → 現在状態確認
  → 打刻Server Action実行
  → DB書き込み（トランザクション）
    - AttendanceEvent作成
    - Attendance更新/作成
    - AuditLog記録
  → 完了画面表示
```

### 管理者勤怠修正フロー
```
管理者操作
  → 認可チェック（組織・店舗スコープ）
  → Server Action実行
  → トランザクション：
    - AttendanceCorrection作成（変更前後）
    - Attendance更新（修正値）
    - AuditLog記録
  → 通知送信（任意）
```

### 外部APIフロー
```
外部システム → APIキー（Bearer） → Route Handler
  → APIキーハッシュ検証
  → スコープ確認（組織・店舗・権限）
  → レート制限チェック
  → ビジネスロジック実行
  → APIアクセスログ記録
  → レスポンス返却
```

## 4. 認証・セッション設計

- Auth.js v5 の Credentials Provider（メール+パスワード）
- セッションはDB（Prisma adapter）に保存
- Cookie: httpOnly, SameSite=Lax, Secure（本番）
- 組織選択はセッションメタデータまたはCookieに保存
- 複数組織ユーザーは「アクティブ組織」を切り替え可能

## 5. タイムゾーン処理

- **DB保存**: 常にUTC（`DateTime @db.Timestamptz`）
- **表示**: 店舗/組織のタイムゾーンでクライアント表示
- **勤務日計算**: 営業日切替時刻を店舗タイムゾーンで適用
- **date-fns-tz** でタイムゾーン変換

```typescript
// 勤務日計算例
// 店舗TZ: Asia/Tokyo, 切替時刻: 06:00
// 2026-07-11 05:00 JST → 営業日 2026-07-10
function getBusinessDay(clockedAt: Date, timezone: string, dayChangeHour: number): string {
  const localTime = toZonedTime(clockedAt, timezone);
  if (localTime.getHours() < dayChangeHour) {
    // 切替時刻前 → 前日の営業日
    return format(subDays(localTime, 1), 'yyyy-MM-dd');
  }
  return format(localTime, 'yyyy-MM-dd');
}
```

## 6. セキュリティ設計原則

1. **組織スコープ強制**: 全クエリに `organizationId` を含める
2. **IDOR防止**: IDだけでなく所有権チェックを必須化
3. **最小権限**: APIキーは必要スコープのみ
4. **監査証跡**: 全重要操作をAuditLogに記録
5. **レート制限**: ログイン・PIN・API各エンドポイントに適用

## 7. 主要な設計判断と理由

| 判断 | 理由 |
|------|------|
| 休憩中退勤時に「退勤時刻と同時刻で休憩終了自動記録」 | 管理コストを最小化しつつ不整合を防ぐ。管理者への異常フラグは立てる |
| 打刻URLはUUID+乱数ではなくnanoid（21文字）を使用 | 推測困難性と短さのバランス |
| 勤怠レコードは1日1レコード（複数休憩をJSON配列） | シンプルなモデルと検索のバランス |
| セッションをDBに保存 | ログアウト確実性、セッション無効化の確実性 |
| APIキーはSHA-256でハッシュ後プレフィックス付きで保存 | 検索効率（プレフィックスでルックアップ）と安全性の両立 |
| 時給をWageHistoryテーブルで管理 | 過去勤怠への影響を防止 |
