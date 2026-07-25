import crypto from "node:crypto";
import type {
  CountryBusinessVolume,
  CountryPartnerCommissionRule,
  CountryPartnerLead,
  CountryPartnerLevelThreshold,
  CountryPartnerMarketingAsset,
  CountryPartnerProfile,
} from "@fpf/shared";
import { getPrismaClient, isDatabaseUrlConfigured } from "../database/prismaClient.js";
import type { CountryPartnerLeadInput, CountryPartnerRepository, CountryPartnerSettingsInput } from "./types.js";

const defaultRules: CountryPartnerCommissionRule[] = [
  {
    id: "rule_subscription_default",
    ruleCode: "NET_SUBSCRIPTION_REVENUE_30",
    label: "Country Partner subscription commission",
    revenueType: "NET_SUBSCRIPTION_REVENUE",
    percent: 30,
    active: true,
    notes: "Default: 30% of verified net subscription revenue generated inside the assigned territory.",
  },
  {
    id: "rule_company_revenue_default",
    ruleCode: "ELIGIBLE_COMPANY_REVENUE_20",
    label: "Country Partner Performance Partner business commission",
    revenueType: "ELIGIBLE_COMPANY_REVENUE",
    percent: 20,
    active: true,
    notes: "Default: 20% of eligible FPF company revenue from Performance Partner business. Contributed capital is always excluded.",
  },
];

const defaultLevels: CountryPartnerLevelThreshold[] = [
  { level: "Emerging", minimumCbvCents: 0, active: true },
  { level: "Bronze", minimumCbvCents: 1_000_000, active: true },
  { level: "Silver", minimumCbvCents: 5_000_000, active: true },
  { level: "Gold", minimumCbvCents: 15_000_000, active: true },
  { level: "Platinum", minimumCbvCents: 50_000_000, active: true },
];

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function jsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function dateIso(value: unknown): string | null {
  if (!value) return null;
  return new Date(value as string).toISOString();
}

function isMissingTableError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (("code" in error && (error.code === "P2021" || error.code === "42P01")) ||
      (error instanceof Error && /does not exist|missing table|relation .* does not exist/i.test(error.message)))
  );
}

function profileFromRow(row: Record<string, unknown>): CountryPartnerProfile {
  return {
    id: String(row.id),
    userId: String(row.userId),
    partnerName: String(row.partnerName),
    countryCode: String(row.countryCode),
    countryName: String(row.countryName),
    region: row.region ? String(row.region) : null,
    licenceStatus: String(row.licenceStatus) as CountryPartnerProfile["licenceStatus"],
    licenceStartedAt: dateIso(row.licenceStartedAt),
    licenceExpiresAt: dateIso(row.licenceExpiresAt),
    entryFeeCents: Number(row.entryFeeCents ?? 300000),
    renewalFeeCents: Number(row.renewalFeeCents ?? 300000),
    currency: String(row.currency ?? "USD"),
    level: String(row.level ?? "Emerging") as CountryPartnerProfile["level"],
    complianceScore: Number(row.complianceScore ?? 80),
    localContactDetails: jsonObject(row.localContactDetails),
    allowedCustomFields: jsonArray(row.allowedCustomFields),
  };
}

function ruleFromRow(row: Record<string, unknown>): CountryPartnerCommissionRule {
  return {
    id: String(row.id),
    ruleCode: String(row.ruleCode),
    label: String(row.label),
    revenueType: String(row.revenueType) as CountryPartnerCommissionRule["revenueType"],
    percent: Number(row.percent ?? 0),
    active: Boolean(row.active),
    notes: String(row.notes ?? ""),
  };
}

function levelFromRow(row: Record<string, unknown>): CountryPartnerLevelThreshold {
  return {
    level: String(row.level) as CountryPartnerLevelThreshold["level"],
    minimumCbvCents: Number(row.minimumCbvCents ?? 0),
    active: Boolean(row.active),
  };
}

function leadFromRow(row: Record<string, unknown>): CountryPartnerLead {
  return {
    id: String(row.id),
    partnerId: String(row.partnerId),
    name: String(row.name),
    email: row.email ? String(row.email) : null,
    phone: row.phone ? String(row.phone) : null,
    countryCode: String(row.countryCode),
    interestType: String(row.interestType ?? "SUBSCRIPTION"),
    status: String(row.status ?? "NEW") as CountryPartnerLead["status"],
    estimatedValueCents: Number(row.estimatedValueCents ?? 0),
    notes: row.notes ? String(row.notes) : null,
    createdAt: new Date(row.createdAt as string).toISOString(),
    updatedAt: new Date(row.updatedAt as string).toISOString(),
  };
}

function assetFromRow(row: Record<string, unknown>): CountryPartnerMarketingAsset {
  return {
    id: String(row.id),
    partnerId: row.partnerId ? String(row.partnerId) : null,
    countryCode: String(row.countryCode),
    language: String(row.language ?? "en"),
    platform: String(row.platform) as CountryPartnerMarketingAsset["platform"],
    contentType: String(row.contentType) as CountryPartnerMarketingAsset["contentType"],
    campaignType: String(row.campaignType),
    title: String(row.title),
    body: String(row.body),
    caption: String(row.caption),
    script: row.script ? String(row.script) : null,
    localisation: jsonObject(row.localisation),
    approvedByHq: Boolean(row.approvedByHq),
    status: String(row.status ?? "APPROVED") as CountryPartnerMarketingAsset["status"],
    createdAt: new Date(row.createdAt as string).toISOString(),
  };
}

function emptyCbv(currency = "USD", start = new Date(), end = new Date()): CountryBusinessVolume {
  return {
    totalCents: 0,
    currency,
    subscriptionRevenueCents: 0,
    performancePartnerBusinessCents: 0,
    renewalsCents: 0,
    approvedLocalServicesCents: 0,
    verifiedPaymentCount: 0,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}

export class InMemoryCountryPartnerRepository implements CountryPartnerRepository {
  private profiles: CountryPartnerProfile[] = [];
  private rules = [...defaultRules];
  private levels = [...defaultLevels];
  private leads: CountryPartnerLead[] = [];
  private assets: CountryPartnerMarketingAsset[] = [];

  async findProfileByUserId(userId: string) {
    return this.profiles.find((profile) => profile.userId === userId) ?? null;
  }

  async listProfiles() {
    return this.profiles;
  }

  async listCommissionRules() {
    return this.rules;
  }

  async upsertCommissionRules(rules: CountryPartnerSettingsInput["rules"]) {
    if (!rules?.length) return this.rules;
    for (const rule of rules) {
      const existing = this.rules.find((item) => item.ruleCode === rule.ruleCode);
      const next = { id: existing?.id ?? id("rule"), notes: rule.notes ?? "", ...rule };
      if (existing) Object.assign(existing, next);
      else this.rules.push(next);
    }
    return this.rules;
  }

  async listLevelThresholds() {
    return this.levels;
  }

  async upsertLevelThresholds(levels: CountryPartnerSettingsInput["levels"]) {
    if (!levels?.length) return this.levels;
    for (const level of levels) {
      const existing = this.levels.find((item) => item.level === level.level);
      if (existing) Object.assign(existing, level);
      else this.levels.push(level);
    }
    return this.levels;
  }

  async calculateBusinessVolume(profile: CountryPartnerProfile, period: { start: Date; end: Date }) {
    return emptyCbv(profile.currency, period.start, period.end);
  }

  async listLeads(partnerId: string) {
    return this.leads.filter((lead) => lead.partnerId === partnerId);
  }

  async createLead(profile: CountryPartnerProfile, input: CountryPartnerLeadInput) {
    const createdAt = nowIso();
    const lead: CountryPartnerLead = {
      id: id("lead"),
      partnerId: profile.id,
      countryCode: profile.countryCode,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      interestType: input.interestType,
      status: "NEW",
      estimatedValueCents: input.estimatedValueCents,
      notes: input.notes ?? null,
      createdAt,
      updatedAt: createdAt,
    };
    this.leads.unshift(lead);
    return lead;
  }

  async listMarketingAssets(profile: CountryPartnerProfile) {
    return this.assets.filter((asset) => asset.countryCode === profile.countryCode && (asset.partnerId === null || asset.partnerId === profile.id));
  }

  async createMarketingAssets(_profile: CountryPartnerProfile, assets: CountryPartnerMarketingAsset[]) {
    this.assets.unshift(...assets);
    return assets;
  }

  async audit() {}
}

export class PrismaCountryPartnerRepository implements CountryPartnerRepository {
  private readonly prisma = isDatabaseUrlConfigured() ? getPrismaClient() : null;
  private readonly fallback = new InMemoryCountryPartnerRepository();

  private async safe<T>(operation: () => Promise<T>, fallback: () => Promise<T>) {
    if (!this.prisma) return fallback();
    try {
      return await operation();
    } catch (error) {
      if (isMissingTableError(error)) {
        console.warn("COUNTRY_PARTNER_TABLE_FALLBACK", { message: error instanceof Error ? error.message : "Missing country partner table" });
        return fallback();
      }
      throw error;
    }
  }

  async findProfileByUserId(userId: string) {
    return this.safe(async () => {
      const rows = await this.prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM "country_partner_profiles" WHERE "userId" = $1 LIMIT 1`,
        userId,
      );
      return rows[0] ? profileFromRow(rows[0]) : null;
    }, () => this.fallback.findProfileByUserId(userId));
  }

  async listProfiles() {
    return this.safe(async () => {
      const rows = await this.prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM "country_partner_profiles" ORDER BY "countryName" ASC, "partnerName" ASC LIMIT 300`,
      );
      return rows.map(profileFromRow);
    }, () => this.fallback.listProfiles());
  }

  async listCommissionRules() {
    return this.safe(async () => {
      const rows = await this.prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM "country_partner_commission_rules" ORDER BY "revenueType" ASC, "ruleCode" ASC`,
      );
      return rows.length ? rows.map(ruleFromRow) : defaultRules;
    }, () => this.fallback.listCommissionRules());
  }

  async upsertCommissionRules(rules: CountryPartnerSettingsInput["rules"]) {
    return this.safe(async () => {
      if (!rules?.length) return this.listCommissionRules();
      for (const rule of rules) {
        await this.prisma!.$executeRawUnsafe(
          `INSERT INTO "country_partner_commission_rules" ("ruleCode","label","revenueType","percent","active","notes")
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT ("ruleCode") DO UPDATE SET "label" = EXCLUDED."label", "revenueType" = EXCLUDED."revenueType", "percent" = EXCLUDED."percent", "active" = EXCLUDED."active", "notes" = EXCLUDED."notes", "updatedAt" = CURRENT_TIMESTAMP`,
          rule.ruleCode,
          rule.label,
          rule.revenueType,
          rule.percent,
          rule.active,
          rule.notes ?? "",
        );
      }
      return this.listCommissionRules();
    }, () => this.fallback.upsertCommissionRules(rules));
  }

  async listLevelThresholds() {
    return this.safe(async () => {
      const rows = await this.prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM "country_partner_level_thresholds" ORDER BY "minimumCbvCents" ASC`,
      );
      return rows.length ? rows.map(levelFromRow) : defaultLevels;
    }, () => this.fallback.listLevelThresholds());
  }

  async upsertLevelThresholds(levels: CountryPartnerSettingsInput["levels"]) {
    return this.safe(async () => {
      if (!levels?.length) return this.listLevelThresholds();
      for (const level of levels) {
        await this.prisma!.$executeRawUnsafe(
          `INSERT INTO "country_partner_level_thresholds" ("level","minimumCbvCents","active")
           VALUES ($1,$2,$3)
           ON CONFLICT ("level") DO UPDATE SET "minimumCbvCents" = EXCLUDED."minimumCbvCents", "active" = EXCLUDED."active", "updatedAt" = CURRENT_TIMESTAMP`,
          level.level,
          level.minimumCbvCents,
          level.active,
        );
      }
      return this.listLevelThresholds();
    }, () => this.fallback.upsertLevelThresholds(levels));
  }

  async calculateBusinessVolume(profile: CountryPartnerProfile, period: { start: Date; end: Date }) {
    return this.safe(async () => {
      const paymentRows = await this.prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT
          COALESCE(SUM(CASE WHEN po."purpose" IN ('SUBSCRIPTION','SUBSCRIPTION_UPGRADE') THEN po."receivedAmountCents" ELSE 0 END), 0) AS "subscriptionRevenueCents",
          COALESCE(SUM(CASE WHEN po."purpose" = 'SUBSCRIPTION_RENEWAL' THEN po."receivedAmountCents" ELSE 0 END), 0) AS "renewalsCents",
          COALESCE(SUM(CASE WHEN po."purpose" = 'INVESTOR_FUNDING' THEN COALESCE(NULLIF(po."metadata"->>'eligibleCompanyRevenueCents', '')::integer, 0) ELSE 0 END), 0) AS "performancePartnerBusinessCents",
          COUNT(*)::integer AS "verifiedPaymentCount"
        FROM "payment_orders" po
        JOIN "User" u ON u."id" = po."userId"
        LEFT JOIN "user_preferences" pref ON pref."userId" = u."id"
        WHERE po."status" IN ('CONFIRMED','FINISHED')
          AND po."createdAt" >= $1
          AND po."createdAt" <= $2
          AND COALESCE(pref."country", $3) = $3`,
        period.start,
        period.end,
        profile.countryCode,
      );
      const serviceRows = await this.prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT COALESCE(SUM("revenueCents"), 0) AS "approvedLocalServicesCents"
         FROM "country_partner_local_services"
         WHERE "partnerId" = $1 AND "status" = 'VERIFIED'`,
        profile.id,
      );
      const row = paymentRows[0] ?? {};
      const approvedLocalServicesCents = Number(serviceRows[0]?.approvedLocalServicesCents ?? 0);
      const subscriptionRevenueCents = Number(row.subscriptionRevenueCents ?? 0);
      const renewalsCents = Number(row.renewalsCents ?? 0);
      const performancePartnerBusinessCents = Number(row.performancePartnerBusinessCents ?? 0);
      return {
        totalCents: subscriptionRevenueCents + renewalsCents + performancePartnerBusinessCents + approvedLocalServicesCents,
        currency: profile.currency,
        subscriptionRevenueCents,
        performancePartnerBusinessCents,
        renewalsCents,
        approvedLocalServicesCents,
        verifiedPaymentCount: Number(row.verifiedPaymentCount ?? 0),
        periodStart: period.start.toISOString(),
        periodEnd: period.end.toISOString(),
      };
    }, () => this.fallback.calculateBusinessVolume(profile, period));
  }

  async listLeads(partnerId: string) {
    return this.safe(async () => {
      const rows = await this.prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM "country_partner_leads" WHERE "partnerId" = $1 ORDER BY "updatedAt" DESC LIMIT 200`,
        partnerId,
      );
      return rows.map(leadFromRow);
    }, () => this.fallback.listLeads(partnerId));
  }

  async createLead(profile: CountryPartnerProfile, input: CountryPartnerLeadInput) {
    return this.safe(async () => {
      const rows = await this.prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `INSERT INTO "country_partner_leads" ("partnerId","name","email","phone","countryCode","interestType","estimatedValueCents","notes")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        profile.id,
        input.name,
        input.email ?? null,
        input.phone ?? null,
        profile.countryCode,
        input.interestType,
        input.estimatedValueCents,
        input.notes ?? null,
      );
      return leadFromRow(rows[0]);
    }, () => this.fallback.createLead(profile, input));
  }

  async listMarketingAssets(profile: CountryPartnerProfile) {
    return this.safe(async () => {
      const rows = await this.prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM "country_partner_marketing_assets"
         WHERE "countryCode" = $1 AND ("partnerId" IS NULL OR "partnerId" = $2) AND "status" IN ('APPROVED','LOCALIZED','PUBLISHED')
         ORDER BY "createdAt" DESC LIMIT 100`,
        profile.countryCode,
        profile.id,
      );
      return rows.map(assetFromRow);
    }, () => this.fallback.listMarketingAssets(profile));
  }

  async createMarketingAssets(profile: CountryPartnerProfile, assets: CountryPartnerMarketingAsset[]) {
    return this.safe(async () => {
      const created: CountryPartnerMarketingAsset[] = [];
      for (const asset of assets) {
        const rows = await this.prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `INSERT INTO "country_partner_marketing_assets" ("id","partnerId","countryCode","language","platform","contentType","campaignType","title","body","caption","script","localisation","approvedByHq","status")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14)
           RETURNING *`,
          asset.id,
          profile.id,
          asset.countryCode,
          asset.language,
          asset.platform,
          asset.contentType,
          asset.campaignType,
          asset.title,
          asset.body,
          asset.caption,
          asset.script,
          JSON.stringify(asset.localisation),
          asset.approvedByHq,
          asset.status,
        );
        created.push(assetFromRow(rows[0]));
      }
      return created;
    }, () => this.fallback.createMarketingAssets(profile, assets));
  }

  async audit(input: Parameters<CountryPartnerRepository["audit"]>[0]) {
    return this.safe(async () => {
      await this.prisma!.$executeRawUnsafe(
        `INSERT INTO "country_partner_audit_logs" ("partnerId","actorUserId","action","entityType","entityId","details")
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        input.partnerId ?? null,
        input.actorUserId ?? null,
        input.action,
        input.entityType,
        input.entityId ?? null,
        JSON.stringify(input.details ?? {}),
      );
    }, async () => {});
  }
}

export function virtualCountryPartnerProfile(user: { id: string; name: string }): CountryPartnerProfile {
  return {
    id: `virtual_partner_${user.id}`,
    userId: user.id,
    partnerName: user.name,
    countryCode: "UNASSIGNED",
    countryName: "Unassigned Territory",
    region: null,
    licenceStatus: "PENDING",
    licenceStartedAt: null,
    licenceExpiresAt: null,
    entryFeeCents: 300000,
    renewalFeeCents: 300000,
    currency: "USD",
    level: "Emerging",
    complianceScore: 0,
    localContactDetails: {},
    allowedCustomFields: ["contactDetails", "language", "currency"],
  };
}
