# デザインシステム — みせ勤

## 1. デザインコンセプト

**キーワード**: 清潔 / 信頼 / 分かりやすさ / 業務効率

Linear・Stripe Dashboard・Vercel・Notionの長所を組み合わせつつ、
みせ勤独自のデザインシステムを構築する。

---

## 2. カラートークン

### ベース（ニュートラル）
```css
--color-background: #fafafa;       /* ページ背景 */
--color-surface: #ffffff;          /* カード・パネル背景 */
--color-surface-hover: #f4f4f5;    /* ホバー時 */
--color-border: #e4e4e7;           /* 境界線 */
--color-border-strong: #d1d1d6;    /* 強調境界線 */
```

### テキスト
```css
--color-text-primary: #18181b;     /* 主テキスト */
--color-text-secondary: #71717a;   /* 補足テキスト */
--color-text-tertiary: #a1a1aa;    /* プレースホルダー等 */
--color-text-disabled: #d4d4d8;    /* 無効状態 */
--color-text-inverse: #ffffff;     /* 白背景上の逆色 */
```

### アクセント（インディゴ）
```css
--color-primary: #4f46e5;          /* ボタン・リンク・アクティブ */
--color-primary-hover: #4338ca;
--color-primary-light: #ede9fe;    /* 薄いアクセント背景 */
--color-primary-text: #ffffff;
```

### ステータス
```css
/* 成功 */
--color-success: #16a34a;
--color-success-light: #f0fdf4;
--color-success-border: #bbf7d0;

/* 警告 */
--color-warning: #d97706;
--color-warning-light: #fffbeb;
--color-warning-border: #fde68a;

/* エラー */
--color-error: #dc2626;
--color-error-light: #fef2f2;
--color-error-border: #fecaca;

/* 情報 */
--color-info: #2563eb;
--color-info-light: #eff6ff;
--color-info-border: #bfdbfe;
```

### 勤怠ステータスカラー
```css
--color-status-working: #16a34a;   /* 勤務中 */
--color-status-break: #d97706;     /* 休憩中 */
--color-status-off: #71717a;       /* 退勤済み */
--color-status-missing: #dc2626;   /* 退勤漏れ */
--color-status-pending: #2563eb;   /* 申請中 */
```

---

## 3. タイポグラフィ

### フォントファミリー
```css
--font-sans: 'Geist', 'Noto Sans JP', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'Geist Mono', 'JetBrains Mono', ui-monospace, monospace;
```

### フォントサイズスケール
```css
--text-xs: 0.75rem;    /* 12px - ラベル、バッジ */
--text-sm: 0.875rem;   /* 14px - 補足テキスト、テーブル */
--text-base: 1rem;     /* 16px - 本文 */
--text-lg: 1.125rem;   /* 18px - 小見出し */
--text-xl: 1.25rem;    /* 20px - 見出し */
--text-2xl: 1.5rem;    /* 24px - ページタイトル */
--text-3xl: 1.875rem;  /* 30px - 打刻完了画面等 */
```

### フォントウェイト
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 行間
```css
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

---

## 4. スペーシング

4pxグリッドシステム

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

---

## 5. 角丸

```css
--radius-sm: 0.25rem;  /* 4px - バッジ、入力欄内部 */
--radius-md: 0.375rem; /* 6px - ボタン、入力欄 */
--radius-lg: 0.5rem;   /* 8px - カード */
--radius-xl: 0.75rem;  /* 12px - モーダル */
--radius-full: 9999px; /* ピル型バッジ等 */
```

---

## 6. シャドウ

```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05);
```

---

## 7. コンポーネント仕様

### ボタン

| バリアント | 用途 |
|-----------|------|
| primary | 主要アクション（保存、送信）|
| secondary | 副次アクション |
| outline | 破壊的でない補助操作 |
| ghost | テキスト様の操作 |
| destructive | 削除・無効化等 |
| loading | 処理中状態（disabled + spinner）|

タップ領域: 最小 44×44px（モバイル）

### バッジ（ステータス表示）

勤怠ステータスは色だけでなく**アイコン + テキスト**で表示（アクセシビリティ）

| ステータス | 色 | アイコン | テキスト |
|-----------|-----|---------|---------|
| 勤務中 | 緑 | ● | 勤務中 |
| 休憩中 | 橙 | ⏸ | 休憩中 |
| 退勤済み | グレー | ✓ | 退勤済み |
| 退勤漏れ | 赤 | ⚠ | 退勤漏れ |
| 申請中 | 青 | ⏳ | 申請中 |
| 承認済み | 緑 | ✓ | 承認済み |
| 却下 | 赤 | ✗ | 却下 |

### テーブル

- 固定ヘッダー（sticky top）
- 行クリックで詳細パネルまたはページ遷移
- ホバー: `--color-surface-hover` 背景
- ソートアイコン表示
- ページネーション（1ページ50件）
- 絞り込みバー（テーブル上部）
- モバイル: カード表示に切り替え

### フォーム

- ラベルは入力欄の上（フローティングラベル不使用）
- エラーメッセージは入力欄の下（赤テキスト + エラーアイコン）
- 必須項目は `*` マーク
- 送信ボタンは処理中にloading状態

### ダイアログ

- 背景オーバーレイ: `rgba(0,0,0,0.4)`
- Escapeキーで閉じる
- フォーカストラップ
- 破壊的操作のダイアログは「何が起きるか」を明記
- 操作名をボタンテキストに（「削除する」「無効化する」等、汎用的な「OK」は不使用）

### トースト

- 右下に表示
- 成功: 緑アイコン
- エラー: 赤アイコン
- 自動消去: 4秒（エラーは手動閉じ）
- スタックは最大3件

---

## 8. レイアウト

### 管理画面（PC）

```
┌─────────────────────────────────────────────┐
│ Header: ロゴ | 組織名 | 通知 | アカウント        │
├──────────┬──────────────────────────────────┤
│          │ Breadcrumb                        │
│ Sidebar  │ ─────────────────────────────── │
│ 240px    │ Page Title                        │
│          │                                   │
│ Nav      │ Main Content                      │
│ items    │                                   │
│          │                                   │
│          │                                   │
└──────────┴──────────────────────────────────┘
```

### スタッフ・打刻画面（モバイル優先）

```
┌────────────────────┐
│ Header              │
├────────────────────┤
│                     │
│ Content             │
│ (シングルカラム)      │
│                     │
└────────────────────┘
```

---

## 9. アニメーション

```css
--duration-fast: 100ms;
--duration-normal: 150ms;
--duration-slow: 200ms;
--easing-default: cubic-bezier(0.4, 0, 0.2, 1);
```

- ダイアログ開閉: フェード + スケール（150ms）
- トースト: スライドイン（150ms）
- サイドバー: スライド（200ms）
- ボタンホバー: 即時（100ms）

`@media (prefers-reduced-motion: reduce)` で全アニメーション無効化

---

## 10. アクセシビリティ

- コントラスト比: テキスト 4.5:1以上、大テキスト 3:1以上
- フォーカスリング: `2px solid var(--color-primary)` + 2px offset
- スキップリンク（main contentへ）
- 全インタラクティブ要素にキーボードアクセス
- aria-live で動的コンテンツ更新を読み上げ
- ダイアログは `role="dialog" aria-modal="true" aria-labelledby`
- テーブルは `caption` または `aria-label`
