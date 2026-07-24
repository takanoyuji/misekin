import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOrgMember } from "@/lib/auth/permissions";
import { resolveActiveOrganizationId } from "@/lib/auth/active-org";
import { PageHeader } from "@/components/common/page-header";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ja } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { AvailabilityBoard } from "./availability-board";

export const metadata: Metadata = {
  title: "シフト希望",
};

const TZ = "Asia/Tokyo";
const DAYS_AHEAD = 21; // 3週間先まで希望を出せる

export default async function MyShiftsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = await resolveActiveOrganizationId(
    session.user?.id,
    (session as any).activeOrganizationId as string | null
  );
  if (!activeOrgId) redirect("/dashboard");

  try {
    await requireOrgMember(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const staff = await db.staff.findFirst({
    where: { userId: session.user!.id, organizationId: activeOrgId },
    select: { id: true },
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

  const staffStores = await db.staffStore.findMany({
    where: { staffId: staff.id, isActive: true },
    orderBy: [{ isPrimary: "desc" }],
    select: { store: { select: { id: true, name: true } } },
  });

  // 対象期間の営業日リスト（今日〜DAYS_AHEAD日先）
  const now = toZonedTime(new Date(), TZ);
  const dates: string[] = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    dates.push(format(d, "yyyy-MM-dd"));
  }
  const from = dates[0];
  const to = dates[dates.length - 1];

  const stores = staffStores.map((ss) => ss.store);
  const storeIds = stores.map((s) => s.id);

  // 提出済みの希望と、公開済みの自分のシフト
  const [availabilities, myShifts] = await Promise.all([
    db.shiftAvailability.findMany({
      where: {
        staffId: staff.id,
        storeId: { in: storeIds.length ? storeIds : ["__none__"] },
        businessDate: { gte: from, lte: to },
      },
      select: {
        storeId: true,
        businessDate: true,
        type: true,
        startAt: true,
        endAt: true,
        note: true,
      },
    }),
    db.shift.findMany({
      where: {
        staffId: staff.id,
        status: "PUBLISHED",
        businessDate: { gte: from, lte: to },
      },
      select: {
        storeId: true,
        businessDate: true,
        startAt: true,
        endAt: true,
      },
    }),
  ]);

  const dayLabels = dates.map((d) => ({
    date: d,
    label: format(toZonedTime(new Date(`${d}T00:00:00`), TZ), "M/d(E)", {
      locale: ja,
    }),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="シフト希望"
        description="勤務できる日・できない日を提出します。管理者がこれを見てシフトを組みます。"
      />

      {stores.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center shadow-sm">
          <CalendarDays
            className="mb-4 size-12 text-muted-foreground/30"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            所属店舗が設定されていません。管理者にお問い合わせください。
          </p>
        </div>
      ) : (
        <AvailabilityBoard
          stores={stores}
          days={dayLabels}
          availabilities={availabilities.map((a) => ({
            storeId: a.storeId,
            businessDate: a.businessDate,
            type: a.type,
            startTime: a.startAt
              ? format(toZonedTime(a.startAt, TZ), "HH:mm")
              : null,
            endTime: a.endAt ? format(toZonedTime(a.endAt, TZ), "HH:mm") : null,
            note: a.note,
          }))}
          publishedShifts={myShifts.map((s) => ({
            storeId: s.storeId,
            businessDate: s.businessDate,
            startTime: format(toZonedTime(s.startAt, TZ), "HH:mm"),
            endTime: format(toZonedTime(s.endAt, TZ), "HH:mm"),
          }))}
        />
      )}
    </div>
  );
}
