import type {
  FinancialConstitutionAllocation,
  FpfSeason,
  ParticipationPlan,
  SeasonOperatingModel,
} from "@fpf/shared";
import { COMPANY_POSITIONING, INTERNAL_PLATFORM_NAME, PUBLIC_BRAND_NAME } from "@fpf/shared";

export const defaultFpfSeason: FpfSeason = {
  id: "fpf-season-2026-27",
  name: "FPF Season 2026/27",
  status: "REGISTRATION",
  registrationOpensAt: "2026-07-01T00:00:00.000Z",
  seasonStartsAt: "2026-08-01T00:00:00.000Z",
  seasonEndsAt: "2027-05-31T23:59:59.000Z",
  settlementStartsAt: "2027-06-01T00:00:00.000Z",
  closingStartsAt: "2027-06-15T00:00:00.000Z",
  nextRegistrationOpensAt: "2027-07-01T00:00:00.000Z",
  totalWeeks: 44,
};

export const defaultParticipationPlans: ParticipationPlan[] = [
  {
    code: "FULL_SEASON",
    label: "Full Season",
    description: "Participation from season start through season settlement.",
    requiresActiveSeason: false,
  },
  {
    code: "HALF_SEASON",
    label: "Half Season",
    description: "Participation for a defined half-season period.",
    requiresActiveSeason: false,
  },
  {
    code: "REMAINING_SEASON",
    label: "Remaining Season",
    description: "Mid-season participation from approval date through season settlement.",
    requiresActiveSeason: true,
  },
];

export const defaultFinancialConstitution: FinancialConstitutionAllocation[] = [
  {
    type: "PERFORMANCE_PARTNER_DISTRIBUTION_POOL",
    label: "Performance Partner Distribution Pool",
    percent: 35,
    distributable: true,
    purpose: "Weekly Performance Partner distributions for eligible participation agreements.",
  },
  {
    type: "ANALYST_PERFORMANCE_POOL",
    label: "Analyst Performance Pool",
    percent: 15,
    distributable: true,
    purpose: "Weighted analyst rewards based on accuracy, quality, calibration, discipline, documentation, contribution, and improvement.",
  },
  {
    type: "RISK_STABILITY_RESERVE",
    label: "Risk & Stability Reserve",
    percent: 15,
    distributable: false,
    purpose: "Business continuity, financial protection, emergency operations, and long-term sustainability.",
  },
  {
    type: "COMPANY_GROWTH_OPERATIONS_FUND",
    label: "Company Growth & Operations Fund",
    percent: 35,
    distributable: false,
    purpose: "Infrastructure, APIs, technology, marketing, expansion, product development, legal, and compliance.",
  },
];

export const defaultSeasonNotices: SeasonOperatingModel["notices"] = {
  performancePartnerCompatibility:
    "Performance Partner is the user-facing model. Internally, legacy INVESTOR role and table names remain in place until a non-destructive migration is complete.",
  contractualPayout:
    "The contractual payout represents the complete financial obligation under the participation agreement. No additional capital repayment is due after completion.",
  noAutomaticRenewal:
    "Participation agreements expire at the end of the agreed participation period. Returning members register for the next season.",
  noRetroactiveDistribution:
    "Mid-season participants are eligible only from their approved participation start date. No retroactive distributions are created.",
};

export const defaultSeasonOperatingModel: SeasonOperatingModel = {
  brand: PUBLIC_BRAND_NAME,
  platform: INTERNAL_PLATFORM_NAME,
  positioning: COMPANY_POSITIONING,
  currentSeason: defaultFpfSeason,
  participationPlans: defaultParticipationPlans,
  financialConstitution: defaultFinancialConstitution,
  notices: defaultSeasonNotices,
};
