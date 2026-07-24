import { describe, it, expect, beforeEach } from "vitest";
import {
  createClockSession,
  verifyClockSession,
  clockCookieName,
  CLOCK_SESSION_TTL_MS,
} from "@/lib/clock-session";

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-for-clock-session";
});

describe("clockCookieName", () => {
  it("打刻URLトークンごとに別のCookie名になる", () => {
    expect(clockCookieName("abc123")).not.toBe(clockCookieName("xyz789"));
  });

  it("英数字以外を除去する", () => {
    expect(clockCookieName("a.b/c")).toBe(clockCookieName("abc"));
  });
});

describe("clock session HMAC", () => {
  const now = 1_700_000_000_000;

  it("発行直後のセッションは有効", () => {
    const s = createClockSession("ss_1", now);
    expect(verifyClockSession(s, "ss_1", now)).toBe(true);
  });

  it("別のstaffStoreでは検証に失敗する", () => {
    const s = createClockSession("ss_1", now);
    expect(verifyClockSession(s, "ss_2", now)).toBe(false);
  });

  it("有効期限を過ぎると無効になる", () => {
    const s = createClockSession("ss_1", now);
    expect(verifyClockSession(s, "ss_1", now + CLOCK_SESSION_TTL_MS + 1)).toBe(
      false
    );
  });

  it("署名を改ざんすると無効になる", () => {
    const s = createClockSession("ss_1", now);
    const tampered = s.slice(0, -2) + (s.endsWith("00") ? "11" : "00");
    expect(verifyClockSession(tampered, "ss_1", now)).toBe(false);
  });

  it("有効期限を延ばす改ざんは署名不一致で弾かれる", () => {
    const s = createClockSession("ss_1", now);
    const [sid, , mac] = s.split(".");
    const forged = `${sid}.${now + 10_000_000}.${mac}`;
    expect(verifyClockSession(forged, "ss_1", now)).toBe(false);
  });

  it("空・不正な形式は無効", () => {
    expect(verifyClockSession(undefined, "ss_1", now)).toBe(false);
    expect(verifyClockSession("", "ss_1", now)).toBe(false);
    expect(verifyClockSession("garbage", "ss_1", now)).toBe(false);
  });
});
