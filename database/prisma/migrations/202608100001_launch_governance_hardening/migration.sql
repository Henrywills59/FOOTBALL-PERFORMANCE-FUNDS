DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FpfSeasonStatus') THEN
    CREATE TYPE "FpfSeasonStatus" AS ENUM (
      'REGISTRATION',
      'ACTIVE',
      'SETTLEMENT',
      'CLOSING',
      'NEXT_REGISTRATION'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "fpf_seasons" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "FpfSeasonStatus" NOT NULL DEFAULT 'REGISTRATION',
  "registrationOpensAt" TIMESTAMP(3) NOT NULL,
  "seasonStartsAt" TIMESTAMP(3) NOT NULL,
  "seasonEndsAt" TIMESTAMP(3) NOT NULL,
  "settlementStartsAt" TIMESTAMP(3) NOT NULL,
  "closingStartsAt" TIMESTAMP(3) NOT NULL,
  "nextRegistrationOpensAt" TIMESTAMP(3),
  "totalWeeks" INTEGER NOT NULL DEFAULT 38,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fpf_seasons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fpf_seasons_name_key" ON "fpf_seasons"("name");
CREATE INDEX IF NOT EXISTS "fpf_seasons_status_idx" ON "fpf_seasons"("status");
CREATE INDEX IF NOT EXISTS "fpf_seasons_seasonStartsAt_seasonEndsAt_idx"
ON "fpf_seasons"("seasonStartsAt", "seasonEndsAt");

ALTER TABLE "fpf_seasons"
  ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "applicationsOpen" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "depositsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "complianceApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "legalApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "publicLaunchApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "activePlanApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "investorTermsApproved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "capacityLimitCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "capacityUsedCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "governanceUpdatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "governanceUpdatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "fpf_seasons_isPublic_idx" ON "fpf_seasons"("isPublic");
CREATE INDEX IF NOT EXISTS "fpf_seasons_depositsEnabled_idx" ON "fpf_seasons"("depositsEnabled");

CREATE UNIQUE INDEX IF NOT EXISTS "treasury_ledger_payment_order_classification_unique"
ON "treasury_ledger"("referenceType", "referenceId", "classification")
WHERE "referenceType" = 'PAYMENT_ORDER' AND "referenceId" IS NOT NULL;
