/**
 * 検証用シード: データローの実店舗構成を入れる
 *
 * 目的は業態版（Vertical）の挙動確認。データローはコンカフェとシーシャを併営しているので、
 *   - 組織全体   … 複数業態なので中立の配色になる
 *   - 星狼/VLL   … 店舗ページはコンカフェ版の配色
 *   - Exhale     … 店舗ページはシーシャ版の配色
 * が一度に確かめられる。
 *
 * 実行:
 *   SEED_OWNER_EMAIL=you@example.com SEED_OWNER_PASSWORD=... npx tsx prisma/seed-dataraw.ts
 *
 * 注意:
 *   - 既存の同名組織があれば中断する（重複作成を防ぐため）
 *   - キャストは仮名を生成する。実名は入れない（検証に不要な個人情報を持ち込まないため）
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";

// 画像を読まない defaults.ts だけを使う（Vertical 本体はLP画像を静的インポートしているため）
import { defaultsForCategory } from "../src/lib/verticals/defaults";
import type { StoreCategory } from "../src/lib/store-category";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  32
);

const ORG_NAME = "合同会社データロー";
const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@dataraw.local";
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? "dataraw1234";

/**
 * 店舗一覧
 *
 * 出所: accounting/config/stores.yml（code / name / business_unit）
 *       ＋ accounting/input/sales/*.csv に出てくるが stores.yml に無い店舗
 *
 * ⚠️ stores.yml は 2026-07 時点で更新が遅れており、名古屋と Exhale が載っていない。
 *    ここでは売上CSVの実績にあわせて補っている。実態と違えば直すこと。
 *    本部（HQ / 管理）は勤怠の対象外なので入れていない。
 */
const STORES: {
  code: string;
  name: string;
  category: StoreCategory;
  /** accounting 側の業態表記（対応を追えるように残す） */
  source: string;
  inStoresYml: boolean;
}[] = [
  { code: "IKB_SEIRO", name: "星狼 池袋", category: "CONCAFE", source: "男装コンカフェ", inStoresYml: true },
  { code: "OSK_SEIRO", name: "星狼 大阪", category: "CONCAFE", source: "男装コンカフェ", inStoresYml: true },
  { code: "NGY_SEIRO", name: "星狼 名古屋", category: "CONCAFE", source: "売上CSVのみ", inStoresYml: false },
  { code: "IKB_VLL", name: "V Liver Lab 池袋", category: "CONCAFE", source: "Vtuberカフェ", inStoresYml: true },
  { code: "OSK_VLL", name: "V Liver Lab 梅田", category: "CONCAFE", source: "Vtuberカフェ", inStoresYml: true },
  { code: "EXHALE", name: "SHISHA Exhale", category: "SHISHA", source: "売上CSVのみ", inStoresYml: false },
  { code: "OSK_STUDIO", name: "studio狼", category: "OTHER", source: "撮影スタジオ", inStoresYml: true },
];

/** 検証用のキャスト。実名は使わない */
const STAFF = [
  { displayName: "あかり", code: "C001", stores: ["IKB_SEIRO"] },
  { displayName: "ゆめ", code: "C002", stores: ["IKB_SEIRO", "IKB_VLL"] },
  { displayName: "りん", code: "C003", stores: ["IKB_SEIRO"] },
  { displayName: "ももか", code: "C004", stores: ["IKB_VLL"] },
  { displayName: "さくら", code: "C005", stores: ["OSK_SEIRO", "OSK_VLL"] },
  { displayName: "ひなた", code: "C006", stores: ["OSK_SEIRO"] },
  { displayName: "みなみ", code: "C007", stores: ["NGY_SEIRO"] },
  // 掛け持ち（コンカフェ × シーシャ）。組織をまたがずに集計できることの確認用
  { displayName: "けんと", code: "S001", stores: ["EXHALE", "IKB_SEIRO"] },
  { displayName: "たくみ", code: "S002", stores: ["EXHALE"] },
  { displayName: "そうた", code: "S003", stores: ["EXHALE"] },
];

async function main() {
  const existing = await prisma.organization.findFirst({
    where: { name: ORG_NAME },
    select: { id: true },
  });
  if (existing) {
    throw new Error(
      `組織「${ORG_NAME}」がすでにあります（${existing.id}）。重複を避けるため中断しました。`
    );
  }

  // ===== オーナーのアカウント =====
  const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 10);
  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    update: {},
    create: {
      name: "データロー 管理者",
      email: OWNER_EMAIL,
      emailVerified: new Date(),
      passwordHash,
    },
  });
  console.log(`オーナー: ${owner.email}`);

  // ===== 組織 =====
  // vertical は獲得経路の記録。実際にはLP経由ではないので、主力業態のコンカフェを入れる。
  // staffTerm は複数業態のため中立語「スタッフ」に寄せる。
  const org = await prisma.organization.create({
    data: {
      name: ORG_NAME,
      timezone: "Asia/Tokyo",
      dayChangeHour: 6,
      dayChangeMinute: 0,
      vertical: "CONCAFE",
      staffTerm: "STAFF",
    },
  });
  await prisma.organizationMember.create({
    data: { organizationId: org.id, userId: owner.id, role: "OWNER" },
  });
  console.log(`組織: ${org.name}`);

  // ===== 店舗・打刻URL・シフトの時間帯 =====
  const storeByCode = new Map<string, string>();
  for (const s of STORES) {
    const defaults = defaultsForCategory(s.category, "concafe");
    const store = await prisma.store.create({
      data: {
        organizationId: org.id,
        name: s.name,
        code: s.code,
        category: s.category,
        timezone: "Asia/Tokyo",
        dayChangeHour: defaults.dayChangeHour,
        dayChangeMinute: 0,
      },
    });
    storeByCode.set(s.code, store.id);

    await prisma.storeClockUrl.create({
      data: { storeId: store.id, token: nanoid() },
    });

    // 業態に合わせた時間帯をコピー投入（本番の店舗作成と同じ扱い）
    await prisma.shiftSlot.createMany({
      data: defaults.slots.map((slot, i) => ({
        organizationId: org.id,
        storeId: store.id,
        name: slot.name,
        startTime: slot.startTime,
        endTime: slot.endTime,
        sortOrder: i,
      })),
    });

    console.log(
      `  店舗: ${s.name} [${s.category}] 時間帯=${defaults.slots
        .map((x) => x.name)
        .join("/")}`
    );
  }

  // ===== スタッフ =====
  const pinHash = await bcrypt.hash("1234", 10);
  for (const p of STAFF) {
    const staff = await prisma.staff.create({
      data: {
        organizationId: org.id,
        displayName: p.displayName,
        employeeCode: p.code,
        status: "ACTIVE",
        hireDate: new Date("2025-04-01"),
      },
    });
    for (const [i, code] of p.stores.entries()) {
      const storeId = storeByCode.get(code);
      if (!storeId) continue;
      await prisma.staffStore.create({
        data: {
          staffId: staff.id,
          storeId,
          isPrimary: i === 0,
          pinHash,
          startDate: new Date("2025-04-01"),
        },
      });
    }
  }
  console.log(`スタッフ: ${STAFF.length}名（PINはすべて 1234）`);

  console.log("\n--- 確認できること ---");
  console.log("組織全体の配色 : 中立（コンカフェとシーシャの併営のため）");
  console.log("星狼/VLL の店舗ページ : コンカフェ版の配色");
  console.log("SHISHA Exhale の店舗ページ : シーシャ版の配色");
  console.log("studio狼 の店舗ページ : 版を持たない業態なので組織の配色（中立）");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
