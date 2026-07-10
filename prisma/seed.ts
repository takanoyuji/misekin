import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";

const prisma = new PrismaClient();

const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  32
);

// JST → UTC 変換: JST は UTC+9
function jstToUtc(dateStr: string, hour: number, minute = 0): Date {
  // dateStr: "YYYY-MM-DD", hour: JST 時刻
  const [year, month, day] = dateStr.split("-").map(Number);
  // JST - 9h = UTC
  const utcHour = hour - 9;
  const d = new Date(Date.UTC(year, month - 1, day, utcHour, minute, 0, 0));
  return d;
}

// 過去 N 日の営業日 (YYYY-MM-DD) を返す (今日含む)
function pastDates(n: number): string[] {
  const dates: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    // JST での日付 (dayChangeHour=6 なので、JST 0〜6 時は前日扱いだが、シードでは簡略化して UTC 日付をそのまま使用)
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
}

// 今日の JST 日付文字列
function todayJst(): string {
  const now = new Date();
  // UTC + 9h
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = jst.getUTCFullYear();
  const month = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const day = String(jst.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function main() {
  console.log("シードデータを投入中...");

  // ===== クリーンアップ =====
  // 外部キー制約の順番に注意して削除
  await prisma.apiAccessLog.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.correctionRequest.deleteMany();
  await prisma.attendanceCorrection.deleteMany();
  await prisma.attendanceEvent.deleteMany();
  await prisma.break.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.closingPeriod.deleteMany();
  await prisma.wageHistory.deleteMany();
  await prisma.transportationHistory.deleteMany();
  await prisma.staffStore.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.storeClockUrl.deleteMany();
  await prisma.storeAdmin.deleteMany();
  await prisma.store.deleteMany();
  await prisma.organizationMember.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log("既存データを削除しました");

  // ===== ユーザー =====
  const passwordHash = await bcrypt.hash("password123", 12);

  const adminUser = await prisma.user.create({
    data: {
      name: "テスト管理者",
      email: "admin@example.com",
      emailVerified: new Date(),
      passwordHash,
    },
  });

  console.log(`ユーザー作成: ${adminUser.email}`);

  // ===== 組織 =====
  const organization = await prisma.organization.create({
    data: {
      name: "コンカフェ テスト",
      timezone: "Asia/Tokyo",
      dayChangeHour: 6,
      dayChangeMinute: 0,
      isActive: true,
    },
  });

  console.log(`組織作成: ${organization.name}`);

  // ===== 組織メンバー =====
  const orgMember = await prisma.organizationMember.create({
    data: {
      organizationId: organization.id,
      userId: adminUser.id,
      role: "OWNER",
      isActive: true,
    },
  });

  // ===== 店舗 =====
  const storeData = [
    { name: "新宿店", code: "SHINJUKU", address: "東京都新宿区歌舞伎町1-1-1" },
    { name: "渋谷店", code: "SHIBUYA", address: "東京都渋谷区道玄坂2-2-2" },
    { name: "池袋店", code: "IKEBUKURO", address: "東京都豊島区東池袋3-3-3" },
  ];

  const stores = await Promise.all(
    storeData.map((s) =>
      prisma.store.create({
        data: {
          organizationId: organization.id,
          name: s.name,
          code: s.code,
          address: s.address,
          timezone: "Asia/Tokyo",
          dayChangeHour: 6,
          dayChangeMinute: 0,
          isActive: true,
        },
      })
    )
  );

  console.log(`店舗作成: ${stores.map((s) => s.name).join(", ")}`);

  const [shinjuku, shibuya, ikebukuro] = stores;

  // ===== StoreClockUrl =====
  await Promise.all(
    stores.map((store) =>
      prisma.storeClockUrl.create({
        data: {
          storeId: store.id,
          token: nanoid(),
          isActive: true,
        },
      })
    )
  );

  console.log("打刻URL作成完了");

  // ===== スタッフ =====
  const pinHash = await bcrypt.hash("1234", 10);

  const staffData = [
    { displayName: "佐藤 花子", email: "hanako@example.com", employeeCode: "S001" },
    { displayName: "田中 美咲", email: "misaki@example.com", employeeCode: "S002" },
    { displayName: "鈴木 愛", email: "ai@example.com", employeeCode: "S003" },
    { displayName: "伊藤 優花", email: "yuka@example.com", employeeCode: "S004" },
    { displayName: "渡辺 さくら", email: "sakura@example.com", employeeCode: "S005" },
    { displayName: "小林 麻衣", email: "mai@example.com", employeeCode: "S006" },
    { displayName: "加藤 莉子", email: "riko@example.com", employeeCode: "S007" },
    { displayName: "吉田 ひなた", email: "hinata@example.com", employeeCode: "S008" },
    { displayName: "山田 のの", email: "nono@example.com", employeeCode: "S009" },
    { displayName: "中村 れな", email: "rena@example.com", employeeCode: "S010" },
  ];

  const staffMembers = await Promise.all(
    staffData.map((s) =>
      prisma.staff.create({
        data: {
          organizationId: organization.id,
          displayName: s.displayName,
          email: s.email,
          employeeCode: s.employeeCode,
          status: "ACTIVE",
          hireDate: new Date("2024-01-01"),
        },
      })
    )
  );

  console.log(`スタッフ作成: ${staffMembers.length}名`);

  const [hanako, misaki, ai, yuka, sakura, mai, riko, hinata, nono, rena] = staffMembers;

  // ===== StaffStore 割り当て =====
  // 新宿店: 花子(primary)、美咲(primary)、愛(primary)、優花(primary)、さくら
  // 渋谷店: さくら(primary)、麻衣(primary)、莉子(primary)、ひなた(primary)
  // 池袋店: ひなた、のの(primary)、れな(primary)、花子、美咲
  const staffStoreAssignments: Array<{
    staffId: string;
    storeId: string;
    isPrimary: boolean;
  }> = [
    // 新宿店
    { staffId: hanako.id, storeId: shinjuku.id, isPrimary: true },
    { staffId: misaki.id, storeId: shinjuku.id, isPrimary: true },
    { staffId: ai.id, storeId: shinjuku.id, isPrimary: true },
    { staffId: yuka.id, storeId: shinjuku.id, isPrimary: true },
    { staffId: sakura.id, storeId: shinjuku.id, isPrimary: false },
    // 渋谷店
    { staffId: sakura.id, storeId: shibuya.id, isPrimary: true },
    { staffId: mai.id, storeId: shibuya.id, isPrimary: true },
    { staffId: riko.id, storeId: shibuya.id, isPrimary: true },
    { staffId: hinata.id, storeId: shibuya.id, isPrimary: true },
    // 池袋店
    { staffId: hinata.id, storeId: ikebukuro.id, isPrimary: false },
    { staffId: nono.id, storeId: ikebukuro.id, isPrimary: true },
    { staffId: rena.id, storeId: ikebukuro.id, isPrimary: true },
    { staffId: hanako.id, storeId: ikebukuro.id, isPrimary: false },
    { staffId: misaki.id, storeId: ikebukuro.id, isPrimary: false },
  ];

  const createdStaffStores = await Promise.all(
    staffStoreAssignments.map((a) =>
      prisma.staffStore.create({
        data: {
          staffId: a.staffId,
          storeId: a.storeId,
          isPrimary: a.isPrimary,
          pinHash,
          canClock: true,
          isActive: true,
          startDate: new Date("2024-01-01"),
        },
      })
    )
  );

  console.log(`StaffStore作成: ${createdStaffStores.length}件`);

  // ===== WageHistory =====
  await Promise.all(
    createdStaffStores.map((ss) =>
      prisma.wageHistory.create({
        data: {
          staffStoreId: ss.id,
          amount: 1100,
          effectiveFrom: new Date("2024-01-01"),
          createdByUserId: adminUser.id,
          reason: "初期設定",
        },
      })
    )
  );

  console.log("賃金履歴作成完了");

  // ===== 勤怠データ (過去7日間) =====
  const dates = pastDates(7);
  const today = todayJst();

  // 各店舗の担当スタッフ
  const storeStaffMap: Record<string, string[]> = {
    [shinjuku.id]: [hanako.id, misaki.id, ai.id, yuka.id],
    [shibuya.id]: [sakura.id, mai.id, riko.id, hinata.id],
    [ikebukuro.id]: [nono.id, rena.id, hanako.id, misaki.id],
  };

  // シフトパターン (JST)
  const shiftPatterns = [
    { clockInHour: 17, clockOutHour: 23, breakMinutes: 30 },
    { clockInHour: 18, clockOutHour: 24, breakMinutes: 30 },
    { clockInHour: 17, clockOutHour: 25, breakMinutes: 60 }, // 25 = 翌01:00 JST
    { clockInHour: 19, clockOutHour: 24, breakMinutes: 30 },
  ];

  let attendanceCount = 0;

  for (const store of stores) {
    const staffIds = storeStaffMap[store.id];

    for (const dateStr of dates) {
      const isToday = dateStr === today;
      // 各日3〜4名が勤務 (インデックスで選択)
      const dayIndex = dates.indexOf(dateStr);
      // 4人全員の日と3人の日を交互に
      const workingCount = dayIndex % 3 === 0 ? 3 : 4;
      const workingStaff = staffIds.slice(0, workingCount);

      for (let i = 0; i < workingStaff.length; i++) {
        const staffId = workingStaff[i];
        const pattern = shiftPatterns[i % shiftPatterns.length];

        const clockInAt = jstToUtc(dateStr, pattern.clockInHour);

        // 深夜跨ぎ対応: clockOutHour が 24 以上の場合は翌日
        let clockOutDateStr = dateStr;
        let clockOutHour = pattern.clockOutHour;
        if (clockOutHour >= 24) {
          // 翌日の日付
          const nextDay = new Date(clockInAt);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          const ny = nextDay.getUTCFullYear();
          const nm = String(nextDay.getUTCMonth() + 1).padStart(2, "0");
          const nd = String(nextDay.getUTCDate()).padStart(2, "0");
          clockOutDateStr = `${ny}-${nm}-${nd}`;
          clockOutHour = clockOutHour - 24;
        }
        const clockOutAt = jstToUtc(clockOutDateStr, clockOutHour);

        const workMinutes =
          Math.round((clockOutAt.getTime() - clockInAt.getTime()) / 60000) - pattern.breakMinutes;

        // 今日の一部を IN_PROGRESS に
        const isInProgress = isToday && i === 0;
        const status = isInProgress ? "IN_PROGRESS" : "COMPLETED";

        // 異常フラグ (長時間シフトのケース)
        const hasAnomaly = workMinutes > 420; // 7時間超
        const anomalyReasons: string[] = hasAnomaly ? ["LONG_SHIFT"] : [];

        try {
          await prisma.attendance.create({
            data: {
              organizationId: organization.id,
              storeId: store.id,
              staffId,
              businessDate: dateStr,
              clockInAt,
              clockOutAt: isInProgress ? null : clockOutAt,
              breakMinutes: isInProgress ? 0 : pattern.breakMinutes,
              workMinutes: isInProgress ? null : workMinutes,
              status: status as any,
              hasAnomaly,
              anomalyReasons,
              isLocked: false,
            },
          });
          attendanceCount++;
        } catch (e) {
          // unique constraint エラーなどをスキップ
          console.warn(`勤怠スキップ: ${store.name} ${dateStr} staffId=${staffId}`);
        }
      }
    }
  }

  console.log(`勤怠データ作成: ${attendanceCount}件`);

  // ===== APIキー (テスト用) =====
  const { generateApiKey } = await import("../src/lib/api/api-key");
  const { rawKey, keyPrefix, keyHash } = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      organizationId: organization.id,
      name: "テスト用APIキー (全店舗)",
      description: "開発・テスト用のAPIキー。全店舗にアクセス可能。",
      keyPrefix,
      keyHash,
      isReadOnly: true,
      storeScope: null,
      isActive: true,
      createdByUserId: adminUser.id,
    },
  });

  console.log("\n===== シードデータ投入完了 =====");
  console.log(`組織: ${organization.name} (ID: ${organization.id})`);
  console.log(`管理者: admin@example.com / password123`);
  console.log(`店舗: 新宿店, 渋谷店, 池袋店`);
  console.log(`スタッフ: 10名 (PIN: 1234)`);
  console.log(`勤怠データ: 過去7日間 (${attendanceCount}件)`);
  console.log(`\nテスト用APIキー: ${rawKey}`);
  console.log("(このキーは再表示されません。安全な場所に保管してください)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
