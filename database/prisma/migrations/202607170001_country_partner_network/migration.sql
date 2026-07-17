ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'COUNTRY_PARTNER';

CREATE TABLE IF NOT EXISTS "country_partner_profiles" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL UNIQUE,
  "partnerName" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "countryName" TEXT NOT NULL,
  "region" TEXT,
  "licenceStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "licenceStartedAt" TIMESTAMPTZ,
  "licenceExpiresAt" TIMESTAMPTZ,
  "entryFeeCents" INTEGER NOT NULL DEFAULT 300000,
  "renewalFeeCents" INTEGER NOT NULL DEFAULT 300000,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "level" TEXT NOT NULL DEFAULT 'Emerging',
  "complianceScore" INTEGER NOT NULL DEFAULT 80,
  "localContactDetails" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "allowedCustomFields" JSONB NOT NULL DEFAULT '["contactDetails","language","currency"]'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "country_partner_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "country_partner_commission_rules" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "ruleCode" TEXT NOT NULL UNIQUE,
  "label" TEXT NOT NULL,
  "revenueType" TEXT NOT NULL,
  "percent" DOUBLE PRECISION NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "notes" TEXT NOT NULL DEFAULT '',
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "country_partner_level_thresholds" (
  "level" TEXT PRIMARY KEY,
  "minimumCbvCents" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "country_partner_leads" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "partnerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "countryCode" TEXT NOT NULL,
  "interestType" TEXT NOT NULL DEFAULT 'SUBSCRIPTION',
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "estimatedValueCents" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "country_partner_leads_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "country_partner_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "country_partner_commissions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "partnerId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT,
  "baseRevenueCents" INTEGER NOT NULL,
  "commissionCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "calculatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMPTZ,
  "paidAt" TIMESTAMPTZ,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT "country_partner_commissions_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "country_partner_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "country_partner_local_services" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "partnerId" TEXT NOT NULL,
  "serviceName" TEXT NOT NULL,
  "revenueCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "verifiedAt" TIMESTAMPTZ,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "country_partner_local_services_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "country_partner_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "country_partner_marketing_assets" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "partnerId" TEXT,
  "countryCode" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'en',
  "platform" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "campaignType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "caption" TEXT NOT NULL,
  "script" TEXT,
  "localisation" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "approvedByHq" BOOLEAN NOT NULL DEFAULT TRUE,
  "status" TEXT NOT NULL DEFAULT 'APPROVED',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "country_partner_marketing_assets_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "country_partner_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "country_partner_audit_logs" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "partnerId" TEXT,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "country_partner_profiles_countryCode_idx" ON "country_partner_profiles" ("countryCode");
CREATE INDEX IF NOT EXISTS "country_partner_profiles_licenceStatus_idx" ON "country_partner_profiles" ("licenceStatus");
CREATE INDEX IF NOT EXISTS "country_partner_profiles_level_idx" ON "country_partner_profiles" ("level");
CREATE INDEX IF NOT EXISTS "country_partner_commission_rules_active_idx" ON "country_partner_commission_rules" ("active");
CREATE INDEX IF NOT EXISTS "country_partner_commission_rules_revenueType_idx" ON "country_partner_commission_rules" ("revenueType");
CREATE INDEX IF NOT EXISTS "country_partner_level_thresholds_active_idx" ON "country_partner_level_thresholds" ("active");
CREATE INDEX IF NOT EXISTS "country_partner_leads_partnerId_idx" ON "country_partner_leads" ("partnerId");
CREATE INDEX IF NOT EXISTS "country_partner_leads_countryCode_idx" ON "country_partner_leads" ("countryCode");
CREATE INDEX IF NOT EXISTS "country_partner_leads_status_idx" ON "country_partner_leads" ("status");
CREATE INDEX IF NOT EXISTS "country_partner_commissions_partnerId_idx" ON "country_partner_commissions" ("partnerId");
CREATE INDEX IF NOT EXISTS "country_partner_commissions_sourceType_idx" ON "country_partner_commissions" ("sourceType");
CREATE INDEX IF NOT EXISTS "country_partner_commissions_status_idx" ON "country_partner_commissions" ("status");
CREATE INDEX IF NOT EXISTS "country_partner_local_services_partnerId_idx" ON "country_partner_local_services" ("partnerId");
CREATE INDEX IF NOT EXISTS "country_partner_local_services_status_idx" ON "country_partner_local_services" ("status");
CREATE INDEX IF NOT EXISTS "country_partner_marketing_assets_partnerId_idx" ON "country_partner_marketing_assets" ("partnerId");
CREATE INDEX IF NOT EXISTS "country_partner_marketing_assets_countryCode_idx" ON "country_partner_marketing_assets" ("countryCode");
CREATE INDEX IF NOT EXISTS "country_partner_marketing_assets_platform_idx" ON "country_partner_marketing_assets" ("platform");
CREATE INDEX IF NOT EXISTS "country_partner_marketing_assets_status_idx" ON "country_partner_marketing_assets" ("status");
CREATE INDEX IF NOT EXISTS "country_partner_audit_logs_partnerId_idx" ON "country_partner_audit_logs" ("partnerId");
CREATE INDEX IF NOT EXISTS "country_partner_audit_logs_actorUserId_idx" ON "country_partner_audit_logs" ("actorUserId");
CREATE INDEX IF NOT EXISTS "country_partner_audit_logs_action_idx" ON "country_partner_audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "country_partner_audit_logs_createdAt_idx" ON "country_partner_audit_logs" ("createdAt");

INSERT INTO "country_partner_commission_rules" ("ruleCode", "label", "revenueType", "percent", "notes")
VALUES
  ('NET_SUBSCRIPTION_REVENUE_30', 'Country Partner subscription commission', 'NET_SUBSCRIPTION_REVENUE', 30, 'Default: 30% of verified net subscription revenue generated inside the assigned territory.'),
  ('ELIGIBLE_COMPANY_REVENUE_20', 'Country Partner Performance Partner business commission', 'ELIGIBLE_COMPANY_REVENUE', 20, 'Default: 20% of eligible FPF company revenue from Performance Partner business. Contributed capital is always excluded.')
ON CONFLICT ("ruleCode") DO NOTHING;

INSERT INTO "country_partner_level_thresholds" ("level", "minimumCbvCents")
VALUES
  ('Emerging', 0),
  ('Bronze', 1000000),
  ('Silver', 5000000),
  ('Gold', 15000000),
  ('Platinum', 50000000)
ON CONFLICT ("level") DO NOTHING;
