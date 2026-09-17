/**
 * 管理者の勤怠手入力（createAttendanceByAdmin）を実DBで通す。
 *
 * 実行には seed 済みの Postgres が要る:
 *   DATABASE_URL=postgresql://... npx vitest run tests/integration
 * DATABASE_URL が無ければ丸ごとスキップする（通常の `vitest run` は tests/unit だけを想定）。
 */
import { describe, it, expect, vi, beforeAll } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAttendanceByAdmin } from "@/actions/attendance";

const HAS_DB = Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("johndoe"));

describe.skipIf(!HAS_DB)("createAttendanceByAdmin（実DB）", () => {
  let organizationId = "";
  let storeId = "";
  let staffId = "";
  let otherStoreId = "";

  beforeAll(async () => {
    const admin = await db.user.findFirstOrThrow({ where: { email: "admin@example.com" } });
    const member = await db.organizationMember.findFirstOrThrow({ where: { userId: admin.id }, include: { organization: true } });
    organizationId = member.organizationId;
    const stores = await db.store.findMany({ where: { organizationId }, orderBy: { name: "asc" }, take: 2 });
    storeId = stores[0].id;
    otherStoreId = stores[1].id;
    const ss = await db.staffStore.findFirstOrThrow({ where: { storeId, isActive: true } });
    staffId = ss.staffId;
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: admin.id } });
    // 使う営業日を空けておく
    await db.attendance.deleteMany({ where: { staffId, businessDate: { in: ["2026-03-01", "2026-03-02"] } } });
  });

  it("出勤〜退勤・休憩から勤怠を作り、修正履歴と監査ログを残す", async () => {
    // 2026-03-02 02:00 JST 出勤 → 日付切替 06:00 より前なので営業日は 2026-03-01
    const clockInAt = new Date("2026-03-01T17:00:00Z");
    const clockOutAt = new Date("2026-03-01T20:30:00Z");
    const r = await createAttendanceByAdmin(organizationId, {
      storeId, staffId, clockInAt, clockOutAt,
      breaks: [{ startAt: new Date("2026-03-01T18:00:00Z"), endAt: new Date("2026-03-01T18:30:00Z") }],
      reason: "テスト: 本人からLINEで申告",
      adminNotes: "内部メモ",
    });
    expect(r.error).toBeUndefined();
    expect(r.success).toBe(true);

    const att = await db.attendance.findUniqueOrThrow({ where: { id: r.attendanceId! }, include: { breaks: true, corrections: true } });
    expect(att.businessDate).toBe("2026-03-01");
    expect(att.status).toBe("COMPLETED");
    expect(att.breakMinutes).toBe(30);
    expect(att.workMinutes).toBe(180);
    expect(att.breaks).toHaveLength(1);
    expect(att.adminNotes).toContain("管理者が手入力で作成");
    expect(att.adminNotes).toContain("内部メモ");
    expect(att.corrections).toHaveLength(1);
    expect(att.corrections[0].reason).toBe("テスト: 本人からLINEで申告");

    const log = await db.auditLog.findFirst({ where: { targetId: att.id, action: "ATTENDANCE_CREATE" } });
    expect(log).not.toBeNull();
    expect(log!.staffId).toBe(staffId);
  });

  it("同じ営業日に勤怠があれば作らず、既存IDを返して修正へ誘導する", async () => {
    const r = await createAttendanceByAdmin(organizationId, {
      storeId, staffId,
      clockInAt: new Date("2026-03-01T10:00:00Z"), clockOutAt: new Date("2026-03-01T12:00:00Z"),
      reason: "重複",
    });
    expect(r.error).toMatch(/既にあります/);
    expect(r.attendanceId).toBeTruthy();
    expect(await db.attendance.count({ where: { staffId, businessDate: "2026-03-01" } })).toBe(1);
  });

  it("所属していない店舗には作れない", async () => {
    const notMember = await db.staff.findFirstOrThrow({
      where: { organizationId, staffStores: { none: { storeId: otherStoreId } } },
    });
    const r = await createAttendanceByAdmin(organizationId, {
      storeId: otherStoreId, staffId: notMember.id,
      clockInAt: new Date("2026-03-02T10:00:00Z"), clockOutAt: new Date("2026-03-02T12:00:00Z"),
      reason: "x",
    });
    expect(r.error).toMatch(/所属していない/);
  });

  it("締め済みの期間には作れない", async () => {
    const admin = await db.user.findFirstOrThrow({ where: { email: "admin@example.com" } });
    const closing = await db.closingPeriod.create({
      data: { organizationId, storeId, name: "テスト締め", periodStart: "2026-03-02", periodEnd: "2026-03-02", closedAt: new Date(), closedByUserId: admin.id },
    });
    try {
      const r = await createAttendanceByAdmin(organizationId, {
        storeId, staffId,
        clockInAt: new Date("2026-03-02T10:00:00Z"), clockOutAt: new Date("2026-03-02T12:00:00Z"),
        reason: "x",
      });
      expect(r.error).toMatch(/締め処理済み/);
    } finally {
      await db.closingPeriod.delete({ where: { id: closing.id } });
    }
  });

  it("入力の矛盾（退勤が先）は保存前に弾く", async () => {
    const r = await createAttendanceByAdmin(organizationId, {
      storeId, staffId,
      clockInAt: new Date("2026-03-02T12:00:00Z"), clockOutAt: new Date("2026-03-02T10:00:00Z"),
      reason: "x",
    });
    expect(r.error).toMatch(/退勤時刻は出勤時刻より後/);
  });
});
