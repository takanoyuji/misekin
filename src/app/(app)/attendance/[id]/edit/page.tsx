import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, canAccessStore } from "@/lib/auth/permissions";
import { AttendanceEditForm } from "./attendance-edit-form";

export const metadata: Metadata = {
  title: "勤怠修正",
};

export default async function AttendanceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = (session as any).activeOrganizationId as string | null;
  if (!activeOrgId) redirect("/dashboard");

  let ctx;
  try {
    ctx = await requireAdmin(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;

  const attendance = await db.attendance.findUnique({
    where: { id },
    include: {
      staff: { select: { displayName: true } },
      store: { select: { name: true, timezone: true } },
      breaks: { orderBy: { startAt: "asc" } },
    },
  });

  if (!attendance) notFound();
  if (attendance.organizationId !== activeOrgId) notFound();

  const hasAccess = await canAccessStore(ctx.memberId, ctx.role, attendance.storeId);
  if (!hasAccess) redirect("/attendance");

  if (attendance.isLocked) {
    redirect(`/attendance/${id}`);
  }

  return (
    <AttendanceEditForm
      attendanceId={id}
      organizationId={activeOrgId}
      original={{
        businessDate: attendance.businessDate,
        staffName: attendance.staff.displayName,
        storeName: attendance.store.name,
        timezone: attendance.store.timezone ?? "Asia/Tokyo",
        clockInAt: attendance.clockInAt?.toISOString() ?? null,
        clockOutAt: attendance.clockOutAt?.toISOString() ?? null,
        adminNotes: attendance.adminNotes ?? null,
        breaks: attendance.breaks.map((b) => ({
          startAt: b.startAt.toISOString(),
          endAt: b.endAt?.toISOString() ?? null,
        })),
      }}
    />
  );
}
