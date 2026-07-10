import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

type VercelRequest = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
  setHeader?: (name: string, value: string) => void;
};

function getHeader(request: VercelRequest, name: string) {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function parseBody(body: unknown) {
  if (typeof body === "string") {
    return JSON.parse(body) as Record<string, unknown>;
  }

  if (typeof body === "object" && body !== null) {
    return body as Record<string, unknown>;
  }

  return {};
}

function safeError(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: "Unknown error" };
  }

  return {
    name: error.constructor.name,
    message: error.message,
    code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
  };
}

async function ensureInvestorSchema(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "investor_accounts" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "userId" TEXT NOT NULL UNIQUE,
      "tier" TEXT NOT NULL DEFAULT 'Founding Investor',
      "kycStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
      "agreementStatus" TEXT NOT NULL DEFAULT 'PENDING_SIGNATURE',
      "paymentMethod" TEXT NOT NULL DEFAULT 'Placeholder - not connected',
      "withdrawalMethod" TEXT NOT NULL DEFAULT 'Placeholder - admin review required',
      "riskNotice" TEXT NOT NULL DEFAULT 'Capital is at risk. Historical performance is not a guarantee of future results.',
      "startDate" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "investor_accounts_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "investor_balances" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "investorAccountId" TEXT NOT NULL UNIQUE,
      "totalCapitalCents" INTEGER NOT NULL DEFAULT 0,
      "activeInvestmentBalanceCents" INTEGER NOT NULL DEFAULT 0,
      "weeklyEarningsCents" INTEGER NOT NULL DEFAULT 0,
      "totalEarningsCents" INTEGER NOT NULL DEFAULT 0,
      "pendingDistributionCents" INTEGER NOT NULL DEFAULT 0,
      "paidDistributionCents" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "investor_balances_investorAccountId_fkey"
        FOREIGN KEY ("investorAccountId") REFERENCES "investor_accounts"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "investor_distribution_batches" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "weekStart" TIMESTAMP(3) NOT NULL,
      "weekEnd" TIMESTAMP(3) NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
      "totalCapitalCents" INTEGER NOT NULL DEFAULT 0,
      "totalGrossReturnCents" INTEGER NOT NULL DEFAULT 0,
      "totalNetDistributionCents" INTEGER NOT NULL DEFAULT 0,
      "investorCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "investor_distributions" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "investorAccountId" TEXT NOT NULL,
      "batchId" TEXT,
      "periodStart" TIMESTAMP(3) NOT NULL,
      "periodEnd" TIMESTAMP(3) NOT NULL,
      "capitalBaseCents" INTEGER NOT NULL,
      "returnRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "grossReturnCents" INTEGER NOT NULL DEFAULT 0,
      "platformFeeCents" INTEGER NOT NULL DEFAULT 0,
      "netDistributionCents" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'PENDING_CALCULATION',
      "adminNotes" TEXT,
      "calculatedAt" TIMESTAMP(3),
      "approvedAt" TIMESTAMP(3),
      "paidAt" TIMESTAMP(3),
      "failedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "investor_distributions_investorAccountId_fkey"
        FOREIGN KEY ("investorAccountId") REFERENCES "investor_accounts"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "investor_distributions_batchId_fkey"
        FOREIGN KEY ("batchId") REFERENCES "investor_distribution_batches"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "investor_reports" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "investorAccountId" TEXT NOT NULL,
      "periodType" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "summary" TEXT NOT NULL,
      "earningsCents" INTEGER NOT NULL DEFAULT 0,
      "capitalCents" INTEGER NOT NULL DEFAULT 0,
      "roiPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "downloadUrl" TEXT,
      "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "investor_reports_investorAccountId_fkey"
        FOREIGN KEY ("investorAccountId") REFERENCES "investor_accounts"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "investor_audit_logs" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "investorAccountId" TEXT,
      "actorUserId" TEXT,
      "action" TEXT NOT NULL,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT,
      "details" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "investor_audit_logs_investorAccountId_fkey"
        FOREIGN KEY ("investorAccountId") REFERENCES "investor_accounts"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "investor_audit_logs_actorUserId_fkey"
        FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "investor_notes" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "investorAccountId" TEXT NOT NULL,
      "authorUserId" TEXT,
      "note" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "investor_notes_investorAccountId_fkey"
        FOREIGN KEY ("investorAccountId") REFERENCES "investor_accounts"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "investor_notes_authorUserId_fkey"
        FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);

  const indexes = [
    `CREATE INDEX IF NOT EXISTS "investor_distribution_batches_status_idx" ON "investor_distribution_batches"("status")`,
    `CREATE INDEX IF NOT EXISTS "investor_distribution_batches_weekStart_weekEnd_idx" ON "investor_distribution_batches"("weekStart", "weekEnd")`,
    `CREATE INDEX IF NOT EXISTS "investor_distributions_investorAccountId_idx" ON "investor_distributions"("investorAccountId")`,
    `CREATE INDEX IF NOT EXISTS "investor_distributions_batchId_idx" ON "investor_distributions"("batchId")`,
    `CREATE INDEX IF NOT EXISTS "investor_distributions_status_idx" ON "investor_distributions"("status")`,
    `CREATE INDEX IF NOT EXISTS "investor_distributions_periodStart_periodEnd_idx" ON "investor_distributions"("periodStart", "periodEnd")`,
    `CREATE INDEX IF NOT EXISTS "investor_reports_investorAccountId_idx" ON "investor_reports"("investorAccountId")`,
    `CREATE INDEX IF NOT EXISTS "investor_reports_periodType_idx" ON "investor_reports"("periodType")`,
    `CREATE INDEX IF NOT EXISTS "investor_audit_logs_investorAccountId_idx" ON "investor_audit_logs"("investorAccountId")`,
    `CREATE INDEX IF NOT EXISTS "investor_audit_logs_actorUserId_idx" ON "investor_audit_logs"("actorUserId")`,
    `CREATE INDEX IF NOT EXISTS "investor_audit_logs_action_idx" ON "investor_audit_logs"("action")`,
    `CREATE INDEX IF NOT EXISTS "investor_audit_logs_createdAt_idx" ON "investor_audit_logs"("createdAt")`,
    `CREATE INDEX IF NOT EXISTS "investor_notes_investorAccountId_idx" ON "investor_notes"("investorAccountId")`,
    `CREATE INDEX IF NOT EXISTS "investor_notes_authorUserId_idx" ON "investor_notes"("authorUserId")`,
  ];

  for (const statement of indexes) {
    await prisma.$executeRawUnsafe(statement);
  }
}

async function ensureGlobalizationSchema(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "languages" (
      "code" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "nativeName" TEXT NOT NULL,
      "direction" TEXT NOT NULL DEFAULT 'ltr',
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "currencies" (
      "code" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "symbol" TEXT NOT NULL,
      "placeholderRateFromUsd" DOUBLE PRECISION NOT NULL DEFAULT 1,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "exchange_rate_placeholders" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
      "currency" TEXT NOT NULL,
      "rate" DOUBLE PRECISION NOT NULL,
      "source" TEXT NOT NULL DEFAULT 'PLACEHOLDER',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "user_preferences" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "userId" TEXT NOT NULL UNIQUE,
      "language" TEXT NOT NULL DEFAULT 'en',
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "timezone" TEXT NOT NULL DEFAULT 'UTC',
      "country" TEXT NOT NULL DEFAULT 'US',
      "region" TEXT NOT NULL DEFAULT 'North America',
      "measurementSystem" TEXT NOT NULL DEFAULT 'metric',
      "dateFormat" TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
      "numberFormat" TEXT NOT NULL DEFAULT 'en-US',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "user_preferences_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "country_settings" (
      "countryCode" TEXT PRIMARY KEY,
      "countryName" TEXT NOT NULL,
      "region" TEXT NOT NULL,
      "defaultLanguage" TEXT NOT NULL,
      "defaultCurrency" TEXT NOT NULL,
      "defaultTimezone" TEXT NOT NULL,
      "measurementSystem" TEXT NOT NULL DEFAULT 'metric',
      "dateFormat" TEXT NOT NULL,
      "numberFormat" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "timezone_settings" (
      "id" TEXT PRIMARY KEY,
      "label" TEXT NOT NULL,
      "offset" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "exchange_rate_placeholders_baseCurrency_currency_idx" ON "exchange_rate_placeholders"("baseCurrency", "currency")`);
}

async function ensureCommercialSchema(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "subscription_plans" (
      "code" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "monthlyPriceCents" INTEGER NOT NULL,
      "yearlyPriceCents" INTEGER NOT NULL,
      "features" JSONB NOT NULL,
      "highlighted" BOOLEAN NOT NULL DEFAULT false,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "investor_levels" (
      "name" TEXT PRIMARY KEY,
      "minimumInvestmentCents" INTEGER NOT NULL,
      "badgeColor" TEXT NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "investment_lock_periods" (
      "code" TEXT PRIMARY KEY,
      "label" TEXT NOT NULL,
      "months" INTEGER NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "simulator_settings" (
      "key" TEXT PRIMARY KEY,
      "value" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "pricing_settings" (
      "key" TEXT PRIMARY KEY,
      "value" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function ensurePaymentSchema(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "payment_orders" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "userId" TEXT NOT NULL,
      "purpose" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'CREATED',
      "provider" TEXT NOT NULL DEFAULT 'NOWPAYMENTS',
      "providerPaymentId" TEXT UNIQUE,
      "providerInvoiceId" TEXT,
      "planCode" TEXT,
      "billingCycle" TEXT,
      "investmentPackageId" TEXT,
      "lockPeriodCode" TEXT,
      "expectedAmountCents" INTEGER NOT NULL,
      "receivedAmountCents" INTEGER NOT NULL DEFAULT 0,
      "priceCurrency" TEXT NOT NULL DEFAULT 'USD',
      "payCurrency" TEXT NOT NULL DEFAULT 'USDTTRC20',
      "paymentAddress" TEXT,
      "checkoutUrl" TEXT,
      "expiresAt" TIMESTAMP(3),
      "confirmedAt" TIMESTAMP(3),
      "reconciliationStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "payment_orders_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "payment_transactions" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "orderId" TEXT NOT NULL,
      "providerPaymentId" TEXT,
      "status" TEXT NOT NULL,
      "expectedAmountCents" INTEGER NOT NULL,
      "receivedAmountCents" INTEGER NOT NULL DEFAULT 0,
      "priceCurrency" TEXT NOT NULL DEFAULT 'USD',
      "payCurrency" TEXT NOT NULL DEFAULT 'USDTTRC20',
      "providerFeeCents" INTEGER NOT NULL DEFAULT 0,
      "providerPayload" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "payment_transactions_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "payment_orders"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "payment_webhook_receipts" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "provider" TEXT NOT NULL DEFAULT 'NOWPAYMENTS',
      "providerPaymentId" TEXT,
      "orderId" TEXT,
      "eventKey" TEXT NOT NULL UNIQUE,
      "signatureValid" BOOLEAN NOT NULL DEFAULT false,
      "processingStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
      "payloadHash" TEXT NOT NULL,
      "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "errorMessage" TEXT,
      "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "processedAt" TIMESTAMP(3),
      CONSTRAINT "payment_webhook_receipts_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "payment_orders"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "payment_status_history" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "orderId" TEXT NOT NULL,
      "previousStatus" TEXT,
      "newStatus" TEXT NOT NULL,
      "reason" TEXT,
      "source" TEXT NOT NULL DEFAULT 'SYSTEM',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "payment_status_history_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "payment_orders"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "payment_reconciliation" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "orderId" TEXT NOT NULL UNIQUE,
      "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
      "expectedAmountCents" INTEGER NOT NULL,
      "receivedAmountCents" INTEGER NOT NULL DEFAULT 0,
      "differenceCents" INTEGER NOT NULL DEFAULT 0,
      "expectedCurrency" TEXT NOT NULL DEFAULT 'USD',
      "receivedCurrency" TEXT,
      "notes" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "payment_reconciliation_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "payment_orders"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "payment_refunds_placeholder" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "orderId" TEXT NOT NULL,
      "amountCents" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'PLACEHOLDER_ONLY',
      "reason" TEXT,
      "createdByUserId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "payment_refunds_placeholder_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "payment_orders"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "payment_manual_reviews" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "orderId" TEXT NOT NULL,
      "reason" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'OPEN',
      "notes" TEXT,
      "createdByUserId" TEXT,
      "resolvedByUserId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "resolvedAt" TIMESTAMP(3),
      CONSTRAINT "payment_manual_reviews_orderId_fkey"
        FOREIGN KEY ("orderId") REFERENCES "payment_orders"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  const indexes = [
    `CREATE INDEX IF NOT EXISTS "payment_orders_userId_idx" ON "payment_orders"("userId")`,
    `CREATE INDEX IF NOT EXISTS "payment_orders_purpose_idx" ON "payment_orders"("purpose")`,
    `CREATE INDEX IF NOT EXISTS "payment_orders_status_idx" ON "payment_orders"("status")`,
    `CREATE INDEX IF NOT EXISTS "payment_orders_providerPaymentId_idx" ON "payment_orders"("providerPaymentId")`,
    `CREATE INDEX IF NOT EXISTS "payment_orders_createdAt_idx" ON "payment_orders"("createdAt")`,
    `CREATE INDEX IF NOT EXISTS "payment_transactions_orderId_idx" ON "payment_transactions"("orderId")`,
    `CREATE INDEX IF NOT EXISTS "payment_transactions_providerPaymentId_idx" ON "payment_transactions"("providerPaymentId")`,
    `CREATE INDEX IF NOT EXISTS "payment_transactions_status_idx" ON "payment_transactions"("status")`,
    `CREATE INDEX IF NOT EXISTS "payment_webhook_receipts_providerPaymentId_idx" ON "payment_webhook_receipts"("providerPaymentId")`,
    `CREATE INDEX IF NOT EXISTS "payment_webhook_receipts_orderId_idx" ON "payment_webhook_receipts"("orderId")`,
    `CREATE INDEX IF NOT EXISTS "payment_webhook_receipts_processingStatus_idx" ON "payment_webhook_receipts"("processingStatus")`,
    `CREATE INDEX IF NOT EXISTS "payment_status_history_orderId_idx" ON "payment_status_history"("orderId")`,
    `CREATE INDEX IF NOT EXISTS "payment_status_history_newStatus_idx" ON "payment_status_history"("newStatus")`,
    `CREATE INDEX IF NOT EXISTS "payment_reconciliation_status_idx" ON "payment_reconciliation"("status")`,
    `CREATE INDEX IF NOT EXISTS "payment_refunds_placeholder_orderId_idx" ON "payment_refunds_placeholder"("orderId")`,
    `CREATE INDEX IF NOT EXISTS "payment_refunds_placeholder_status_idx" ON "payment_refunds_placeholder"("status")`,
    `CREATE INDEX IF NOT EXISTS "payment_manual_reviews_orderId_idx" ON "payment_manual_reviews"("orderId")`,
    `CREATE INDEX IF NOT EXISTS "payment_manual_reviews_status_idx" ON "payment_manual_reviews"("status")`,
  ];

  for (const statement of indexes) {
    await prisma.$executeRawUnsafe(statement);
  }
}

async function ensureBusinessCommercialSchema(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "subscriptions" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "userId" TEXT NOT NULL,
      "planCode" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'TRIAL',
      "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
      "renewalDate" TIMESTAMP(3),
      "trialEndsAt" TIMESTAMP(3),
      "gracePeriodEndsAt" TIMESTAMP(3),
      "invoices" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "receipts" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "failedPayments" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "discounts" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "coupons" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "taxesPlaceholder" TEXT NOT NULL DEFAULT 'Taxes are placeholder-only until billing providers are connected.',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "subscriptions_userId_idx" ON "subscriptions"("userId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON "subscriptions"("status")`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "investor_packages" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "minimumAmountCents" INTEGER NOT NULL,
      "maximumAmountCents" INTEGER,
      "lockPeriodCode" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "visible" BOOLEAN NOT NULL DEFAULT true,
      "projectedPerformanceNote" TEXT NOT NULL,
      "riskDisclosure" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "pricing_rules" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "countryCode" TEXT,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "couponCode" TEXT,
      "promotionType" TEXT NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "pricing_countries" (
      "countryCode" TEXT PRIMARY KEY,
      "countryName" TEXT NOT NULL,
      "currency" TEXT NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "discounts" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "discountPercent" DOUBLE PRECISION NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "startsAt" TIMESTAMP(3),
      "endsAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "coupons" (
      "code" TEXT PRIMARY KEY,
      "discountPercent" DOUBLE PRECISION NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "maxRedemptions" INTEGER,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "revenue_metrics" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "period" TEXT NOT NULL,
      "metrics" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "provider_registry" (
      "id" TEXT PRIMARY KEY,
      "providerName" TEXT NOT NULL,
      "purpose" TEXT NOT NULL,
      "dashboardUrl" TEXT,
      "documentationUrl" TEXT,
      "status" TEXT NOT NULL,
      "health" TEXT NOT NULL,
      "apiKeyStatus" TEXT NOT NULL,
      "productionStatus" TEXT NOT NULL,
      "developmentStatus" TEXT NOT NULL,
      "supportContact" TEXT,
      "category" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "provider_costs" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "providerId" TEXT NOT NULL,
      "monthlyCostCents" INTEGER NOT NULL DEFAULT 0,
      "annualCostCents" INTEGER NOT NULL DEFAULT 0,
      "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "provider_renewals" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "providerId" TEXT NOT NULL,
      "renewalDate" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "reminders" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "procurement" (
      "id" TEXT PRIMARY KEY,
      "vendor" TEXT NOT NULL,
      "plan" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "license" TEXT,
      "invoice" TEXT,
      "costCents" INTEGER NOT NULL DEFAULT 0,
      "renewalDate" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "billing_events" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "userId" TEXT,
      "eventType" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "amountCents" INTEGER NOT NULL DEFAULT 0,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function ensureOperationsSchema(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "reports" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "title" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "ownerUserId" TEXT,
      "ownerRole" TEXT,
      "filters" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "summary" TEXT NOT NULL,
      "data" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "errorMessage" TEXT,
      "generatedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reports_type_idx" ON "reports"("type")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports"("status")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reports_ownerUserId_idx" ON "reports"("ownerUserId")`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "report_runs" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "reportId" TEXT NOT NULL REFERENCES "reports"("id") ON DELETE CASCADE,
      "status" TEXT NOT NULL,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMP(3),
      "errorMessage" TEXT
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "report_runs_reportId_idx" ON "report_runs"("reportId")`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "report_schedules" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "reportType" TEXT NOT NULL,
      "filters" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "cadence" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT false,
      "nextRunAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "system_health_checks" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "component" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "system_incidents" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "title" TEXT NOT NULL,
      "severity" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "affectedModules" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "assignedToUserId" TEXT,
      "rootCause" TEXT,
      "resolution" TEXT,
      "archived" BOOLEAN NOT NULL DEFAULT false,
      "createdByUserId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "system_incidents_status_idx" ON "system_incidents"("status")`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "incident_notes" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "incidentId" TEXT NOT NULL REFERENCES "system_incidents"("id") ON DELETE CASCADE,
      "authorUserId" TEXT NOT NULL,
      "note" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "notifications" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "userId" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "readAt" TIMESTAMP(3)
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "notifications_userId_idx" ON "notifications"("userId")`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "notification_preferences" (
      "userId" TEXT PRIMARY KEY,
      "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
      "emailPlaceholderEnabled" BOOLEAN NOT NULL DEFAULT false,
      "smsPlaceholderEnabled" BOOLEAN NOT NULL DEFAULT false,
      "whatsappPlaceholderEnabled" BOOLEAN NOT NULL DEFAULT false,
      "pushPlaceholderEnabled" BOOLEAN NOT NULL DEFAULT false,
      "marketingEnabled" BOOLEAN NOT NULL DEFAULT true,
      "financialEnabled" BOOLEAN NOT NULL DEFAULT true,
      "predictionEnabled" BOOLEAN NOT NULL DEFAULT true,
      "securityEnabled" BOOLEAN NOT NULL DEFAULT true,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "notification_deliveries" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "notificationId" TEXT NOT NULL,
      "channel" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "errorMessage" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "admin_announcements" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "title" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "targetRoles" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "targetCountries" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "targetLanguages" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "targetSubscriptionPlans" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "scheduledAt" TIMESTAMP(3),
      "expiresAt" TIMESTAMP(3),
      "createdByUserId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "announcement_targets" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "announcementId" TEXT NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetValue" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "monitoring_events" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "component" TEXT NOT NULL,
      "level" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function ensureMediaSchema(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "campaigns" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "objective" TEXT NOT NULL,
      "startDate" TIMESTAMP(3),
      "endDate" TIMESTAMP(3),
      "budgetCents" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "campaigns"("status")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "campaigns_type_idx" ON "campaigns"("type")`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "posts" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "campaignId" TEXT,
      "title" TEXT NOT NULL,
      "contentType" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'DRAFT',
      "body" TEXT NOT NULL,
      "language" TEXT NOT NULL DEFAULT 'en',
      "country" TEXT,
      "audience" TEXT NOT NULL DEFAULT 'General',
      "platforms" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "scheduledAt" TIMESTAMP(3),
      "timezone" TEXT NOT NULL DEFAULT 'UTC',
      "createdByUserId" TEXT NOT NULL,
      "approvedByUserId" TEXT,
      "publishedAt" TIMESTAMP(3),
      "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "posts_campaignId_idx" ON "posts"("campaignId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "posts_status_idx" ON "posts"("status")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "posts_scheduledAt_idx" ON "posts"("scheduledAt")`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "post_platforms" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "postId" TEXT NOT NULL,
      "platform" TEXT NOT NULL,
      "providerStatus" TEXT NOT NULL DEFAULT 'PLACEHOLDER',
      "externalPostId" TEXT,
      "publishPayload" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "scheduled_posts" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "postId" TEXT NOT NULL,
      "scheduledAt" TIMESTAMP(3) NOT NULL,
      "timezone" TEXT NOT NULL DEFAULT 'UTC',
      "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "content_assets" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "assetType" TEXT NOT NULL,
      "url" TEXT,
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "content_templates" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "contentType" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "variables" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "hashtags" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "tag" TEXT NOT NULL UNIQUE,
      "category" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "seo_keywords" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "keyword" TEXT NOT NULL,
      "category" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "media_library" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "name" TEXT NOT NULL,
      "itemType" TEXT NOT NULL,
      "url" TEXT,
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "campaign_reports" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "campaignId" TEXT,
      "title" TEXT NOT NULL,
      "analytics" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader?.("access-control-allow-methods", "POST,OPTIONS");
  response.setHeader?.("access-control-allow-headers", "content-type,x-admin-seed-token");

  if (request.method === "OPTIONS") {
    response.status(200).json({ ok: true });
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ ok: false, message: "Method not allowed." });
    return;
  }

  const expectedToken = process.env.ADMIN_SEED_TOKEN?.trim();
  const providedToken = getHeader(request, "x-admin-seed-token")?.trim();

  if (!expectedToken || !providedToken || providedToken !== expectedToken) {
    response.status(404).json({ ok: false, message: "Not found." });
    return;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    response.status(500).json({
      ok: false,
      failedStage: "environment",
      databaseUrlConfigured: false,
    });
    return;
  }

  let prisma: PrismaClient | null = null;
  try {
    prisma = new PrismaClient({ log: ["error"] });
    await ensureInvestorSchema(prisma);
    await ensureGlobalizationSchema(prisma);
    await ensureCommercialSchema(prisma);
    await ensurePaymentSchema(prisma);
    await ensureOperationsSchema(prisma);
    await ensureMediaSchema(prisma);

    const body = parseBody(request.body);
    const shouldEnsureBusinessCommercialSchema = body.ensureBusinessCommercialSchema === true;
    if (shouldEnsureBusinessCommercialSchema) {
      await ensureBusinessCommercialSchema(prisma);
    }
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "admin@footballperformancefund.com";
    const password =
      typeof body.password === "string" && body.password.length > 0
        ? body.password
        : "ChooseAStrongPassword123!";
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "FPF Admin";

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
      create: {
        name,
        email,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    response.status(200).json({
      ok: true,
      seeded: true,
      investorSchemaEnsured: true,
      globalizationSchemaEnsured: true,
      commercialSchemaEnsured: true,
      paymentSchemaEnsured: true,
      businessCommercialSchemaEnsured: shouldEnsureBusinessCommercialSchema,
      operationsSchemaEnsured: true,
      mediaSchemaEnsured: true,
      user,
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      failedStage: "adminSeed",
      error: safeError(error),
    });
  } finally {
    try {
      await prisma?.$disconnect();
    } catch {
      // Cleanup must not hide the seed result from the deploy report.
    }
  }
}
