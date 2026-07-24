import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_PREFIXES = [
  "/lp",
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // Auth.js v5 stores session token in these cookies
  const sessionToken =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token");

  const isLoggedIn = !!sessionToken;

  const basePath = request.nextUrl.basePath;

  if (!isLoggedIn && !isPublicPath) {
    const loginUrl = new URL(`${basePath}/login`, request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // JWTが無効な場合もあるためcookieの存在だけで/dashboardにリダイレクトしない
  // ログイン済みユーザーの/loginリダイレクトはlogin/register page側で対処

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
