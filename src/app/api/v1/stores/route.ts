import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashApiKey, extractApiKey } from "@/lib/api/api-key";

export async function GET(req: NextRequest) {
  try {
    // APIキー認証
    const rawKey = extractApiKey(req.headers.get("Authorization"));
    if (!rawKey) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "APIキーが必要です" } },
        { status: 401 }
      );
    }

    const keyPrefix = rawKey.substring(0, 16);
    const keyHash = hashApiKey(rawKey);

    const apiKey = await db.apiKey.findFirst({
      where: { keyPrefix, keyHash, isActive: true },
    });

    if (!apiKey) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "無効なAPIキーです" } },
        { status: 401 }
      );
    }

    // 有効期限チェック
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "APIキーの有効期限が切れています" } },
        { status: 401 }
      );
    }

    // クエリパラメータ
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

    // 店舗スコープ
    const storeScope = apiKey.storeScope as string[] | null;

    const where = {
      organizationId: apiKey.organizationId,
      ...(storeScope ? { id: { in: storeScope } } : {}),
    };

    const [stores, total] = await Promise.all([
      db.store.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.store.count({ where }),
    ]);

    // 最終使用日時を更新
    await db.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    // アクセスログ
    await db.apiAccessLog.create({
      data: {
        apiKeyId: apiKey.id,
        endpoint: "/api/v1/stores",
        method: "GET",
        statusCode: 200,
        ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    });

    return NextResponse.json({
      data: stores.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        address: s.address,
        timezone: s.timezone,
        dayChangeHour: s.dayChangeHour,
        isActive: s.isActive,
        createdAt: s.createdAt.toISOString(),
      })),
      pagination: {
        total,
        page,
        limit,
        hasNextPage: page * limit < total,
      },
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
