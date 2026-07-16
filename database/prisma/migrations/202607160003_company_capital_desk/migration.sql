ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CEO';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FINANCE';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'RISK_MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CAPITAL_MANAGER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMINISTRATOR';

CREATE TABLE IF NOT EXISTS "company_capital_portfolios" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
  "openingBalanceCents" INTEGER NOT NULL DEFAULT 0,
  "availableCapitalCents" INTEGER NOT NULL DEFAULT 0,
  "allocatedCapitalCents" INTEGER NOT NULL DEFAULT 0,
  "exposureCents" INTEGER NOT NULL DEFAULT 0,
  "settledProfitCents" INTEGER NOT NULL DEFAULT 0,
  "settledLossCents" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_capital_portfolios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "company_capital_allocations" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "portfolioId" TEXT NOT NULL,
  "candidateId" TEXT,
  "fixtureId" TEXT,
  "matchLabel" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "selection" TEXT NOT NULL,
  "recommendedStakeCents" INTEGER NOT NULL DEFAULT 0,
  "approvedStakeCents" INTEGER NOT NULL DEFAULT 0,
  "maxStakeCents" INTEGER NOT NULL DEFAULT 0,
  "odds" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "riskGrade" TEXT NOT NULL DEFAULT 'MEDIUM',
  "exposureCents" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "analystApprovalStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "intelligenceStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "rationale" TEXT,
  "createdBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "rejectedBy" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_capital_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "company_capital_stakes" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "allocationId" TEXT NOT NULL,
  "stakeCents" INTEGER NOT NULL DEFAULT 0,
  "odds" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "bookmaker" TEXT NOT NULL DEFAULT 'Manual execution placeholder',
  "reference" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING_PLACEMENT',
  "placedBy" TEXT,
  "placedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_capital_stakes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "company_capital_settlements" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "allocationId" TEXT NOT NULL,
  "stakeId" TEXT,
  "outcome" TEXT NOT NULL,
  "grossReturnCents" INTEGER NOT NULL DEFAULT 0,
  "profitCents" INTEGER NOT NULL DEFAULT 0,
  "lossCents" INTEGER NOT NULL DEFAULT 0,
  "netResultCents" INTEGER NOT NULL DEFAULT 0,
  "settlementStatus" TEXT NOT NULL DEFAULT 'RECORDED',
  "settledBy" TEXT NOT NULL,
  "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  CONSTRAINT "company_capital_settlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "company_capital_risk_events" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "allocationId" TEXT,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "message" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "company_capital_risk_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "company_capital_reports" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "periodType" TEXT NOT NULL,
  "periodLabel" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metrics" JSONB NOT NULL DEFAULT '{}',
  "generatedBy" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_capital_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "company_capital_audit_records" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "beforeState" JSONB,
  "afterState" JSONB,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_capital_audit_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "company_capital_portfolios_status_idx" ON "company_capital_portfolios"("status");
CREATE INDEX IF NOT EXISTS "company_capital_allocations_portfolioId_idx" ON "company_capital_allocations"("portfolioId");
CREATE INDEX IF NOT EXISTS "company_capital_allocations_candidateId_idx" ON "company_capital_allocations"("candidateId");
CREATE INDEX IF NOT EXISTS "company_capital_allocations_fixtureId_idx" ON "company_capital_allocations"("fixtureId");
CREATE INDEX IF NOT EXISTS "company_capital_allocations_status_idx" ON "company_capital_allocations"("status");
CREATE INDEX IF NOT EXISTS "company_capital_allocations_approvalStatus_idx" ON "company_capital_allocations"("approvalStatus");
CREATE INDEX IF NOT EXISTS "company_capital_stakes_allocationId_idx" ON "company_capital_stakes"("allocationId");
CREATE INDEX IF NOT EXISTS "company_capital_stakes_status_idx" ON "company_capital_stakes"("status");
CREATE INDEX IF NOT EXISTS "company_capital_settlements_allocationId_idx" ON "company_capital_settlements"("allocationId");
CREATE INDEX IF NOT EXISTS "company_capital_settlements_stakeId_idx" ON "company_capital_settlements"("stakeId");
CREATE INDEX IF NOT EXISTS "company_capital_risk_events_allocationId_idx" ON "company_capital_risk_events"("allocationId");
CREATE INDEX IF NOT EXISTS "company_capital_risk_events_severity_idx" ON "company_capital_risk_events"("severity");
CREATE INDEX IF NOT EXISTS "company_capital_risk_events_status_idx" ON "company_capital_risk_events"("status");
CREATE INDEX IF NOT EXISTS "company_capital_reports_periodType_periodLabel_idx" ON "company_capital_reports"("periodType", "periodLabel");
CREATE INDEX IF NOT EXISTS "company_capital_audit_records_actorUserId_idx" ON "company_capital_audit_records"("actorUserId");
CREATE INDEX IF NOT EXISTS "company_capital_audit_records_action_idx" ON "company_capital_audit_records"("action");
CREATE INDEX IF NOT EXISTS "company_capital_audit_records_createdAt_idx" ON "company_capital_audit_records"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'company_capital_allocations_portfolioId_fkey'
  ) THEN
    ALTER TABLE "company_capital_allocations"
      ADD CONSTRAINT "company_capital_allocations_portfolioId_fkey"
      FOREIGN KEY ("portfolioId") REFERENCES "company_capital_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'company_capital_stakes_allocationId_fkey'
  ) THEN
    ALTER TABLE "company_capital_stakes"
      ADD CONSTRAINT "company_capital_stakes_allocationId_fkey"
      FOREIGN KEY ("allocationId") REFERENCES "company_capital_allocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'company_capital_settlements_allocationId_fkey'
  ) THEN
    ALTER TABLE "company_capital_settlements"
      ADD CONSTRAINT "company_capital_settlements_allocationId_fkey"
      FOREIGN KEY ("allocationId") REFERENCES "company_capital_allocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'company_capital_settlements_stakeId_fkey'
  ) THEN
    ALTER TABLE "company_capital_settlements"
      ADD CONSTRAINT "company_capital_settlements_stakeId_fkey"
      FOREIGN KEY ("stakeId") REFERENCES "company_capital_stakes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'company_capital_risk_events_allocationId_fkey'
  ) THEN
    ALTER TABLE "company_capital_risk_events"
      ADD CONSTRAINT "company_capital_risk_events_allocationId_fkey"
      FOREIGN KEY ("allocationId") REFERENCES "company_capital_allocations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
