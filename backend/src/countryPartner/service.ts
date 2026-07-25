import crypto from "node:crypto";
import type {
  CountryPartnerAdminOverview,
  CountryPartnerCommissionRule,
  CountryPartnerDashboard,
  CountryPartnerLead,
  CountryPartnerMarketingAsset,
  CountryPartnerProfile,
} from "@fpf/shared";
import { virtualCountryPartnerProfile } from "./repository.js";
import type {
  CountryPartnerLeadInput,
  CountryPartnerMarketingRequest,
  CountryPartnerRepository,
  CountryPartnerSettingsInput,
} from "./types.js";

const platforms: CountryPartnerMarketingAsset["platform"][] = [
  "FACEBOOK",
  "INSTAGRAM",
  "TIKTOK",
  "LINKEDIN",
  "X",
  "TELEGRAM",
  "WHATSAPP",
  "YOUTUBE_SHORTS",
];

const contentTypes: CountryPartnerMarketingAsset["contentType"][] = [
  "POSTER",
  "REEL",
  "CAPTION",
  "SHORT_VIDEO",
  "VOICE_SCRIPT",
  "CAMPAIGN",
];

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function monthWindow() {
  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  return { start, end };
}

function percentRule(rules: CountryPartnerCommissionRule[], revenueType: CountryPartnerCommissionRule["revenueType"], fallback: number) {
  return rules.find((rule) => rule.active && rule.revenueType === revenueType)?.percent ?? fallback;
}

function commission(baseCents: number, percent: number) {
  return Math.round(baseCents * (percent / 100));
}

function complianceStatus(score: number) {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Ready";
  if (score >= 50) return "Needs Attention";
  return "Onboarding Required";
}

export class CountryPartnerService {
  constructor(private readonly repository: CountryPartnerRepository) {}

  async profileForUser(user: { id: string; name: string }) {
    return (await this.repository.findProfileByUserId(user.id)) ?? virtualCountryPartnerProfile(user);
  }

  async dashboard(user: { id: string; name: string }): Promise<CountryPartnerDashboard> {
    const profile = await this.profileForUser(user);
    const period = monthWindow();
    const [cbv, rules, leads, assets] = await Promise.all([
      this.repository.calculateBusinessVolume(profile, period),
      this.repository.listCommissionRules(),
      this.repository.listLeads(profile.id),
      this.repository.listMarketingAssets(profile),
    ]);
    const subscriptionPercent = percentRule(rules, "NET_SUBSCRIPTION_REVENUE", 30);
    const companyRevenuePercent = percentRule(rules, "ELIGIBLE_COMPANY_REVENUE", 20);
    const localServicesPercent = percentRule(rules, "APPROVED_LOCAL_SERVICE", 0);
    const subscriptionBase = cbv.subscriptionRevenueCents + cbv.renewalsCents;
    const commissionSummary = {
      totalCommissionCents:
        commission(subscriptionBase, subscriptionPercent) +
        commission(cbv.performancePartnerBusinessCents, companyRevenuePercent) +
        commission(cbv.approvedLocalServicesCents, localServicesPercent),
      currency: cbv.currency,
      subscriptionCommissionCents: commission(subscriptionBase, subscriptionPercent),
      eligibleCompanyRevenueCommissionCents: commission(cbv.performancePartnerBusinessCents, companyRevenuePercent),
      localServicesCommissionCents: commission(cbv.approvedLocalServicesCents, localServicesPercent),
      rules,
    };

    return {
      profile,
      cbv,
      commissionSummary,
      subscriberGrowth: [
        { label: "New leads", value: leads.filter((lead) => lead.status === "NEW").length },
        { label: "Qualified", value: leads.filter((lead) => lead.status === "QUALIFIED").length },
        { label: "Converted", value: leads.filter((lead) => lead.status === "CONVERTED").length },
      ],
      performancePartnerActivity: [
        {
          label: "Eligible company revenue",
          amountCents: cbv.performancePartnerBusinessCents,
          status: "Verified revenue only; contributed capital excluded",
        },
        {
          label: "Subscription and renewal revenue",
          amountCents: subscriptionBase,
          status: "Verified payments only",
        },
      ],
      marketing: {
        approvedAssets: assets,
        dailyContentStatus: assets.length ? "Approved localised content available" : "Ready to generate approved placeholder content",
        editableFields: profile.allowedCustomFields,
      },
      leadSummary: {
        total: leads.length,
        newLeads: leads.filter((lead) => lead.status === "NEW").length,
        qualified: leads.filter((lead) => lead.status === "QUALIFIED").length,
        converted: leads.filter((lead) => lead.status === "CONVERTED").length,
      },
      compliance: {
        score: profile.complianceScore,
        status: complianceStatus(profile.complianceScore),
        reminders: [
          "Use HQ-approved branding only.",
          "Do not present licence fees as investments.",
          "Do not promise ROI or fixed returns.",
          "All payments remain centrally processed by FPF Headquarters.",
        ],
      },
      licence: {
        status: profile.licenceStatus,
        entryFeeNotice: "Country Partner licence fee is not an investment and has no ROI entitlement.",
        renewalDueAt: profile.licenceExpiresAt,
        territoryRights: "Territory rights are performance-based and remain subject to Headquarters approval.",
      },
      reports: [
        {
          title: "Territory Overview",
          summary: `${profile.countryName} CBV is calculated from verified payments and approved local services only.`,
          generatedAt: new Date().toISOString(),
        },
        {
          title: "Governance Note",
          summary: "Treasury, Financial Engine, Company Capital Desk, provider secrets, and prediction approvals remain HQ-only.",
          generatedAt: new Date().toISOString(),
        },
      ],
    };
  }

  async leads(user: { id: string; name: string }) {
    const profile = await this.profileForUser(user);
    return this.repository.listLeads(profile.id);
  }

  async createLead(user: { id: string; name: string }, input: CountryPartnerLeadInput): Promise<CountryPartnerLead> {
    const profile = await this.profileForUser(user);
    const lead = await this.repository.createLead(profile, input);
    await this.repository.audit({
      partnerId: profile.id,
      actorUserId: user.id,
      action: "COUNTRY_PARTNER_LEAD_CREATED",
      entityType: "COUNTRY_PARTNER_LEAD",
      entityId: lead.id,
      details: { interestType: input.interestType, countryCode: profile.countryCode },
    });
    return lead;
  }

  async marketing(user: { id: string; name: string }) {
    const profile = await this.profileForUser(user);
    return {
      assets: await this.repository.listMarketingAssets(profile),
      editableFields: profile.allowedCustomFields,
      controls: {
        hqBrandingLocked: true,
        localCustomisationAllowed: profile.allowedCustomFields,
        prohibited: ["providerSecrets", "treasury", "financialEngine", "predictionApproval", "otherTerritories"],
      },
    };
  }

  async generateDailyMarketingContent(user: { id: string; name: string }, input: CountryPartnerMarketingRequest) {
    const profile = await this.profileForUser(user);
    const campaignType = input.campaignType || "Educational Campaign";
    const titleBase = `FPF ${profile.countryName} ${campaignType}`;
    const assets = platforms.map((platform, index): CountryPartnerMarketingAsset => {
      const contentType = contentTypes[index % contentTypes.length];
      return {
        id: id("cp_asset"),
        partnerId: profile.id,
        countryCode: profile.countryCode,
        language: input.language || "en",
        platform,
        contentType,
        campaignType,
        title: `${titleBase} - ${platform.replaceAll("_", " ")}`,
        body:
          "Football Performance Fund uses institutional football intelligence, risk controls, and approved performance reporting. This localised content is a placeholder pending HQ creative approval.",
        caption:
          "We Don't Chase Luck. We Build Performance. Football intelligence with risk-first discipline. Results are never guaranteed.",
        script:
          contentType === "VOICE_SCRIPT" || contentType === "SHORT_VIDEO" || contentType === "REEL"
            ? "Introduce FPF, explain intelligence-led discipline, include risk warning, and direct users to official FPF channels."
            : null,
        localisation: {
          country: profile.countryName,
          currency: profile.currency,
          contactDetails: input.localContactDetails ?? profile.localContactDetails,
          editableFields: profile.allowedCustomFields,
        },
        approvedByHq: true,
        status: "APPROVED",
        createdAt: new Date().toISOString(),
      };
    });
    const created = await this.repository.createMarketingAssets(profile, assets);
    await this.repository.audit({
      partnerId: profile.id,
      actorUserId: user.id,
      action: "COUNTRY_PARTNER_MARKETING_CONTENT_GENERATED",
      entityType: "COUNTRY_PARTNER_MARKETING_ASSET",
      details: { campaignType, count: created.length, language: input.language },
    });
    return { assets: created };
  }

  async adminOverview(): Promise<CountryPartnerAdminOverview> {
    const partners = await this.repository.listProfiles();
    const rules = await this.repository.listCommissionRules();
    const levels = await this.repository.listLevelThresholds();
    const period = monthWindow();
    const volumes = await Promise.all(partners.map((profile) => this.repository.calculateBusinessVolume(profile, period)));
    return {
      partners,
      rules,
      levels,
      totalCbvCents: volumes.reduce((total, cbv) => total + cbv.totalCents, 0),
      activePartners: partners.filter((partner) => partner.licenceStatus === "ACTIVE").length,
      pendingRenewals: partners.filter((partner) => partner.licenceStatus === "RENEWAL_DUE").length,
    };
  }

  async updateSettings(actorUserId: string, input: CountryPartnerSettingsInput) {
    const [rules, levels] = await Promise.all([
      this.repository.upsertCommissionRules(input.rules),
      this.repository.upsertLevelThresholds(input.levels),
    ]);
    await this.repository.audit({
      actorUserId,
      action: "COUNTRY_PARTNER_SETTINGS_UPDATED",
      entityType: "COUNTRY_PARTNER_SETTINGS",
      details: { rules: input.rules?.map((rule) => rule.ruleCode) ?? [], levels: input.levels?.map((level) => level.level) ?? [] },
    });
    return { rules, levels };
  }
}
