import { NextRequest, NextResponse } from "next/server";

import { effectiveOn } from "@/lib/business/effective-period";
import {
  transportationForAttendance,
  type TransportationType,
} from "@/lib/business/transportation";
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

    // storeId と storeScope の両方がある場合、storeScope 内に storeId が含まれるか確認
    if (storeId && storeScope && !storeScope.includes(storeId)) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "指定された店舗へのアクセス権がありません" } },
        { status: 403 }
      );
    }

    // storeId が指定されている場合は storeScope より優先（上のチェックでスコープ内は保証済み）
    // from と to は同じ businessDate に載せる（別々に書くと後勝ちで片方が消える）
    const where = {
      organizationId: apiKey.organizationId,
      ...(storeId
        ? { storeId }
        : storeScope
          ? { storeId: { in: storeScope } }
          : {}),
      ...(staffId && { staffId }),
      ...((dateFrom || dateTo) && {
        businessDate: {
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo && { lte: dateTo }),
        },
      }),
    };

    const attendances = await db.attendance.findMany({
      where,
      include: {
        staff: { select: { displayName: true, employeeCode: true } },
        store: { select: { name: true } },
      },
      orderBy: [{ businessDate: "desc" }, { clockInAt: "desc" }],
      take: limit,
      skip: (page - 1) * limit,
    });

    // 交通費と時給は (スタッフ, 店舗) ごとの履歴から日付で引き当てる（CSV出力と同じ計算）
    const pairs = [
      ...new Map(
        attendances.map((a) => [`${a.staffId}:${a.storeId}`, a])
      ).values(),
    ];
    const staffStores = pairs.length
      ? await db.staffStore.findMany({
          where: {
            OR: pairs.map((a) => ({ staffId: a.staffId, storeId: a.storeId })),
          },
          select: {
            staffId: true,
            storeId: true,
            transportationHistories: {
              select: {
                type: true,
                amount: true,
                effectiveFrom: true,
                effectiveTo: true,
              },
            },
            wageHistories: {
              select: {
                amount: true,
                effectiveFrom: true,
                effectiveTo: true,
              },
            },
          },
        })
      : [];
    const settingsByPair = new Map(
      staffStores.map((ss) => [
        `${ss.staffId}:${ss.storeId}`,
        ss.transportationHistories.map((t) => ({
          type: t.type as TransportationType,
          amount: Number(t.amount),
          effectiveFrom: t.effectiveFrom,
          effectiveTo: t.effectiveTo,
        })),
      ])
    );
    const wagesByPair = new Map(
      staffStores.map((ss) => [
        `${ss.staffId}:${ss.storeId}`,
        ss.wageHistories.map((w) => ({
          amount: Number(w.amount),
          effectiveFrom: w.effectiveFrom,
          effectiveTo: w.effectiveTo,
        })),
      ])
    );

    const total = await db.attendance.count({ where });

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
        // 出勤ごとの交通費。月額と月上限は未対応で常に0（lib/business/transportation.ts）
        transportationAmount: transportationForAttendance(
          settingsByPair.get(`${a.staffId}:${a.storeId}`) ?? [],
          { businessDate: a.businessDate, clockInAt: a.clockInAt }
        ),
        // その営業日に効いていた時給。未登録なら null（呼び出し側で入力してもらう）
        hourlyWage:
          effectiveOn(
            wagesByPair.get(`${a.staffId}:${a.storeId}`) ?? [],
            a.businessDate
          )?.amount ?? null,
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
