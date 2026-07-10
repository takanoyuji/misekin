# API仕様書 — みせ勤

## 1. 基本仕様

- ベースURL: `/api/v1/`
- 認証方式: `Authorization: Bearer {APIキー}`
- レスポンス形式: JSON
- 文字コード: UTF-8
- タイムゾーン: ISO 8601 with timezone（例: `2026-07-10T20:00:00+09:00`）

## 2. 認証

### APIキー形式
```
mk_live_{nanoid(32)}
```
- `mk_live_` プレフィックスで本番キーを識別
- DBにはSHA-256ハッシュを保存（プレフィックス付きで検索高速化）

### リクエスト例
```http
GET /api/v1/attendance
Authorization: Bearer mk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
X-Organization-Id: org_xxxxx  （任意: 複数組織対応のAPIキーの場合）
```

## 3. エラーレスポンス

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired API key",
    "details": []
  }
}
```

| HTTPステータス | errorCode | 説明 |
|--------------|-----------|------|
| 400 | VALIDATION_ERROR | 入力値エラー |
| 401 | UNAUTHORIZED | 認証失敗 |
| 403 | FORBIDDEN | 権限不足 |
| 404 | NOT_FOUND | リソース未検出 |
| 409 | CONFLICT | 競合（重複打刻等）|
| 429 | RATE_LIMITED | レート制限超過 |
| 500 | INTERNAL_ERROR | サーバーエラー |

## 4. ページネーション

```http
GET /api/v1/attendance?page=1&limit=50&cursor=xxxxx
```

レスポンス:
```json
{
  "data": [...],
  "pagination": {
    "total": 1234,
    "page": 1,
    "limit": 50,
    "hasNextPage": true,
    "nextCursor": "xxxxx"
  }
}
```

## 5. レート制限

- 読み取りAPI: 1000 req/min
- 書き込みAPI: 100 req/min
- 打刻API（内部）: 制限なし（PINレート制限で保護）

レスポンスヘッダー:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1720612800
```

## 6. エンドポイント一覧

### 組織
```
GET /api/v1/organizations          組織情報取得
```

### 店舗
```
GET    /api/v1/stores              店舗一覧
GET    /api/v1/stores/:id          店舗詳細
```

### スタッフ
```
GET    /api/v1/staff               スタッフ一覧
GET    /api/v1/staff/:id           スタッフ詳細
POST   /api/v1/staff               スタッフ作成（書き込み権限必須）
PATCH  /api/v1/staff/:id           スタッフ更新（書き込み権限必須）
```

### 勤怠
```
GET    /api/v1/attendance          勤怠一覧
GET    /api/v1/attendance/:id      勤怠詳細
POST   /api/v1/attendance          勤怠作成（書き込み権限必須）
PATCH  /api/v1/attendance/:id      勤怠更新（書き込み権限必須）
```

### 打刻イベント
```
GET    /api/v1/attendance-events   打刻イベント一覧
```

### 修正申請
```
GET    /api/v1/attendance-correction-requests  修正申請一覧
```

## 7. リクエスト/レスポンス例

### GET /api/v1/staff
```http
GET /api/v1/staff?storeId=store_xxx&status=ACTIVE&page=1&limit=20
Authorization: Bearer mk_live_xxxx
```

```json
{
  "data": [
    {
      "id": "staff_xxx",
      "displayName": "山田 太郎",
      "employeeCode": "S001",
      "status": "ACTIVE",
      "hireDate": "2025-04-01",
      "stores": [
        {
          "storeId": "store_xxx",
          "storeName": "新宿店",
          "isPrimary": true,
          "startDate": "2025-04-01",
          "canClock": true
        }
      ],
      "createdAt": "2025-04-01T00:00:00Z",
      "updatedAt": "2025-04-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "hasNextPage": true,
    "nextCursor": "staff_yyy"
  }
}
```

### GET /api/v1/attendance
```http
GET /api/v1/attendance?storeId=store_xxx&from=2026-07-01&to=2026-07-31
Authorization: Bearer mk_live_xxxx
```

```json
{
  "data": [
    {
      "id": "att_xxx",
      "staffId": "staff_xxx",
      "staffName": "山田 太郎",
      "storeId": "store_xxx",
      "storeName": "新宿店",
      "businessDate": "2026-07-10",
      "clockInAt": "2026-07-10T11:00:00Z",
      "clockOutAt": "2026-07-10T20:00:00Z",
      "breakMinutes": 60,
      "workMinutes": 480,
      "status": "COMPLETED",
      "hasAnomaly": false,
      "isLocked": false
    }
  ],
  "pagination": { ... }
}
```

## 8. OpenAPI仕様

`/api-docs` でSwagger UIを提供。
`/api/v1/openapi.json` でOpenAPI 3.1 仕様JSONを取得可能。

## 9. セキュリティ考慮事項

- APIキーはリクエストごとにSHA-256でハッシュ化してDB照合
- 組織スコープ外のデータへのアクセスは403
- APIキーに設定された店舗スコープ外のデータへのアクセスは403
- 書き込み操作は全てAuditLogに記録
- エラーレスポンスに内部実装情報を含めない
