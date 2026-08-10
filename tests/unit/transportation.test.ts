import { describe, it, expect } from "vitest";
import {
  settingForDate,
  transportationForAttendance,
  type TransportationSetting,
} from "@/lib/business/transportation";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

const perShift = (
  amount: number,
  from: string,
  to: string | null = null
): TransportationSetting => ({
  type: "PER_SHIFT",
  amount,
  effectiveFrom: d(from),
  effectiveTo: to ? d(to) : null,
});

describe("settingForDate", () => {
  it("開始日当日から効く", () => {
    const s = [perShift(800, "2026-07-01")];
    expect(settingForDate(s, "2026-06-30")).toBeNull();
    expect(settingForDate(s, "2026-07-01")?.amount).toBe(800);
  });

  it("終了日は含まない（切り替え日に二重で効かない）", () => {
    const s = [perShift(800, "2026-07-01", "2026-08-01"), perShift(1000, "2026-08-01")];
    expect(settingForDate(s, "2026-07-31")?.amount).toBe(800);
    expect(settingForDate(s, "2026-08-01")?.amount).toBe(1000);
  });

  it("期間が重なっていたら新しく始まった方を採る", () => {
    const s = [perShift(800, "2026-07-01"), perShift(1200, "2026-07-15")];
    expect(settingForDate(s, "2026-07-20")?.amount).toBe(1200);
  });

  it("設定が無ければ null", () => {
    expect(settingForDate([], "2026-07-01")).toBeNull();
  });
});

describe("transportationForAttendance", () => {
  const s = [perShift(800, "2026-07-01")];

  it("出勤していれば1回分つく", () => {
    expect(
      transportationForAttendance(s, {
        businessDate: "2026-07-01",
        clockInAt: new Date("2026-07-01T10:30:00.000Z"),
      })
    ).toBe(800);
  });

  it("出勤の記録が無い日は0", () => {
    expect(
      transportationForAttendance(s, { businessDate: "2026-07-01", clockInAt: null })
    ).toBe(0);
  });

  it("適用開始より前の日は0", () => {
    expect(
      transportationForAttendance(s, {
        businessDate: "2026-06-30",
        clockInAt: new Date("2026-06-30T10:30:00.000Z"),
      })
    ).toBe(0);
  });

  it("月額と「なし」は0（今は勤怠1件に割り当てない）", () => {
    for (const type of ["MONTHLY", "NONE"] as const) {
      expect(
        transportationForAttendance(
          [{ type, amount: 5000, effectiveFrom: d("2026-07-01"), effectiveTo: null }],
          {
            businessDate: "2026-07-10",
            clockInAt: new Date("2026-07-10T10:30:00.000Z"),
          }
        )
      ).toBe(0);
    }
  });

  it("退勤漏れでも来ていれば払う", () => {
    expect(
      transportationForAttendance(s, {
        businessDate: "2026-07-05",
        clockInAt: new Date("2026-07-05T10:30:00.000Z"),
      })
    ).toBe(800);
  });
});
