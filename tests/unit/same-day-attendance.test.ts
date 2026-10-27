import { describe, it, expect } from "vitest";
import {
  findOverlappingAttendance,
  firstAttendanceIdsOfDay,
  pickCurrentAttendance,
} from "@/lib/business/same-day-attendance";
import {
  calculateDayClockState,
  getAvailableActions,
  validateClockTransition,
} from "@/lib/business/time-clock";
import { transportationForAttendance } from "@/lib/business/transportation";

const at = (hhmm: string, day = "2026-10-19") => new Date(`${day}T${hhmm}:00+09:00`);

describe("退勤後の再出勤（Store.allowMultipleClockIns）", () => {
  it("再出勤できない店舗は、退勤後に何も押せない（従来どおり）", () => {
    expect(getAvailableActions("CLOCKED_OUT")).toEqual([]);
    expect(validateClockTransition("CLOCKED_OUT", "CLOCK_IN")).toBe("すでに退勤済みです");
  });

  it("再出勤できる店舗は、退勤後にもう一度出勤できる", () => {
    const opts = { allowMultipleClockIns: true };
    expect(getAvailableActions("CLOCKED_OUT", opts)).toEqual(["CLOCK_IN"]);
    expect(validateClockTransition("CLOCKED_OUT", "CLOCK_IN", opts)).toBeNull();
  });

  it("勤務中・休憩中の出勤は、再出勤できる店舗でも弾く", () => {
    const opts = { allowMultipleClockIns: true };
    expect(validateClockTransition("WORKING", "CLOCK_IN", opts)).toBe("すでに出勤済みです");
    expect(validateClockTransition("ON_BREAK", "CLOCK_IN", opts)).toBe("すでに出勤済みです");
  });
});

describe("calculateDayClockState（その日の勤怠1件から状態を決める）", () => {
  it("勤怠なし → 未出勤", () => {
    expect(calculateDayClockState(null)).toBe("NOT_CLOCKED_IN");
  });

  it("管理者の手入力で作った勤怠（打刻イベントなし）は退勤済み。未出勤に見せない", () => {
    expect(
      calculateDayClockState({ clockInAt: at("19:00"), clockOutAt: at("23:00"), attendanceEvents: [] })
    ).toBe("CLOCKED_OUT");
  });

  it("退勤していない勤怠は、イベントに従って勤務中・休憩中", () => {
    expect(
      calculateDayClockState({
        clockInAt: at("19:00"),
        clockOutAt: null,
        attendanceEvents: [{ eventType: "CLOCK_IN" }, { eventType: "BREAK_START" }],
      })
    ).toBe("ON_BREAK");
    expect(
      calculateDayClockState({ clockInAt: at("19:00"), clockOutAt: null, attendanceEvents: [] })
    ).toBe("WORKING");
  });
});

describe("pickCurrentAttendance", () => {
  it("退勤していない勤怠を優先する", () => {
    const rows = [
      { id: "a", clockInAt: at("19:00"), clockOutAt: at("23:00") },
      { id: "b", clockInAt: at("23:30"), clockOutAt: null },
    ];
    expect(pickCurrentAttendance(rows)?.id).toBe("b");
  });

  it("全部退勤済みなら、出勤がいちばん遅いもの（作成順ではなく出勤順）", () => {
    const rows = [
      { id: "late", clockInAt: at("23:30"), clockOutAt: at("23:59") },
      { id: "early", clockInAt: at("19:00"), clockOutAt: at("23:00") },
    ];
    expect(pickCurrentAttendance(rows)?.id).toBe("late");
  });

  it("勤怠なしは null", () => {
    expect(pickCurrentAttendance([])).toBeNull();
  });
});

describe("findOverlappingAttendance（同じ日の勤怠どうしの重なり）", () => {
  const first = { id: "a", clockInAt: at("19:00"), clockOutAt: at("23:00") };

  it("重ならない2件目は通す", () => {
    expect(findOverlappingAttendance([first], { clockInAt: at("23:30"), clockOutAt: at("23:59") })).toBeNull();
  });

  it("退勤と同時刻の出勤は重なりではない", () => {
    expect(findOverlappingAttendance([first], { clockInAt: at("23:00"), clockOutAt: at("23:30") })).toBeNull();
  });

  it("一部でも重なれば返す", () => {
    expect(findOverlappingAttendance([first], { clockInAt: at("22:30"), clockOutAt: at("23:30") })?.id).toBe("a");
    expect(findOverlappingAttendance([first], { clockInAt: at("18:00"), clockOutAt: at("19:30") })?.id).toBe("a");
  });

  it("退勤していない勤怠は、出勤から先がずっと続いている扱い", () => {
    const open = { id: "o", clockInAt: at("23:30"), clockOutAt: null };
    expect(findOverlappingAttendance([open], { clockInAt: at("23:45"), clockOutAt: at("23:50") })?.id).toBe("o");
    expect(findOverlappingAttendance([open], { clockInAt: at("20:00"), clockOutAt: at("21:00") })).toBeNull();
  });

  it("修正中の勤怠自身は比較から外す", () => {
    expect(findOverlappingAttendance([first], { clockInAt: at("20:00"), clockOutAt: at("22:00") }, "a")).toBeNull();
  });
});

describe("交通費はその日の最初の勤怠にだけ付ける", () => {
  const rows = [
    { id: "x2", staffId: "s1", storeId: "v", businessDate: "2026-10-19", clockInAt: at("23:30") },
    { id: "x1", staffId: "s1", storeId: "v", businessDate: "2026-10-19", clockInAt: at("19:00") },
    { id: "y1", staffId: "s1", storeId: "v", businessDate: "2026-10-20", clockInAt: at("19:00", "2026-10-20") },
    { id: "z1", staffId: "s2", storeId: "v", businessDate: "2026-10-19", clockInAt: at("20:00") },
    { id: "n1", staffId: "s3", storeId: "v", businessDate: "2026-10-19", clockInAt: null },
  ];

  it("(スタッフ, 店舗, 営業日) ごとに出勤がいちばん早い1件", () => {
    expect([...firstAttendanceIdsOfDay(rows)].sort()).toEqual(["x1", "y1", "z1"]);
  });

  it("2件目は0円、1件目と1日1件の日は従来どおり", () => {
    const settings = [
      { type: "PER_SHIFT" as const, amount: 500, effectiveFrom: new Date("2026-01-01"), effectiveTo: null },
    ];
    const base = { businessDate: "2026-10-19", clockInAt: at("19:00") };
    expect(transportationForAttendance(settings, { ...base, isFirstOfDay: true })).toBe(500);
    expect(transportationForAttendance(settings, { ...base, isFirstOfDay: false })).toBe(0);
    expect(transportationForAttendance(settings, base)).toBe(500);
  });
});
