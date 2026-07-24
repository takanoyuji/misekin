/**
 * アプリの公開URLを返す (サーバー専用)
 *
 * NEXT_PUBLIC_APP_URL はビルド時に埋め込まれる値のため、
 * Docker のように「ビルド時と実行時で環境が分かれる」構成では空になる。
 * 実行時に渡される APP_URL / NEXTAUTH_URL を優先して解決する。
 *
 * basePath を含んだ値が入る想定 (例: https://example.com/dev/misekin)
 */
export function getAppUrl(): string {
  const url =
    process.env.APP_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000";

  // 末尾のスラッシュは付けない (呼び出し側が /clock/... を足すため)
  return url.replace(/\/+$/, "");
}

/**
 * 店舗の打刻ページURLを組み立てる
 */
export function buildClockUrl(token: string): string {
  return `${getAppUrl()}/clock/${token}`;
}
