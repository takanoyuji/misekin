import { fromZonedTime } from "date-fns-tz";

/**
 * 時間帯("HH:mm")と営業日から、シフトの出退勤の時刻(UTC)を作る。
 *
 * `new Date("2026-09-01T19:00:00")` のようにタイムゾーンの付かない文字列は
 * **サーバーのローカル時刻**として解釈される。本番コンテナは TZ 未設定＝UTC なので、
 * 19:00（JSTのつもり）の枠が 19:00 UTC ＝ 翌日04:00 JST で保存され、
 * 画面（JST表示）では9時間ずれて見えていた。
 * 勤怠の営業日計算と同じく、必ず店舗のタイムゾーンで解釈する。
 *
 * 終了が開始以下なら翌日跨ぎ（例 21:00〜05:00）。
 * 翌日ぶんは「24時間足す」のではなく翌日の日付で解釈し直す。
 * 夏時間のある地域で1日が24時間にならない日を取りこぼさないため。
 */
export function slotTimes(
  businessDate: string,
  startTime: string,
  endTime: string,
  timezone: string
): { start: Date; end: Date } {
  const start = fromZonedTime(`${businessDate}T${startTime}:00`, timezone);
  let end = fromZonedTime(`${businessDate}T${endTime}:00`, timezone);

  if (end <= start) {
    end = fromZonedTime(`${nextDay(businessDate)}T${endTime}:00`, timezone);
  }
  return { start, end };
}

/** YYYY-MM-DD の翌日を返す */
function nextDay(businessDate: string): string {
  const d = new Date(`${businessDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
