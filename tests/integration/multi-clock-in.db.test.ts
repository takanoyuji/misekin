/**
 * 退勤後の再出勤（Store.allowMultipleClockIns）を実DBで通す。
 *
 * 実行には seed 済みの Postgres が要る（migrations.sql まで流したもの）:
 *   DATABASE_URL=postgresql://... npx vitest run tests/integration
 * DATABASE_URL が無ければ丸ごとスキップする。
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clockAction, createAttendanceByAdmin } from "@/actions/attendance";
import { getBusinessDate } from "@/lib/business/business-day";

const HAS_DB = Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("johndoe"));

describe.skipIf(!HAS_DB)("退勤後の再出勤（実DB）", () => {
  let organizationId = "";
  let storeId = "";
  let staffId = "";
  let token = "";
  let today = "";

  const clearDay = async (businessDates: string[]) => {
    const ids = (
      await db.attendance.findMany({
        where: { staffId, businessDate: { in: businessDates } },
        select: { id: true },
      })
    ).map((a) => a.id);
    await db.attendanceEvent.deleteMany({ where: { attendanceId: { in: ids } } });
    await db.break.deleteMany({ where: { attendanceId: { in: ids } } });
    await db.attendanceCorrection.deleteMany({ where: { attendanceId: { in: ids } } });
    await db.attendance.deleteMany({ where: { id: { in: ids } } });
  };

  const setAllow = (allow: boolean) =>
    db.store.update({ where: { id: storeId }, data: { allowMultipleClockIns: allow } });

  const clock = (action: "CLOCK_IN" | "CLOCK_OUT") => clockAction({ token, staffId, action });

  beforeAll(async () => {
    const admin = await db.user.findFirstOrThrow({ where: { email: "admin@example.com" } });
    const member = await db.organizationMember.findFirstOrThrow({ where: { userId: admin.id } });
    organizationId = member.organizationId;
    const store = await db.store.findFirstOrThrow({ where: { organizationId }, orderBy: { name: "asc" } });
    storeId = store.id;
    const ss = await db.staffStore.findFirstOrThrow({ where: { storeId, isActive: true, canClock: true } });
    staffId = ss.staffId;
    await db.staffStore.update({ where: { id: ss.id }, data: { requirePin: false } });
    const url = await db.storeClockUrl.findFirstOrThrow({ where: { storeId, isActive: true } });
    token = url.token;
    today = getBusinessDate(new Date(), store.timezone, store.dayChangeHour, store.dayChangeMinute);
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: admin.id } });
  });

  beforeEach(async () => {
    await clearDay([today, "2026-03-10"]);
  });

  afterAll(async () => {
    await setAllow(false);
  });

  it("再出勤できない店舗は、退勤後の出勤を弾く（従来どおり）", async () => {
    await setAllow(false);
    expect((await clock("CLOCK_IN")).error).toBeUndefined();
    expect((await clock("CLOCK_OUT")).error).toBeUndefined();
    expect((await clock("CLOCK_IN")).error).toBe("すでに退勤済みです");
    expect(await db.attendance.count({ where: { staffId, storeId, businessDate: today } })).toBe(1);
  });

  it("再出勤できる店舗は、退勤後の出勤で同じ営業日の2件目を作る", async () => {
    await setAllow(true);
    expect((await clock("CLOCK_IN")).error).toBeUndefined();
    expect((await clock("CLOCK_IN")).error).toBe("すでに出勤済みです");
    expect((await clock("CLOCK_OUT")).error).toBeUndefined();
    expect((await clock("CLOCK_IN")).error).toBeUndefined();

    const rows = await db.attendance.findMany({
      where: { staffId, storeId, businessDate: today },
      include: { attendanceEvents: true },
      orderBy: { clockInAt: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe("COMPLETED");
    expect(rows[1].status).toBe("IN_PROGRESS");
    expect(rows[1].attendanceEvents.map((e) => e.eventType)).toEqual(["CLOCK_IN"]);

    // 2件目の退勤は2件目の勤怠に付く
    expect((await clock("CLOCK_OUT")).error).toBeUndefined();
    const second = await db.attendance.findUniqueOrThrow({ where: { id: rows[1].id } });
    expect(second.status).toBe("COMPLETED");
    const first = await db.attendance.findUniqueOrThrow({ where: { id: rows[0].id } });
    expect(first.clockOutAt?.getTime()).toBe(rows[0].clockOutAt?.getTime());
  });

  it("出勤の二度押しが同時に届いても、退勤していない勤怠は1件だけ", async () => {
    await setAllow(true);
    const results = await Promise.all([clock("CLOCK_IN"), clock("CLOCK_IN")]);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(results.find((r) => r.error)?.error).toBe("すでに出勤済みです");
    expect(
      await db.attendance.count({ where: { staffId, storeId, businessDate: today, clockOutAt: null } })
    ).toBe(1);
  });

  it("管理者の手入力: 再出勤できる店舗では、重ならなければ同じ日に2件目を作れる", async () => {
    await setAllow(true);
    // 2026-03-10 19:00〜23:00 JST
    const r1 = await createAttendanceByAdmin(organizationId, {
      storeId, staffId,
      clockInAt: new Date("2026-03-10T10:00:00Z"), clockOutAt: new Date("2026-03-10T14:00:00Z"),
      reason: "テスト: 通常勤務",
    });
    expect(r1.error).toBeUndefined();

    const overlap = await createAttendanceByAdmin(organizationId, {
      storeId, staffId,
      clockInAt: new Date("2026-03-10T13:30:00Z"), clockOutAt: new Date("2026-03-10T14:30:00Z"),
      reason: "テスト: 重なる",
    });
    expect(overlap.error).toMatch(/重なっています/);

    // 23:30〜翌0:30 JST（営業日は 2026-03-10 のまま）
    const r2 = await createAttendanceByAdmin(organizationId, {
      storeId, staffId,
      clockInAt: new Date("2026-03-10T14:30:00Z"), clockOutAt: new Date("2026-03-10T15:30:00Z"),
      reason: "テスト: 遠隔推し活",
    });
    expect(r2.error).toBeUndefined();
    expect(await db.attendance.count({ where: { staffId, storeId, businessDate: "2026-03-10" } })).toBe(2);
  });
});
