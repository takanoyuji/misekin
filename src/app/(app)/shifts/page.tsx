import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, getAccessibleStoreIds } from "@/lib/auth/permissions";
import { resolveActiveOrganizationId } from "@/lib/auth/active-org";
import { PageHeader } from "@/components/common/page-header";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ja } from "date-fns/locale";
import { checkShiftRules, evaluateRules } from "@/lib/business/shift-rules";
import { computeShiftMetrics, formatRate } from "@/lib/business/shift-metrics";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { ShiftEditor } from "./shift-editor";
import { HeadcountPanel } from "./headcount-panel";
import { getHeadcountGrid } from "@/lib/business/headcount-server";

export const metadata: Metadata = {
  title: "シフト管理",
};

const TZ = "Asia/Tokyo";

interface SearchParams {
  storeId?: string;
  weekStart?: string; // YYYY-MM-DD（週の起点）
}

function addDaysStr(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const activeOrgId = await resolveActiveOrganizationId(
    session.user?.id,
    (session as any).activeOrganizationId as string | null
  );
  if (!activeOrgId) redirect("/dashboard");

  let ctx;
  try {
    ctx = await requireAdmin(session.user!.id, activeOrgId);
  } catch {
    redirect("/dashboard");
  }

  const accessibleStoreIds = await getAccessibleStoreIds(
    ctx.memberId,
    ctx.role,
    activeOrgId
  );

  const stores = await db.store.findMany({
    where: {
      organizationId: activeOrgId,
      isActive: true,
      ...(accessibleStoreIds ? { id: { in: accessibleStoreIds } } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const params = await searchParams;
  const storeId = params.storeId ?? stores[0]?.id ?? "";

  // 取り込んだ売上から必要人数の目安を出す（売上が無ければ null）
  const headcountGrid = storeId ? await getHeadcountGrid(storeId) : null;

  if (stores.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="シフト管理" />
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          担当できる店舗がありません。
        </div>
      </div>
    );
  }

  // 週の起点（既定は今日）
  const todayJst = format(toZonedTime(new Date(), TZ), "yyyy-MM-dd");
  const weekStart = params.weekStart ?? todayJst;
  const weekEnd = addDaysStr(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i));

  // その店舗のスタッフ・時間帯・希望・必要人数・シフト
  const [staffStores, slots, availabilities, requirements, shifts, activeStaffCount] =
    await Promise.all([
      db.staffStore.findMany({
        where: { storeId, isActive: true, staff: { status: "ACTIVE" } },
        orderBy: [{ isPrimary: "desc" }],
        select: { staff: { select: { id: true, displayName: true } } },
      }),
      db.shiftSlot.findMany({
        where: { storeId, isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, startTime: true, endTime: true },
      }),
      db.shiftAvailability.findMany({
        where: { storeId, businessDate: { gte: weekStart, lte: weekEnd } },
        select: { staffId: true, slotId: true, businessDate: true, type: true },
      }),
      db.shiftRequirement.findMany({
        where: { storeId, businessDate: { gte: weekStart, lte: weekEnd } },
        select: { slotId: true, businessDate: true, requiredCount: true },
      }),
      db.shift.findMany({
        where: { storeId, businessDate: { gte: weekStart, lte: weekEnd } },
        orderBy: { startAt: "asc" },
        select: {
          id: true,
          staffId: true,
          slotId: true,
          businessDate: true,
          startAt: true,
          endAt: true,
          status: true,
          note: true,
          revisionCount: true,
        },
      }),
      db.staffStore.count({
        where: { storeId, isActive: true, staff: { status: "ACTIVE" } },
      }),
    ]);

  // 有効な店長ルール（評価可能なもののみ）
  const enabledRules = await db.shiftRule.findMany({
    where: { storeId, enabled: true },
    select: { id: true, ruleType: true, params: true, description: true },
  });

  const staffList = staffStores.map((ss) => ss.staff);

  const shiftLikes = shifts.map((s) => ({
    id: s.id,
    staffId: s.staffId,
    businessDate: s.businessDate,
    startAt: s.startAt,
    endAt: s.endAt,
  }));

  // 法令警告（週内の全シフト対象）
  const warnings = checkShiftRules(shiftLikes);

  // 店長ルールの違反（SPACING / MAX_SHIFTS_PER_WEEK のみ評価）
  const ruleViolations = evaluateRules(
    enabledRules.map((r) => ({
      id: r.id,
      ruleType: r.ruleType,
      params: (r.params ?? {}) as Record<string, unknown>,
      description: r.description,
    })),
    shiftLikes
  );
  const ruleDescById = new Map(enabledRules.map((r) => [r.id, r.description]));
  const staffNameById = new Map(staffList.map((s) => [s.id, s.displayName]));

  // 指標
  const requiredTotal = requirements.reduce((n, r) => n + r.requiredCount, 0);
  const metrics = computeShiftMetrics({
    activeStaffCount,
    dayCount: 7,
    submittedAvailabilities: availabilities.length,
    requiredTotal,
    assignedTotal: shifts.length,
    postPublishRevisions: shifts.reduce((n, s) => n + s.revisionCount, 0),
  });

  const buildUrl = (next: Partial<SearchParams>) => {
    const sp = new URLSearchParams();
    sp.set("storeId", next.storeId ?? storeId);
    sp.set("weekStart", next.weekStart ?? weekStart);
    return `/shifts?${sp.toString()}`;
  };

  const dayLabels = days.map((d) => ({
    date: d,
    label: format(toZonedTime(new Date(`${d}T00:00:00`), TZ), "M/d(E)", {
      locale: ja,
    }),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="シフト管理"
        description="スタッフの希望を見ながらシフトを組み、公開します。"
        actions={
          <Link
            href={`/shifts/rules?storeId=${storeId}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            シフトルール
          </Link>
        }
      />

      {/* 店舗・週の選択 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {stores.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            {stores.map((s) => (
              <Link
                key={s.id}
                href={buildUrl({ storeId: s.id })}
                className={`inline-flex min-h-9 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                  s.id === storeId
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-background hover:bg-muted"
                }`}
              >
                {s.name}
              </Link>
            ))}
          </div>
        ) : (
          <span className="text-sm font-medium">{stores[0].name}</span>
        )}

        <div className="flex items-center gap-2">
          <Link
            href={buildUrl({ weekStart: addDaysStr(weekStart, -7) })}
            aria-label="前の週"
            className="inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Link>
          <span className="font-numeric text-sm font-medium">
            {format(toZonedTime(new Date(`${weekStart}T00:00:00`), TZ), "M/d")} –{" "}
            {format(toZonedTime(new Date(`${weekEnd}T00:00:00`), TZ), "M/d")}
          </span>
          <Link
            href={buildUrl({ weekStart: addDaysStr(weekStart, 7) })}
            aria-label="次の週"
            className="inline-flex size-9 items-center justify-center rounded-md border border-border hover:bg-muted"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* 指標 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="希望提出率"
          value={formatRate(metrics.submissionRate)}
          hint={`${availabilities.length} / ${activeStaffCount * 7} 人日`}
        />
        <MetricCard
          label="充足率"
          value={formatRate(metrics.fulfillmentRate)}
          hint={
            requiredTotal > 0
              ? `割当 ${shifts.length} / 必要 ${requiredTotal}`
              : "必要人数が未設定"
          }
        />
        <MetricCard
          label="公開後の変更回数"
          value={String(metrics.postPublishRevisions)}
          hint="確定シフトの直しの多さ"
        />
      </div>

      {/* 法令警告 */}
      {warnings.length > 0 && (
        <section
          aria-labelledby="warn-heading"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm"
        >
          <h2
            id="warn-heading"
            className="flex items-center gap-2 text-sm font-semibold text-amber-900"
          >
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            法令上の注意（{warnings.length}件）
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-amber-900">
            {warnings.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-medium">
                  {staffNameById.get(w.staffId) ?? "スタッフ"}
                </span>
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-amber-800">
            2027年施行見込みの労基法改正（勤務間インターバル11時間・連続勤務13日）に基づく警告です。
          </p>
        </section>
      )}

      {/* 店長ルールの違反 */}
      {ruleViolations.length > 0 && (
        <section
          aria-labelledby="rule-heading"
          className="rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-sm"
        >
          <h2
            id="rule-heading"
            className="flex items-center gap-2 text-sm font-semibold text-orange-900"
          >
            <Sparkles className="size-4 shrink-0" aria-hidden="true" />
            シフトルールに合わない点（{ruleViolations.length}件）
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-orange-900">
            {ruleViolations.map((v, i) => (
              <li key={i} className="flex flex-wrap gap-x-2">
                <span className="font-medium">
                  {staffNameById.get(v.staffId) ?? "スタッフ"}
                </span>
                <span>{v.message}</span>
                <span className="text-orange-700">
                  （{ruleDescById.get(v.ruleId) ?? "ルール"}）
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-orange-800">
            努力目標のルールです。登録したルールは
            <Link href={`/shifts/rules?storeId=${storeId}`} className="underline">
              シフトルール
            </Link>
            で管理できます。
          </p>
        </section>
      )}

      {/* 売上から出した必要人数の目安。シフトを組む前に見る */}
      <HeadcountPanel
        grid={headcountGrid}
        storeName={stores.find((s) => s.id === storeId)?.name ?? ""}
      />

      {/* シフト編集グリッド */}
      {slots.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          この店舗には時間帯（早番・遅番など）が未設定です。
          <Link href={`/stores/${storeId}`} className="ml-1 underline">
            店舗詳細
          </Link>
          で時間帯を追加してください。
        </div>
      ) : (
        <ShiftEditor
          organizationId={activeOrgId}
          storeId={storeId}
          days={dayLabels}
          staff={staffList}
          slots={slots}
          requirements={requirements}
          shifts={shifts.map((s) => ({
            id: s.id,
            staffId: s.staffId,
            slotId: s.slotId,
            businessDate: s.businessDate,
            startTime: format(toZonedTime(s.startAt, TZ), "HH:mm"),
            endTime: format(toZonedTime(s.endAt, TZ), "HH:mm"),
            status: s.status,
            note: s.note,
          }))}
          availabilities={availabilities.map((a) => ({
            staffId: a.staffId,
            slotId: a.slotId,
            businessDate: a.businessDate,
            type: a.type,
          }))}
          weekStart={weekStart}
          weekEnd={weekEnd}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-numeric text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
