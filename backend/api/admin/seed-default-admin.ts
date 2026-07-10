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
    await ensureOperationsSchema(prisma);

    const body = parseBody(request.body);
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
      operationsSchemaEnsured: true,
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
