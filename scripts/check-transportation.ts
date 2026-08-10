/**
 * 交通費がCSVに載る値を、本番と同じデータで確かめる（読み取りのみ）
 *
 * CSV出力の route.ts と同じクエリ・同じ計算をなぞる。
 * Decimal から number への変換や、(スタッフ,店舗) の引き当てが
 * 実データで壊れていないかを見るのが目的。
 *
 *   DATABASE_URL=... npx tsx scripts/check-transportation.ts <組織ID> <from> <to>
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  transportationForAttendance,
  type TransportationType,
} from "../src/lib/business/transportation";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const [orgId, from, to] = process.argv.slice(2);
  if (!orgId || !from || !to) {
    console.error("使い方: check-transportation.ts <組織ID> <from> <to>");
    process.exit(1);
  }

  const attendances = await db.attendance.findMany({
    where: { organizationId: orgId, businessDate: { gte: from, lte: to } },
    include: {
      staff: { select: { displayName: true } },
      store: { select: { name: true } },
    },
    orderBy: [{ businessDate: "asc" }, { clockInAt: "asc" }],
  });

  const pairs = [
    ...new Map(attendances.map((a) => [`${a.staffId}:${a.storeId}`, a])).values(),
  ];
  const staffStores = pairs.length
    ? await db.staffStore.findMany({
        where: {
          OR: pairs.map((a) => ({ staffId: a.staffId, storeId: a.storeId })),
        },
        select: {
          staffId: true,
          storeId: true,
          transportationHistories: {
            select: {
              type: true,
              amount: true,
              effectiveFrom: true,
              effectiveTo: true,
            },
          },
        },
      })
    : [];
  const settingsByPair = new Map(
    staffStores.map((ss) => [
      `${ss.staffId}:${ss.storeId}`,
      ss.transportationHistories.map((t) => ({
        type: t.type as TransportationType,
        amount: Number(t.amount),
        effectiveFrom: t.effectiveFrom,
        effectiveTo: t.effectiveTo,
      })),
    ])
  );

  const total = new Map<string, { count: number; yen: number }>();
  for (const a of attendances) {
    const yen = transportationForAttendance(
      settingsByPair.get(`${a.staffId}:${a.storeId}`) ?? [],
      { businessDate: a.businessDate, clockInAt: a.clockInAt }
    );
    console.log(
      [a.businessDate, a.staff.displayName, a.store.name, a.workMinutes, yen].join("\t")
    );
    const key = `${a.staff.displayName} / ${a.store.name}`;
    const t = total.get(key) ?? { count: 0, yen: 0 };
    total.set(key, { count: t.count + 1, yen: t.yen + yen });
  }

  console.log("\n=== スタッフ別 ===");
  for (const [k, v] of total) {
    console.log(`${k}\t出勤${v.count}回\t交通費 ${v.yen.toLocaleString()}円`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
