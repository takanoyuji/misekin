import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, canAccessStore } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/common/page-header";
import { resolveActiveOrganizationId } from "@/lib/auth/active-org";
import { haversineMeters } from "@/lib/business/geo";
import { MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "打刻位置の分布",
};

/** 判定距離を決めるときに見比べる候補（m） */
const CANDIDATE_RADII = [100, 200, 300, 500, 1000, 2000];

const PERIOD_DAYS = 30;

interface PageProps {
  searchParams: Promise<{ storeId?: string }>;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[index];
}

const fmtMeters = (value: number | null) =>
  value == null ? "—" : `${Math.round(value).toLocaleString()}m`;

export default async function LocationDistributionPage({
  searchParams,
}: PageProps) {
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

  const allStores = await db.store.findMany({
    where: { organizationId: activeOrgId, isActive: true },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      geofenceRadiusMeters: true,
      locationTrackingEnabled: true,
    },
    orderBy: { name: "asc" },
  });

  // 担当店舗だけに絞る（ADMIN は自分の店舗のみ見える）
  const accessible: typeof allStores = [];
  for (const store of allStores) {
    if (await canAccessStore(ctx!.memberId, ctx!.role, store.id)) {
      accessible.push(store);
    }
  }

  const { storeId } = await searchParams;
  const selected =
    accessible.find((s) => s.id === storeId) ??
    accessible.find((s) => s.locationTrackingEnabled) ??
    accessible[0] ??
    null;

  const since = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const events = selected
    ? await db.attendanceEvent.findMany({
        where: { storeId: selected.id, clockedAt: { gte: since } },
        select: {
          latitude: true,
          longitude: true,
          locationAccuracy: true,
          staff: { select: { id: true, displayName: true } },
        },
      })
    : [];

  const storePoint =
    selected?.latitude != null && selected?.longitude != null
      ? { latitude: selected.latitude, longitude: selected.longitude }
      : null;

  // 打刻ごとの距離。位置が無いものは null のまま残す（取得できない率も見たいので落とさない）
  const measured = events.map((event) => {
    const hasLocation = event.latitude != null && event.longitude != null;
    const distance =
      hasLocation && storePoint
        ? haversineMeters(storePoint, {
            latitude: event.latitude!,
            longitude: event.longitude!,
          })
        : null;
    return {
      staffId: event.staff.id,
      staffName: event.staff.displayName,
      hasLocation,
      distance,
      accuracy: event.locationAccuracy,
    };
  });

  const withLocation = measured.filter((m) => m.hasLocation);
  const distances = measured
    .map((m) => m.distance)
    .filter((d): d is number => d != null)
    .sort((a, b) => a - b);
  const accuracies = withLocation
    .map((m) => m.accuracy)
    .filter((a): a is number => a != null)
    .sort((a, b) => a - b);

  // スタッフ別。位置が取れない人を見つけるのが主目的
  const byStaff = new Map<
    string,
    { name: string; total: number; missing: number; distances: number[] }
  >();
  for (const m of measured) {
    const row = byStaff.get(m.staffId) ?? {
      name: m.staffName,
      total: 0,
      missing: 0,
      distances: [],
    };
    row.total += 1;
    if (!m.hasLocation) row.missing += 1;
    if (m.distance != null) row.distances.push(m.distance);
    byStaff.set(m.staffId, row);
  }
  const staffRows = [...byStaff.values()]
    .map((row) => ({
      ...row,
      sorted: [...row.distances].sort((a, b) => a - b),
    }))
    .sort((a, b) => b.missing / b.total - a.missing / a.total);

  return (
    <div className="space-y-6">
      <PageHeader
        title="打刻位置の分布"
        description={`直近${PERIOD_DAYS}日。判定距離を決めるための材料で、ここでは打刻を弾いていません`}
        breadcrumbs={[
          { label: "ホーム", href: "/dashboard" },
          { label: "勤怠管理", href: "/attendance" },
          { label: "打刻位置の分布" },
        ]}
      />

      {/* 店舗の切り替え */}
      <div className="flex flex-wrap gap-2">
        {accessible.map((store) => (
          <Link
            key={store.id}
            href={`/attendance/location?storeId=${store.id}`}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-md border px-4 text-sm font-medium transition-colors ${
              selected?.id === store.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:bg-muted"
            }`}
          >
            {store.name}
            {!store.locationTrackingEnabled && (
              <span className="text-xs opacity-70">(記録オフ)</span>
            )}
          </Link>
        ))}
      </div>

      {!selected ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          表示できる店舗がありません
        </p>
      ) : !selected.locationTrackingEnabled ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          この店舗では位置を記録していません。店舗設定で有効にすると、ここに分布が出ます。
          <br />
          <Link
            href={`/stores/${selected.id}`}
            className="text-primary underline underline-offset-4"
          >
            {selected.name} の設定を開く
          </Link>
        </p>
      ) : (
        <>
          {/* 概況 */}
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">打刻件数</p>
              <p className="font-numeric text-2xl font-bold">
                {measured.length.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">位置が取れた割合</p>
              <p className="font-numeric text-2xl font-bold">
                {measured.length === 0
                  ? "—"
                  : `${Math.round((withLocation.length / measured.length) * 100)}%`}
              </p>
              <p className="text-xs text-muted-foreground">
                取れなかった {measured.length - withLocation.length} 件
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">現在の判定距離</p>
              <p className="font-numeric text-2xl font-bold">
                {selected.geofenceRadiusMeters == null
                  ? "未設定"
                  : `${selected.geofenceRadiusMeters}m`}
              </p>
              <p className="text-xs text-muted-foreground">
                {selected.geofenceRadiusMeters == null
                  ? "記録のみ。フラグは立てていない"
                  : "超えるとフラグが付く（打刻は通る）"}
              </p>
            </div>
          </section>

          {!storePoint && (
            <p className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
              店舗の座標が未設定なので距離を出せません。店舗設定で座標を入れてください。
            </p>
          )}

          {storePoint && (
            <>
              {/* 距離と誤差の分布 */}
              <section className="rounded-xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-5 py-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 text-muted-foreground" aria-hidden="true" />
                    <h2 className="text-base font-semibold">距離と測位誤差のばらつき</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    誤差が距離と同じくらい大きい場合、その測位は「離れている証拠」になりません。
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                          位置
                        </th>
                        {["中央値", "75%", "90%", "95%", "最大"].map((label) => (
                          <th
                            key={label}
                            className="px-4 py-3 text-right font-medium text-muted-foreground"
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="px-5 py-3 font-medium">店舗からの距離</td>
                        {[50, 75, 90, 95, 100].map((p) => (
                          <td key={p} className="px-4 py-3 text-right font-numeric">
                            {fmtMeters(percentile(distances, p))}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-5 py-3 font-medium">測位誤差</td>
                        {[50, 75, 90, 95, 100].map((p) => (
                          <td key={p} className="px-4 py-3 text-right font-numeric">
                            {fmtMeters(percentile(accuracies, p))}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 判定距離のシミュレーション */}
              <section className="rounded-xl border border-border bg-card shadow-sm">
                <div className="border-b border-border px-5 py-4">
                  <h2 className="text-base font-semibold">
                    この距離にすると、何件にフラグが付くか
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    直近{PERIOD_DAYS}日の打刻に当てはめた件数。実際の判定と同じく、距離から測位誤差を引いて数えています。
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                          判定距離
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          フラグが付く打刻
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                          全体に占める割合
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {CANDIDATE_RADII.map((radius) => {
                        const flagged = measured.filter(
                          (m) =>
                            m.distance != null &&
                            m.distance - (m.accuracy ?? 0) > radius
                        ).length;
                        return (
                          <tr
                            key={radius}
                            className={
                              selected.geofenceRadiusMeters === radius
                                ? "bg-primary/5"
                                : undefined
                            }
                          >
                            <td className="px-5 py-3 font-numeric font-medium">
                              {radius}m
                              {selected.geofenceRadiusMeters === radius && (
                                <span className="ml-2 text-xs text-primary">現在</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-numeric">
                              {flagged}
                            </td>
                            <td className="px-4 py-3 text-right font-numeric text-muted-foreground">
                              {measured.length === 0
                                ? "—"
                                : `${Math.round((flagged / measured.length) * 100)}%`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* スタッフ別 */}
          <section className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold">スタッフ別</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                位置が取れない率が高い人から並べています。一度ブラウザで位置の許可を拒否すると、
                以降ずっと取れないままになります。端末側の設定を直してもらってください。
              </p>
            </div>
            {staffRows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                直近{PERIOD_DAYS}日の打刻がありません
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-5 py-3 text-left font-medium text-muted-foreground">
                        スタッフ
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        打刻
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        位置が取れない
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        距離の中央値
                      </th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                        最大
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {staffRows.map((row) => (
                      <tr key={row.name} className="hover:bg-muted/20">
                        <td className="px-5 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 text-right font-numeric">
                          {row.total}
                        </td>
                        <td className="px-4 py-3 text-right font-numeric">
                          {row.missing > 0 ? (
                            <span className="text-orange-600">
                              {row.missing}件（
                              {Math.round((row.missing / row.total) * 100)}%）
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-numeric">
                          {fmtMeters(percentile(row.sorted, 50))}
                        </td>
                        <td className="px-4 py-3 text-right font-numeric">
                          {fmtMeters(percentile(row.sorted, 100))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
