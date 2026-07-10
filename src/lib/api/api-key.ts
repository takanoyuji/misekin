import { createHash, randomBytes } from "crypto";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  32
);

const API_KEY_PREFIX = "mk_live_";
const API_KEY_PREFIX_LENGTH = 16; // プレフィックス + 最初の数文字をDBのkeyPrefixに保存

/**
 * 新しいAPIキーを生成する
 * @returns { rawKey: 表示用生キー, keyPrefix: DB検索用プレフィックス, keyHash: DB保存用ハッシュ }
 */
export function generateApiKey(): {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const rawSuffix = nanoid();
  const rawKey = `${API_KEY_PREFIX}${rawSuffix}`;
  const keyPrefix = rawKey.substring(0, API_KEY_PREFIX_LENGTH);
  const keyHash = hashApiKey(rawKey);

  return { rawKey, keyPrefix, keyHash };
}

/**
 * APIキーをSHA-256でハッシュ化する
 */
export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

/**
 * APIキーリクエストからキーを抽出してハッシュと照合する
 */
export function extractApiKey(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
