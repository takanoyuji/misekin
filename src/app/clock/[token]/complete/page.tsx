import { CompleteClient } from "./complete-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "打刻完了",
};

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    action?: string;
    staffName?: string;
    clockedAt?: string;
  }>;
}

const actionLabelMap: Record<string, { verb: string; status: string }> = {
  CLOCK_IN: { verb: "出勤しました", status: "勤務中" },
  BREAK_START: { verb: "休憩を開始しました", status: "休憩中" },
  BREAK_END: { verb: "休憩を終了しました", status: "勤務中" },
  CLOCK_OUT: { verb: "退勤しました", status: "退勤済み" },
};

export default async function CompletePage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const { action, staffName, clockedAt } = await searchParams;

  const actionInfo = action ? actionLabelMap[action] : null;

  return (
    <CompleteClient
      token={token}
      staffName={staffName ?? ""}
      clockedAt={clockedAt ?? new Date().toISOString()}
      verb={actionInfo?.verb ?? "打刻が完了しました"}
      statusLabel={actionInfo?.status ?? ""}
    />
  );
}
