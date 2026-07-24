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
