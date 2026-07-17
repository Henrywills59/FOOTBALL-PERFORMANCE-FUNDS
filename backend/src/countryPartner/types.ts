import type {
  CountryBusinessVolume,
  CountryPartnerAdminOverview,
  CountryPartnerCommissionRule,
  CountryPartnerDashboard,
  CountryPartnerLead,
  CountryPartnerLevelThreshold,
  CountryPartnerMarketingAsset,
  CountryPartnerProfile,
} from "@fpf/shared";

export const COUNTRY_PARTNER_ACCESS_ROLES = ["COUNTRY_PARTNER"] as const;
export const COUNTRY_PARTNER_HQ_ROLES = ["ADMIN", "CEO", "SUPER_ADMINISTRATOR"] as const;

export type CountryPartnerLeadInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  interestType: string;
  estimatedValueCents: number;
  notes?: string | null;
};

export type CountryPartnerSettingsInput = {
  rules?: Array<{
    ruleCode: string;
    label: string;
    revenueType: CountryPartnerCommissionRule["revenueType"];
    percent: number;
    active: boolean;
    notes?: string;
  }>;
  levels?: Array<{
    level: CountryPartnerLevelThreshold["level"];
    minimumCbvCents: number;
    active: boolean;
  }>;
};

export type CountryPartnerMarketingRequest = {
  language: string;
  campaignType: string;
  localContactDetails?: Record<string, unknown>;
};

export type CountryPartnerRepository = {
  findProfileByUserId(userId: string): Promise<CountryPartnerProfile | null>;
  listProfiles(): Promise<CountryPartnerProfile[]>;
  listCommissionRules(): Promise<CountryPartnerCommissionRule[]>;
  upsertCommissionRules(rules: CountryPartnerSettingsInput["rules"]): Promise<CountryPartnerCommissionRule[]>;
  listLevelThresholds(): Promise<CountryPartnerLevelThreshold[]>;
  upsertLevelThresholds(levels: CountryPartnerSettingsInput["levels"]): Promise<CountryPartnerLevelThreshold[]>;
  calculateBusinessVolume(profile: CountryPartnerProfile, period: { start: Date; end: Date }): Promise<CountryBusinessVolume>;
  listLeads(partnerId: string): Promise<CountryPartnerLead[]>;
  createLead(profile: CountryPartnerProfile, input: CountryPartnerLeadInput): Promise<CountryPartnerLead>;
  listMarketingAssets(profile: CountryPartnerProfile): Promise<CountryPartnerMarketingAsset[]>;
  createMarketingAssets(profile: CountryPartnerProfile, assets: CountryPartnerMarketingAsset[]): Promise<CountryPartnerMarketingAsset[]>;
  audit(input: { partnerId?: string | null; actorUserId?: string | null; action: string; entityType: string; entityId?: string | null; details?: Record<string, unknown> }): Promise<void>;
};

export type {
  CountryBusinessVolume,
  CountryPartnerAdminOverview,
  CountryPartnerCommissionRule,
  CountryPartnerDashboard,
  CountryPartnerLead,
  CountryPartnerLevelThreshold,
  CountryPartnerMarketingAsset,
  CountryPartnerProfile,
};
