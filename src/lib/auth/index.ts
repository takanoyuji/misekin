import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";
import { authConfig } from "@/lib/auth/config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  trustHost: true,
  session: {
    strategy: "database",
  },
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, user }) {
      if (user) {
        session.user.id = user.id;
        // アクティブ組織IDをセッションから取得
        const dbSession = await db.session.findUnique({
          where: { sessionToken: session.sessionToken as string },
        });
        (session as any).activeOrganizationId =
          dbSession?.activeOrganizationId ?? null;
      }
      return session;
    },
  providers: [
    Credentials({
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user || !user.passwordHash) return null;
        if (!user.emailVerified) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      // ログイン成功イベント（監査ログには別途記録）
    },
  },
});

/**
 * 現在のユーザーのアクティブ組織IDを取得する
 */
export async function getActiveOrganizationId(
  sessionToken: string
): Promise<string | null> {
  const session = await db.session.findUnique({
    where: { sessionToken },
  });
  return session?.activeOrganizationId ?? null;
}

/**
 * アクティブ組織を設定する
 */
export async function setActiveOrganization(
  sessionToken: string,
  organizationId: string
): Promise<void> {
  await db.session.update({
    where: { sessionToken },
    data: { activeOrganizationId: organizationId },
  });
}
