/**
 * 打刻漏れのお知らせジョブ（runAnomalyAlertJob）を、DB とメールをモックして通す。
 * スタッフごとに1通にまとめること・送れた分だけ記録と通知を作ること・dryRun で何も書かないことを見る。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyAttendance = vi.fn();
const findManyMember = vi.fn();
const upsertNotice = vi.fn();
const createNotification = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    attendance: { findMany: (...a: unknown[]) => findManyAttendance(...a) },
    organizationMember: { findMany: (...a: unknown[]) => findManyMember(...a) },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        attendanceAnomalyNotice: { upsert: (...a: unknown[]) => upsertNotice(...a) },
        notification: { create: (...a: unknown[]) => createNotification(...a) },
      }),
  },
}));

const sendMail = vi.fn();
vi.mock("@/lib/email", () => ({
  sendAttendanceAnomalyEmail: (...a: unknown[]) => sendMail(...a),
}));

import { runAnomalyAlertJob } from "@/lib/notifications/anomaly-alert-job";

const NOW = new Date("2026-11-11T00:00:00Z"); // 09:00 JST

const store = {
  name: "池袋店",
  timezone: "Asia/Tokyo",
  dayChangeHour: 6,
  dayChangeMinute: 0,
};

function staff(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    displayName: `スタッフ${id}`,
    status: "ACTIVE",
    resignDate: null,
    userId: `user-${id}`,
    user: { email: `${id}@example.com` },
    organization: { name: "星狼", isActive: true },
    ...overrides,
  };
}

function att(
  id: string,
  businessDate: string,
  s: ReturnType<typeof staff>,
  overrides: Record<string, unknown> = {}
) {
  const [y, m, d] = businessDate.split("-").map(Number);
  return {
    id,
    organizationId: "org1",
    businessDate,
    // JST 18:00 出勤・退勤なし
    clockInAt: new Date(Date.UTC(y, m - 1, d, 9)),
    clockOutAt: null,
    breaks: [],
    store,
    staff: s,
    anomalyNotice: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findManyMember.mockResolvedValue([
    { organizationId: "org1", userId: "user-a" },
    { organizationId: "org1", userId: "user-b" },
  ]);
  sendMail.mockResolvedValue(true);
});

describe("runAnomalyAlertJob", () => {
  it("スタッフごとに1通にまとめ、勤怠ごとの記録と通知1件を作る", async () => {
    const a = staff("a");
    const b = staff("b");
    findManyAttendance.mockResolvedValue([
      att("att1", "2026-11-09", a),
      att("att2", "2026-11-10", a),
      att("att3", "2026-11-10", b),
    ]);

    const result = await runAnomalyAlertJob({ now: NOW });

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(sendMail.mock.calls[0][0].to).toBe("a@example.com");
    expect(sendMail.mock.calls[0][0].subject).toContain("2件");
    expect(upsertNotice).toHaveBeenCalledTimes(3);
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification.mock.calls[0][0].data).toMatchObject({
      userId: "user-a",
      staffId: "a",
      type: "ATTENDANCE_ANOMALY_DETECTED",
      linkUrl: "/my-correction-requests/new",
    });
    expect(result.sentStaffCount).toBe(2);
    expect(result.sentAttendanceCount).toBe(3);
    // 本番実行の結果にはメールアドレスを残さない
    expect(result.staff[0].email).toBeUndefined();
  });

  it("候補の検索条件に開始日・締め・申請・修正履歴・ステータスの絞り込みが入っている", async () => {
    findManyAttendance.mockResolvedValue([]);
    await runAnomalyAlertJob({ now: NOW });
    const where = findManyAttendance.mock.calls[0][0].where;
    expect(where.businessDate).toEqual({ gte: "2026-11-01" });
    expect(where.isLocked).toBe(false);
    expect(where.correctionRequests).toEqual({
      none: { status: { in: ["PENDING", "APPROVED", "REJECTED"] } },
    });
    expect(where.corrections).toEqual({ none: {} });
    expect(where.staff).toEqual({ status: "ACTIVE", userId: { not: null } });
  });

  it("送ったことがある勤怠は7日たつまで送らず、たったら再送として送る", async () => {
    const a = staff("a");
    findManyAttendance.mockResolvedValue([
      att("recent", "2026-11-08", a, {
        anomalyNotice: { firstSentAt: new Date("2026-11-09T00:00:00Z"), sendCount: 1 },
      }),
      att("old", "2026-11-03", a, {
        anomalyNotice: { firstSentAt: new Date("2026-11-04T00:00:00Z"), sendCount: 1 },
      }),
      att("done", "2026-11-02", a, {
        anomalyNotice: { firstSentAt: new Date("2026-11-03T00:00:00Z"), sendCount: 2 },
      }),
    ]);

    const result = await runAnomalyAlertJob({ now: NOW });

    expect(result.staff).toHaveLength(1);
    expect(result.staff[0].items.map((i) => [i.attendanceId, i.decision])).toEqual([
      ["old", "RESEND"],
    ]);
    expect(upsertNotice.mock.calls[0][0].update).toMatchObject({
      sendCount: { increment: 1 },
    });
  });

  it("ログインできない人（組織メンバー無効）・退職者には送らない", async () => {
    findManyAttendance.mockResolvedValue([
      att("x1", "2026-11-10", staff("c")), // メンバーに居ない
      att("x2", "2026-11-10", staff("a", { status: "RESIGNED" })),
    ]);

    const result = await runAnomalyAlertJob({ now: NOW });

    expect(sendMail).not.toHaveBeenCalled();
    expect(result.staff).toHaveLength(0);
  });

  it("メールが送れなかった人は記録も通知も作らない（翌日もう一度試す）", async () => {
    sendMail.mockResolvedValue(false);
    findManyAttendance.mockResolvedValue([att("att1", "2026-11-10", staff("a"))]);

    const result = await runAnomalyAlertJob({ now: NOW });

    expect(upsertNotice).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
    expect(result.failedStaffCount).toBe(1);
  });

  it("dryRun は送らず書かず、対象とメールアドレスを返す", async () => {
    findManyAttendance.mockResolvedValue([att("att1", "2026-11-10", staff("a"))]);

    const result = await runAnomalyAlertJob({ now: NOW, dryRun: true });

    expect(sendMail).not.toHaveBeenCalled();
    expect(upsertNotice).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
    expect(result.staff[0]).toMatchObject({
      email: "a@example.com",
      sent: false,
      items: [{ attendanceId: "att1", reasons: ["MISSING_CLOCK_OUT"], decision: "FIRST" }],
    });
  });

  it("今日の営業日の勤怠（勤務中かもしれない）は送らない", async () => {
    findManyAttendance.mockResolvedValue([att("today", "2026-11-11", staff("a"))]);
    const result = await runAnomalyAlertJob({ now: NOW });
    expect(result.staff).toHaveLength(0);
  });
});
