/**
 * 交通費の日ごとの金額
 *
 * 交通費は「その日に来たかどうか」で決まるお金なので、勤怠1件ごとに出す。
 * 給与の根拠になる数字なので、どの設定を使ったかが後から追えるように
 * 履歴（TransportationHistory）から日付で引き当てる。
 *
 * いま計算できるのは PER_SHIFT（出勤ごと）だけ。
 * MONTHLY（月額）は勤怠1件に割り当てられる金額ではないので0を返す。
 * monthlyLimit（月の上限）も未対応。どちらも画面に「未対応」と出している。
 */

import { effectiveOn } from "./effective-period";

export type TransportationType = "PER_SHIFT" | "MONTHLY" | "NONE";

export interface TransportationSetting {
  type: TransportationType;
  /** 1回あたりの金額（PER_SHIFT のとき） */
  amount: number;
  effectiveFrom: Date;
  /** null なら現在も有効 */
  effectiveTo: Date | null;
}

/**
 * その営業日に効いている設定を返す。無ければ null。
 *
 * 引き当ての規則は時給と共通（effective-period.ts）。
 */
export function settingForDate(
  settings: TransportationSetting[],
  businessDate: string
): TransportationSetting | null {
  return effectiveOn(settings, businessDate);
}

/**
 * 勤怠1件ぶんの交通費。
 *
 * 出勤の記録（clockInAt）が無い日は0。来ていないなら交通費は発生しない。
 * 逆に、退勤を押し忘れた日や実労働が0分の日でも、来ている以上は払う。
 * 押し忘れやテスト打刻を集計側で黙って落とすと、金額の理由が追えなくなる。
 */
export function transportationForAttendance(
  settings: TransportationSetting[],
  attendance: { businessDate: string; clockInAt: Date | null }
): number {
  if (!attendance.clockInAt) return 0;
  const s = settingForDate(settings, attendance.businessDate);
  if (!s || s.type !== "PER_SHIFT") return 0;
  return s.amount;
}
