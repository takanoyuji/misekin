# データベース設計書 — みせ勤

## 1. テーブル一覧

| テーブル名 | 説明 |
|-----------|------|
| User | ユーザーアカウント |
| Account | Auth.js用OAuthアカウント |
| Session | セッション |
| VerificationToken | メール認証・パスワードリセットトークン |
| Organization | 組織 |
| OrganizationMember | 組織メンバー（オーナー・管理者） |
| Store | 店舗 |
| StoreClockUrl | 打刻URL |
| StoreAdmin | 管理者の店舗スコープ |
| Staff | スタッフ基本情報 |
| StaffStore | スタッフ×店舗所属 |
| WageHistory | 時給履歴 |
| TransportationHistory | 交通費履歴 |
| AttendanceEvent | 個別打刻イベント |
| Attendance | 1勤務の集約レコード |
| Break | 休憩区間 |
| CorrectionRequest | 修正申請 |
| ClosingPeriod | 締め期間 |
| Notification | Web通知 |
| AuditLog | 監査ログ |
| ApiKey | APIキー |
| ApiAccessLog | APIアクセスログ |

## 2. 主要テーブル定義

### User
```
id            String   @id @default(cuid())
email         String   @unique
emailVerified DateTime?
name          String?
passwordHash  String?
image         String?
createdAt     DateTime @default(now())
updatedAt     DateTime @updatedAt
```

### Organization
```
id              String   @id @default(cuid())
name            String
timezone        String   @default("Asia/Tokyo")
country         String   @default("JP")
dayChangeHour   Int      @default(6)   // 営業日切替時刻（0-23）
dayChangeMinute Int      @default(0)
isActive        Boolean  @default(true)
createdAt       DateTime @default(now())
updatedAt       DateTime @updatedAt
```

### OrganizationMember
```
id             String             @id @default(cuid())
organizationId String
userId         String
role           OrganizationRole   // OWNER | ADMIN
isActive       Boolean            @default(true)
createdAt      DateTime           @default(now())
updatedAt      DateTime           @updatedAt
@@unique([organizationId, userId])
```

### Store
```
id              String   @id @default(cuid())
organizationId  String
name            String
code            String?           // 店舗コード
address         String?
timezone        String   @default("Asia/Tokyo")
dayChangeHour   Int      @default(6)
dayChangeMinute Int      @default(0)
isActive        Boolean  @default(true)
createdAt       DateTime @default(now())
updatedAt       DateTime @updatedAt
@@unique([organizationId, code])
```

### StoreClockUrl
```
id             String    @id @default(cuid())
storeId        String
token          String    @unique  // nanoid(21) 推測困難なランダムトークン
isActive       Boolean   @default(true)
expiresAt      DateTime?
createdAt      DateTime  @default(now())
invalidatedAt  DateTime?
```

### Staff
```
id             String      @id @default(cuid())
organizationId String
userId         String?     // アカウント作成済みならUserと紐付け
displayName    String
fullName       String?
email          String
phone          String?
employeeCode   String?
status         StaffStatus // INVITED | ACTIVE | ON_LEAVE | RESIGNED | SUSPENDED
hireDate       DateTime?
resignDate     DateTime?
notes          String?
createdAt      DateTime    @default(now())
updatedAt      DateTime    @updatedAt
@@unique([organizationId, email])
```

### StaffStore（スタッフ×店舗所属）
```
id               String   @id @default(cuid())
staffId          String
storeId          String
startDate        DateTime
endDate          DateTime?
isPrimary        Boolean  @default(false)
pinHash          String?                    // PINハッシュ
canClock         Boolean  @default(true)
isActive         Boolean  @default(true)
createdAt        DateTime @default(now())
updatedAt        DateTime @updatedAt
@@unique([staffId, storeId])
```

### WageHistory（時給履歴）
```
id             String   @id @default(cuid())
staffStoreId   String
amount         Decimal  @db.Decimal(10, 2)
effectiveFrom  DateTime
effectiveTo    DateTime?
createdByUserId String
reason         String?
createdAt      DateTime @default(now())
```

### TransportationHistory（交通費履歴）
```
id              String              @id @default(cuid())
staffStoreId    String
type            TransportationType  // PER_SHIFT | MONTHLY | NONE
amount          Decimal             @db.Decimal(10, 2)
monthlyLimit    Decimal?            @db.Decimal(10, 2)
effectiveFrom   DateTime
effectiveTo     DateTime?
notes           String?
createdAt       DateTime            @default(now())
```

### AttendanceEvent（個別打刻イベント）
```
id               String          @id @default(cuid())
organizationId   String
storeId          String
staffId          String
eventType        ClockEventType  // CLOCK_IN | BREAK_START | BREAK_END | CLOCK_OUT
clockedAt        DateTime        // 実打刻日時（UTC）
businessDate     String          // 営業日（YYYY-MM-DD）
timezone         String
source           ClockSource     // STORE_URL | ADMIN | SYSTEM
ipAddress        String?
userAgent        String?
deviceFingerprint String?
storeUrlToken    String?         // 店舗URL経由の場合
createdAt        DateTime        @default(now())
// 位置情報（将来）
latitude         Float?
longitude        Float?
locationAccuracy Float?
```

### Attendance（勤怠集約レコード）
```
id               String           @id @default(cuid())
organizationId   String
storeId          String
staffId          String
businessDate     String           // 営業日（YYYY-MM-DD）
clockInAt        DateTime?        // UTC
clockOutAt       DateTime?        // UTC
breakMinutes     Int              @default(0)
workMinutes      Int?
status           AttendanceStatus // IN_PROGRESS | COMPLETED | MISSING_CLOCK_OUT | ANOMALY
hasAnomaly       Boolean          @default(false)
anomalyReasons   Json             @default("[]")
adminNotes       String?
isLocked         Boolean          @default(false)
lockedAt         DateTime?
lockedByUserId   String?
closingPeriodId  String?
createdAt        DateTime         @default(now())
updatedAt        DateTime         @updatedAt
@@unique([staffId, storeId, businessDate])
```

### Break（休憩区間）
```
id           String    @id @default(cuid())
attendanceId String
startAt      DateTime  // UTC
endAt        DateTime? // UTC（退勤同時処理の場合も含む）
isAutoEnded  Boolean   @default(false)  // 休憩中退勤で自動終了
createdAt    DateTime  @default(now())
updatedAt    DateTime  @updatedAt
```

### CorrectionRequest（修正申請）
```
id              String                    @id @default(cuid())
attendanceId    String
staffId         String
requestedAt     DateTime                  @default(now())
status          CorrectionRequestStatus   // PENDING | APPROVED | REJECTED | CANCELLED
originalData    Json                      // 変更前データスナップショット
requestedData   Json                      // 変更希望データ
reason          String
notes           String?
reviewedByUserId String?
reviewedAt      DateTime?
reviewNotes     String?
createdAt       DateTime                  @default(now())
updatedAt       DateTime                  @updatedAt
```

### AuditLog（監査ログ）
```
id              String   @id @default(cuid())
organizationId  String
actorUserId     String?
actorType       String   // USER | SYSTEM | API
action          String   // ATTENDANCE_MODIFY, STAFF_UPDATE, etc.
targetType      String   // Attendance, Staff, etc.
targetId        String?
storeId         String?
staffId         String?
before          Json?
after           Json?
reason          String?
ipAddress       String?
userAgent       String?
metadata        Json?
createdAt       DateTime @default(now())
// 監査ログは更新・削除不可（アプリレベル制御）
```

### ApiKey
```
id              String   @id @default(cuid())
organizationId  String
name            String
description     String?
keyPrefix       String   // 検索用プレフィックス（mk_live_xxxxx）
keyHash         String   // SHA-256ハッシュ
permissions     Json     // { read: true, write: false, stores: ['id1', 'id2'] }
isActive        Boolean  @default(true)
expiresAt       DateTime?
lastUsedAt      DateTime?
createdByUserId String
createdAt       DateTime @default(now())
revokedAt       DateTime?
@@index([keyPrefix])
```

## 3. ENUMとステータス定義

```prisma
enum OrganizationRole {
  OWNER
  ADMIN
}

enum StaffStatus {
  INVITED
  ACTIVE
  ON_LEAVE
  RESIGNED
  SUSPENDED
}

enum ClockEventType {
  CLOCK_IN
  BREAK_START
  BREAK_END
  CLOCK_OUT
}

enum ClockSource {
  STORE_URL
  ADMIN
  SYSTEM
}

enum AttendanceStatus {
  IN_PROGRESS
  COMPLETED
  MISSING_CLOCK_OUT
  MISSING_BREAK_END
  ANOMALY
}

enum CorrectionRequestStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum TransportationType {
  PER_SHIFT
  MONTHLY
  NONE
}
```

## 4. 重要なインデックス設計

```sql
-- 打刻照会（最頻クエリ）
CREATE INDEX idx_attendance_event_staff_date ON AttendanceEvent(staffId, businessDate);
CREATE INDEX idx_attendance_staff_store_date ON Attendance(staffId, storeId, businessDate);

-- 管理者向け勤怠一覧
CREATE INDEX idx_attendance_org_date ON Attendance(organizationId, businessDate);
CREATE INDEX idx_attendance_store_date ON Attendance(storeId, businessDate);

-- 異常勤怠・修正申請
CREATE INDEX idx_attendance_has_anomaly ON Attendance(organizationId, hasAnomaly, isLocked);
CREATE INDEX idx_correction_request_status ON CorrectionRequest(status, attendanceId);

-- APIキー検索
CREATE INDEX idx_api_key_prefix ON ApiKey(keyPrefix, isActive);

-- 監査ログ
CREATE INDEX idx_audit_log_org_created ON AuditLog(organizationId, createdAt DESC);
```

## 5. データ保全の仕組み

1. **AttendanceEvent**: 物理削除不可（INSERT専用に近い運用）
2. **Attendance**: isLockedで締め処理後の変更を防止
3. **CorrectionRequest**: originalDataとrequestedDataをJSONスナップショットで保存
4. **WageHistory**: 上書きなし、期間で管理（effectiveFrom/effectiveTo）
5. **AuditLog**: アプリレベルでUPDATE/DELETE禁止
