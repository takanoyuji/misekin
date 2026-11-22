import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { normalizeCustomerName } from "@/lib/business/daily-report";
import type { DailyReportInput } from "@/lib/validations/daily-report";

type Tx = Prisma.TransactionClient;

/**
 * お客様名からお客様IDを引く。照合キーが同じお客様がいなければ作る。
 * 返すのは書かれた名前に対応するお客様のID（まとめた先ではない。まとめ直しても行の紐づけは変わらない）。
 *
 * 打刻のトランザクションの外で呼ぶ。同時に同じ名前が来たときの一意制約違反は1回だけ読み直す。
 * 打刻が失敗してお客様だけ残っても、名前の台帳が1件増えるだけで害はない。
 */
export async function findOrCreateCustomers(
  organizationId: string,
  storeId: string,
  names: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const byKey = new Map<string, string>();
  for (const n of names) {
    const key = normalizeCustomerName(n);
    if (!byKey.has(key)) byKey.set(key, n.trim());
  }
  for (const [normalizedName, name] of byKey) {
    let customer = await db.customer.findUnique({
      where: { storeId_normalizedName: { storeId, normalizedName } },
      select: { id: true },
    });
    if (!customer) {
      try {
        customer = await db.customer.create({
          data: { organizationId, storeId, name, normalizedName },
          select: { id: true },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          customer = await db.customer.findUniqueOrThrow({
            where: { storeId_normalizedName: { storeId, normalizedName } },
            select: { id: true },
          });
        } else {
          throw e;
        }
      }
    }
    out.set(normalizedName, customer.id);
  }
  // 呼び出し側は書かれた名前で引けるようにする
  const result = new Map<string, string>();
  for (const n of names) result.set(n, out.get(normalizeCustomerName(n))!);
  return result;
}

/** 退勤のトランザクションの中で日報を保存する */
export async function createDailyReportInTx(
  tx: Tx,
  params: {
    organizationId: string;
    storeId: string;
    staffId: string;
    attendanceId: string;
    businessDate: string;
    submittedAt: Date;
    input: DailyReportInput;
    customerIds: Map<string, string>;
  }
): Promise<string> {
  const { input, customerIds } = params;
  const report = await tx.dailyReport.create({
    data: {
      organizationId: params.organizationId,
      storeId: params.storeId,
      staffId: params.staffId,
      attendanceId: params.attendanceId,
      businessDate: params.businessDate,
      noSales: input.noSales,
      submittedAt: params.submittedAt,
      sales: {
        create: input.sales.map((s, i) => ({
          customerId: customerIds.get(s.customerName)!,
          customerName: s.customerName.trim(),
          amount: s.amount,
          sortOrder: i,
        })),
      },
      backItems: {
        create: input.backItems.map((b, i) => ({
          productName: b.productName.trim(),
          unitPrice: b.unitPrice,
          quantity: b.quantity,
          sortOrder: i,
        })),
      },
    },
    select: { id: true },
  });
  return report.id;
}

/** お客様IDから代表（まとめた先）のIDを引く。まとめは1段にしているので1回辿れば足りる */
export function rootCustomerId(c: { id: string; mergedIntoId: string | null }): string {
  return c.mergedIntoId ?? c.id;
}
