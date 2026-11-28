/**
 * 勤怠の異常（打刻漏れ等）を本人に知らせるかどうかの判定と、メール本文の組み立て。
 * DB に触らない純粋関数だけを置く（送信ジョブは src/lib/notifications/anomaly-alert-job.ts）。
 *
 * 仕様の正は docs/requirements.md 3.10.1。
 */
import { differenceInDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import {
  detectAnomalies,
  getAnomalyLabel,
  type AnomalyReason,
} from "@/lib/business/anomaly-detection";

/** これより前の営業日は知らせない（高野 2026-11-27「10月までのやつは知らせなくて良い」） */
export const ANOMALY_ALERT_START_DATE = "2026-11-01";

/** 初回から何日たっても未対応なら再送するか */
export const ANOMALY_ALERT_RESEND_AFTER_DAYS = 7;

/** 1勤怠あたりの最大送信回数（初回＋再送1回） */
export const ANOMALY_ALERT_MAX_SEND_COUNT = 2;

/** 本人が修正申請で直すべき異常。再送の対象になる */
export const ACTIONABLE_ANOMALY_REASONS: readonly AnomalyReason[] = [
  "MISSING_CLOCK_OUT",
  "MISSING_BREAK_END",
  "CLOCK_OUT_BEFORE_CLOCK_IN",
];

/** 知らせる異常。長時間勤務は正しい打刻のこともあるので、知らせるが再送しない */
export const NOTIFIABLE_ANOMALY_REASONS: readonly AnomalyReason[] = [
  ...ACTIONABLE_ANOMALY_REASONS,
  "LONG_SHIFT",
];

export interface AlertAttendanceInput {
  businessDate: string;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  breaks: { startAt: Date; endAt: Date | null }[];
  /** 店舗の「今日の営業日」（getBusinessDate(now, 店舗TZ, 切替時刻)） */
  todayBusinessDate: string;
  now: Date;
}

/**
 * 実行時点のデータで異常を判定し直し、知らせる異常コードを返す（無ければ空配列）。
 *
 * - 2026-11-01 より前、または今日以降の営業日は空配列
 * - 保存済みの hasAnomaly は退勤時にしか更新されないので使わない
 * - 営業日が終わっているのに退勤が無ければ、経過24時間未満でも退勤漏れとする
 *   （夜に出勤した人は翌朝の時点で24時間たっておらず、長時間勤務と判定されてしまう）
 */
export function evaluateAttendanceForAlert(
  input: AlertAttendanceInput
): AnomalyReason[] {
  if (input.businessDate < ANOMALY_ALERT_START_DATE) return [];
  if (input.businessDate >= input.todayBusinessDate) return [];

  const reasons = new Set(
    detectAnomalies({
      clockInAt: input.clockInAt,
      clockOutAt: input.clockOutAt,
      breaks: input.breaks,
      now: input.now,
    }).reasons
  );

  if (input.clockInAt && !input.clockOutAt) {
    reasons.add("MISSING_CLOCK_OUT");
    // 退勤が無いことによる「長時間」は退勤漏れの言い換えなので出さない
    reasons.delete("LONG_SHIFT");
  }

  return NOTIFIABLE_ANOMALY_REASONS.filter((r) => reasons.has(r));
}

export type NoticeDecision = "FIRST" | "RESEND" | null;

/**
 * 送るかどうか。前回の記録（attendance_anomaly_notices）と照らす。
 * - 記録なし → 初回
 * - 初回から7日たっても直すべき異常が残っていて、まだ1回しか送っていない → 再送
 * - それ以外 → 送らない
 */
export function decideNotice(params: {
  reasons: readonly AnomalyReason[];
  previous: { firstSentAt: Date; sendCount: number } | null;
  now: Date;
}): NoticeDecision {
  const { reasons, previous, now } = params;
  if (reasons.length === 0) return null;
  if (!previous) return "FIRST";
  if (previous.sendCount >= ANOMALY_ALERT_MAX_SEND_COUNT) return null;
  if (!reasons.some((r) => ACTIONABLE_ANOMALY_REASONS.includes(r))) return null;
  if (differenceInDays(now, previous.firstSentAt) < ANOMALY_ALERT_RESEND_AFTER_DAYS) {
    return null;
  }
  return "RESEND";
}

/**
 * 送り先として有効か。退職・停止・休職・招待中、ログイン不可、メール無しは送らない。
 */
export function isAlertRecipientEligible(params: {
  staffStatus: string;
  resignDate: Date | null;
  userId: string | null;
  userEmail: string | null | undefined;
  memberActive: boolean;
  organizationActive: boolean;
  now: Date;
}): boolean {
  if (params.staffStatus !== "ACTIVE") return false;
  if (params.resignDate && params.resignDate.getTime() < params.now.getTime()) {
    return false;
  }
  if (!params.userId) return false;
  if (!params.userEmail || !params.userEmail.includes("@")) return false;
  if (!params.memberActive) return false;
  if (!params.organizationActive) return false;
  return true;
}

// ------------------------------------------------------------
// メール・通知の文面
// ------------------------------------------------------------

export interface AlertItem {
  attendanceId: string;
  businessDate: string;
  storeName: string;
  timezone: string;
  clockInAt: Date | null;
  clockOutAt: Date | null;
  reasons: AnomalyReason[];
  decision: Exclude<NoticeDecision, null>;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTime(d: Date | null, timezone: string): string {
  return d ? formatInTimeZone(d, timezone, "M/d HH:mm") : "なし";
}

function reasonText(reasons: readonly AnomalyReason[]): string {
  const onlyLong =
    reasons.length > 0 && reasons.every((r) => r === "LONG_SHIFT");
  const labels = reasons.map(getAnomalyLabel).join("・");
  return onlyLong ? `${labels}（時刻が正しければ対応は不要です）` : labels;
}

export function correctionRequestUrl(appUrl: string, attendanceId?: string): string {
  const base = `${appUrl}/my-correction-requests/new`;
  return attendanceId
    ? `${base}?attendanceId=${encodeURIComponent(attendanceId)}`
    : base;
}

export function buildAnomalyAlertEmail(params: {
  staffName: string;
  organizationName: string;
  items: AlertItem[];
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const { staffName, organizationName, items, appUrl } = params;
  const count = items.length;
  const subject = `【みせ勤】打刻の修正をお願いします（${count}件）`;
  const hasResend = items.some((i) => i.decision === "RESEND");
  const listUrl = correctionRequestUrl(appUrl);

  const rowsHtml = items
    .map((i) => {
      const url = correctionRequestUrl(appUrl, i.attendanceId);
      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e4e4e7; white-space: nowrap;">${escapeHtml(i.businessDate)}${i.decision === "RESEND" ? "<br><span style=\"color:#b45309;font-size:12px;\">再送</span>" : ""}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e4e4e7;">${escapeHtml(i.storeName)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e4e4e7; white-space: nowrap;">出勤 ${formatTime(i.clockInAt, i.timezone)}<br>退勤 ${formatTime(i.clockOutAt, i.timezone)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e4e4e7;">${escapeHtml(reasonText(i.reasons))}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e4e4e7; white-space: nowrap;"><a href="${escapeHtml(url)}" style="color: #4f46e5;">修正を申請する</a></td>
        </tr>`;
    })
    .join("");

  const html = `
    <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto;">
      <h1 style="color: #4f46e5;">みせ勤</h1>
      <p>${escapeHtml(staffName)} さん</p>
      <p>${escapeHtml(organizationName)} の勤怠に、打刻の漏れなど確認が必要なものが${count}件あります。</p>
      <p>実際の時刻で「修正を申請する」から申請してください。管理者が承認すると勤怠に反映されます。</p>
      ${hasResend ? `<p style="color: #b45309;">「再送」の行は、前回お知らせしてから修正の申請が出ていないものです。</p>` : ""}
      <table style="border-collapse: collapse; width: 100%; font-size: 14px; margin: 16px 0;">
        <thead>
          <tr style="background: #f4f4f5; text-align: left;">
            <th style="padding: 8px;">営業日</th>
            <th style="padding: 8px;">店舗</th>
            <th style="padding: 8px;">打刻</th>
            <th style="padding: 8px;">内容</th>
            <th style="padding: 8px;"></th>
          </tr>
        </thead>
        <tbody>${rowsHtml}
        </tbody>
      </table>
      <a href="${escapeHtml(listUrl)}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 8px 0;">
        修正を申請する
      </a>
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
      <p style="color: #71717a; font-size: 12px;">このメールは前日までの勤怠をもとに自動でお送りしています。すでに管理者に伝えている場合は、管理者の修正をお待ちください。</p>
    </div>
  `;

  const textLines = [
    `${staffName} さん`,
    "",
    `${organizationName} の勤怠に、打刻の漏れなど確認が必要なものが${count}件あります。`,
    "実際の時刻で修正を申請してください。管理者が承認すると勤怠に反映されます。",
    "",
    ...items.map(
      (i) =>
        `- ${i.businessDate} ${i.storeName}（出勤 ${formatTime(i.clockInAt, i.timezone)} / 退勤 ${formatTime(i.clockOutAt, i.timezone)}）: ${reasonText(i.reasons)}${i.decision === "RESEND" ? "【再送】" : ""}\n  ${correctionRequestUrl(appUrl, i.attendanceId)}`
    ),
    "",
    `修正を申請する: ${listUrl}`,
  ];

  return { subject, html, text: textLines.join("\n") };
}

/** アプリ内通知（ベル）の文面。linkUrl は basePath 無し（next/link が付ける） */
export function buildAnomalyAlertNotification(items: AlertItem[]): {
  title: string;
  body: string;
  linkUrl: string;
} {
  const body = items
    .map((i) => `${i.businessDate} ${i.storeName}: ${reasonText(i.reasons)}`)
    .join(" / ");
  return {
    title: `打刻の修正をお願いします（${items.length}件）`,
    body,
    linkUrl: "/my-correction-requests/new",
  };
}
