# 将来機能設計案 — みせ勤

## 1. CSVインポート

### 対象データ
- 店舗、スタッフ、店舗所属、時給、交通費、勤怠

### フロー
```
テンプレートCSVダウンロード
  → ユーザーがCSVを作成
  → アップロード
  → バリデーション（行単位エラー表示）
  → プレビュー（追加/更新/スキップの分類）
  → 確定
  → 処理結果表示（成功件数/エラー件数）
  → インポート履歴に記録
```

### 技術要件
- UTF-8 BOM / Shift_JIS両対応
- 最大10万行対応（ストリーム処理）
- 失敗行のみCSVで再ダウンロード
- トランザクション（全行成功か全件ロールバック or 行単位コミット選択式）
- インポート履歴テーブル（ImportHistory）

### データモデル追加
```prisma
model ImportHistory {
  id             String   @id @default(cuid())
  organizationId String
  type           String   // STAFF, STORE, ATTENDANCE, etc.
  status         String   // PROCESSING, COMPLETED, FAILED
  totalRows      Int
  successRows    Int
  errorRows      Int
  errorDetails   Json?
  createdByUserId String
  createdAt      DateTime @default(now())
  completedAt    DateTime?
}
```

---

## 2. 深夜・残業計算

### 計算ルール（日本法令ベース）

| 種別 | 定義 | 割増率 |
|------|------|-------|
| 通常労働 | 所定労働時間内 | 100% |
| 法定時間外 | 週40h超または1日8h超 | 125% |
| 深夜労働 | 22:00〜05:00 | 125%（重複時は加算）|
| 法定休日 | 法定休日の労働 | 135% |
| 所定休日 | 会社所定の休日 | 125% |

### データ構造（MVP時点で準備済み）
- `AttendanceEvent.clockedAt` は常に実打刻時刻（不変）
- 丸め処理が必要な場合は `Attendance.roundedClockInAt` 等を別フィールドで持つ
- 給与計算用の集計は `WorkSummary` テーブルで行う（将来追加）

### 設定テーブル（将来追加）
```prisma
model LaborRuleConfig {
  id             String @id @default(cuid())
  organizationId String
  // 所定労働時間
  weeklyWorkHours Int @default(40)
  dailyWorkHours  Int @default(8)
  // 深夜時間帯
  nightStart      Int @default(22)  // 22:00
  nightEnd        Int @default(5)   // 05:00
  // 丸め設定
  roundUnit       Int @default(1)   // 分単位（1, 5, 15, 30, 60）
  roundDirection  String @default("DOWN")  // DOWN | UP | ROUND
  effectiveFrom   DateTime
  createdAt       DateTime @default(now())
}
```

---

## 3. 給与集計

### 機能概要
- 勤怠データから給与計算用の集計データを生成
- 外部給与システムへのCSV出力
- 確定処理（修正不可ロック）

### 注意
みせ勤は「給与計算補助ツール」の位置づけ。
給与の最終確定・源泉徴収・社会保険計算は外部給与システムに委ねる。

---

## 4. 高度なダッシュボード

### グラフ・KPI
- 店舗別・スタッフ別の月間勤務時間推移
- 深夜時間・残業時間の内訳
- 人件費率（売上データ連携時）
- 異常勤怠件数・修正申請件数のトレンド

### 技術要件
- Recharts or Victory による折れ線・棒グラフ
- 日別/週別/月別の切替
- 店舗別比較ビュー
- データ更新はServer-Sent EventsまたはSWR定期再フェッチ

---

## 5. Webhook

### 対象イベント
- attendance.created
- attendance.updated
- correction_request.created
- correction_request.approved
- correction_request.rejected
- staff.created
- staff.status_changed

### 実装方針
- WebhookEndpoint テーブルを追加
- 署名検証（HMAC-SHA256）
- 失敗時のリトライ（指数バックオフ、最大5回）
- 配信履歴の保存

---

## 6. 外部サービス連携

| サービス | 連携内容 |
|---------|---------|
| LINE Messaging API | スタッフへの打刻リマインダー・申請通知 |
| Slack | 管理者への退勤漏れアラート |
| マネーフォワードクラウド給与 | 勤怠データ自動連携 |
| freee人事労務 | 同上 |
| Airレジ | 売上データと人件費の連携 |

---

## 7. 位置情報打刻

- 打刻時にブラウザGeolocation APIで位置取得（任意）
- 店舗の登録位置から一定距離内のみ打刻許可（設定可能）
- 位置情報はDB保存済み（`AttendanceEvent.latitude/longitude`）

---

## 8. シフト管理

- 希望シフト提出（スタッフ）
- シフト作成・公開（管理者）
- シフトと実績の乖離レポート
- シフト表CSVダウンロード

---

## 9. モバイルアプリ

- React Native または Progressive Web App (PWA)
- Push通知
- オフライン打刻（バックグラウンド同期）

---

## 10. 多言語対応

- next-intl による日英切替
- タイムゾーン・ロケール別の日付表示
