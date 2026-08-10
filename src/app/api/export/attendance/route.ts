import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdmin, getAccessibleStoreIds } from "@/lib/auth/permissions";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import {
  transportationForAttendance,
  type TransportationType,
} from "@/lib/business/transportation";

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "勤務中",
  COMPLETED: "退勤済み",
  MISSING_CLOCK_OUT: "退勤漏れ",
  MISSING_BREAK_END: "休憩中",
  ANOMALY: "異常",
};

function formatDatetime(date: Date | null, timezone: string): string {
  if (!date) return "";
  return format(toZonedTime(date, timezone), "yyyy/MM/dd HH:mm");
}

function escapeCsv(value: string | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const activeOrgId = (session as any).activeOrganizationId as string | null;
  if (!activeOrgId) {
    return new NextResponse("No active organization", { status: 400 });
  }

  let ctx;
  try {
    ctx = await requireAdmin(session.user.id, activeOrgId);
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const accessibleStoreIds = await getAccessibleStoreIds(ctx.memberId, ctx.role, activeOrgId);

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";
  const storeId = searchParams.get("storeId") ?? undefined;

  if (!dateFrom || !dateTo) {
    return new NextResponse("dateFrom and dateTo are required", { status: 400 });
  }

  // Store scope check
  let storeWhere: string[] | undefined;
  if (accessibleStoreIds !== null) {
    storeWhere = storeId
      ? accessibleStoreIds.includes(storeId) ? [storeId] : []
      : accessibleStoreIds;
  } else if (storeId) {
    storeWhere = [storeId];
  }

  const attendances = await db.attendance.findMany({
    where: {
      organizationId: activeOrgId,
      businessDate: { gte: dateFrom, lte: dateTo },
      ...(storeWhere !== undefined ? { storeId: { in: storeWhere } } : {}),
    },
    include: {
      staff: { select: { displayName: true, employeeCode: true } },
      store: { select: { name: true, timezone: true } },
    },
    orderBy: [{ businessDate: "asc" }, { clockInAt: "asc" }],
  });

  // 交通費は (スタッフ, 店舗) ごとの履歴から日付で引き当てる。
  // 勤怠1件ずつ問い合わせると件数ぶんクエリが飛ぶので、出てきた組み合わせだけまとめて取る
  const pairs = [
    ...new Map(
      attendances.map((a) => [`${a.staffId}:${a.storeId}`, a])
    ).values(),
  ];
  const staffStores = pairs.length
    ? await db.staffStore.findMany({
        where: { OR: pairs.map((a) => ({ staffId: a.staffId, storeId: a.storeId })) },
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

  const header =
    "勤務日,スタッフ名,社員コード,店舗名,出勤時刻,退勤時刻,休憩(分),実労働(分),交通費,ステータス";
  const rows = attendances.map((a) => {
    const tz = a.store.timezone ?? "Asia/Tokyo";
    const transportation = transportationForAttendance(
      settingsByPair.get(`${a.staffId}:${a.storeId}`) ?? [],
      { businessDate: a.businessDate, clockInAt: a.clockInAt }
    );
    return [
      a.businessDate,
      a.staff.displayName,
      a.staff.employeeCode ?? "",
      a.store.name,
      formatDatetime(a.clockInAt, tz),
      formatDatetime(a.clockOutAt, tz),
      a.breakMinutes?.toString() ?? "",
      a.workMinutes?.toString() ?? "",
      transportation.toString(),
      STATUS_LABEL[a.status] ?? a.status,
    ].map(escapeCsv).join(",");
  });

  const csv = "\uFEFF" + [header, ...rows].join("\r\n"); // BOM付きUTF-8
  const filename = `attendance_${dateFrom}_${dateTo}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
