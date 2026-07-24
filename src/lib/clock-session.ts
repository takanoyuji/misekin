import { createHmac, timingSafeEqual } from "crypto";

/**
 * 打刻セッション（PIN検証済みの短命トークン）
 *
 * PINをURLクエリで持ち回ると履歴やログに残るため、PINは一度だけ検証し、
 * その結果を HMAC 署名した Cookie に置き換える。Cookie には PIN を含めない。
 * 有効期限は数分に限定し、共用端末に長く残らないようにする。
 */

const TTL_MS = 5 * 60 * 1000; // 5分
const COOKIE_PREFIX = "misekin-clock-";

function secret(): string {
  return process.env.AUTH_SECRET ?? "dev-insecure-secret";
}

/** 打刻URLトークンごとに Cookie 名を分ける（店舗をまたいで漏れないように） */
export function clockCookieName(urlToken: string): string {
  // Cookie 名に使えない文字を避けるため英数字のみ残す
  return COOKIE_PREFIX + urlToken.replace(/[^a-zA-Z0-9]/g, "");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/**
 * 署名付きセッション値を作る
 * 形式: <staffStoreId>.<expiryMs>.<hmac>
 */
export function createClockSession(staffStoreId: string, now: number): string {
  const expiry = now + TTL_MS;
  const payload = `${staffStoreId}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * セッション値を検証し、対象の staffStore と一致し期限内なら true
 */
export function verifyClockSession(
  value: string | undefined,
  staffStoreId: string,
  now: number
): boolean {
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;

  const [sid, expiryStr, mac] = parts;
  if (sid !== staffStoreId) return false;

  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < now) return false;

  const expected = sign(`${sid}.${expiryStr}`);
  // タイミング攻撃を避けて比較する
  if (mac.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const CLOCK_SESSION_TTL_MS = TTL_MS;
