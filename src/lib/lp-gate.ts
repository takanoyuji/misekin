/**
 * LPのパスワードゲート
 *
 * 公開前のLPに、実在するキャストの写真を載せている。検索から見つかったり
 * URLを知らない人が偶然たどり着いたりしないよう、合言葉で閉じておく。
 *
 * これは「関係者だけに見せる」ための簡易な仕切りであって、強い認証ではない。
 *   - 合言葉は共有される前提
 *   - 画像そのもの（/_next/... の実体URL）は、URLを直接叩けば取れる
 * 本当に守りたい素材はここに置かないこと。noindex と併用している。
 *
 * middleware（Edge）と Server Action の両方から呼ぶので、Web Crypto だけで書く。
 */

export const LP_GATE_COOKIE = "misekin_lp_gate";
export const LP_GATE_MAX_AGE = 60 * 60 * 24 * 30; // 30日

/** 合言葉。未設定ならゲートを無効にする（ローカル開発で邪魔にならないように） */
export function getLpPassword(): string | null {
  const v = process.env.LP_PASSWORD;
  return v && v.trim() !== "" ? v : null;
}

/**
 * クッキーに入れる値。合言葉そのものは入れない。
 * AUTH_SECRET を混ぜて、値だけ見ても合言葉が分からないようにする。
 */
export async function lpGateToken(password: string): Promise<string> {
  const material = `${password}:${process.env.AUTH_SECRET ?? "misekin"}`;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(material)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** クッキーの値が正しいか */
export async function isLpGateUnlocked(
  cookieValue: string | undefined
): Promise<boolean> {
  const password = getLpPassword();
  if (!password) return true; // 合言葉が未設定なら素通し
  if (!cookieValue) return false;
  return cookieValue === (await lpGateToken(password));
}
