import type { NextAuthConfig } from "next-auth";

/**
 * Edge Runtime 互換のベース認証設定（Prisma不使用）
 * middleware.ts からインポートして使用する
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth;

      const isPublicPath =
        nextUrl.pathname.startsWith("/clock") ||
        nextUrl.pathname.startsWith("/api") ||
        nextUrl.pathname === "/login" ||
        nextUrl.pathname === "/register" ||
        nextUrl.pathname === "/verify-email" ||
        nextUrl.pathname === "/reset-password" ||
        nextUrl.pathname === "/onboarding";

      if (!isLoggedIn && !isPublicPath) return false;

      if (
        isLoggedIn &&
        (nextUrl.pathname === "/login" || nextUrl.pathname === "/register")
      ) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
