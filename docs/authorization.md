# 権限設計書 — みせ勤

## 1. 権限階層

```
組織オーナー (OrganizationRole.OWNER)
  ↓ 全権限
管理者 (OrganizationRole.ADMIN)
  ↓ オーナー権限移譲以外の全権限（店舗スコープ制限可）
スタッフ (Staff.status = ACTIVE)
  ↓ 自分の勤怠・修正申請のみ
打刻端末 (StoreClockUrl.token 認証)
  ↓ 打刻操作のみ
外部API (ApiKey 認証)
  ↓ キーのスコープ内のみ
```

## 2. 権限マトリクス

### 組織管理

| 操作 | オーナー | 管理者 | スタッフ |
|------|---------|-------|---------|
| 組織設定変更 | ✅ | ❌ | ❌ |
| 組織有効/無効 | ✅ | ❌ | ❌ |
| オーナー権限移譲 | ✅ | ❌ | ❌ |
| 管理者招待 | ✅ | ❌ | ❌ |
| 管理者権限変更 | ✅ | ❌ | ❌ |
| 管理者削除 | ✅ | ❌ | ❌ |
| 監査ログ閲覧 | ✅ | ✅ | ❌ |

### 店舗管理

| 操作 | オーナー | 管理者（全店舗） | 管理者（特定店舗） | スタッフ |
|------|---------|--------------|----------------|---------|
| 店舗作成 | ✅ | ✅ | ❌ | ❌ |
| 店舗編集 | ✅ | ✅ | ✅（所属店舗のみ） | ❌ |
| 店舗無効化 | ✅ | ✅ | ❌ | ❌ |
| 打刻URL管理 | ✅ | ✅ | ✅（所属店舗のみ） | ❌ |

### スタッフ管理

| 操作 | オーナー | 管理者（全店舗） | 管理者（特定店舗） | スタッフ |
|------|---------|--------------|----------------|---------|
| スタッフ招待 | ✅ | ✅ | ✅（所属店舗のみ） | ❌ |
| スタッフ情報編集 | ✅ | ✅ | ✅（所属店舗のみ） | ❌ |
| 退職処理 | ✅ | ✅ | ❌ | ❌ |
| 時給設定 | ✅ | ✅ | ✅（所属店舗のみ） | ❌ |
| 交通費設定 | ✅ | ✅ | ✅（所属店舗のみ） | ❌ |
| 自分の情報閲覧 | — | — | — | ✅ |

### 勤怠管理

| 操作 | オーナー | 管理者（全店舗） | 管理者（特定店舗） | スタッフ |
|------|---------|--------------|----------------|---------|
| 全勤怠閲覧 | ✅ | ✅ | ✅（所属店舗のみ） | ❌ |
| 自分の勤怠閲覧 | — | — | — | ✅ |
| 勤怠修正 | ✅ | ✅ | ✅（所属店舗のみ） | ❌ |
| 修正申請一覧閲覧 | ✅ | ✅ | ✅（所属店舗のみ） | ❌ |
| 修正申請承認/却下 | ✅ | ✅ | ✅（所属店舗のみ） | ❌ |
| 自分の修正申請提出 | — | — | — | ✅ |
| 締め処理 | ✅ | ✅ | ✅（所属店舗のみ） | ❌ |
| ロック解除 | ✅ | ✅（要特別権限） | ❌ | ❌ |

### システム

| 操作 | オーナー | 管理者 | スタッフ |
|------|---------|-------|---------|
| CSVエクスポート | ✅ | ✅（スコープ内） | ❌ |
| APIキー発行 | ✅ | ✅ | ❌ |
| APIキー無効化 | ✅ | ✅（自分が発行したもの）| ❌ |

## 3. 管理者スコープ設計

```typescript
type AdminScope = {
  type: 'ALL_STORES' | 'SPECIFIC_STORES';
  storeIds?: string[];  // type === 'SPECIFIC_STORES' の場合
};
```

### スコープチェック実装例

```typescript
async function canAccessStore(
  userId: string,
  organizationId: string,
  storeId: string
): Promise<boolean> {
  const member = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } }
  });
  if (!member?.isActive) return false;
  if (member.role === 'OWNER') return true;

  // 管理者の場合、スコープを確認
  const scope = await db.storeAdmin.findFirst({
    where: { organizationMemberId: member.id, storeId }
  });
  // scope がない = 全店舗アクセス可能（ALL_STORES）
  // scope がある = 特定店舗のみ
  return true; // 実際はStoreAdmin設計に依存
}
```

## 4. 打刻端末の権限

打刻URLトークンは「その店舗への打刻権限」のみを持つ。
- スタッフ一覧取得（自店舗の在籍スタッフのみ）
- PIN検証
- 打刻操作（CLOCK_IN, BREAK_START, BREAK_END, CLOCK_OUT）
- 現在状態確認

**取得不可**: 時給、勤怠一覧、他スタッフ情報など

## 5. 兼任ユーザーの処理

同一Userが複数組織に所属する場合：
- セッションに `activeOrganizationId` を保持
- 組織切替UI でアクティブ組織を変更
- 全クエリは `activeOrganizationId` でスコープ制限

## 6. オーナー保護ルール

```typescript
// オーナーが最後の1人の場合、権限降格・削除を禁止
async function canRemoveOwner(organizationId: string, userId: string): Promise<boolean> {
  const ownerCount = await db.organizationMember.count({
    where: { organizationId, role: 'OWNER', isActive: true }
  });
  return ownerCount > 1;
}
```

## 7. Server Side 認可チェック必須

フロントエンドでのUI制御だけでなく、**必ずServer Action/Route Handlerで認可を検証**する。

```typescript
// Server Action の認可チェックテンプレート
async function requireOrgAccess(organizationId: string) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const member = await db.organizationMember.findFirst({
    where: {
      organizationId,
      userId: session.user.id,
      isActive: true
    }
  });
  if (!member) throw new Error('Forbidden');
  return { member, session };
}
```
