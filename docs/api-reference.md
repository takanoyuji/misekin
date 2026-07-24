# みせ勤 API リファレンス

## 概要

みせ勤が提供するREST APIを使うと、外部システムから勤怠データ・スタッフ情報・店舗情報を取得できます。

- **ベースURL**: `https://dataraw.jp/dev/misekin/api/v1`
- **認証方式**: Bearer token（APIキー）
- **レスポンス形式**: JSON
- **文字コード**: UTF-8

---

## 認証

全エンドポイントで `Authorization` ヘッダーにAPIキーを指定してください。

```
Authorization: Bearer mk_live_xxxxxxxxxxxxxxxxxxxxxx
```

APIキーは管理画面の「APIキー管理」から発行します。

### APIキーの権限

APIキーには**店舗スコープ**を設定できます。

| スコープ | 取得できるデータ |
|---------|----------------|
| 全店舗（スコープなし） | 組織内の全店舗のデータ |
| 特定店舗指定 | 指定した店舗のデータのみ |

### エラーレスポンス

| HTTPステータス | 説明 |
|--------------|------|
| `401 Unauthorized` | APIキーが無効、期限切れ、または未指定 |
| `403 Forbidden` | 指定したstoreIdへのアクセス権がない |
| `500 Internal Server Error` | サーバーエラー |

```json
// エラーレスポンス例
{ "error": "Unauthorized" }
```

---

## エンドポイント一覧

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/v1/attendance` | 勤怠一覧の取得 |
| GET | `/api/v1/staff` | スタッフ一覧の取得 |
| GET | `/api/v1/stores` | 店舗一覧の取得 |

---

## GET `/api/v1/attendance`

勤怠記録の一覧を取得します。

### リクエスト

```
GET /api/v1/attendance
Authorization: Bearer {APIキー}
```

### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `storeId` | string | 任意 | 絞り込む店舗ID |
| `staffId` | string | 任意 | 絞り込むスタッフID |
| `from` | string | 任意 | 期間開始日（YYYY-MM-DD）。営業日で絞り込み |
| `to` | string | 任意 | 期間終了日（YYYY-MM-DD）。営業日で絞り込み |
| `page` | integer | 任意 | ページ番号（デフォルト: 1） |
| `limit` | integer | 任意 | 1ページの件数（デフォルト: 50、最大: 100） |

### レスポンス

```json
{
  "data": [
    {
      "id": "cmrh9xxxxxxxxxxxxxxxxxxx",
      "staffId": "cmrh9xxxxxxxxxxxxxxxxxxx",
      "staffName": "田中 太郎",
      "staffEmployeeCode": "EMP001",
      "storeId": "cmrh9xxxxxxxxxxxxxxxxxxx",
      "storeName": "渋谷店",
      "businessDate": "2026-07-13",
      "clockInAt": "2026-07-13T00:00:00.000Z",
      "clockOutAt": "2026-07-13T09:00:00.000Z",
      "breakMinutes": 60,
      "workMinutes": 480,
      "status": "COMPLETED",
      "hasAnomaly": false,
      "isLocked": false,
      "createdAt": "2026-07-13T00:00:00.000Z",
      "updatedAt": "2026-07-13T09:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 250,
    "page": 1,
    "limit": 50,
    "hasNextPage": true
  }
}
```

### フィールド詳細

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | string | 勤怠レコードID |
| `staffId` | string | スタッフID |
| `staffName` | string | スタッフ表示名 |
| `staffEmployeeCode` | string \| null | 社員コード |
| `storeId` | string | 店舗ID |
| `storeName` | string | 店舗名 |
| `businessDate` | string | 営業日（YYYY-MM-DD） |
| `clockInAt` | string \| null | 出勤時刻（ISO 8601 UTC） |
| `clockOutAt` | string \| null | 退勤時刻（ISO 8601 UTC）。勤務中の場合は null |
| `breakMinutes` | integer | 休憩時間（分） |
| `workMinutes` | integer \| null | 実労働時間（分）。退勤前は null |
| `status` | string | 勤怠状態（下記参照） |
| `hasAnomaly` | boolean | 異常フラグ |
| `isLocked` | boolean | 締め処理済みフラグ |
| `createdAt` | string | レコード作成日時（ISO 8601 UTC） |
| `updatedAt` | string | レコード更新日時（ISO 8601 UTC） |

### statusの値

| 値 | 説明 |
|----|------|
| `IN_PROGRESS` | 勤務中（退勤前） |
| `COMPLETED` | 正常に退勤済み |
| `MISSING_CLOCK_OUT` | 退勤打刻なし（異常） |
| `MISSING_BREAK_END` | 休憩終了打刻なし（異常） |
| `ANOMALY` | その他の異常 |

### 営業日について

`businessDate` は日付変わり時刻（店舗設定）を考慮した営業日です。例えば日付変わり時刻が06:00の場合、深夜3:00の打刻は前日の営業日として記録されます。日本時間（Asia/Tokyo）で表示されています。

`clockInAt` / `clockOutAt` はUTCで返却されます。日本時間に変換する場合は `+09:00` を加算してください。

### リクエスト例

```bash
# 特定期間の全勤怠を取得
curl -H "Authorization: Bearer mk_live_xxxxx" \
  "https://dataraw.jp/dev/misekin/api/v1/attendance?from=2026-07-01&to=2026-07-31"

# 特定店舗の本日の勤怠
curl -H "Authorization: Bearer mk_live_xxxxx" \
  "https://dataraw.jp/dev/misekin/api/v1/attendance?storeId=cmrxxx&from=2026-07-13&to=2026-07-13"

# ページネーション
curl -H "Authorization: Bearer mk_live_xxxxx" \
  "https://dataraw.jp/dev/misekin/api/v1/attendance?page=2&limit=100"
```

---

## GET `/api/v1/staff`

スタッフ一覧を取得します。

### リクエスト

```
GET /api/v1/staff
Authorization: Bearer {APIキー}
```

### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `storeId` | string | 任意 | 特定店舗に所属するスタッフのみ取得 |
| `status` | string | 任意 | 在籍状態で絞り込み（下記参照） |
| `page` | integer | 任意 | ページ番号（デフォルト: 1） |
| `limit` | integer | 任意 | 1ページの件数（デフォルト: 50、最大: 100） |

### レスポンス

```json
{
  "data": [
    {
      "id": "cmrh9xxxxxxxxxxxxxxxxxxx",
      "displayName": "田中 太郎",
      "employeeCode": "EMP001",
      "email": "tanaka@example.com",
      "status": "ACTIVE",
      "hireDate": "2025-04-01",
      "stores": [
        {
          "storeId": "cmrh9xxxxxxxxxxxxxxxxxxx",
          "storeName": "渋谷店",
          "isPrimary": true
        }
      ]
    }
  ],
  "pagination": {
    "total": 30,
    "page": 1,
    "limit": 50,
    "hasNextPage": false
  }
}
```

### フィールド詳細

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | string | スタッフID |
| `displayName` | string | 表示名（打刻画面に表示） |
| `employeeCode` | string \| null | 社員コード |
| `email` | string \| null | メールアドレス |
| `status` | string | 在籍状態（下記参照） |
| `hireDate` | string \| null | 入社日（YYYY-MM-DD） |
| `stores` | array | 所属店舗一覧 |
| `stores[].storeId` | string | 店舗ID |
| `stores[].storeName` | string | 店舗名 |
| `stores[].isPrimary` | boolean | 主所属店舗かどうか |

### statusの値

| 値 | 説明 |
|----|------|
| `ACTIVE` | 在籍中 |
| `INVITED` | 招待中（メール未承認） |
| `ON_LEAVE` | 休職中 |
| `SUSPENDED` | 停止中 |
| `RESIGNED` | 退職済み |

### リクエスト例

```bash
# 在籍中スタッフの一覧
curl -H "Authorization: Bearer mk_live_xxxxx" \
  "https://dataraw.jp/dev/misekin/api/v1/staff?status=ACTIVE"

# 特定店舗のスタッフ
curl -H "Authorization: Bearer mk_live_xxxxx" \
  "https://dataraw.jp/dev/misekin/api/v1/staff?storeId=cmrxxx"
```

---

## GET `/api/v1/stores`

店舗一覧を取得します。

### リクエスト

```
GET /api/v1/stores
Authorization: Bearer {APIキー}
```

### クエリパラメータ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `page` | integer | 任意 | ページ番号（デフォルト: 1） |
| `limit` | integer | 任意 | 1ページの件数（デフォルト: 50、最大: 100） |

### レスポンス

```json
{
  "data": [
    {
      "id": "cmrh9xxxxxxxxxxxxxxxxxxx",
      "name": "渋谷店",
      "code": "SHIBUYA",
      "address": "東京都渋谷区...",
      "timezone": "Asia/Tokyo",
      "dayChangeHour": 6,
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "limit": 50,
    "hasNextPage": false
  }
}
```

### フィールド詳細

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `id` | string | 店舗ID |
| `name` | string | 店舗名 |
| `code` | string \| null | 店舗コード（任意） |
| `address` | string \| null | 住所 |
| `timezone` | string | タイムゾーン（例: `Asia/Tokyo`） |
| `dayChangeHour` | integer | 日付変わり時刻（時、0〜23） |
| `isActive` | boolean | 有効かどうか |
| `createdAt` | string | 作成日時（ISO 8601 UTC） |

### リクエスト例

```bash
curl -H "Authorization: Bearer mk_live_xxxxx" \
  "https://dataraw.jp/dev/misekin/api/v1/stores"
```

---

## ページネーション

全エンドポイントで共通のページネーション形式を使用します。

```json
"pagination": {
  "total": 500,     // 総件数
  "page": 1,        // 現在のページ
  "limit": 50,      // 1ページあたりの件数
  "hasNextPage": true  // 次のページが存在するか
}
```

全件取得する場合は `hasNextPage` が `false` になるまで `page` をインクリメントしてください。

```bash
# 全件取得の例（シェルスクリプト）
page=1
while true; do
  response=$(curl -s -H "Authorization: Bearer mk_live_xxxxx" \
    "https://dataraw.jp/dev/misekin/api/v1/attendance?page=$page&limit=100")
  echo "$response" | process_data  # データ処理
  has_next=$(echo "$response" | jq '.pagination.hasNextPage')
  if [ "$has_next" = "false" ]; then break; fi
  page=$((page + 1))
done
```

---

## 利用例

### 月次勤怠レポートの取得

```python
import requests
from datetime import date

API_KEY = "mk_live_xxxxx"
BASE_URL = "https://dataraw.jp/dev/misekin/api/v1"
HEADERS = {"Authorization": f"Bearer {API_KEY}"}

def get_monthly_attendance(year: int, month: int) -> list:
    from_date = f"{year}-{month:02d}-01"
    # 月末日の計算
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    to_date = f"{year}-{month:02d}-{last_day:02d}"

    results = []
    page = 1
    while True:
        resp = requests.get(
            f"{BASE_URL}/attendance",
            headers=HEADERS,
            params={"from": from_date, "to": to_date, "page": page, "limit": 100}
        )
        resp.raise_for_status()
        data = resp.json()
        results.extend(data["data"])
        if not data["pagination"]["hasNextPage"]:
            break
        page += 1
    return results

# 2026年7月の勤怠を取得
attendance = get_monthly_attendance(2026, 7)
print(f"取得件数: {len(attendance)}")
```

### 現在出勤中のスタッフ確認

```javascript
const API_KEY = "mk_live_xxxxx";
const BASE_URL = "https://dataraw.jp/dev/misekin/api/v1";

async function getActiveStaff(storeId) {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD (UTC)
  const response = await fetch(
    `${BASE_URL}/attendance?storeId=${storeId}&from=${today}&to=${today}`,
    { headers: { Authorization: `Bearer ${API_KEY}` } }
  );
  const data = await response.json();
  return data.data.filter(a => a.status === "IN_PROGRESS");
}
```

---

## アクセスログ

APIへのアクセスはすべて管理画面の「APIキー管理」から確認できます。不正利用が疑われる場合はAPIキーを即座に無効化してください。

---

## 制限事項

- 1リクエストあたり最大 **100件** まで取得可能です
- APIは現在**読み取り専用**です（勤怠の追加・修正はAPIからはできません）
- APIキーは組織単位で発行されます。他の組織のデータには一切アクセスできません
