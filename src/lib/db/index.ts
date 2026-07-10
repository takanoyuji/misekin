import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient(
    process.env.NODE_ENV === "development"
      ? ({ log: ["query", "error", "warn"] } as any)
      : undefined
  );

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export * from "@/generated/prisma/client";
