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
