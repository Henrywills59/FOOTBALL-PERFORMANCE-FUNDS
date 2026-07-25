CREATE TYPE "AiIntelligenceStatus" AS ENUM (
  'SCANNED',
  'QUALIFIED',
  'REQUIRES_REVIEW',
  'APPROVED_SUBSCRIBER',
  'APPROVED_COMPANY',
  'APPROVED_BOTH',
  'REJECTED',
  'PUBLISHED',
  'WITHDRAWN',
  'EXPIRED'
);

CREATE TYPE "IntelligenceReviewDecision" AS ENUM (
  'APPROVE_SUBSCRIBER',
  'APPROVE_COMPANY',
  'APPROVE_BOTH',
  'REJECT',
  'REQUEST_MORE_ANALYSIS',
  'WITHDRAW'
);

CREATE TYPE "SubscriberPublicationStatus" AS ENUM (
  'DRAFT',
  'SCHEDULED',
  'PUBLISHED',
  'WITHDRAWN',
  'EXPIRED'
);

CREATE TYPE "CompanyBetPlacementStatus" AS ENUM (
  'PENDING_APPROVAL',
  'APPROVED',
  'READY_TO_PLACE',
  'PLACED',
  'CANCELLED',
  'EXPIRED',
  'SETTLED'
);

CREATE TYPE "BettingLedgerResult" AS ENUM (
  'PENDING',
  'WON',
  'LOST',
  'VOID',
  'PARTIAL_WIN',
  'PARTIAL_LOSS',
  'CANCELLED'
);

CREATE TABLE "ai_intelligence" (
  "id" TEXT NOT NULL,
  "fixtureId" TEXT NOT NULL,
  "matchLabel" TEXT NOT NULL,
  "leagueName" TEXT NOT NULL,
  "kickoffAt" TIMESTAMP(3),
  "source" TEXT NOT NULL DEFAULT 'AI_DECISION_ENGINE',
  "scanStatus" "AiIntelligenceStatus" NOT NULL DEFAULT 'SCANNED',
  "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "riskScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "valueScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "opportunityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "recommendedMarket" TEXT NOT NULL,
  "predictedOutcome" TEXT NOT NULL,
  "reasoningSummary" TEXT NOT NULL,
  "supportingMetrics" JSONB NOT NULL DEFAULT '{}',
  "riskFactors" JSONB NOT NULL DEFAULT '[]',
  "alternativeMarkets" JSONB NOT NULL DEFAULT '[]',
  "operationsNotes" TEXT,
  "subscriberSummary" TEXT,
  "dataQualityStatus" "PredictionDataQualityStatus" NOT NULL DEFAULT 'INSUFFICIENT_DATA',
  "decisionEngineRunId" TEXT,
  "createdByUserId" TEXT,
  "lastReviewedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "reviewedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  CONSTRAINT "ai_intelligence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_intelligence_reviews" (
  "id" TEXT NOT NULL,
  "intelligenceId" TEXT NOT NULL,
  "reviewerUserId" TEXT,
  "decision" "IntelligenceReviewDecision" NOT NULL,
  "previousStatus" "AiIntelligenceStatus" NOT NULL,
  "nextStatus" "AiIntelligenceStatus" NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_intelligence_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriber_publications" (
  "id" TEXT NOT NULL,
  "intelligenceId" TEXT NOT NULL,
  "status" "SubscriberPublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "recommendedMarket" TEXT NOT NULL,
  "predictedOutcome" TEXT NOT NULL,
  "confidenceScore" DOUBLE PRECISION NOT NULL,
  "riskScore" DOUBLE PRECISION NOT NULL,
  "valueScore" DOUBLE PRECISION NOT NULL,
  "opportunityScore" DOUBLE PRECISION NOT NULL,
  "riskGrade" TEXT NOT NULL,
  "visibleFrom" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscriber_publications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_bets" (
  "id" TEXT NOT NULL,
  "intelligenceId" TEXT NOT NULL,
  "status" "CompanyBetPlacementStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "market" TEXT NOT NULL,
  "selection" TEXT NOT NULL,
  "requestedStakeCents" INTEGER NOT NULL DEFAULT 0,
  "approvedStakeCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "targetOdds" DOUBLE PRECISION,
  "finalOdds" DOUBLE PRECISION,
  "bookmaker" TEXT,
  "exposureCents" INTEGER NOT NULL DEFAULT 0,
  "maxLossCents" INTEGER NOT NULL DEFAULT 0,
  "expectedReturnCents" INTEGER NOT NULL DEFAULT 0,
  "riskGrade" TEXT NOT NULL DEFAULT 'MEDIUM',
  "approvedByUserId" TEXT,
  "placedByUserId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "placedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  CONSTRAINT "company_bets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "betting_ledger_entries" (
  "id" TEXT NOT NULL,
  "companyBetId" TEXT NOT NULL,
  "fixtureId" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "selection" TEXT NOT NULL,
  "stakeCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "odds" DOUBLE PRECISION NOT NULL,
  "potentialReturnCents" INTEGER NOT NULL,
  "settledReturnCents" INTEGER NOT NULL DEFAULT 0,
  "profitLossCents" INTEGER NOT NULL DEFAULT 0,
  "result" "BettingLedgerResult" NOT NULL DEFAULT 'PENDING',
  "bookmaker" TEXT,
  "placedAt" TIMESTAMP(3),
  "settledAt" TIMESTAMP(3),
  "reconciliationStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "externalBetReference" TEXT,
  "createdByUserId" TEXT,
  "settledByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "betting_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_intelligence_fixtureId_idx" ON "ai_intelligence"("fixtureId");
CREATE INDEX "ai_intelligence_scanStatus_idx" ON "ai_intelligence"("scanStatus");
CREATE INDEX "ai_intelligence_leagueName_idx" ON "ai_intelligence"("leagueName");
CREATE INDEX "ai_intelligence_kickoffAt_idx" ON "ai_intelligence"("kickoffAt");
CREATE INDEX "ai_intelligence_confidenceScore_idx" ON "ai_intelligence"("confidenceScore");
CREATE INDEX "ai_intelligence_riskScore_idx" ON "ai_intelligence"("riskScore");
CREATE INDEX "ai_intelligence_createdAt_idx" ON "ai_intelligence"("createdAt");
CREATE INDEX "ai_intelligence_reviews_intelligenceId_idx" ON "ai_intelligence_reviews"("intelligenceId");
CREATE INDEX "ai_intelligence_reviews_reviewerUserId_idx" ON "ai_intelligence_reviews"("reviewerUserId");
CREATE INDEX "ai_intelligence_reviews_decision_idx" ON "ai_intelligence_reviews"("decision");
CREATE INDEX "ai_intelligence_reviews_createdAt_idx" ON "ai_intelligence_reviews"("createdAt");
CREATE INDEX "subscriber_publications_intelligenceId_idx" ON "subscriber_publications"("intelligenceId");
CREATE INDEX "subscriber_publications_status_idx" ON "subscriber_publications"("status");
CREATE INDEX "subscriber_publications_publishedAt_idx" ON "subscriber_publications"("publishedAt");
CREATE INDEX "company_bets_intelligenceId_idx" ON "company_bets"("intelligenceId");
CREATE INDEX "company_bets_status_idx" ON "company_bets"("status");
CREATE INDEX "company_bets_createdAt_idx" ON "company_bets"("createdAt");
CREATE UNIQUE INDEX "betting_ledger_entries_companyBetId_key" ON "betting_ledger_entries"("companyBetId");
CREATE INDEX "betting_ledger_entries_fixtureId_idx" ON "betting_ledger_entries"("fixtureId");
CREATE INDEX "betting_ledger_entries_result_idx" ON "betting_ledger_entries"("result");
CREATE INDEX "betting_ledger_entries_reconciliationStatus_idx" ON "betting_ledger_entries"("reconciliationStatus");
CREATE INDEX "betting_ledger_entries_createdAt_idx" ON "betting_ledger_entries"("createdAt");

ALTER TABLE "ai_intelligence" ADD CONSTRAINT "ai_intelligence_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "FootballFixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_intelligence_reviews" ADD CONSTRAINT "ai_intelligence_reviews_intelligenceId_fkey" FOREIGN KEY ("intelligenceId") REFERENCES "ai_intelligence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriber_publications" ADD CONSTRAINT "subscriber_publications_intelligenceId_fkey" FOREIGN KEY ("intelligenceId") REFERENCES "ai_intelligence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_bets" ADD CONSTRAINT "company_bets_intelligenceId_fkey" FOREIGN KEY ("intelligenceId") REFERENCES "ai_intelligence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "betting_ledger_entries" ADD CONSTRAINT "betting_ledger_entries_companyBetId_fkey" FOREIGN KEY ("companyBetId") REFERENCES "company_bets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
