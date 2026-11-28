/**
 * 勤怠の異常（打刻漏れ等）を本人に知らせる日次ジョブの入口。
 * 本番はホストの crontab から毎朝1回叩く（docs/requirements.md 3.10.1）。
 *
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     http://127.0.0.1:3003/dev/misekin/api/cron/anomaly-alerts
 *
 * `?dryRun=1` で送らず・記録せずに対象だけ返す。
 */
import { NextRequest, NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/api/cron-auth";
import { runAnomalyAlertJob } from "@/lib/notifications/anomaly-alert-job";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = isCronAuthorized(
    req.headers.get("Authorization"),
    process.env.CRON_SECRET
  );
  if (auth === "NOT_CONFIGURED") {
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "CRON_SECRET が設定されていません" } },
      { status: 503 }
    );
  }
  if (auth !== "OK") {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "認証に失敗しました" } },
      { status: 401 }
    );
  }

  const dryRun = ["1", "true"].includes(
    req.nextUrl.searchParams.get("dryRun") ?? ""
  );

  try {
    const result = await runAnomalyAlertJob({ dryRun });
    console.log(
      `[anomaly-alerts] dryRun=${dryRun} checked=${result.checkedAttendances} sentStaff=${result.sentStaffCount} sentAttendances=${result.sentAttendanceCount} failedStaff=${result.failedStaffCount}`
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("[anomaly-alerts] failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "ジョブの実行に失敗しました" } },
      { status: 500 }
    );
  }
}
