/**
 * 「その営業日に効いている設定」を履歴から引く共通ロジック。
 *
 * 交通費も時給も、給与の根拠になる金額を履歴（effectiveFrom / effectiveTo）で
 * 持っている。どちらも同じ引き当て方をしないと、同じ日の同じ勤怠に対して
 * 交通費と時給で違う期間の設定が効く、という食い違いが起きる。
 */

export interface EffectivePeriod {
  effectiveFrom: Date;
  /** null なら現在も有効 */
  effectiveTo: Date | null;
}

/** 日付だけを YYYY-MM-DD で取り出す。effectiveFrom は日付入力由来でUTC0時に入っている */
export function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * その営業日に効いている設定を返す。無ければ null。
 *
 * 有効期間は「開始日を含み、終了日を含まない」。
 * 設定を差し替えるとき、古い方の effectiveTo に新しい方の effectiveFrom が入るので、
 * 終了日を含めてしまうと切り替え日に2つ効いて二重に払うことになる。
 */
export function effectiveOn<T extends EffectivePeriod>(
  items: T[],
  businessDate: string
): T | null {
  const active = items.filter((s) => {
    const from = dateKey(s.effectiveFrom);
    if (businessDate < from) return false;
    if (s.effectiveTo === null) return true;
    return businessDate < dateKey(s.effectiveTo);
  });
  if (active.length === 0) return null;

  // 期間が重なって登録されていたら、より新しく始まった設定を採る
  return active.reduce((a, b) =>
    dateKey(b.effectiveFrom) > dateKey(a.effectiveFrom) ? b : a
  );
}
