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
