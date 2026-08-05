import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// 型と定数だけのモジュールなので、middleware から読んでも実行時の重さは増えない
import { VERTICAL_SLUGS } from "@/lib/verticals/types";
import {
  VERTICAL_COOKIE,
  VERTICAL_COOKIE_MAX_AGE,
  normalizeVerticalSlug,
} from "@/lib/verticals/cookie";
import { LP_GATE_COOKIE, isLpGateUnlocked } from "@/lib/lp-gate";

const PUBLIC_PREFIXES = [
  // 業態版のLP（/concafe, /shisha …）と旧URL
  ...VERTICAL_SLUGS.map((v) => `/${v}`),
  "/lp",
  // 合言葉の入力ページ自体は当然公開する
  "/gate",
  // 開発用のトンマナ確認ページ（本番では 404 になる）
  "/theme-preview",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/invite",
  "/clock",
  "/api/auth",
  "/api/v1",
];

/**
 * この画面はどの業態版から来たのか。
 * LPのパス（/shisha）と、CTAが付ける `?v=shisha` の両方から拾う。
 */
function detectVertical(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const fromPath = VERTICAL_SLUGS.find(
    (v) => pathname === `/${v}` || pathname.startsWith(`/${v}/`)
  );
  return fromPath ?? normalizeVerticalSlug(searchParams.get("v"));
}

/** 合言葉で閉じる対象。公開前のLPだけ */
function isGatedPath(pathname: string) {
  return (
    pathname === "/lp" ||
    VERTICAL_SLUGS.some((v) => pathname === `/${v}` || pathname.startsWith(`/${v}/`))
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公開前のLPは合言葉で閉じる（実在するキャストの写真を載せているため）
  if (isGatedPath(pathname)) {
    const unlocked = await isLpGateUnlocked(
      request.cookies.get(LP_GATE_COOKIE)?.value
    );
    if (!unlocked) {
      const gate = new URL(`${request.nextUrl.basePath}/gate`, request.url);
      gate.searchParams.set("next", pathname);
      return NextResponse.redirect(gate);
    }
  }

  const isPublicPath = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // Auth.js v5 stores session token in these cookies
  const sessionToken =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token");

  const isLoggedIn = !!sessionToken;

  const basePath = request.nextUrl.basePath;

  const response = !isLoggedIn && !isPublicPath
    ? (() => {
        const loginUrl = new URL(`${basePath}/login`, request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      })()
    : // JWTが無効な場合もあるためcookieの存在だけで/dashboardにリダイレクトしない
      // ログイン済みユーザーの/loginリダイレクトはlogin/register page側で対処
      NextResponse.next();

  // ログイン前の導線（LP → 登録）でトンマナと用語を引き継ぐ
  const vertical = detectVertical(request);
  if (vertical && request.cookies.get(VERTICAL_COOKIE)?.value !== vertical) {
    response.cookies.set(VERTICAL_COOKIE, vertical, {
      path: "/",
      sameSite: "lax",
      maxAge: VERTICAL_COOKIE_MAX_AGE,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
