/**
 * 自社（SHISHA Exhale）の給与計算実績と、みせ勤の勤怠ロジックを突き合わせる
 *
 * 16ヶ月ぶんの実績（人が検算済み）を正解として、
 *   - 労働時間  = (退勤 - 出勤) - 休憩
 *   - 深夜労働時間 = 勤務と深夜帯(22:00〜翌5:00)の重なり - 深夜にかかった休憩
 * が一致するかを見る。DBは要らない。
 *
 *   npx tsx scripts/verify-attendance.ts
 *
 * 注意: 元CSVには休憩の「時刻」が無く合計分しか無いため、深夜ぶんの休憩を正確には引けない。
 * ここでは休憩を勤務の中央に置いたと仮定して概算する。みせ勤は打刻の時刻を持つので、
 * 本番では仮定なしで計算できる（そのぶん元CSVより正確になる）。
 */
import fs from "node:fs";
import path from "node:path";

import {
  calculateNightMinutes,
  calculateWorkMinutes,
} from "../src/lib/business/attendance";

const MATERIALS = "/home/takan/projects/exhale_salary/materials";
const TZ = "Asia/Tokyo";

interface Row {
  month: string;
  name: string;
  date: string;
  inMin: number;
  outMin: number;
  breakMin: number;
  work: number;
  night: number;
}

const toMin = (s: string): number | null => {
  const m = (s ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** ヘッダー付きCSVを読む（このファイル群はUTF-8 BOM付き） */
function readCsv(file: string): string[][] {
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => l.split(","));
}

function load(): Row[] {
  const rows: Row[] = [];
  if (!fs.existsSync(MATERIALS)) return rows;

  for (const dir of fs.readdirSync(MATERIALS).sort()) {
    const d = path.join(MATERIALS, dir);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) {
      if (!f.startsWith("概算人件費") || !f.endsWith(".csv")) continue;
      const csv = readCsv(path.join(d, f));
      const h = csv[0];
      if (!h.includes("氏名")) continue;
      const c = (n: string) => h.indexOf(n);

      for (const r of csv.slice(1)) {
        if (r.length < h.length) continue;
        const name = (r[c("氏名")] ?? "").trim().replace(/_+$/, "");
        if (!name) continue;
        const inMin = toMin(r[c("出勤")]);
        const outMin = toMin(r[c("退勤")]);
        const work = toMin(r[c("労働時間")]);
        const night = toMin(r[c("深夜労働時間")]);
        const breakMin = toMin(r[c("休憩")]) ?? 0;
        if (inMin === null || outMin === null || work === null || night === null) {
          continue;
        }
        rows.push({
          month: dir,
          name,
          date: (r[c("日付")] ?? "").trim(),
          inMin,
          outMin,
          breakMin,
          work,
          night,
        });
      }
    }
  }
  return rows;
}

/** "YYYY/M/D" + 経過分 → Date（JST） */
function at(dateStr: string, minutes: number): Date {
  const m = dateStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return new Date(NaN);
  const [, y, mo, d] = m;
  const base = new Date(
    `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00+09:00`
  );
  return new Date(base.getTime() + minutes * 60_000);
}

function main() {
  const rows = load();
  if (rows.length === 0) {
    console.log("勤怠CSVが見つかりませんでした");
    return;
  }
  console.log(`対象 ${rows.length}件 / ${rows[0].month}〜${rows[rows.length - 1].month}\n`);

  let workOk = 0;
  let nightOk = 0;
  const nightDiffs: { row: Row; calc: number }[] = [];

  for (const r of rows) {
    // 退勤が出勤以前なら日跨ぎ
    const outMin = r.outMin <= r.inMin ? r.outMin + 24 * 60 : r.outMin;
    const clockIn = at(r.date, r.inMin);
    const clockOut = at(r.date, outMin);

    // 休憩は時刻が無いので、勤務のまん中に置いたと仮定する
    const mid = (r.inMin + outMin) / 2;
    const breaks =
      r.breakMin > 0
        ? [
            {
              startAt: at(r.date, mid - r.breakMin / 2),
              endAt: at(r.date, mid + r.breakMin / 2),
            },
          ]
        : [];

    if (calculateWorkMinutes(clockIn, clockOut, breaks) === r.work) workOk++;

    const night = calculateNightMinutes(clockIn, clockOut, breaks, TZ);
    if (night === r.night) nightOk++;
    else nightDiffs.push({ row: r, calc: night });
  }

  const pct = (n: number) => ((n / rows.length) * 100).toFixed(1);
  console.log(`■ 労働時間      : ${workOk}/${rows.length} 一致 (${pct(workOk)}%)`);
  console.log(`■ 深夜労働時間  : ${nightOk}/${rows.length} 一致 (${pct(nightOk)}%)`);

  if (nightDiffs.length) {
    const buckets = new Map<number, number>();
    for (const d of nightDiffs) {
      const diff = d.calc - d.row.night;
      buckets.set(diff, (buckets.get(diff) ?? 0) + 1);
    }
    const sorted = [...buckets].sort((a, b) => b[1] - a[1]).slice(0, 5);
    console.log(
      `   ずれ（分）の内訳: ${sorted.map(([k, v]) => `${k > 0 ? "+" : ""}${k}分×${v}件`).join(", ")}`
    );
    console.log("   ※ 休憩の時刻が元データに無く、勤務の中央と仮定しているためのずれ");
    for (const d of nightDiffs.slice(0, 3)) {
      const r = d.row;
      console.log(
        `     ${r.month} ${r.name} ${r.date} 休憩${r.breakMin}分 → 計算${d.calc} / 実績${r.night}`
      );
    }
  }
}

main();
