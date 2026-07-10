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
    const storeId = searchParams.get("storeId") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

    // 店舗スコープ
    const storeScope = apiKey.storeScope as string[] | null;

    // storeId と storeScope の両方がある場合、storeScope 内に storeId が含まれるか確認
    if (storeId && storeScope && !storeScope.includes(storeId)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "指定された店舗へのアクセス権がありません" } },
        { status: 403 }
      );
    }

    // スタッフ一覧取得
    // storeId が指定されている場合は storeScope より優先
    const effectiveStoreFilter = storeId ?? undefined;
    const effectiveStoreScope = !storeId && storeScope ? storeScope : undefined;

    const where = {
      organizationId: apiKey.organizationId,
      ...(status ? { status: status as any } : {}),
      ...(effectiveStoreFilter
        ? { staffStores: { some: { storeId: effectiveStoreFilter, isActive: true } } }
        : effectiveStoreScope
          ? { staffStores: { some: { storeId: { in: effectiveStoreScope }, isActive: true } } }
          : {}),
    };

    const [staff, total] = await Promise.all([
      db.staff.findMany({
        where,
        include: {
          staffStores: {
            where: {
              isActive: true,
              ...(effectiveStoreFilter
                ? { storeId: effectiveStoreFilter }
                : effectiveStoreScope
                  ? { storeId: { in: effectiveStoreScope } }
                  : {}),
            },
            include: {
              store: { select: { name: true } },
            },
          },
        },
        orderBy: { displayName: "asc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      db.staff.count({ where }),
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
        endpoint: "/api/v1/staff",
        method: "GET",
        statusCode: 200,
        ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    });

    return NextResponse.json({
      data: staff.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        employeeCode: s.employeeCode,
        email: s.email,
        status: s.status,
        hireDate: s.hireDate ? s.hireDate.toISOString().split("T")[0] : null,
        stores: s.staffStores.map((ss) => ({
          storeId: ss.storeId,
          storeName: ss.store.name,
          isPrimary: ss.isPrimary,
        })),
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
