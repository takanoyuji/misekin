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
import {
  getSubmissionPeriods,
  daysInPeriod,
} from "@/lib/business/shift-period";
import { AvailabilityBoard } from "./availability-board";

export const metadata: Metadata = {
  title: "シフト希望",
};

const TZ = "Asia/Tokyo";

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
    select: {
      store: {
        select: {
          id: true,
          name: true,
          shiftPeriodUnit: true,
          shiftPeriodStartDay: true,
          shiftSlots: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, startTime: true, endTime: true },
          },
        },
      },
    },
  });

  const stores = staffStores.map((ss) => ss.store);
  const storeIds = stores.map((s) => s.id);

  // 店舗ごとに提出対象期間（当期＋翌期）を計算し、日リストと表示範囲を作る
  const todayStr = format(toZonedTime(new Date(), TZ), "yyyy-MM-dd");

  // 全店舗をまとめて取得するための最小・最大日
  let globalFrom = todayStr;
  let globalTo = todayStr;
  const storeDays = new Map<string, { date: string; label: string }[]>();
  const storePeriods = new Map<
    string,
    { label: string; start: string; end: string }[]
  >();

  for (const store of stores) {
    const periods = getSubmissionPeriods(
      store.shiftPeriodUnit,
      store.shiftPeriodStartDay,
      todayStr,
      2
    );
    storePeriods.set(
      store.id,
      periods.map((p) => ({ label: p.label, start: p.start, end: p.end }))
    );

    const days: { date: string; label: string }[] = [];
    for (const p of periods) {
      for (const d of daysInPeriod(p)) {
        // 過去日は提出しない（当期の途中から）
        if (d < todayStr) continue;
        days.push({
          date: d,
          label: format(toZonedTime(new Date(`${d}T00:00:00`), TZ), "M/d(E)", {
            locale: ja,
          }),
        });
        if (d < globalFrom) globalFrom = d;
        if (d > globalTo) globalTo = d;
      }
    }
    storeDays.set(store.id, days);
  }

  // 提出済みの希望と、公開済みの自分のシフト
  const [availabilities, myShifts] = await Promise.all([
    db.shiftAvailability.findMany({
      where: {
        staffId: staff.id,
        storeId: { in: storeIds.length ? storeIds : ["__none__"] },
        businessDate: { gte: globalFrom, lte: globalTo },
      },
      select: {
        storeId: true,
        slotId: true,
        businessDate: true,
        type: true,
        note: true,
      },
    }),
    db.shift.findMany({
      where: {
        staffId: staff.id,
        status: "PUBLISHED",
        businessDate: { gte: globalFrom, lte: globalTo },
      },
      select: {
        storeId: true,
        slotId: true,
        businessDate: true,
        startAt: true,
        endAt: true,
      },
    }),
  ]);

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
          stores={stores.map((s) => ({
            id: s.id,
            name: s.name,
            days: storeDays.get(s.id) ?? [],
            periods: storePeriods.get(s.id) ?? [],
            slots: s.shiftSlots.map((sl) => ({
              id: sl.id,
              name: sl.name,
              startTime: sl.startTime,
              endTime: sl.endTime,
            })),
          }))}
          availabilities={availabilities.map((a) => ({
            storeId: a.storeId,
            slotId: a.slotId,
            businessDate: a.businessDate,
            type: a.type,
            note: a.note,
          }))}
          publishedShifts={myShifts.map((s) => ({
            storeId: s.storeId,
            slotId: s.slotId,
            businessDate: s.businessDate,
            startTime: format(toZonedTime(s.startAt, TZ), "HH:mm"),
            endTime: format(toZonedTime(s.endAt, TZ), "HH:mm"),
          }))}
        />
      )}
    </div>
  );
}
