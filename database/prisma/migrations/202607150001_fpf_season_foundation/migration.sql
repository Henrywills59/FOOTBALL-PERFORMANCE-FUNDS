DO $$ BEGIN
  CREATE TYPE "FpfSeasonStatus" AS ENUM ('REGISTRATION', 'ACTIVE', 'SETTLEMENT', 'CLOSING', 'NEXT_REGISTRATION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ParticipationPlanCode" AS ENUM ('HALF_SEASON', 'FULL_SEASON', 'REMAINING_SEASON');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ParticipationAgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SETTLEMENT', 'COMPLETED', 'RENEWAL_OPEN', 'EXPIRED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FinancialConstitutionAllocationType" AS ENUM (
    'PERFORMANCE_PARTNER_DISTRIBUTION_POOL',
    'ANALYST_PERFORMANCE_POOL',
    'RISK_STABILITY_RESERVE',
    'COMPANY_GROWTH_OPERATIONS_FUND'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

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
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fpf_seasons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fpf_seasons_name_key" ON "fpf_seasons"("name");
CREATE INDEX IF NOT EXISTS "fpf_seasons_status_idx" ON "fpf_seasons"("status");
CREATE INDEX IF NOT EXISTS "fpf_seasons_seasonStartsAt_seasonEndsAt_idx" ON "fpf_seasons"("seasonStartsAt", "seasonEndsAt");

CREATE TABLE IF NOT EXISTS "performance_partner_participations" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "planCode" "ParticipationPlanCode" NOT NULL,
  "status" "ParticipationAgreementStatus" NOT NULL DEFAULT 'DRAFT',
  "participationAmountCents" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "remainingWeeks" INTEGER NOT NULL DEFAULT 0,
  "remainingDistributions" INTEGER NOT NULL DEFAULT 0,
  "noRetroactiveDistribution" BOOLEAN NOT NULL DEFAULT true,
  "contractualPayoutNotice" TEXT NOT NULL DEFAULT 'The contractual payout represents the complete financial obligation under the participation agreement. No additional capital repayment is due after completion.',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "performance_partner_participations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "performance_partner_participations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "performance_partner_participations_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "fpf_seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "performance_partner_participations_userId_idx" ON "performance_partner_participations"("userId");
CREATE INDEX IF NOT EXISTS "performance_partner_participations_seasonId_idx" ON "performance_partner_participations"("seasonId");
CREATE INDEX IF NOT EXISTS "performance_partner_participations_status_idx" ON "performance_partner_participations"("status");
CREATE INDEX IF NOT EXISTS "performance_partner_participations_expiresAt_idx" ON "performance_partner_participations"("expiresAt");

CREATE TABLE IF NOT EXISTS "season_financial_constitution" (
  "id" TEXT NOT NULL,
  "seasonId" TEXT NOT NULL,
  "allocationType" "FinancialConstitutionAllocationType" NOT NULL,
  "label" TEXT NOT NULL,
  "percent" DOUBLE PRECISION NOT NULL,
  "distributable" BOOLEAN NOT NULL DEFAULT false,
  "purpose" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "season_financial_constitution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "season_financial_constitution_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "fpf_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "season_financial_constitution_seasonId_allocationType_key" ON "season_financial_constitution"("seasonId", "allocationType");
CREATE INDEX IF NOT EXISTS "season_financial_constitution_seasonId_idx" ON "season_financial_constitution"("seasonId");
