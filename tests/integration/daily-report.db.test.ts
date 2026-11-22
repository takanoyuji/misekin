/**
 * 退勤の日報（Store.requireDailyReport）を実DBで通す。
 *
 * 実行には seed 済みの Postgres が要る（migrations.sql まで流したもの）:
 *   DATABASE_URL=postgresql://... npx vitest run tests/integration --no-file-parallelism
 * multi-clock-in と同じ店舗・スタッフを使うので、ファイルは順に流す。
 * DATABASE_URL が無ければ丸ごとスキップする。
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clockAction } from "@/actions/attendance";
import {
  checkSameDayCustomers,
  decideSaleDuplicate,
  mergeCustomers,
  unmergeCustomer,
  updateDailyReportSettings,
} from "@/actions/daily-report";
import { updateStore } from "@/actions/store";
import { getBusinessDate } from "@/lib/business/business-day";

const HAS_DB = Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("johndoe"));

describe.skipIf(!HAS_DB)("退勤の日報（実DB）", () => {
  let organizationId = "";
  let storeId = "";
  let staffA = "";
  let staffB = "";
  let token = "";
  let today = "";

  const clear = async () => {
    const reports = await db.dailyReport.findMany({ where: { storeId }, select: { id: true } });
    const ids = reports.map((r) => r.id);
    await db.dailyReportSale.deleteMany({ where: { reportId: { in: ids } } });
    await db.dailyReportBackItem.deleteMany({ where: { reportId: { in: ids } } });
    await db.dailyReport.deleteMany({ where: { id: { in: ids } } });
    await db.customer.updateMany({ where: { storeId }, data: { mergedIntoId: null } });
    await db.customer.deleteMany({ where: { storeId } });
    const att = (
      await db.attendance.findMany({
        where: { storeId, staffId: { in: [staffA, staffB] }, businessDate: today },
        select: { id: true },
      })
    ).map((a) => a.id);
    await db.attendanceEvent.deleteMany({ where: { attendanceId: { in: att } } });
    await db.break.deleteMany({ where: { attendanceId: { in: att } } });
    await db.attendance.deleteMany({ where: { id: { in: att } } });
  };

  const clock = (staffId: string, action: "CLOCK_IN" | "CLOCK_OUT", dailyReport?: unknown) =>
    clockAction({ token, staffId, action, dailyReport });

  beforeAll(async () => {
    const admin = await db.user.findFirstOrThrow({ where: { email: "admin@example.com" } });
    const member = await db.organizationMember.findFirstOrThrow({ where: { userId: admin.id } });
    organizationId = member.organizationId;
    const store = await db.store.findFirstOrThrow({ where: { organizationId }, orderBy: { name: "asc" } });
    storeId = store.id;
    const ss = await db.staffStore.findMany({
      where: { storeId, isActive: true, canClock: true },
      orderBy: { id: "asc" },
      take: 2,
    });
    [staffA, staffB] = ss.map((s) => s.staffId);
    await db.staffStore.updateMany({ where: { id: { in: ss.map((s) => s.id) } }, data: { requirePin: false } });
    token = (await db.storeClockUrl.findFirstOrThrow({ where: { storeId, isActive: true } })).token;
    today = getBusinessDate(new Date(), store.timezone, store.dayChangeHour, store.dayChangeMinute);
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ user: { id: admin.id } });
  });

  beforeEach(async () => {
    await clear();
    await db.store.update({ where: { id: storeId }, data: { requireDailyReport: true, dailyReportLocations: [] } });
  });

  afterAll(async () => {
    await clear();
    await db.store.update({
      where: { id: storeId },
      data: { requireDailyReport: false, dailyReportProducts: [], dailyReportLocations: [] },
    });
  });

  it("日報が要る店舗は、日報なしの退勤を弾き、勤怠は勤務中のまま", async () => {
    expect((await clock(staffA, "CLOCK_IN")).error).toBeUndefined();
    expect((await clock(staffA, "CLOCK_OUT")).error).toMatch(/日報が必要/);
    expect(
      (await clock(staffA, "CLOCK_OUT", { noSales: false, sales: [], backItems: [] })).error
    ).toMatch(/売上か商品を1つ以上/);
    const att = await db.attendance.findFirstOrThrow({ where: { staffId: staffA, storeId, businessDate: today } });
    expect(att.status).toBe("IN_PROGRESS");
    expect(await db.dailyReport.count({ where: { storeId } })).toBe(0);
  });

  it("日報が要らない店舗は従来どおり日報なしで退勤できる", async () => {
    await db.store.update({ where: { id: storeId }, data: { requireDailyReport: false } });
    expect((await clock(staffA, "CLOCK_IN")).error).toBeUndefined();
    expect((await clock(staffA, "CLOCK_OUT")).error).toBeUndefined();
    expect(await db.dailyReport.count({ where: { storeId } })).toBe(0);
  });

  it("退勤と同時に日報を保存し、表記ゆれの名前は同じお客様に紐づける", async () => {
    await clock(staffA, "CLOCK_IN");
    const r = await clock(staffA, "CLOCK_OUT", {
      noSales: false,
      sales: [
        { customerName: "たけしさん", amount: 8400 },
        { customerName: "タケシ様", amount: 1000 },
        { customerName: "ゆうと", amount: 23500 },
      ],
      backItems: [{ productName: "キャストドリンク", unitPrice: 1000, quantity: 5 }],
    });
    expect(r.error).toBeUndefined();

    const report = await db.dailyReport.findFirstOrThrow({
      where: { storeId, staffId: staffA },
      include: { sales: { orderBy: { sortOrder: "asc" } }, backItems: true, attendance: true },
    });
    expect(report.attendance.status).toBe("COMPLETED");
    expect(report.businessDate).toBe(today);
    expect(report.sales.map((s) => s.customerName)).toEqual(["たけしさん", "タケシ様", "ゆうと"]);
    expect(report.sales[0].customerId).toBe(report.sales[1].customerId);
    expect(report.backItems[0].quantity).toBe(5);
    expect(await db.customer.count({ where: { storeId } })).toBe(2);
  });

  it("別のキャストが今日同じお客様を書いていたら知らせる（自分の分は出さない）", async () => {
    await clock(staffA, "CLOCK_IN");
    await clock(staffA, "CLOCK_OUT", {
      noSales: false,
      sales: [{ customerName: "たけしさん", amount: 8000 }],
      backItems: [],
    });
    const forB = await checkSameDayCustomers({ token, staffId: staffB, names: ["タケシ", "そうた"] });
    expect(forB.hits).toHaveLength(1);
    expect(forB.hits[0]).toMatchObject({ customerName: "タケシ", writtenName: "たけしさん", amount: 8000 });

    const forA = await checkSameDayCustomers({ token, staffId: staffA, names: ["たけし"] });
    expect(forA.hits).toHaveLength(0);
  });

  it("2人が同じお客様を書いたら重複の疑い。採用を決めると判断が行に残る", async () => {
    for (const [staff, amount] of [[staffA, 8000], [staffB, 8400]] as const) {
      await clock(staff, "CLOCK_IN");
      const r = await clock(staff, "CLOCK_OUT", {
        noSales: false,
        sales: [{ customerName: staff === staffA ? "たけしさん" : "タケシ", amount }],
        backItems: [],
      });
      expect(r.error).toBeUndefined();
    }
    const reports = await db.dailyReport.findMany({ where: { storeId }, include: { sales: true } });
    expect(reports).toHaveLength(2);
    const customerRootId = reports[0].sales[0].customerId;
    expect(reports[1].sales[0].customerId).toBe(customerRootId);

    const reportA = reports.find((r) => r.staffId === staffA)!;
    const res = await decideSaleDuplicate(organizationId, {
      storeId,
      businessDate: today,
      customerRootId,
      choice: { adoptReportId: reportA.id },
    });
    expect(res.error).toBeUndefined();
    const sales = await db.dailyReportSale.findMany({
      where: { report: { storeId } },
      include: { report: true },
    });
    expect(sales.find((s) => s.report.staffId === staffA)!.duplicateDecision).toBe("ADOPTED");
    expect(sales.find((s) => s.report.staffId === staffB)!.duplicateDecision).toBe("EXCLUDED");
    expect(sales.every((s) => s.decidedByUserId)).toBe(true);

    // 取り消すと未確認に戻る。行は消えない
    await decideSaleDuplicate(organizationId, { storeId, businessDate: today, customerRootId, choice: "RESET" });
    const after = await db.dailyReportSale.findMany({ where: { report: { storeId } } });
    expect(after).toHaveLength(2);
    expect(after.every((s) => s.duplicateDecision === null)).toBe(true);
  });

  it("重複でない組には判断を付けない", async () => {
    await clock(staffA, "CLOCK_IN");
    await clock(staffA, "CLOCK_OUT", {
      noSales: false,
      sales: [{ customerName: "たけし", amount: 8000 }],
      backItems: [],
    });
    const c = await db.customer.findFirstOrThrow({ where: { storeId } });
    const res = await decideSaleDuplicate(organizationId, {
      storeId,
      businessDate: today,
      customerRootId: c.id,
      choice: "SEPARATE",
    });
    expect(res.error).toMatch(/重複ではありません/);
  });

  it("まとめると代表に寄り、分けると元に戻る。まとめは1段", async () => {
    await clock(staffA, "CLOCK_IN");
    await clock(staffA, "CLOCK_OUT", {
      noSales: false,
      sales: [
        { customerName: "ゆうと（常連）", amount: 1000 },
        { customerName: "ゆうと", amount: 2000 },
        { customerName: "ユウトくん2", amount: 3000 },
      ],
      backItems: [],
    });
    const byName = async (n: string) =>
      db.customer.findFirstOrThrow({ where: { storeId, name: n } });
    const a = await byName("ゆうと（常連）");
    const b = await byName("ゆうと");
    const c = await byName("ユウトくん2");

    expect((await mergeCustomers(organizationId, { sourceId: a.id, targetId: c.id })).error).toBeUndefined();
    // c を b にまとめると、c にまとまっていた a も b に付け替わる
    expect((await mergeCustomers(organizationId, { sourceId: c.id, targetId: b.id })).error).toBeUndefined();
    expect((await byName("ゆうと（常連）")).mergedIntoId).toBe(b.id);
    expect((await byName("ユウトくん2")).mergedIntoId).toBe(b.id);
    expect((await mergeCustomers(organizationId, { sourceId: a.id, targetId: b.id })).error).toMatch(/もう同じ人/);

    expect((await unmergeCustomer(organizationId, { customerId: a.id })).error).toBeUndefined();
    expect((await byName("ゆうと（常連）")).mergedIntoId).toBeNull();
    // 行の紐づけは書いたときのまま
    const sale = await db.dailyReportSale.findFirstOrThrow({ where: { customerName: "ゆうと（常連）" } });
    expect(sale.customerId).toBe(a.id);

    const logs = await db.auditLog.count({
      where: { organizationId, action: { in: ["CUSTOMER_MERGE", "CUSTOMER_UNMERGE"] }, storeId },
    });
    expect(logs).toBeGreaterThanOrEqual(3);
  });

  it("日報の設定は専用の経路でだけ変わる（通常の店舗編集からは変えられない）", async () => {
    await db.store.update({ where: { id: storeId }, data: { requireDailyReport: false } });
    await updateStore(organizationId, storeId, {
      requireDailyReport: true,
      dailyReportProducts: [{ name: "x", price: -1 }],
    } as never);
    let s = await db.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(s.requireDailyReport).toBe(false);

    expect(
      (await updateDailyReportSettings(organizationId, storeId, {
        requireDailyReport: true,
        products: [{ name: "チェキ", price: -1 }],
        locations: [],
      })).error
    ).toBeTruthy();
    const ok = await updateDailyReportSettings(organizationId, storeId, {
      requireDailyReport: true,
      products: [{ name: "チェキ", price: 1000 }],
      locations: ["池袋", "札幌"],
    });
    expect(ok.error).toBeUndefined();
    s = await db.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(s.requireDailyReport).toBe(true);
    expect(s.dailyReportProducts).toEqual([{ name: "チェキ", price: 1000 }]);
    expect(s.dailyReportLocations).toEqual(["池袋", "札幌"]);

    // 通常の店舗編集からは店の一覧も変えられない
    await updateStore(organizationId, storeId, { dailyReportLocations: ["x"] } as never);
    s = await db.store.findUniqueOrThrow({ where: { id: storeId } });
    expect(s.dailyReportLocations).toEqual(["池袋", "札幌"]);
  });

  it("店を選ばせる店舗は、日報に店が1つ要り、選んだ店を保存する", async () => {
    await db.store.update({ where: { id: storeId }, data: { dailyReportLocations: ["池袋", "札幌"] } });
    await clock(staffA, "CLOCK_IN");
    const body = { noSales: false, sales: [{ customerName: "たけし", amount: 8000 }], backItems: [] };
    expect((await clock(staffA, "CLOCK_OUT", body)).error).toMatch(/どこの店の分か/);
    expect((await clock(staffA, "CLOCK_OUT", { ...body, location: "大阪" })).error).toMatch(/どこの店の分か/);
    expect((await clock(staffA, "CLOCK_OUT", { ...body, location: "札幌" })).error).toBeUndefined();
    const report = await db.dailyReport.findFirstOrThrow({ where: { storeId, staffId: staffA } });
    expect(report.location).toBe("札幌");
  });

  it("店を選ばせない店舗は、送られてきた店を保存しない", async () => {
    await clock(staffA, "CLOCK_IN");
    const r = await clock(staffA, "CLOCK_OUT", {
      noSales: false,
      sales: [{ customerName: "たけし", amount: 8000 }],
      backItems: [],
      location: "札幌",
    });
    expect(r.error).toBeUndefined();
    const report = await db.dailyReport.findFirstOrThrow({ where: { storeId, staffId: staffA } });
    expect(report.location).toBeNull();
  });

  it("退勤の二度押しが同時に届いても、日報は1件だけ", async () => {
    await clock(staffA, "CLOCK_IN");
    const body = { noSales: true, sales: [], backItems: [] };
    const results = await Promise.all([clock(staffA, "CLOCK_OUT", body), clock(staffA, "CLOCK_OUT", body)]);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(await db.dailyReport.count({ where: { storeId, staffId: staffA } })).toBe(1);
  });
});
