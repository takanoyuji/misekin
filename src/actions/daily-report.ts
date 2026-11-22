"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/auth/audit";
import { requireAdmin, canAccessStore } from "@/lib/auth/permissions";
import { clockCookieName, verifyClockSession } from "@/lib/clock-session";
import { getBusinessDate } from "@/lib/business/business-day";
import { decideDuplicateGroup, normalizeCustomerName } from "@/lib/business/daily-report";
import { rootCustomerId } from "@/lib/daily-report/server";
import { dailyReportSettingsSchema } from "@/lib/validations/daily-report";

interface ActionResult {
  success?: boolean;
  error?: string;
}

// ------------------------------------------------------------
// キャスト（打刻画面）
// ------------------------------------------------------------

export interface SameDayCustomerHit {
  customerName: string;
  writtenBy: string;
  writtenName: string;
  amount: number;
}

/**
 * 今日、同じ店で別のキャストが同じお客様の売上を書いているか。
 * 売上は「どちらか1人が書く」運用なので、書く前に気づけるよう打刻画面で知らせる。
 * 打刻URL＋スタッフ（PIN必須ならPINのセッション）で確かめる。見せるのは同じ店・同じ営業日の分だけ。
 */
export async function checkSameDayCustomers(params: {
  token: string;
  staffId: string;
  names: string[];
}): Promise<{ hits: SameDayCustomerHit[] }> {
  const names = params.names
    .map((n) => (typeof n === "string" ? n.trim() : ""))
    .filter((n) => n.length > 0 && n.length <= 50)
    .slice(0, 50);
  if (names.length === 0) return { hits: [] };

  const clockUrl = await db.storeClockUrl.findFirst({
    where: { token: params.token, isActive: true },
    include: { store: true },
  });
  if (!clockUrl || (clockUrl.expiresAt && clockUrl.expiresAt < new Date())) return { hits: [] };
  const store = clockUrl.store;
  if (!store.requireDailyReport) return { hits: [] };

  const staffStore = await db.staffStore.findFirst({
    where: {
      staffId: params.staffId,
      storeId: store.id,
      isActive: true,
      canClock: true,
      staff: { status: "ACTIVE", organizationId: store.organizationId },
    },
  });
  if (!staffStore) return { hits: [] };
  if (staffStore.requirePin) {
    const session = (await cookies()).get(clockCookieName(params.token))?.value;
    // 日報を書いている間にPINのセッション（5分）が切れることがある。切れていたら知らせないだけにする
    if (!verifyClockSession(session, staffStore.id, Date.now())) return { hits: [] };
  }

  const businessDate = getBusinessDate(
    new Date(),
    store.timezone,
    store.dayChangeHour,
    store.dayChangeMinute
  );

  const keys = [...new Set(names.map(normalizeCustomerName))];
  const customers = await db.customer.findMany({
    where: { storeId: store.id, normalizedName: { in: keys } },
    select: { id: true, mergedIntoId: true, normalizedName: true },
  });
  if (customers.length === 0) return { hits: [] };
  const rootByKey = new Map(customers.map((c) => [c.normalizedName, rootCustomerId(c)]));
  const roots = [...new Set(rootByKey.values())];

  const sales = await db.dailyReportSale.findMany({
    where: {
      report: { storeId: store.id, businessDate, NOT: { staffId: params.staffId } },
      OR: [{ customerId: { in: roots } }, { customer: { mergedIntoId: { in: roots } } }],
    },
    select: {
      customerName: true,
      amount: true,
      customer: { select: { id: true, mergedIntoId: true } },
      report: { select: { staff: { select: { displayName: true } } } },
    },
  });

  const hits: SameDayCustomerHit[] = [];
  for (const n of names) {
    const root = rootByKey.get(normalizeCustomerName(n));
    if (!root) continue;
    for (const s of sales) {
      if (rootCustomerId(s.customer) !== root) continue;
      hits.push({
        customerName: n,
        writtenBy: s.report.staff.displayName,
        writtenName: s.customerName,
        amount: s.amount,
      });
    }
  }
  return { hits };
}

// ------------------------------------------------------------
// 管理者
// ------------------------------------------------------------

async function requireStoreAdmin(organizationId: string, storeId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("ログインが必要です");
  const ctx = await requireAdmin(session.user.id, organizationId);
  const store = await db.store.findFirst({
    where: { id: storeId, organizationId },
    select: { id: true },
  });
  if (!store || !(await canAccessStore(ctx.memberId, ctx.role, storeId))) {
    throw new Error("この店舗へのアクセス権がありません");
  }
  return { userId: session.user.id, ctx };
}

function errorMessage(e: unknown, fallback: string): string {
  const m = e instanceof Error ? e.message : "";
  if (m.startsWith("FORBIDDEN")) return "この操作の権限がありません";
  return m || fallback;
}

/** 店舗設定: 退勤のときに日報を書かせるか・よく出る商品（専用の経路。通常の店舗編集からは変えない） */
export async function updateDailyReportSettings(
  organizationId: string,
  storeId: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const { userId } = await requireStoreAdmin(organizationId, storeId);
    const parsed = dailyReportSettingsSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "入力を確かめてください" };

    const before = await db.store.findUnique({
      where: { id: storeId },
      select: { requireDailyReport: true, dailyReportProducts: true, dailyReportLocations: true },
    });
    const after = {
      requireDailyReport: parsed.data.requireDailyReport,
      dailyReportProducts: parsed.data.products,
      dailyReportLocations: parsed.data.locations,
    };
    await db.store.update({ where: { id: storeId, organizationId }, data: after });
    await createAuditLog({
      organizationId,
      actorUserId: userId,
      action: "STORE_DAILY_REPORT_SETTINGS_UPDATE",
      targetType: "Store",
      targetId: storeId,
      storeId,
      before,
      after,
    });
    revalidatePath(`/stores/${storeId}`);
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e, "保存できませんでした") };
  }
}

const duplicateChoiceSchema = z.object({
  storeId: z.string().min(1),
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  customerRootId: z.string().min(1),
  choice: z.union([
    z.object({ adoptReportId: z.string().min(1) }),
    z.literal("SEPARATE"),
    z.literal("RESET"),
  ]),
});

/**
 * 重複の疑い（同じ日に2人が同じお客様の売上を書いた）を店長が決める。
 * - adoptReportId: その日報の行を店の売上に数え、ほかは数えない
 * - SEPARATE: 別の会計なので全部数える
 * - RESET: 決めたのを取り消して未確認に戻す
 * 行は消さない。判断と判断した人・日時だけを書く。
 */
export async function decideSaleDuplicate(
  organizationId: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = duplicateChoiceSchema.safeParse(input);
  if (!parsed.success) return { error: "入力が正しくありません" };
  const { storeId, businessDate, customerRootId, choice } = parsed.data;
  try {
    const { userId } = await requireStoreAdmin(organizationId, storeId);

    const rows = await db.dailyReportSale.findMany({
      where: {
        report: { storeId, businessDate },
        OR: [{ customerId: customerRootId }, { customer: { mergedIntoId: customerRootId } }],
      },
      select: { id: true, reportId: true, duplicateDecision: true, amount: true },
    });
    if (new Set(rows.map((r) => r.reportId)).size < 2) {
      return { error: "この組はもう重複ではありません。画面を読み込み直してください" };
    }
    if (
      typeof choice === "object" &&
      !rows.some((r) => r.reportId === choice.adoptReportId)
    ) {
      return { error: "選んだ日報がこの組にありません。画面を読み込み直してください" };
    }

    const now = new Date();
    const decisions =
      choice === "RESET" ? null : decideDuplicateGroup(rows, choice);
    await db.$transaction(
      rows.map((r) =>
        db.dailyReportSale.update({
          where: { id: r.id },
          data: decisions
            ? { duplicateDecision: decisions.get(r.id)!, decidedByUserId: userId, decidedAt: now }
            : { duplicateDecision: null, decidedByUserId: null, decidedAt: null },
        })
      )
    );
    await createAuditLog({
      organizationId,
      actorUserId: userId,
      action: "DAILY_REPORT_DUPLICATE_DECIDE",
      targetType: "Customer",
      targetId: customerRootId,
      storeId,
      before: rows.map((r) => ({ id: r.id, decision: r.duplicateDecision })),
      after: { businessDate, choice },
    });
    revalidatePath("/daily-reports");
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e, "保存できませんでした") };
  }
}

/**
 * 表記ゆれ: source のお客様を target と同じ人としてまとめる。
 * まとめは1段にする（source にまとめられていたお客様も target に付け替える）。行の紐づけは変えない。
 */
export async function mergeCustomers(
  organizationId: string,
  input: { sourceId: string; targetId: string }
): Promise<ActionResult> {
  try {
    const [source, targetRaw] = await Promise.all([
      db.customer.findFirst({ where: { id: input.sourceId, organizationId } }),
      db.customer.findFirst({ where: { id: input.targetId, organizationId } }),
    ]);
    if (!source || !targetRaw) return { error: "お客様が見つかりません" };
    if (source.storeId !== targetRaw.storeId) return { error: "別の店舗のお客様はまとめられません" };
    const { userId } = await requireStoreAdmin(organizationId, source.storeId);

    const targetId = rootCustomerId(targetRaw);
    const sourceRootId = rootCustomerId(source);
    if (targetId === sourceRootId) return { error: "もう同じ人としてまとまっています" };

    const now = new Date();
    // source の代表ごとまとめる（source が別の人にまとめられていたら、その代表とその仲間ごと）
    const moved = await db.customer.updateMany({
      where: {
        storeId: source.storeId,
        OR: [{ id: sourceRootId }, { mergedIntoId: sourceRootId }],
      },
      data: { mergedIntoId: targetId, mergedAt: now, mergedByUserId: userId },
    });
    await createAuditLog({
      organizationId,
      actorUserId: userId,
      action: "CUSTOMER_MERGE",
      targetType: "Customer",
      targetId,
      storeId: source.storeId,
      before: { sourceId: source.id, sourceRootId },
      after: { mergedInto: targetId, moved: moved.count },
    });
    revalidatePath("/daily-reports");
    revalidatePath("/daily-reports/customers");
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e, "まとめられませんでした") };
  }
}

/** まとめたお客様を分ける（その名前だけを独立させる） */
export async function unmergeCustomer(
  organizationId: string,
  input: { customerId: string }
): Promise<ActionResult> {
  try {
    const c = await db.customer.findFirst({ where: { id: input.customerId, organizationId } });
    if (!c) return { error: "お客様が見つかりません" };
    if (!c.mergedIntoId) return { error: "まとめられていません" };
    const { userId } = await requireStoreAdmin(organizationId, c.storeId);
    await db.customer.update({
      where: { id: c.id },
      data: { mergedIntoId: null, mergedAt: null, mergedByUserId: null },
    });
    await createAuditLog({
      organizationId,
      actorUserId: userId,
      action: "CUSTOMER_UNMERGE",
      targetType: "Customer",
      targetId: c.id,
      storeId: c.storeId,
      before: { mergedIntoId: c.mergedIntoId },
      after: { mergedIntoId: null },
    });
    revalidatePath("/daily-reports");
    revalidatePath("/daily-reports/customers");
    return { success: true };
  } catch (e) {
    return { error: errorMessage(e, "分けられませんでした") };
  }
}
