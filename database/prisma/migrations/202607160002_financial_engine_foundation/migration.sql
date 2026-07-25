CREATE TABLE IF NOT EXISTS "financial_engine_runs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "weekLabel" TEXT NOT NULL,
  "seasonId" TEXT,
  "grossReturnsCents" INTEGER NOT NULL DEFAULT 0,
  "returnedStakeCents" INTEGER NOT NULL DEFAULT 0,
  "totalStakeCents" INTEGER NOT NULL DEFAULT 0,
  "totalLossesCents" INTEGER NOT NULL DEFAULT 0,
  "operatingAdjustmentsCents" INTEGER NOT NULL DEFAULT 0,
  "eligibleProfitCents" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'CALCULATED',
  "calculationInput" JSONB NOT NULL DEFAULT '{}',
  "calculationOutput" JSONB NOT NULL DEFAULT '{}',
  "calculatedBy" TEXT NOT NULL,
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_engine_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "financial_engine_allocations" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "runId" TEXT NOT NULL,
  "allocationType" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "percent" DOUBLE PRECISION NOT NULL,
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "distributable" BOOLEAN NOT NULL DEFAULT false,
  "auditExplanation" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_engine_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "financial_analyst_rewards" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "runId" TEXT NOT NULL,
  "analystId" TEXT NOT NULL,
  "analystName" TEXT NOT NULL,
  "contributionWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rewardCents" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'CALCULATED',
  "breakdown" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_analyst_rewards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "financial_partner_distributions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "runId" TEXT NOT NULL,
  "participationId" TEXT,
  "userId" TEXT,
  "participationWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "distributionCents" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'CALCULATED',
  "explanation" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_partner_distributions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "financial_reserve_ledger" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "runId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "balanceAfterCents" INTEGER NOT NULL DEFAULT 0,
  "classification" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_reserve_ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "financial_company_growth_ledger" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "runId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "balanceAfterCents" INTEGER NOT NULL DEFAULT 0,
  "classification" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_company_growth_ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "financial_reports" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "runId" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metrics" JSONB NOT NULL DEFAULT '{}',
  "generatedBy" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "financial_audit_records" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "runId" TEXT,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "beforeState" JSONB,
  "afterState" JSONB,
  "calculationRef" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_audit_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "financial_engine_runs_weekLabel_idx" ON "financial_engine_runs"("weekLabel");
CREATE INDEX IF NOT EXISTS "financial_engine_runs_seasonId_idx" ON "financial_engine_runs"("seasonId");
CREATE INDEX IF NOT EXISTS "financial_engine_runs_status_idx" ON "financial_engine_runs"("status");
CREATE INDEX IF NOT EXISTS "financial_engine_runs_calculatedAt_idx" ON "financial_engine_runs"("calculatedAt");

CREATE INDEX IF NOT EXISTS "financial_engine_allocations_runId_idx" ON "financial_engine_allocations"("runId");
CREATE INDEX IF NOT EXISTS "financial_engine_allocations_allocationType_idx" ON "financial_engine_allocations"("allocationType");

CREATE INDEX IF NOT EXISTS "financial_partner_distributions_runId_idx" ON "financial_partner_distributions"("runId");
CREATE INDEX IF NOT EXISTS "financial_partner_distributions_participationId_idx" ON "financial_partner_distributions"("participationId");
CREATE INDEX IF NOT EXISTS "financial_partner_distributions_userId_idx" ON "financial_partner_distributions"("userId");
CREATE INDEX IF NOT EXISTS "financial_partner_distributions_status_idx" ON "financial_partner_distributions"("status");

CREATE INDEX IF NOT EXISTS "financial_analyst_rewards_runId_idx" ON "financial_analyst_rewards"("runId");
CREATE INDEX IF NOT EXISTS "financial_analyst_rewards_analystId_idx" ON "financial_analyst_rewards"("analystId");
CREATE INDEX IF NOT EXISTS "financial_analyst_rewards_status_idx" ON "financial_analyst_rewards"("status");

CREATE INDEX IF NOT EXISTS "financial_reserve_ledger_runId_idx" ON "financial_reserve_ledger"("runId");
CREATE INDEX IF NOT EXISTS "financial_reserve_ledger_classification_idx" ON "financial_reserve_ledger"("classification");

CREATE INDEX IF NOT EXISTS "financial_company_growth_ledger_runId_idx" ON "financial_company_growth_ledger"("runId");
CREATE INDEX IF NOT EXISTS "financial_company_growth_ledger_classification_idx" ON "financial_company_growth_ledger"("classification");

CREATE INDEX IF NOT EXISTS "financial_reports_runId_idx" ON "financial_reports"("runId");
CREATE INDEX IF NOT EXISTS "financial_reports_reportType_idx" ON "financial_reports"("reportType");

CREATE INDEX IF NOT EXISTS "financial_audit_records_runId_idx" ON "financial_audit_records"("runId");
CREATE INDEX IF NOT EXISTS "financial_audit_records_actorUserId_idx" ON "financial_audit_records"("actorUserId");
CREATE INDEX IF NOT EXISTS "financial_audit_records_action_idx" ON "financial_audit_records"("action");
CREATE INDEX IF NOT EXISTS "financial_audit_records_createdAt_idx" ON "financial_audit_records"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'financial_engine_allocations_runId_fkey'
  ) THEN
    ALTER TABLE "financial_engine_allocations"
      ADD CONSTRAINT "financial_engine_allocations_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "financial_engine_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'financial_analyst_rewards_runId_fkey'
  ) THEN
    ALTER TABLE "financial_analyst_rewards"
      ADD CONSTRAINT "financial_analyst_rewards_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "financial_engine_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'financial_partner_distributions_runId_fkey'
  ) THEN
    ALTER TABLE "financial_partner_distributions"
      ADD CONSTRAINT "financial_partner_distributions_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "financial_engine_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'financial_reserve_ledger_runId_fkey'
  ) THEN
    ALTER TABLE "financial_reserve_ledger"
      ADD CONSTRAINT "financial_reserve_ledger_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "financial_engine_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'financial_company_growth_ledger_runId_fkey'
  ) THEN
    ALTER TABLE "financial_company_growth_ledger"
      ADD CONSTRAINT "financial_company_growth_ledger_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "financial_engine_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'financial_reports_runId_fkey'
  ) THEN
    ALTER TABLE "financial_reports"
      ADD CONSTRAINT "financial_reports_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "financial_engine_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'financial_audit_records_runId_fkey'
  ) THEN
    ALTER TABLE "financial_audit_records"
      ADD CONSTRAINT "financial_audit_records_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "financial_engine_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
