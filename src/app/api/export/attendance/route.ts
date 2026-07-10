import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireAdmin, getAccessibleStoreIds } from "@/lib/auth/permissions";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

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

  const header = "勤務日,スタッフ名,社員コード,店舗名,出勤時刻,退勤時刻,休憩(分),実労働(分),ステータス";
  const rows = attendances.map((a) => {
    const tz = a.store.timezone ?? "Asia/Tokyo";
    return [
      a.businessDate,
      a.staff.displayName,
      a.staff.employeeCode ?? "",
      a.store.name,
      formatDatetime(a.clockInAt, tz),
      formatDatetime(a.clockOutAt, tz),
      a.breakMinutes?.toString() ?? "",
      a.workMinutes?.toString() ?? "",
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
