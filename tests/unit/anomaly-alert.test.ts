import { describe, it, expect } from "vitest";

import {
  ANOMALY_ALERT_START_DATE,
  buildAnomalyAlertEmail,
  buildAnomalyAlertNotification,
  decideNotice,
  evaluateAttendanceForAlert,
  isAlertRecipientEligible,
} from "@/lib/business/anomaly-alert";
import { isCronAuthorized } from "@/lib/api/cron-auth";

// 2026-11-11 09:00 JST = 2026-11-11T00:00Z。切替6時なので今日の営業日は 2026-11-11
const NOW = new Date("2026-11-11T00:00:00Z");
const TODAY = "2026-11-11";

describe("evaluateAttendanceForAlert", () => {
  const base = {
    businessDate: "2026-11-10",
    clockInAt: new Date("2026-11-10T09:00:00Z"), // JST 18:00
    clockOutAt: new Date("2026-11-10T14:00:00Z"), // JST 23:00
    breaks: [] as { startAt: Date; endAt: Date | null }[],
    todayBusinessDate: TODAY,
    now: NOW,
  };

  it("正常な勤怠は知らせない", () => {
    expect(evaluateAttendanceForAlert(base)).toEqual([]);
  });

  it("前日の営業日で退勤が無ければ、24時間未満でも退勤漏れ（長時間勤務は出さない）", () => {
    // 出勤から15時間しかたっていない
    const reasons = evaluateAttendanceForAlert({ ...base, clockOutAt: null });
    expect(reasons).toEqual(["MISSING_CLOCK_OUT"]);
  });

  it("今日の営業日の勤怠は、退勤が無くてもまだ知らせない（勤務中かもしれない）", () => {
    const reasons = evaluateAttendanceForAlert({
      ...base,
      businessDate: TODAY,
      clockOutAt: null,
    });
    expect(reasons).toEqual([]);
  });

  it("2026-11-01 より前の営業日は知らせない（10月までは対象外）", () => {
    expect(ANOMALY_ALERT_START_DATE).toBe("2026-11-01");
    const reasons = evaluateAttendanceForAlert({
      ...base,
      businessDate: "2026-10-31",
      clockInAt: new Date("2026-10-31T09:00:00Z"),
      clockOutAt: null,
    });
    expect(reasons).toEqual([]);
  });

  it("2026-11-01 当日の営業日は対象", () => {
    const reasons = evaluateAttendanceForAlert({
      ...base,
      businessDate: "2026-11-01",
      clockInAt: new Date("2026-11-01T09:00:00Z"),
      clockOutAt: null,
    });
    expect(reasons).toEqual(["MISSING_CLOCK_OUT"]);
  });

  it("休憩終了漏れを拾う", () => {
    const reasons = evaluateAttendanceForAlert({
      ...base,
      breaks: [{ startAt: new Date("2026-11-10T11:00:00Z"), endAt: null }],
    });
    expect(reasons).toEqual(["MISSING_BREAK_END"]);
  });

  it("退勤が出勤より前を拾う", () => {
    const reasons = evaluateAttendanceForAlert({
      ...base,
      clockOutAt: new Date("2026-11-10T08:00:00Z"),
    });
    expect(reasons).toEqual(["CLOCK_OUT_BEFORE_CLOCK_IN"]);
  });

  it("退勤済みで12時間以上なら長時間勤務", () => {
    const reasons = evaluateAttendanceForAlert({
      ...base,
      clockOutAt: new Date("2026-11-10T22:00:00Z"), // 13時間
    });
    expect(reasons).toEqual(["LONG_SHIFT"]);
  });
});

describe("decideNotice", () => {
  it("異常が無ければ送らない", () => {
    expect(decideNotice({ reasons: [], previous: null, now: NOW })).toBeNull();
  });

  it("記録が無ければ初回", () => {
    expect(
      decideNotice({ reasons: ["MISSING_CLOCK_OUT"], previous: null, now: NOW })
    ).toBe("FIRST");
  });

  it("送ってから7日未満なら送らない", () => {
    expect(
      decideNotice({
        reasons: ["MISSING_CLOCK_OUT"],
        previous: { firstSentAt: new Date("2026-11-05T00:00:00Z"), sendCount: 1 },
        now: NOW,
      })
    ).toBeNull();
  });

  it("7日たっても未対応なら1回だけ再送", () => {
    expect(
      decideNotice({
        reasons: ["MISSING_CLOCK_OUT"],
        previous: { firstSentAt: new Date("2026-11-04T00:00:00Z"), sendCount: 1 },
        now: NOW,
      })
    ).toBe("RESEND");
  });

  it("再送済み（2回）ならもう送らない", () => {
    expect(
      decideNotice({
        reasons: ["MISSING_CLOCK_OUT"],
        previous: { firstSentAt: new Date("2026-10-20T00:00:00Z"), sendCount: 2 },
        now: NOW,
      })
    ).toBeNull();
  });

  it("長時間勤務だけなら再送しない", () => {
    expect(
      decideNotice({
        reasons: ["LONG_SHIFT"],
        previous: { firstSentAt: new Date("2026-11-01T00:00:00Z"), sendCount: 1 },
        now: NOW,
      })
    ).toBeNull();
  });
});

describe("isAlertRecipientEligible", () => {
  const ok = {
    staffStatus: "ACTIVE",
    resignDate: null,
    userId: "u1",
    userEmail: "cast@example.com",
    memberActive: true,
    organizationActive: true,
    now: NOW,
  };

  it("有効なスタッフには送る", () => {
    expect(isAlertRecipientEligible(ok)).toBe(true);
  });

  it.each(["RESIGNED", "SUSPENDED", "ON_LEAVE", "INVITED"])(
    "%s のスタッフには送らない",
    (staffStatus) => {
      expect(isAlertRecipientEligible({ ...ok, staffStatus })).toBe(false);
    }
  );

  it("退職日が過ぎていれば送らない", () => {
    expect(
      isAlertRecipientEligible({ ...ok, resignDate: new Date("2026-11-01T00:00:00Z") })
    ).toBe(false);
  });

  it("ログイン用アカウントが無ければ送らない", () => {
    expect(isAlertRecipientEligible({ ...ok, userId: null })).toBe(false);
  });

  it("メールが無ければ送らない", () => {
    expect(isAlertRecipientEligible({ ...ok, userEmail: null })).toBe(false);
    expect(isAlertRecipientEligible({ ...ok, userEmail: "" })).toBe(false);
  });

  it("組織メンバーとして無効なら送らない", () => {
    expect(isAlertRecipientEligible({ ...ok, memberActive: false })).toBe(false);
  });

  it("組織が無効なら送らない", () => {
    expect(isAlertRecipientEligible({ ...ok, organizationActive: false })).toBe(false);
  });
});

describe("buildAnomalyAlertEmail", () => {
  const items = [
    {
      attendanceId: "att1",
      businessDate: "2026-11-10",
      storeName: "池袋店",
      timezone: "Asia/Tokyo",
      clockInAt: new Date("2026-11-10T09:00:00Z"),
      clockOutAt: null,
      reasons: ["MISSING_CLOCK_OUT" as const],
      decision: "FIRST" as const,
    },
    {
      attendanceId: "att2",
      businessDate: "2026-11-03",
      storeName: "池袋店",
      timezone: "Asia/Tokyo",
      clockInAt: new Date("2026-11-03T09:00:00Z"),
      clockOutAt: new Date("2026-11-03T22:00:00Z"),
      reasons: ["LONG_SHIFT" as const],
      decision: "RESEND" as const,
    },
  ];

  const mail = buildAnomalyAlertEmail({
    staffName: "<b>ゆう</b>",
    organizationName: "星狼",
    items,
    appUrl: "https://dataraw.jp/dev/misekin",
  });

  it("件名に件数が入る", () => {
    expect(mail.subject).toBe("【みせ勤】打刻の修正をお願いします（2件）");
  });

  it("勤怠ごとの修正申請リンクと一覧リンクが入る", () => {
    expect(mail.html).toContain(
      "https://dataraw.jp/dev/misekin/my-correction-requests/new?attendanceId=att1"
    );
    expect(mail.text).toContain(
      "修正を申請する: https://dataraw.jp/dev/misekin/my-correction-requests/new"
    );
  });

  it("店舗のタイムゾーンで時刻を出し、退勤が無ければ「なし」", () => {
    expect(mail.text).toContain("出勤 11/10 18:00 / 退勤 なし");
    expect(mail.text).toContain("退勤漏れ");
  });

  it("長時間勤務だけの行には対応不要の注記、再送の行には再送と書く", () => {
    expect(mail.text).toContain("長時間勤務（時刻が正しければ対応は不要です）【再送】");
    expect(mail.html).toContain("再送");
  });

  it("名前は HTML エスケープする", () => {
    expect(mail.html).toContain("&lt;b&gt;ゆう&lt;/b&gt; さん");
    expect(mail.html).not.toContain("<b>ゆう</b>");
  });

  it("アプリ内通知は basePath 無しの修正申請ページへ", () => {
    const n = buildAnomalyAlertNotification(items);
    expect(n.title).toBe("打刻の修正をお願いします（2件）");
    expect(n.linkUrl).toBe("/my-correction-requests/new");
    expect(n.body).toContain("2026-11-10 池袋店: 退勤漏れ");
  });
});

describe("isCronAuthorized", () => {
  const secret = "0123456789abcdef0123456789abcdef";

  it("CRON_SECRET が未設定・短すぎるなら NOT_CONFIGURED", () => {
    expect(isCronAuthorized(`Bearer ${secret}`, undefined)).toBe("NOT_CONFIGURED");
    expect(isCronAuthorized("Bearer short", "short")).toBe("NOT_CONFIGURED");
  });

  it("一致すれば OK、違えば・無ければ UNAUTHORIZED", () => {
    expect(isCronAuthorized(`Bearer ${secret}`, secret)).toBe("OK");
    expect(isCronAuthorized("Bearer wrong", secret)).toBe("UNAUTHORIZED");
    expect(isCronAuthorized(null, secret)).toBe("UNAUTHORIZED");
  });
});
