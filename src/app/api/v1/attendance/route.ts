import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashApiKey, extractApiKey } from "@/lib/api/api-key";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  let apiKeyId: string | null = null;

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

    apiKeyId = apiKey.id;

    // クエリパラメータ
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId");
    const staffId = searchParams.get("staffId");
    const dateFrom = searchParams.get("from");
    const dateTo = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

    // 店舗スコープチェック
    const storeScope = apiKey.storeScope as string[] | null;

    const attendances = await db.attendance.findMany({
      where: {
        organizationId: apiKey.organizationId,
        ...(storeId && { storeId }),
        ...(staffId && { staffId }),
        ...(dateFrom && { businessDate: { gte: dateFrom } }),
        ...(dateTo && { businessDate: { lte: dateTo } }),
        ...(storeScope && { storeId: { in: storeScope } }),
      },
      include: {
        staff: { select: { displayName: true, employeeCode: true } },
        store: { select: { name: true } },
      },
      orderBy: [{ businessDate: "desc" }, { clockInAt: "desc" }],
      take: limit,
      skip: (page - 1) * limit,
    });

    const total = await db.attendance.count({
      where: {
        organizationId: apiKey.organizationId,
        ...(storeId && { storeId }),
        ...(staffId && { staffId }),
        ...(dateFrom && { businessDate: { gte: dateFrom } }),
        ...(dateTo && { businessDate: { lte: dateTo } }),
        ...(storeScope && { storeId: { in: storeScope } }),
      },
    });

    // 最終使用日時を更新
    await db.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    // アクセスログ
    await db.apiAccessLog.create({
      data: {
        apiKeyId: apiKey.id,
        endpoint: "/api/v1/attendance",
        method: "GET",
        statusCode: 200,
        ipAddress: req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
    });

    return NextResponse.json({
      data: attendances.map((a) => ({
        id: a.id,
        staffId: a.staffId,
        staffName: a.staff.displayName,
        staffEmployeeCode: a.staff.employeeCode,
        storeId: a.storeId,
        storeName: a.store.name,
        businessDate: a.businessDate,
        clockInAt: a.clockInAt?.toISOString() ?? null,
        clockOutAt: a.clockOutAt?.toISOString() ?? null,
        breakMinutes: a.breakMinutes,
        workMinutes: a.workMinutes,
        status: a.status,
        hasAnomaly: a.hasAnomaly,
        isLocked: a.isLocked,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
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
