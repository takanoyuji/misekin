/**
 * next.config.ts の `basePath` と同じ値 (例: "/dev/misekin")
 *
 * ビルド時にクライアントバンドルへ埋め込まれるため、サーバー・クライアントの
 * どちらからでも参照できる。
 *
 * next/link・next/router・next/navigation の redirect() は basePath を
 * 自動で付けるので、これらを使う場合は不要。
 * 一方で以下は自動付与されないため、この定数を明示的に前置する:
 *   - 素の <a href="/..."> / <form action="/...">
 *   - クライアントからの fetch("/api/...")
 *   - Auth.js の signIn/signOut に渡す redirectTo / callbackUrl
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
