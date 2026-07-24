-- 既存DBに差分だけを適用するためのファイル
--
-- schema.sql は「DBが未初期化のとき」だけ流れる (Dockerfile の CMD を参照)。
-- 既に初期化済みのDBには、このファイルだけを毎回流して差分を反映する。
-- そのため、ここに書く文はすべて冪等 (何度実行しても安全) であること。
--   例: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS
--       ADD VALUE IF NOT EXISTS / DO $$ ... EXCEPTION WHEN duplicate_object $$
--
-- スキーマを変更したら schema.sql と両方に追記すること。

-- MakeEmailOptional
ALTER TABLE "staff" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "staff_stores" ADD COLUMN IF NOT EXISTS "requirePin" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "attendances" ADD COLUMN IF NOT EXISTS "clockOutMemo" TEXT;

-- AddMemberRole: スタッフ本人用のロール（既存DBへの追加。既存データは変わらない）
ALTER TYPE "OrganizationRole" ADD VALUE IF NOT EXISTS 'MEMBER';

-- CreateTable: 交通費の変更申請
CREATE TABLE IF NOT EXISTS "transportation_change_requests" (
    "id" TEXT NOT NULL,
    "staffStoreId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "status" "CorrectionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "currentType" "TransportationType",
    "currentAmount" DECIMAL(10,2),
    "requestedType" "TransportationType" NOT NULL,
    "requestedAmount" DECIMAL(10,2) NOT NULL,
    "requestedLimit" DECIMAL(10,2),
    "reason" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transportation_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "transportation_change_requests_status_idx" ON "transportation_change_requests"("status");
CREATE INDEX IF NOT EXISTS "transportation_change_requests_staffStoreId_idx" ON "transportation_change_requests"("staffStoreId");

DO $$ BEGIN
    ALTER TABLE "transportation_change_requests" ADD CONSTRAINT "transportation_change_requests_staffStoreId_fkey" FOREIGN KEY ("staffStoreId") REFERENCES "staff_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "transportation_change_requests" ADD CONSTRAINT "transportation_change_requests_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "transportation_change_requests" ADD CONSTRAINT "transportation_change_requests_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AllowMissingAttendanceRequest: 打刻の付け忘れ(勤怠レコードが無い日)も修正申請で扱えるようにする
ALTER TABLE "correction_requests" ALTER COLUMN "attendanceId" DROP NOT NULL;
ALTER TABLE "correction_requests" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "correction_requests" ADD COLUMN IF NOT EXISTS "businessDate" TEXT;

DO $$ BEGIN
    ALTER TABLE "correction_requests" ADD CONSTRAINT "correction_requests_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ShiftManagement: シフト管理（第1段階: 希望収集・必要人数・確定シフト）
DO $$ BEGIN
    CREATE TYPE "AvailabilityType" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'PREFERRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "ShiftStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "shift_availabilities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "type" "AvailabilityType" NOT NULL DEFAULT 'AVAILABLE',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_availabilities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shift_availabilities_staffId_storeId_businessDate_key" ON "shift_availabilities"("staffId", "storeId", "businessDate");
CREATE INDEX IF NOT EXISTS "shift_availabilities_storeId_businessDate_idx" ON "shift_availabilities"("storeId", "businessDate");

CREATE TABLE IF NOT EXISTS "shift_requirements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "requiredCount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_requirements_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "shift_requirements_storeId_businessDate_key" ON "shift_requirements"("storeId", "businessDate");
CREATE INDEX IF NOT EXISTS "shift_requirements_storeId_businessDate_idx" ON "shift_requirements"("storeId", "businessDate");

CREATE TABLE IF NOT EXISTS "shifts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'DRAFT',
    "note" TEXT,
    "publishedAt" TIMESTAMP(3),
    "revisionCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shifts_storeId_businessDate_idx" ON "shifts"("storeId", "businessDate");
CREATE INDEX IF NOT EXISTS "shifts_staffId_businessDate_idx" ON "shifts"("staffId", "businessDate");
CREATE INDEX IF NOT EXISTS "shifts_organizationId_status_idx" ON "shifts"("organizationId", "status");

DO $$ BEGIN
    ALTER TABLE "shift_availabilities" ADD CONSTRAINT "shift_availabilities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "shift_availabilities" ADD CONSTRAINT "shift_availabilities_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "shift_availabilities" ADD CONSTRAINT "shift_availabilities_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "shift_requirements" ADD CONSTRAINT "shift_requirements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "shift_requirements" ADD CONSTRAINT "shift_requirements_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ShiftRules: シフト作成ルール（Claude翻訳器が生成する構造化ルール）
DO $$ BEGIN
    CREATE TYPE "ShiftRuleWeight" AS ENUM ('HARD', 'SOFT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "shift_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "weight" "ShiftRuleWeight" NOT NULL DEFAULT 'SOFT',
    "params" JSONB NOT NULL DEFAULT '{}',
    "sourceText" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shift_rules_storeId_enabled_idx" ON "shift_rules"("storeId", "enabled");

DO $$ BEGIN
    ALTER TABLE "shift_rules" ADD CONSTRAINT "shift_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "shift_rules" ADD CONSTRAINT "shift_rules_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "shift_rules" ADD CONSTRAINT "shift_rules_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ShiftPeriod: 店舗ごとのシフト希望提出期間設定（既定は月次・1日区切り）
DO $$ BEGIN
    CREATE TYPE "ShiftPeriodUnit" AS ENUM ('MONTHLY', 'WEEKLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "shiftPeriodUnit" "ShiftPeriodUnit" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "shiftPeriodStartDay" INTEGER NOT NULL DEFAULT 1;

-- StoreCategory: 店舗の業態カテゴリ
DO $$ BEGIN
    CREATE TYPE "StoreCategory" AS ENUM ('CONCAFE','MAID_CAFE','GIRLS_BAR','CABARET','CLUB_LOUNGE','SNACK','BAR','SHISHA','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "category" "StoreCategory" NOT NULL DEFAULT 'OTHER';

-- ShiftSlot: シフト時間帯（早番・遅番など）
CREATE TABLE IF NOT EXISTS "shift_slots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shift_slots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "shift_slots_storeId_isActive_idx" ON "shift_slots"("storeId", "isActive");
DO $$ BEGIN
    ALTER TABLE "shift_slots" ADD CONSTRAINT "shift_slots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "shift_slots" ADD CONSTRAINT "shift_slots_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 既存の各店舗に既定の時間帯を1つ作る（未作成時のみ）
INSERT INTO "shift_slots" ("id", "organizationId", "storeId", "name", "startTime", "endTime", "sortOrder", "updatedAt")
SELECT md5(random()::text || s.id), s."organizationId", s.id, '通常', '18:00', '24:00', 0, now()
FROM "stores" s
WHERE NOT EXISTS (SELECT 1 FROM "shift_slots" ss WHERE ss."storeId" = s.id);

-- slotId カラムを追加（まず nullable）
ALTER TABLE "shift_availabilities" ADD COLUMN IF NOT EXISTS "slotId" TEXT;
ALTER TABLE "shift_requirements" ADD COLUMN IF NOT EXISTS "slotId" TEXT;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "slotId" TEXT;

-- 既存行を店舗の既定時間帯にひも付け
UPDATE "shift_availabilities" a SET "slotId" = (SELECT ss.id FROM "shift_slots" ss WHERE ss."storeId" = a."storeId" ORDER BY ss."sortOrder" LIMIT 1) WHERE a."slotId" IS NULL;
UPDATE "shift_requirements" r SET "slotId" = (SELECT ss.id FROM "shift_slots" ss WHERE ss."storeId" = r."storeId" ORDER BY ss."sortOrder" LIMIT 1) WHERE r."slotId" IS NULL;
UPDATE "shifts" sh SET "slotId" = (SELECT ss.id FROM "shift_slots" ss WHERE ss."storeId" = sh."storeId" ORDER BY ss."sortOrder" LIMIT 1) WHERE sh."slotId" IS NULL;

-- availability / requirement は slotId 必須に。unique を張り替え。
ALTER TABLE "shift_availabilities" ALTER COLUMN "slotId" SET NOT NULL;
ALTER TABLE "shift_requirements" ALTER COLUMN "slotId" SET NOT NULL;

DROP INDEX IF EXISTS "shift_availabilities_staffId_storeId_businessDate_key";
CREATE UNIQUE INDEX IF NOT EXISTS "shift_availabilities_staffId_storeId_businessDate_slotId_key" ON "shift_availabilities"("staffId", "storeId", "businessDate", "slotId");
DROP INDEX IF EXISTS "shift_requirements_storeId_businessDate_key";
CREATE UNIQUE INDEX IF NOT EXISTS "shift_requirements_storeId_businessDate_slotId_key" ON "shift_requirements"("storeId", "businessDate", "slotId");

-- 外部キー
DO $$ BEGIN
    ALTER TABLE "shift_availabilities" ADD CONSTRAINT "shift_availabilities_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "shift_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "shift_requirements" ADD CONSTRAINT "shift_requirements_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "shift_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER TABLE "shifts" ADD CONSTRAINT "shifts_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "shift_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
