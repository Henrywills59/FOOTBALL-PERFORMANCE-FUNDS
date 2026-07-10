import type { BusinessDashboard, CommercialStructure, InfrastructureProvider, ProcurementItem, RenewalReminder, SubscriptionRecord } from "@fpf/shared";

const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

export const defaultCommercialStructure: CommercialStructure = {
  subscriberPlans: [
    {
      code: "FREE_TRIAL",
      name: "Free Trial",
      monthlyPriceCents: 0,
      yearlyPriceCents: 0,
      trialDays: 7,
      gracePeriodDays: 0,
      highlighted: false,
      features: ["Limited AI intelligence preview", "Trial opportunity center", "Basic reports preview"],
      countryPricing: [],
    },
    {
      code: "STARTER",
      name: "Starter",
      monthlyPriceCents: 1900,
      yearlyPriceCents: 19000,
      trialDays: 0,
      gracePeriodDays: 7,
      highlighted: false,
      features: ["Basic AI predictions", "Limited daily opportunities", "Basic statistics", "Standard support"],
      countryPricing: [{ countryCode: "US", currency: "USD", monthlyPriceCents: 1900, yearlyPriceCents: 19000 }],
    },
    {
      code: "PROFESSIONAL",
      name: "Professional",
      monthlyPriceCents: 4900,
      yearlyPriceCents: 49000,
      trialDays: 0,
      gracePeriodDays: 7,
      highlighted: true,
      features: ["Full AI predictions", "Confidence scores", "Opportunity Centre", "Advanced statistics", "Notifications", "Priority support"],
      countryPricing: [{ countryCode: "US", currency: "USD", monthlyPriceCents: 4900, yearlyPriceCents: 49000 }],
    },
    {
      code: "PREMIUM",
      name: "Premium",
      monthlyPriceCents: 9900,
      yearlyPriceCents: 99000,
      trialDays: 0,
      gracePeriodDays: 10,
      highlighted: false,
      features: ["Everything in Pro", "Premium Intelligence", "Advanced analytics", "Executive reports", "Early feature access", "VIP support"],
      countryPricing: [{ countryCode: "US", currency: "USD", monthlyPriceCents: 9900, yearlyPriceCents: 99000 }],
    },
    {
      code: "ENTERPRISE",
      name: "Enterprise",
      monthlyPriceCents: 24900,
      yearlyPriceCents: 249000,
      trialDays: 0,
      gracePeriodDays: 14,
      highlighted: false,
      features: ["Custom intelligence workflows", "Executive reporting", "Dedicated support placeholder", "Team access placeholder"],
      countryPricing: [{ countryCode: "US", currency: "USD", monthlyPriceCents: 24900, yearlyPriceCents: 249000 }],
    },
  ],
  investorLevels: [
    { name: "Bronze", minimumInvestmentCents: 10000, badgeColor: "amber" },
    { name: "Silver", minimumInvestmentCents: 100000, badgeColor: "slate" },
    { name: "Gold", minimumInvestmentCents: 500000, badgeColor: "yellow" },
    { name: "Platinum", minimumInvestmentCents: 1000000, badgeColor: "emerald" },
    { name: "Diamond", minimumInvestmentCents: 5000000, badgeColor: "cyan" },
  ],
  lockPeriods: [
    { code: "SIX_MONTHS", label: "6 Months", months: 6, enabled: true },
    { code: "TWELVE_MONTHS", label: "12 Months", months: 12, enabled: true },
  ],
  investorPackages: [
    { id: "pkg_bronze", name: "Bronze", minimumAmountCents: 10000, maximumAmountCents: 49999, lockPeriodCode: "SIX_MONTHS", status: "ACTIVE", visible: true, projectedPerformanceNote: "Simulation only. No returns are guaranteed.", riskDisclosure: "Capital is at risk." },
    { id: "pkg_silver", name: "Silver", minimumAmountCents: 50000, maximumAmountCents: 99999, lockPeriodCode: "SIX_MONTHS", status: "ACTIVE", visible: true, projectedPerformanceNote: "Simulation only. No returns are guaranteed.", riskDisclosure: "Capital is at risk." },
    { id: "pkg_gold", name: "Gold", minimumAmountCents: 100000, maximumAmountCents: 499999, lockPeriodCode: "TWELVE_MONTHS", status: "ACTIVE", visible: true, projectedPerformanceNote: "Simulation only. No returns are guaranteed.", riskDisclosure: "Capital is at risk." },
    { id: "pkg_platinum", name: "Platinum", minimumAmountCents: 500000, maximumAmountCents: 999999, lockPeriodCode: "TWELVE_MONTHS", status: "ACTIVE", visible: true, projectedPerformanceNote: "Simulation only. No returns are guaranteed.", riskDisclosure: "Capital is at risk." },
    { id: "pkg_diamond", name: "Diamond", minimumAmountCents: 1000000, maximumAmountCents: null, lockPeriodCode: "TWELVE_MONTHS", status: "ACTIVE", visible: true, projectedPerformanceNote: "Simulation only. No returns are guaranteed.", riskDisclosure: "Capital is at risk." },
  ],
  pricingRules: [
    { id: "pricing_usd_default", name: "USD default pricing", countryCode: "US", currency: "USD", discountPercent: 0, couponCode: null, promotionType: "ADMIN_OVERRIDE", active: true },
    { id: "launch_placeholder", name: "Launch campaign placeholder", countryCode: null, currency: "USD", discountPercent: 10, couponCode: "FPF-LAUNCH", promotionType: "LAUNCH", active: false },
  ],
  minimumInvestmentCents: 10000,
  simulatorDefaults: {
    weeklyReturnPercent: 1.25,
    platformFeePercent: 10,
  },
  notices: {
    paymentPlaceholder: "Payment processing is not connected yet. These plans are commercial placeholders only.",
    investmentRisk: "Capital is at risk. Historical or simulated performance is not a guarantee of future results.",
    simulationOnly: "Simulation only. Returns are not guaranteed and actual results depend on real platform performance.",
  },
};

export const defaultSubscriptionRecord: SubscriptionRecord = {
  id: "subscription_placeholder",
  userId: "current-user",
  planCode: "FREE_TRIAL",
  status: "TRIAL",
  billingCycle: "MONTHLY",
  renewalDate: nextMonth,
  trialEndsAt: nextMonth,
  gracePeriodEndsAt: null,
  invoices: [],
  receipts: [],
  failedPayments: [],
  discounts: [],
  coupons: [],
  taxesPlaceholder: "Taxes are placeholder-only until billing providers are connected.",
};

export const defaultBusinessDashboard: BusinessDashboard = {
  monthlyRevenueCents: 0,
  annualRevenueCents: 0,
  mrrCents: 0,
  arrCents: 0,
  subscriberCount: 0,
  investorCount: 0,
  investmentCapitalCents: 0,
  weeklyDistributionsCents: 0,
  pendingDistributionsCents: 0,
  pendingRenewals: 0,
  platformGrowthPercent: 0,
  predictionAccuracyPercent: 0,
  marketingPerformance: "Media analytics are placeholder-only until providers are connected.",
  infrastructureCostCents: 0,
  apiCostCents: 0,
  systemHealth: "READY",
};

export const defaultInfrastructureProviders: InfrastructureProvider[] = [
  { id: "provider_vercel", providerName: "Vercel", purpose: "Frontend and backend hosting", monthlyCostCents: 0, annualCostCents: 0, renewalDate: nextYear, billingCycle: "ANNUAL", dashboardUrl: "https://vercel.com", documentationUrl: "https://vercel.com/docs", status: "ACTIVE", health: "GREEN", apiKeyStatus: "NOT_REQUIRED", productionStatus: "READY", developmentStatus: "READY", supportContact: null, category: "Hosting" },
  { id: "provider_supabase", providerName: "Supabase", purpose: "PostgreSQL database", monthlyCostCents: 0, annualCostCents: 0, renewalDate: nextYear, billingCycle: "ANNUAL", dashboardUrl: "https://supabase.com", documentationUrl: "https://supabase.com/docs", status: "ACTIVE", health: "GREEN", apiKeyStatus: "CONFIGURED", productionStatus: "READY", developmentStatus: "PLACEHOLDER", supportContact: null, category: "Infrastructure" },
  { id: "provider_api_football", providerName: "API-Football", purpose: "Football data provider", monthlyCostCents: 0, annualCostCents: 0, renewalDate: null, billingCycle: "MONTHLY", dashboardUrl: null, documentationUrl: null, status: "TRIAL", health: "AMBER", apiKeyStatus: "PLACEHOLDER", productionStatus: "PLACEHOLDER", developmentStatus: "PLACEHOLDER", supportContact: null, category: "Football APIs" },
];

export const defaultRenewals: RenewalReminder[] = [
  { id: "renewal_vercel", providerId: "provider_vercel", title: "Vercel annual renewal placeholder", dueAt: nextYear, reminderWindows: ["30 days", "14 days", "7 days", "3 days", "24 hours"], dashboardNotification: true, emailPlaceholder: true, whatsappPlaceholder: true, smsPlaceholder: true, status: "PENDING" },
];

export const defaultProcurement: ProcurementItem[] = [
  { id: "procurement_football_data", vendor: "Football data provider", plan: "Production data package placeholder", status: "PENDING_PURCHASE", license: null, invoice: null, costCents: 0, renewalDate: null },
];
