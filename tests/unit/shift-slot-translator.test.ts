import { describe, it, expect } from "vitest";
import { validateSlots } from "@/lib/ai/shift-slot-translator";

/** note は検証に使わないので空で埋める */
const s = (name: string, startTime: string, endTime: string) => ({
  name,
  startTime,
  endTime,
  note: "",
});

describe("validateSlots", () => {
  it("連続した時間帯は通る", () => {
    expect(
      validateSlots([s("早番", "15:00", "21:00"), s("遅番", "21:00", "05:00")])
    ).toBeNull();
  });

  it("日をまたぐ枠を認める（終了が開始以下）", () => {
    expect(validateSlots([s("深夜", "22:00", "05:00")])).toBeNull();
  });

  it("Exhale の実際の営業時間を表現できる", () => {
    // 通常15時開始・土日祝12時開始・翌日が土日祝なら朝8時まで
    expect(
      validateSlots([
        s("昼", "12:00", "15:00"),
        s("早番", "15:00", "21:00"),
        s("遅番", "21:00", "05:00"),
        s("延長", "05:00", "08:00"),
      ])
    ).toBeNull();
  });

  it("重なっている時間帯は弾く", () => {
    expect(
      validateSlots([s("早番", "15:00", "22:00"), s("遅番", "21:00", "05:00")])
    ).toMatch(/重なって/);
  });

  it("時刻の形式が違うものは弾く", () => {
    expect(validateSlots([s("早番", "15時", "21:00")])).toMatch(/形式/);
    expect(validateSlots([s("早番", "25:00", "21:00")])).toMatch(/形式/);
    // 24:00 は使わせない（00:00 と書かせる）
    expect(validateSlots([s("深夜", "22:00", "24:00")])).toMatch(/形式/);
  });

  it("開始と終了が同じものは弾く", () => {
    expect(validateSlots([s("早番", "15:00", "15:00")])).toMatch(/同じ/);
  });

  it("名前が空のものは弾く", () => {
    expect(validateSlots([s("  ", "15:00", "21:00")])).toMatch(/名前/);
  });

  it("空配列は弾く", () => {
    expect(validateSlots([])).toMatch(/読み取れ/);
  });

  it("多すぎる時間帯は弾く", () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      s(`枠${i}`, `${String(i).padStart(2, "0")}:00`, `${String(i).padStart(2, "0")}:30`)
    );
    expect(validateSlots(many)).toMatch(/多すぎ/);
  });
});
