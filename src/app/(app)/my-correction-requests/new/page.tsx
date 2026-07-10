import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/permissions";
import { MyCorrectionRequestForm } from "./my-correction-request-form";

export const metadata: Metadata = {
  title: "修正申請",
};

export default async function NewCorrectionRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ attendanceId?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = (session as any).activeOrganizationId as string | null;
  if (!activeOrgId) redirect("/dashboard");

  try {
    await requireOrgMember(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const staff = await db.staff.findFirst({
    where: { userId: session.user!.id, organizationId: activeOrgId },
    select: { id: true, displayName: true },
  });

  if (!staff) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">
          スタッフ情報が見つかりません。管理者にお問い合わせください。
        </p>
      </div>
    );
  }

  // 自分の勤怠一覧（直近3ヶ月、ロックされていないもの）
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const fromDate = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;

  const myAttendances = await db.attendance.findMany({
    where: {
      organizationId: activeOrgId,
      staffId: staff.id,
      isLocked: false,
      businessDate: { gte: fromDate },
      // 申請中のものを除く
      correctionRequests: { none: { status: "PENDING" } },
    },
    include: {
      store: { select: { name: true, timezone: true } },
      breaks: { orderBy: { startAt: "asc" } },
    },
    orderBy: { businessDate: "desc" },
    take: 90,
  });

  const params = await searchParams;
  const preselectedId = params.attendanceId;

  return (
    <MyCorrectionRequestForm
      userId={session.user!.id}
      organizationId={activeOrgId}
      staffId={staff.id}
      attendances={myAttendances.map((att) => ({
        id: att.id,
        businessDate: att.businessDate,
        storeName: att.store.name,
        timezone: att.store.timezone ?? "Asia/Tokyo",
        clockInAt: att.clockInAt?.toISOString() ?? null,
        clockOutAt: att.clockOutAt?.toISOString() ?? null,
        breaks: att.breaks.map((b) => ({
          startAt: b.startAt.toISOString(),
          endAt: b.endAt?.toISOString() ?? null,
        })),
      }))}
      preselectedAttendanceId={preselectedId}
    />
  );
}
