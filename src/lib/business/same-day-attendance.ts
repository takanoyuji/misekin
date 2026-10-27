/**
 * 同じ営業日に勤怠が複数件ある場合の規則
 *
 * 再出勤できる店舗（Store.allowMultipleClockIns）では、1人1店舗1営業日に勤怠が2件以上ありうる。
 * VLLの遠隔推し活（通常勤務を退勤したあと、在宅でもう一度出勤する）のため。
 * - 同じ日の勤怠どうしは時間帯が重なってはいけない（同じ時間を2回数えて給与が二重になる）
 * - 交通費は「その日に来たかどうか」なので、その日の最初の勤怠にだけ付ける
 */

export interface TimeRange {
  id?: string;
  clockInAt: Date | null;
  clockOutAt: Date | null;
}

/**
 * target と時間帯が重なる勤怠を返す。無ければ null。
 *
 * 退勤していない勤怠（clockOutAt が null）は、出勤から先がずっと続いているものとして扱う。
 * excludeId は修正中の勤怠自身を比較から外すため。
 */
export function findOverlappingAttendance<T extends TimeRange>(
  others: T[],
  target: TimeRange,
  excludeId?: string
): T | null {
  if (!target.clockInAt) return null;
  const tStart = target.clockInAt.getTime();
  const tEnd = target.clockOutAt?.getTime() ?? Infinity;

  for (const o of others) {
    if (excludeId && o.id === excludeId) continue;
    if (!o.clockInAt) continue;
    const oStart = o.clockInAt.getTime();
    const oEnd = o.clockOutAt?.getTime() ?? Infinity;
    if (tStart < oEnd && oStart < tEnd) return o;
  }
  return null;
}

/**
 * (スタッフ, 店舗, 営業日) ごとに、出勤がいちばん早い勤怠の id を集める。
 *
 * 交通費はこの id の勤怠にだけ付ける。出勤時刻が無い勤怠は対象にしない
 * （来ていないなら交通費は発生しない、という transportationForAttendance の規則と同じ）。
 */
export function firstAttendanceIdsOfDay(
  rows: {
    id: string;
    staffId: string;
    storeId: string;
    businessDate: string;
    clockInAt: Date | null;
  }[]
): Set<string> {
  const first = new Map<string, { id: string; at: number }>();
  for (const r of rows) {
    if (!r.clockInAt) continue;
    const key = `${r.staffId}:${r.storeId}:${r.businessDate}`;
    const at = r.clockInAt.getTime();
    const cur = first.get(key);
    if (!cur || at < cur.at || (at === cur.at && r.id < cur.id)) {
      first.set(key, { id: r.id, at });
    }
  }
  return new Set([...first.values()].map((v) => v.id));
}

/**
 * その営業日の勤怠のうち、いま打刻の対象になる1件を選ぶ。
 *
 * 退勤していない勤怠があればそれ（同時に開いている勤怠は部分インデックスで1件まで）。
 * 無ければ出勤がいちばん遅い勤怠。1件も無ければ null。
 */
export function pickCurrentAttendance<T extends TimeRange>(records: T[]): T | null {
  const open = records.find((r) => r.clockInAt && !r.clockOutAt);
  if (open) return open;
  let latest: T | null = null;
  for (const r of records) {
    if (!latest || (r.clockInAt?.getTime() ?? 0) > (latest.clockInAt?.getTime() ?? 0)) {
      latest = r;
    }
  }
  return latest;
}
