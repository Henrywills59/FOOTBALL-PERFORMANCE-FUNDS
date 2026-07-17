export const PUBLIC_USER_ROLES = ["SUBSCRIBER", "INVESTOR", "ANALYST"] as const;

export type UserRole =
  | "SUBSCRIBER"
  | "INVESTOR"
  | "ANALYST"
  | "ADMIN"
  | "CEO"
  | "FINANCE"
  | "RISK_MANAGER"
  | "CAPITAL_MANAGER"
  | "SUPER_ADMINISTRATOR"
  | "COUNTRY_PARTNER";
export type PublicUserRole = (typeof PUBLIC_USER_ROLES)[number];
export type AccountStatus = "ACTIVE" | "DISABLED";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
};

export type AuthResponse = {
  user: AuthUser;
  token: string;
  expiresIn: string;
};

export type FootballFixtureStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";

export type FootballFixtureSummary = {
  id: string;
  apiFootballFixtureId: number;
  leagueName: string;
  leagueCountry: string | null;
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: string;
  status: FootballFixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
};

export type FootballFixtureDetail = FootballFixtureSummary & {
  season: number;
  round: string | null;
  referee: string | null;
  standings: Array<{
    teamName: string;
    rank: number;
    points: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
  }>;
  injuries: Array<{
    playerName: string;
    teamName: string;
    reason: string | null;
  }>;
  odds: Array<{
    id: string;
    bookmaker: string;
    market: string;
    outcome: string;
    price: number;
    updatedAt: string;
  }>;
  headToHeadRecords: Array<{
    id: string;
    updatedAt: string;
  }>;
};

export type PredictionApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type PredictionDataQualityStatus = "READY" | "INSUFFICIENT_DATA" | "STALE_ODDS";

export type PredictionResult = {
  id?: string;
  fixtureId: string;
  recommendedMarket: string;
  predictedOutcome: string;
  confidenceScore: number;
  riskScore: number;
  valueRating: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  explanation: string;
  adminNotes?: string | null;
  dataQualityStatus: PredictionDataQualityStatus;
  approvalStatus: PredictionApprovalStatus;
  edge: number | null;
  impliedProbability: number | null;
  modelProbability: number | null;
  staleOdds: boolean;
  riskyMarket: boolean;
  createdAt?: string;
};

export type AdminOverview = {
  totalUsers: number;
  activeSubscribers: number;
  activeInvestors: number;
  todaysFixtures: number;
  pendingPredictions: number;
  approvedPredictions: number;
  systemHealth: "OK" | "DEGRADED";
};

export type AdminUser = AuthUser & {
  subscriptionPlan: string;
};

export type AuditLogEntry = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
};

export type AdminSettings = {
  predictionConfidenceThreshold: number;
  riskThreshold: number;
  maximumSelections: number;
  scheduledSyncEnabled: boolean;
  maintenanceMode: boolean;
  enabledLanguages?: string[];
  enabledCurrencies?: string[];
  defaultLanguage?: string;
  defaultCurrency?: string;
  minimumInvestmentCents?: number;
  enabledLockPeriods?: string[];
  defaultSimulationWeeklyReturnPercent?: number;
  defaultPlatformFeePercent?: number;
};

export type SubscriberPlanCode = "FREE_TRIAL" | "STARTER" | "PRO" | "PROFESSIONAL" | "PREMIUM" | "ENTERPRISE" | "ELITE";

export type SubscriberPlan = {
  code: SubscriberPlanCode;
  name: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  trialDays?: number;
  gracePeriodDays?: number;
  countryPricing?: Array<{ countryCode: string; currency: string; monthlyPriceCents: number; yearlyPriceCents: number }>;
  features: string[];
  highlighted: boolean;
};

export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "GRACE_PERIOD" | "CANCELLED" | "EXPIRED";
export type BillingCycle = "MONTHLY" | "ANNUAL";

export type SubscriptionRecord = {
  id: string;
  userId: string;
  planCode: SubscriberPlanCode;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  renewalDate: string | null;
  trialEndsAt: string | null;
  gracePeriodEndsAt: string | null;
  invoices: Array<{ id: string; amountCents: number; currency: string; status: string; issuedAt: string }>;
  receipts: Array<{ id: string; amountCents: number; currency: string; issuedAt: string }>;
  failedPayments: Array<{ id: string; reason: string; attemptedAt: string }>;
  discounts: string[];
  coupons: string[];
  taxesPlaceholder: string;
};

export type InvestorLevel = {
  name: "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";
  minimumInvestmentCents: number;
  badgeColor: string;
};

export type InvestmentLockPeriod = {
  code: "SIX_MONTHS" | "TWELVE_MONTHS";
  label: string;
  months: number;
  enabled: boolean;
};

export type ParticipationPlan = {
  code: "HALF_SEASON" | "FULL_SEASON" | "REMAINING_SEASON";
  label: string;
  description: string;
  requiresActiveSeason: boolean;
};

export type ParticipationAgreementStatus =
  | "DRAFT"
  | "ACTIVE"
  | "SETTLEMENT"
  | "COMPLETED"
  | "RENEWAL_OPEN"
  | "EXPIRED"
  | "CANCELLED";

export type InvestorPackage = {
  id: string;
  name: "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | string;
  minimumAmountCents: number;
  maximumAmountCents: number | null;
  lockPeriodCode: InvestmentLockPeriod["code"];
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  visible: boolean;
  projectedPerformanceNote: string;
  riskDisclosure: string;
};

export type InvestmentLockSnapshot = {
  investmentId: string;
  investmentDate: string;
  unlockDate: string;
  remainingDays: number;
  completionPercentage: number;
  status: "LOCKED" | "UNLOCKING_SOON" | "UNLOCKED" | "COMPLETED";
};

export type PricingRule = {
  id: string;
  name: string;
  countryCode: string | null;
  currency: string;
  discountPercent: number;
  couponCode: string | null;
  promotionType: "DISCOUNT" | "REFERRAL" | "LAUNCH" | "SEASONAL" | "ADMIN_OVERRIDE";
  active: boolean;
};

export type BusinessDashboard = {
  monthlyRevenueCents: number;
  annualRevenueCents: number;
  mrrCents: number;
  arrCents: number;
  subscriberCount: number;
  investorCount: number;
  investmentCapitalCents: number;
  weeklyDistributionsCents: number;
  pendingDistributionsCents: number;
  pendingRenewals: number;
  platformGrowthPercent: number;
  predictionAccuracyPercent: number;
  marketingPerformance: string;
  infrastructureCostCents: number;
  apiCostCents: number;
  systemHealth: "READY" | "DEGRADED";
};

export type InfrastructureProvider = {
  id: string;
  providerName: string;
  purpose: string;
  monthlyCostCents: number;
  annualCostCents: number;
  renewalDate: string | null;
  billingCycle: BillingCycle;
  dashboardUrl: string | null;
  documentationUrl: string | null;
  status: "ACTIVE" | "TRIAL" | "PAUSED" | "EXPIRED";
  health: "GREEN" | "AMBER" | "RED";
  apiKeyStatus: "NOT_REQUIRED" | "CONFIGURED" | "MISSING" | "PLACEHOLDER";
  productionStatus: "READY" | "PLACEHOLDER" | "NOT_CONNECTED";
  developmentStatus: "READY" | "PLACEHOLDER" | "NOT_CONNECTED";
  supportContact: string | null;
  category: "Football APIs" | "AI APIs" | "Payments" | "Messaging" | "Infrastructure" | "Hosting" | "Domains" | "Analytics" | "Security" | "Marketing";
};

export type RenewalReminder = {
  id: string;
  providerId: string | null;
  title: string;
  dueAt: string;
  reminderWindows: string[];
  dashboardNotification: boolean;
  emailPlaceholder: boolean;
  whatsappPlaceholder: boolean;
  smsPlaceholder: boolean;
  status: "PENDING" | "SENT_PLACEHOLDER" | "DISMISSED";
};

export type ProcurementItem = {
  id: string;
  vendor: string;
  plan: string;
  status: "PURCHASED" | "PENDING_PURCHASE" | "CANCELLED" | "TRIAL" | "EXPIRED" | "RENEWAL_PENDING";
  license: string | null;
  invoice: string | null;
  costCents: number;
  renewalDate: string | null;
};

export type CommercialStructure = {
  subscriberPlans: SubscriberPlan[];
  investorLevels: InvestorLevel[];
  investorPackages: InvestorPackage[];
  participationPlans: ParticipationPlan[];
  lockPeriods: InvestmentLockPeriod[];
  pricingRules: PricingRule[];
  minimumInvestmentCents: number;
  simulatorDefaults: {
    weeklyReturnPercent: number;
    platformFeePercent: number;
  };
  notices: {
    paymentPlaceholder: string;
    investmentRisk: string;
    simulationOnly: string;
    performancePartnerCompatibility: string;
    contractualPayout: string;
  };
};

export type CommercialControlCenter = {
  structure: CommercialStructure;
  businessDashboard: BusinessDashboard;
  subscription: SubscriptionRecord;
  lockSnapshots: InvestmentLockSnapshot[];
  infrastructureProviders: InfrastructureProvider[];
  renewals: RenewalReminder[];
  procurement: ProcurementItem[];
};

export type OperationalReportStatus = "DRAFT" | "GENERATING" | "READY" | "FAILED" | "ARCHIVED";
export type OperationalReportType =
  | "SUBSCRIBER"
  | "INVESTOR"
  | "PREDICTION_PERFORMANCE"
  | "ANALYST_PERFORMANCE"
  | "CAMPAIGN"
  | "PLATFORM_ACTIVITY"
  | "FINANCIAL_SUMMARY"
  | "DISTRIBUTION"
  | "USER_GROWTH"
  | "SYSTEM_HEALTH";

export type OperationalReport = {
  id: string;
  title: string;
  type: OperationalReportType;
  status: OperationalReportStatus;
  ownerUserId: string | null;
  ownerRole: UserRole | "ALL" | null;
  filters: Record<string, unknown>;
  summary: string;
  data: Record<string, unknown>;
  errorMessage: string | null;
  generatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MonitoringHealthLevel = "GREEN" | "AMBER" | "RED";
export type MonitoringComponentHealth = {
  name: string;
  status: MonitoringHealthLevel;
  message: string;
  lastCheckedAt: string;
};

export type MonitoringOverview = {
  components: MonitoringComponentHealth[];
  errorCounts: { lastHour: number; lastDay: number };
  failedJobs: number;
  slowEndpoints: Array<{ endpoint: string; averageMs: number; status: MonitoringHealthLevel }>;
  dataFreshness: Array<{ source: string; lastUpdatedAt: string | null; status: MonitoringHealthLevel }>;
  lastSuccessfulDeployment: string | null;
  lastHealthCheck: string;
  activeIncidents: number;
  providerPlaceholders: string[];
};

export type IncidentStatus = "OPEN" | "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED" | "CLOSED";
export type IncidentSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type SystemIncident = {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedModules: string[];
  assignedToUserId: string | null;
  rootCause: string | null;
  resolution: string | null;
  archived: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type NotificationCategory =
  | "PREDICTION_PUBLISHED"
  | "PREDICTION_UPDATED"
  | "REPORT_READY"
  | "DISTRIBUTION_CALCULATED"
  | "DISTRIBUTION_APPROVED"
  | "DISTRIBUTION_PAID"
  | "ACCOUNT_ACTION_REQUIRED"
  | "SECURITY_ALERT"
  | "SYSTEM_MAINTENANCE"
  | "CAMPAIGN_UPDATE"
  | "GENERAL_ANNOUNCEMENT";

export type NotificationStatus = "UNREAD" | "READ" | "ARCHIVED" | "FAILED";

export type OperationalNotification = {
  id: string;
  userId: string;
  category: NotificationCategory;
  status: NotificationStatus;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
};

export type NotificationPreferences = {
  userId: string;
  inAppEnabled: boolean;
  emailPlaceholderEnabled: boolean;
  smsPlaceholderEnabled: boolean;
  whatsappPlaceholderEnabled: boolean;
  pushPlaceholderEnabled: boolean;
  marketingEnabled: boolean;
  financialEnabled: boolean;
  predictionEnabled: boolean;
  securityEnabled: boolean;
  updatedAt: string;
};

export type AnnouncementStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "EXPIRED" | "ARCHIVED";

export type AdminAnnouncement = {
  id: string;
  title: string;
  message: string;
  status: AnnouncementStatus;
  targetRoles: Array<UserRole | "ALL" | "EXECUTIVE" | "MEDIA_TEAM">;
  targetCountries: string[];
  targetLanguages: string[];
  targetSubscriptionPlans: string[];
  scheduledAt: string | null;
  expiresAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type MediaContentStatus = "DRAFT" | "REVIEW" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type MediaContentType =
  | "ARTICLE"
  | "MATCH_PREVIEW"
  | "MATCH_REVIEW"
  | "PREDICTION_EXPLANATION"
  | "INVESTOR_UPDATE"
  | "COMPANY_ANNOUNCEMENT"
  | "EDUCATIONAL_POST"
  | "PROMOTIONAL_CAMPAIGN"
  | "SUBSCRIBER_NEWSLETTER";
export type MediaCampaignType = "LAUNCH" | "EDUCATION" | "PREDICTIONS" | "INVESTOR" | "REFERRAL" | "SUBSCRIPTION" | "HOLIDAY" | "BRAND_AWARENESS";
export type MediaCampaignStatus = "DRAFT" | "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type MediaPlatform = "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "X" | "LINKEDIN" | "TELEGRAM" | "WHATSAPP_CHANNELS" | "YOUTUBE_COMMUNITY" | "DISCORD";

export type MediaCampaign = {
  id: string;
  name: string;
  type: MediaCampaignType;
  status: MediaCampaignStatus;
  objective: string;
  startDate: string | null;
  endDate: string | null;
  budgetCents: number;
  createdAt: string;
  updatedAt: string;
};

export type MediaPost = {
  id: string;
  campaignId: string | null;
  title: string;
  contentType: MediaContentType;
  status: MediaContentStatus;
  body: string;
  language: string;
  country: string | null;
  audience: string;
  platforms: MediaPlatform[];
  scheduledAt: string | null;
  timezone: string;
  createdByUserId: string;
  approvedByUserId: string | null;
  publishedAt: string | null;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MediaAsset = {
  id: string;
  name: string;
  assetType: "LOGO" | "FONT" | "COLOR" | "IMAGE" | "VIDEO" | "BACKGROUND" | "SPONSOR_ASSET" | "MEDIA_KIT" | "DOCUMENT" | "TEMPLATE";
  url: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type MediaAnalytics = {
  views: number;
  clicks: number;
  ctr: number;
  conversions: number;
  subscriptions: number;
  investorSignups: number;
  revenueAttributionCents: number;
  campaignRoi: number;
  growthTrends: Array<{ label: string; value: number }>;
};

export type MediaProviderStatus = {
  name: string;
  configured: boolean;
  mode: "PLACEHOLDER";
};

export type CountryPartnerLicenceStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "EXPIRED" | "RENEWAL_DUE" | "TERMINATED";
export type CountryPartnerLevelName = "Emerging" | "Bronze" | "Silver" | "Gold" | "Platinum";
export type CountryPartnerLeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";
export type CountryPartnerMarketingPlatform =
  | "FACEBOOK"
  | "INSTAGRAM"
  | "TIKTOK"
  | "LINKEDIN"
  | "X"
  | "TELEGRAM"
  | "WHATSAPP"
  | "YOUTUBE_SHORTS";
export type CountryPartnerMarketingContentType = "POSTER" | "REEL" | "CAPTION" | "SHORT_VIDEO" | "VOICE_SCRIPT" | "CAMPAIGN";

export type CountryPartnerProfile = {
  id: string;
  userId: string;
  partnerName: string;
  countryCode: string;
  countryName: string;
  region: string | null;
  licenceStatus: CountryPartnerLicenceStatus;
  licenceStartedAt: string | null;
  licenceExpiresAt: string | null;
  entryFeeCents: number;
  renewalFeeCents: number;
  currency: string;
  level: CountryPartnerLevelName;
  complianceScore: number;
  localContactDetails: Record<string, unknown>;
  allowedCustomFields: string[];
};

export type CountryPartnerCommissionRule = {
  id: string;
  ruleCode: string;
  label: string;
  revenueType: "NET_SUBSCRIPTION_REVENUE" | "ELIGIBLE_COMPANY_REVENUE" | "APPROVED_LOCAL_SERVICE";
  percent: number;
  active: boolean;
  notes: string;
};

export type CountryPartnerLevelThreshold = {
  level: CountryPartnerLevelName;
  minimumCbvCents: number;
  active: boolean;
};

export type CountryBusinessVolume = {
  totalCents: number;
  currency: string;
  subscriptionRevenueCents: number;
  performancePartnerBusinessCents: number;
  renewalsCents: number;
  approvedLocalServicesCents: number;
  verifiedPaymentCount: number;
  periodStart: string;
  periodEnd: string;
};

export type CountryPartnerCommissionSummary = {
  totalCommissionCents: number;
  currency: string;
  subscriptionCommissionCents: number;
  eligibleCompanyRevenueCommissionCents: number;
  localServicesCommissionCents: number;
  rules: CountryPartnerCommissionRule[];
};

export type CountryPartnerLead = {
  id: string;
  partnerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  countryCode: string;
  interestType: string;
  status: CountryPartnerLeadStatus;
  estimatedValueCents: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CountryPartnerMarketingAsset = {
  id: string;
  partnerId: string | null;
  countryCode: string;
  language: string;
  platform: CountryPartnerMarketingPlatform;
  contentType: CountryPartnerMarketingContentType;
  campaignType: string;
  title: string;
  body: string;
  caption: string;
  script: string | null;
  localisation: Record<string, unknown>;
  approvedByHq: boolean;
  status: "DRAFT" | "APPROVED" | "LOCALIZED" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
};

export type CountryPartnerDashboard = {
  profile: CountryPartnerProfile;
  cbv: CountryBusinessVolume;
  commissionSummary: CountryPartnerCommissionSummary;
  subscriberGrowth: Array<{ label: string; value: number }>;
  performancePartnerActivity: Array<{ label: string; amountCents: number; status: string }>;
  marketing: {
    approvedAssets: CountryPartnerMarketingAsset[];
    dailyContentStatus: string;
    editableFields: string[];
  };
  leadSummary: {
    total: number;
    newLeads: number;
    qualified: number;
    converted: number;
  };
  compliance: {
    score: number;
    status: string;
    reminders: string[];
  };
  licence: {
    status: CountryPartnerLicenceStatus;
    entryFeeNotice: string;
    renewalDueAt: string | null;
    territoryRights: string;
  };
  reports: Array<{ title: string; summary: string; generatedAt: string }>;
};

export type CountryPartnerAdminOverview = {
  partners: CountryPartnerProfile[];
  rules: CountryPartnerCommissionRule[];
  levels: CountryPartnerLevelThreshold[];
  totalCbvCents: number;
  activePartners: number;
  pendingRenewals: number;
};

export type MediaDashboard = {
  campaignOverview: { total: number; running: number; scheduled: number };
  scheduledPosts: number;
  publishedPosts: number;
  drafts: number;
  aiGeneratedContent: number;
  approvalQueue: number;
  performance: MediaAnalytics;
  engagementSummary: string;
  audienceGrowth: number;
  clickTracking: number;
  conversionTracking: number;
  platformHealth: MediaProviderStatus[];
  campaigns: MediaCampaign[];
  posts: MediaPost[];
  assets: MediaAsset[];
};

export type SupportedLanguageCode = "en" | "fr" | "es" | "pt" | "de" | "it" | "ar" | "zh";
export type SupportedCurrencyCode = "USD" | "EUR" | "GBP" | "UGX" | "KES" | "TZS" | "NGN" | "ZAR" | "CAD" | "AUD";

export type LanguageSetting = {
  code: SupportedLanguageCode;
  name: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  enabled: boolean;
};

export type CurrencySetting = {
  code: SupportedCurrencyCode;
  name: string;
  symbol: string;
  placeholderRateFromUsd: number;
  enabled: boolean;
};

export type TimezoneSetting = {
  id: string;
  label: string;
  offset: string;
  enabled: boolean;
};

export type CountrySetting = {
  countryCode: string;
  countryName: string;
  region: string;
  defaultLanguage: SupportedLanguageCode;
  defaultCurrency: SupportedCurrencyCode;
  defaultTimezone: string;
  measurementSystem: "metric" | "imperial";
  dateFormat: string;
  numberFormat: string;
};

export type UserGlobalPreferences = {
  language: SupportedLanguageCode;
  currency: SupportedCurrencyCode;
  timezone: string;
  country: string;
  region: string;
  measurementSystem: "metric" | "imperial";
  dateFormat: string;
  numberFormat: string;
};

export type GlobalizationBootstrap = {
  languages: LanguageSetting[];
  currencies: CurrencySetting[];
  timezones: TimezoneSetting[];
  countrySettings: CountrySetting[];
  preferences: UserGlobalPreferences;
};

export type ThemePreference = "dark" | "light" | "system";

export type PublicPlatformStatus = "OPERATIONAL" | "PREPARING" | "DEGRADED" | "MAINTENANCE" | "PROVIDER_PENDING";

export type PublicExperience = {
  generatedAt: string;
  activity: {
    fixturesMonitored: number;
    liveMatches: number;
    analysisJobsCompletedToday: number;
    analystReviewsCompleted: number;
    pendingApproval: number;
    reportsPending: number;
    leaguesCovered: number;
    approvedOpportunities: number;
    lastSuccessfulDataRefresh: string | null;
    platformStatus: PublicPlatformStatus;
    safeState: string;
  };
  intelligencePreview: {
    providerConnected: boolean;
    status: "DATA_COLLECTION" | "AI_ANALYSIS" | "ANALYST_REVIEW" | "ADMIN_REVIEW" | "APPROVED" | "PUBLISHED_TO_MEMBERS" | "ARCHIVED" | "PROVIDER_PENDING";
    message: string;
    fixtures: Array<{
      match: string;
      league: string;
      country: string;
      kickoffTime: string;
      intelligenceStatus: string;
      analystReviewStatus: string;
      riskClassification: string;
      confidenceBand: string;
      dataFreshness: string;
      publicationStatus: string;
    }>;
  };
  performance: {
    liveVerifiedResults: Array<{
      date: string;
      market: string;
      publishedOdds: number;
      result: string;
      stakeUnit: number;
      returnUnit: number;
      netResultUnit: number;
      verificationStatus: string;
    }>;
    preLaunchModelTesting: {
      label: string;
      status: string;
      methodology: string;
      notice: string;
    };
    currentReportingPeriod: {
      status: string;
      positionsSettled: number;
      positionsPending: number;
      reportingCompletion: number;
      reconciliationStatus: string;
    };
  };
  trust: {
    websiteStatus: PublicPlatformStatus;
    backendStatus: PublicPlatformStatus;
    paymentProviderStatus: PublicPlatformStatus;
    footballDataStatus: PublicPlatformStatus;
    notificationProviderStatus: PublicPlatformStatus;
    monitoringStatus: PublicPlatformStatus;
    treasuryReconciliationStatus: PublicPlatformStatus;
    lastPlatformUpdate: string;
    latestCompletedReportingPeriod: string | null;
    riskManagementPolicy: string;
    responsibleParticipationPolicy: string;
    privacySummary: string;
  };
  milestones: Array<{ title: string; status: "VERIFIED" | "PREPARING"; date: string | null }>;
  foundingMembers: {
    enabled: boolean;
    labels: string[];
    benefits: string[];
    seatLimit: number | null;
    message: string;
  };
  commercial: {
    subscriberPlans: SubscriberPlan[];
    investorPackages: InvestorPackage[];
    lockPeriods: InvestmentLockPeriod[];
    minimumInvestmentCents: number;
    paymentConfigured: boolean;
  };
  contentControls: {
    adminManaged: boolean;
    editableAreas: string[];
  };
};

export type AdminReports = {
  subscribers: {
    total: number;
    active: number;
    disabled: number;
  };
  investors: {
    total: number;
    active: number;
  };
  revenue: {
    trackedWalletDepositsCents: number;
    note: string;
  };
  withdrawals: {
    pendingCount: number;
    approvedCount: number;
    pendingAmountCents: number;
    approvedAmountCents: number;
  };
  analystPerformance: {
    submitted: number;
    approved: number;
    published: number;
    rejected: number;
  };
  predictionAccuracy: {
    approvedPredictions: number;
    publishedIntelligence: number;
    accuracyNote: string;
  };
  dailyPlatformActivity: Array<{
    date: string;
    auditEvents: number;
    logins: number;
  }>;
};

export type PlatformHealth = {
  api: "OK";
  database: "OK" | "DEGRADED";
  footballJobs: "RUNNING" | "STOPPED";
  lastSyncAt: string | null;
  version: string;
};

export type InvestmentPlan = {
  id: string;
  name: string;
  description: string;
  minimumInvestmentCents: number;
  maximumInvestmentCents: number;
  historicalPerformanceNote: string;
  riskDisclosure: string;
};

export type InvestorInvestment = {
  id: string;
  planName: string;
  amountCents: number;
  currentValueCents: number;
  weeklyRoiPercent: number;
  lifetimeRoiPercent: number;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  createdAt: string;
};

export type InvestorReport = {
  id: string;
  investmentId: string;
  periodType: "WEEKLY" | "MONTHLY";
  summary: string;
  roiPercent: number;
  portfolioValueCents: number;
  periodStart: string;
  periodEnd: string;
};

export type InvestorDistributionStatus =
  | "PENDING_CALCULATION"
  | "CALCULATED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PAID"
  | "FAILED"
  | "CANCELLED";

export type InvestorSimulatorWithdrawalFrequency = "NONE" | "WEEKLY" | "MONTHLY" | "END_OF_TERM";

export type InvestorSimulatorInput = {
  investmentAmountCents: number;
  expectedWeeklyReturnPercent: number;
  numberOfWeeks: number;
  reinvest: boolean;
  withdrawalFrequency: InvestorSimulatorWithdrawalFrequency;
  platformFeePercent: number;
};

export type InvestorSimulatorWeek = {
  week: number;
  startingBalanceCents: number;
  grossEarningsCents: number;
  platformFeeCents: number;
  netEarningsCents: number;
  distributionCents: number;
  endingBalanceCents: number;
};

export type InvestorSimulatorResult = {
  input: InvestorSimulatorInput;
  netProjectedEarningsCents: number;
  totalProjectedBalanceCents: number;
  totalDistributionsCents: number;
  platformFeesCents: number;
  weeks: InvestorSimulatorWeek[];
  riskWarning: string;
  simulationNotice: string;
  payoutNotice: string;
};

export type InvestorAccount = {
  id: string;
  userId: string;
  name: string;
  email: string;
  tier: string;
  accountStatus: "ACTIVE" | "DISABLED";
  kycStatus: string;
  agreementStatus: string;
  paymentMethod: string;
  withdrawalMethod: string;
  investmentAmountCents: number;
  startDate: string | null;
  riskNotice: string;
  createdAt: string;
  updatedAt: string;
};

export type InvestorBalance = {
  totalCapitalCents: number;
  activeInvestmentBalanceCents: number;
  weeklyEarningsCents: number;
  totalEarningsCents: number;
  pendingDistributionCents: number;
  paidDistributionCents: number;
  updatedAt: string | null;
};

export type InvestorDistribution = {
  id: string;
  investorAccountId: string;
  investorName: string;
  investorEmail: string;
  batchId: string | null;
  periodStart: string;
  periodEnd: string;
  capitalBaseCents: number;
  returnRatePercent: number;
  grossReturnCents: number;
  platformFeeCents: number;
  netDistributionCents: number;
  status: InvestorDistributionStatus;
  adminNotes: string | null;
  calculatedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvestorDistributionBatch = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: InvestorDistributionStatus;
  totalCapitalCents: number;
  totalGrossReturnCents: number;
  totalNetDistributionCents: number;
  investorCount: number;
  createdAt: string;
  updatedAt: string;
};

export type InvestorAuditLog = {
  id: string;
  investorAccountId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: unknown;
  createdAt: string;
};

export type InvestorNote = {
  id: string;
  investorAccountId: string;
  authorUserId: string | null;
  note: string;
  createdAt: string;
};

export type InvestorPortalReport = {
  id: string;
  investorAccountId: string;
  periodType: "WEEKLY" | "MONTHLY";
  title: string;
  summary: string;
  earningsCents: number;
  capitalCents: number;
  roiPercent: number;
  downloadUrl: string | null;
  generatedAt: string;
};

export type WithdrawalRequest = {
  id: string;
  amountCents: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  reviewedAt: string | null;
  adminNotes: string | null;
};

export type InvestorDashboard = {
  totalInvestmentCents: number;
  currentPortfolioValueCents: number;
  weeklyRoiPercent: number;
  lifetimeRoiPercent: number;
  currentStatus: string;
  investmentHistory: InvestorInvestment[];
  account: InvestorAccount;
  balance: InvestorBalance;
  nextDistributionDate: string;
  distributionStatus: InvestorDistributionStatus;
  weeklyEarningsCents: number;
  totalEarningsCents: number;
  investorTier: string;
  accountStatus: "ACTIVE" | "DISABLED";
  riskNotice: string;
  performanceChart: Array<{ label: string; valueCents: number }>;
  recentDistributions: InvestorDistribution[];
  transparencyNote: string;
};

export type InvestorProfile = {
  account: InvestorAccount;
  balance: InvestorBalance;
  activeInvestments: InvestorInvestment[];
};

export type AdminInvestorSummary = {
  id: string;
  userId: string;
  name: string;
  email: string;
  tier: string;
  accountStatus: "ACTIVE" | "DISABLED";
  kycStatus: string;
  agreementStatus: string;
  totalCapitalCents: number;
  activeInvestmentBalanceCents: number;
  pendingDistributionCents: number;
  paidDistributionCents: number;
  createdAt: string;
};

export type AdminInvestorDetail = {
  investor: AdminInvestorSummary;
  profile: InvestorProfile;
  distributions: InvestorDistribution[];
  reports: InvestorPortalReport[];
  auditLogs: InvestorAuditLog[];
  notes: InvestorNote[];
};

export type AdminInvestorManagement = {
  investors: AdminInvestorSummary[];
  distributionQueue: InvestorDistribution[];
  latestBatch: InvestorDistributionBatch | null;
  auditTrail: InvestorAuditLog[];
};

export type WalletTransaction = {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "INVESTMENT" | "ADJUSTMENT";
  status: "PENDING" | "CONFIRMED" | "FAILED" | "APPROVED" | "REJECTED";
  amountCents: number;
  currency: string;
  externalPaymentId: string | null;
  invoiceUrl: string | null;
  createdAt: string;
};

export type InvestorWallet = {
  availableBalanceCents: number;
  pendingBalanceCents: number;
  investmentBalanceCents: number;
  withdrawalBalanceCents: number;
  transactions: WalletTransaction[];
};

export type PaymentPurpose =
  | "SUBSCRIPTION"
  | "INVESTOR_FUNDING"
  | "SUBSCRIPTION_RENEWAL"
  | "SUBSCRIPTION_UPGRADE"
  | "OTHER_ADMIN_APPROVED";

export type PaymentStatus =
  | "CREATED"
  | "WAITING"
  | "CONFIRMING"
  | "PARTIALLY_PAID"
  | "CONFIRMED"
  | "FINISHED"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED"
  | "DISPUTED"
  | "MANUAL_REVIEW";

export type PaymentOrder = {
  id: string;
  userId: string;
  purpose: PaymentPurpose;
  status: PaymentStatus;
  provider: "NOWPAYMENTS";
  providerPaymentId: string | null;
  providerInvoiceId: string | null;
  planCode: string | null;
  billingCycle: string | null;
  investmentPackageId: string | null;
  lockPeriodCode: string | null;
  expectedAmountCents: number;
  receivedAmountCents: number;
  priceCurrency: string;
  payCurrency: string;
  paymentAddress: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
  confirmedAt: string | null;
  reconciliationStatus: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type PaymentCenter = {
  provider: {
    name: "NOWPayments";
    configured: boolean;
    status: "CONFIGURED" | "MISSING_CONFIGURATION";
    priceCurrency: string;
    payCurrency: string;
    webhookUrl: string;
    missingVariables: string[];
  };
  orders: PaymentOrder[];
};

export type AnalystAssignmentStatus = "ASSIGNED" | "COMPLETED" | "CANCELLED";
export type IntelligenceSubmissionStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "PUBLISHED";

export type AnalystAssignment = {
  id: string;
  fixtureId: string;
  match: string;
  leagueName: string;
  kickoffAt: string;
  status: AnalystAssignmentStatus;
  adminNotes: string | null;
};

export type AnalystIntelligenceSubmission = {
  id: string;
  fixtureId: string;
  match: string;
  leagueName: string;
  market: string;
  prediction: string;
  confidence: number;
  riskLevel: string;
  detailedReasoning: string;
  supportingStatistics: string;
  sourceNotes: string;
  briefExplanation: string;
  recommendedStake: string;
  adminNotes: string | null;
  status: IntelligenceSubmissionStatus;
  createdAt: string;
  publishedAt: string | null;
};

export type AnalystDashboard = {
  assignedMatches: AnalystAssignment[];
  assignedLeagues: string[];
  pendingTasks: number;
  submittedIntelligence: number;
  approvedIntelligence: number;
  rejectedIntelligence: number;
  analystPerformanceSummary: string;
  adminNotes: string[];
};

export type AnalystAssistance = {
  teamFormSummary: string;
  headToHeadSummary: string;
  injurySummary: string;
  oddsMovement: string;
  riskWarnings: string[];
  valueOpportunityNotes: string;
};

export type AnalystApplicationStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED_FOR_ACADEMY"
  | "REJECTED"
  | "WAITING_LIST";

export type AnalystApplication = {
  id: string;
  fullName: string;
  email: string;
  country: string;
  footballExperience: string;
  preferredLeagues: string[];
  yearsOfExperience: number;
  countriesCovered: string[];
  predictionStyle: string;
  motivationStatement: string;
  status: AnalystApplicationStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnalystAcademyStatus = "ACTIVE" | "COMPLETED" | "EXTENDED" | "PROMOTED" | "REJECTED";

export type AnalystAcademy = {
  id: string;
  analystId: string;
  applicationId: string | null;
  status: AnalystAcademyStatus;
  startedAt: string;
  endsAt: string;
  durationDays: number;
  virtualWalletCents: number;
  virtualCapitalCents: number;
  demoFixtures: string[];
  adminNotes: string | null;
};

export type DemoPredictionMarket =
  | "MATCH_WINNER"
  | "DOUBLE_CHANCE"
  | "BTTS"
  | "OVER_UNDER"
  | "CORRECT_SCORE"
  | "CORNERS"
  | "CARDS"
  | "ANYTIME_SCORER"
  | "FIRST_GOAL_SCORER";

export type AcademyPrediction = {
  id: string;
  analystId: string;
  academyId: string | null;
  matchName: string;
  leagueName: string;
  market: DemoPredictionMarket;
  prediction: string;
  confidence: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  explanation: string;
  supportingNotes: string;
  stakeCents: number;
  odds: number;
  result: "PENDING" | "WON" | "LOST" | "VOID";
  profitLossCents: number;
  createdAt: string;
  settledAt: string | null;
};

export type AnalystRank = "ACADEMY" | "ASSOCIATE" | "PROFESSIONAL" | "SENIOR" | "ELITE" | "MASTER" | "SUSPENDED";

export type AnalystReliability = {
  analystId: string;
  predictionAccuracy: number;
  roi: number;
  winRate: number;
  drawdown: number;
  riskManagement: number;
  confidenceCalibration: number;
  consistency: number;
  predictionQuality: number;
  marketSpecialization: number;
  discipline: number;
  analystReliabilityIndex: number;
  evaluatedAt: string;
};

export type AnalystProfile = {
  id: string;
  userId: string;
  name: string;
  email: string;
  rank: AnalystRank;
  status: "ACADEMY" | "ACTIVE" | "SUSPENDED" | "TERMINATED";
  reliabilityIndex: number;
  capitalAllocationCents: number;
  rewardBalanceCents: number;
  currentForm: number;
  drawdownPercent: number;
  marketSpecialization: string;
  adminNotes: string | null;
};

export type CapitalAllocation = {
  id: string;
  analystId: string;
  dailyAllocationCents: number;
  weeklyAllocationCents: number;
  monthlyAllocationCents: number;
  reliabilityIndex: number;
  riskLimitPercent: number;
  reason: string;
  createdAt: string;
};

export type AnalystReward = {
  id: string;
  analystId: string;
  rewardPoolId: string | null;
  profitGeneratedCents: number;
  rewardCents: number;
  roi: number;
  accuracy: number;
  consistency: number;
  capitalEfficiency: number;
  reliabilityIndex: number;
  riskAdjustedScore: number;
  status: "CALCULATED" | "PENDING_APPROVAL" | "APPROVED" | "PAID";
  createdAt: string;
};

export type AnalystReport = {
  id: string;
  analystId: string;
  periodType: "WEEKLY" | "MONTHLY";
  title: string;
  summary: string;
  metrics: Record<string, unknown>;
  generatedAt: string;
};

export type AnalystFlag = {
  id: string;
  analystId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  message: string;
  status: "OPEN" | "REVIEWING" | "RESOLVED";
  metadata: Record<string, unknown>;
  createdAt: string;
  resolvedAt: string | null;
};

export type FraudDetectionSignal = {
  id: string;
  analystId: string | null;
  signal: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "REVIEWING" | "RESOLVED";
  description: string;
  metadata: Record<string, unknown>;
  detectedAt: string;
};

export type AnalystPerformanceDashboard = {
  profile: AnalystProfile;
  reliability: AnalystReliability;
  academy: AnalystAcademy | null;
  demoPredictions: AcademyPrediction[];
  capitalAllocations: CapitalAllocation[];
  rewards: AnalystReward[];
  reports: AnalystReport[];
  flags: AnalystFlag[];
  graduationRecommendation: "PROMOTE" | "EXTEND_ACADEMY" | "REJECT";
  aiFeedback: string[];
};

export type AdminAnalystControlCenter = {
  applications: AnalystApplication[];
  analysts: AnalystProfile[];
  academy: AnalystAcademy[];
  predictions: AcademyPrediction[];
  reliability: AnalystReliability[];
  capitalAllocations: CapitalAllocation[];
  rewards: AnalystReward[];
  reports: AnalystReport[];
  flags: AnalystFlag[];
  fraudSignals: FraudDetectionSignal[];
  rewardPoolPercent: number;
  academyDurationDays: number;
};

export type WarRoomAssignment = {
  id: string;
  analystId: string;
  analystName: string;
  scopeType: "LEAGUE" | "COUNTRY" | "COMPETITION" | "MATCH";
  scopeValue: string;
  fixtureId: string | null;
  match: string | null;
  leagueName: string | null;
  country: string | null;
  status: "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "MISSING" | "COMPLETED";
  deadline: string;
  adminNotes: string | null;
};

export type WarRoomFixture = FootballFixtureSummary & {
  competition: string;
  predictionDeadline: string;
  assignedAnalysts: string[];
  assignmentStatus: "UNASSIGNED" | "ASSIGNED" | "PENDING_SUBMISSION" | "READY_FOR_REVIEW";
};

export type WarRoomDiscussion = {
  id: string;
  fixtureId: string | null;
  category:
    | "TACTICAL_ANALYSIS"
    | "TEAM_NEWS"
    | "INJURY_UPDATES"
    | "SUSPENSIONS"
    | "MARKET_MOVEMENT"
    | "WEATHER_DISCUSSION"
    | "AI_OBSERVATIONS"
    | "RISK_ALERTS";
  title: string;
  messages: Array<{
    id: string;
    authorLabel: string;
    body: string;
    mentions: string[];
    createdAt: string;
    replies: Array<{ id: string; authorLabel: string; body: string; createdAt: string }>;
  }>;
  pinnedNotes: string[];
  attachmentsPlaceholder: string;
  authorizedAnalystIds: string[];
};

export type WarRoomAiPanel = {
  fixtureId: string | null;
  historicalMatchSummary: string;
  teamForm: string;
  headToHeadSummary: string;
  confidenceIndicators: string[];
  riskIndicators: string[];
  recommendedResearchTopics: string[];
  providerStatus: "PLACEHOLDER_READY";
};

export type WarRoomMatchBoardItem = {
  fixtureId: string;
  match: string;
  leagueName: string;
  country: string | null;
  assignedAnalysts: string[];
  predictionsSubmitted: number;
  predictionsPending: number;
  averageConfidence: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  submissionDeadline: string;
  aiReviewStatus: "PENDING_DATA" | "READY_FOR_AI_REVIEW" | "NEEDS_ADMIN_REVIEW";
};

export type WarRoomDecisionRoomItem = {
  fixtureId: string;
  match: string;
  aiCombinedScore: number;
  analystAgreementLevel: "LOW" | "MEDIUM" | "HIGH";
  confidenceDistribution: Array<{ label: string; count: number }>;
  riskDistribution: Array<{ label: string; count: number }>;
  recommendationStatus: "PENDING_SUBMISSIONS" | "NEEDS_REVIEW" | "READY_FOR_ADMIN_APPROVAL";
  adminApprovalRequired: true;
};

export type WarRoomAlert = {
  id: string;
  type:
    | "PREDICTION_DEADLINE"
    | "MISSING_SUBMISSION"
    | "SUSPICIOUS_ACTIVITY"
    | "RULE_VIOLATION"
    | "URGENT_TEAM_NEWS"
    | "SYSTEM_ALERT";
  severity: "INFO" | "WATCH" | "URGENT";
  title: string;
  message: string;
  fixtureId: string | null;
  createdAt: string;
};

export type WarRoomRulebook = {
  currentOddsPolicy: string;
  minimumOdds: number;
  maximumOdds: number;
  predictionRules: string[];
  submissionRules: string[];
  disciplineRules: string[];
  confidentialityReminder: string;
};

export type WarRoomDashboard = {
  todayFixtures: WarRoomFixture[];
  tomorrowFixtures: WarRoomFixture[];
  assignments: WarRoomAssignment[];
  discussions: WarRoomDiscussion[];
  aiAssistantPanel: WarRoomAiPanel;
  matchIntelligenceBoard: WarRoomMatchBoardItem[];
  decisionRoom: WarRoomDecisionRoomItem[];
  alerts: WarRoomAlert[];
  leaderboard: AnalystProfile[];
  rulebook: WarRoomRulebook;
  searchIndex: Array<{ category: string; title: string; description: string }>;
};

export type IntelligenceScanStage =
  | "FIXTURE_INGESTION"
  | "MATCH_SCANNING"
  | "CANDIDATE_SCORING"
  | "CANDIDATE_QUEUE"
  | "ANALYST_REVIEW"
  | "PUBLICATION_PIPELINE";

export type IntelligenceScanCandidate = {
  fixtureId: string;
  match: string;
  league: string;
  kickoffTime: string | null;
  confidenceScore: number;
  riskScore: number;
  valueScore: number;
  opportunityScore: number;
  recommendationStatus: DecisionRecommendationStatus;
  queueStatus: PredictionLifecycleStatus;
  analystReviewStatus: "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "PUBLISHED";
  verifiedSelectionReady: boolean;
  companyCapitalEligible: boolean;
  financialEngineEligible: boolean;
  auditTrail: string[];
};

export type IntelligenceWorkflowRun = {
  id: string;
  mode: "MOCK_PROVIDER";
  stages: IntelligenceScanStage[];
  summary: {
    fixturesIngested: number;
    matchesScanned: number;
    candidatesScored: number;
    queuedCandidates: number;
    verifiedSelectionsReady: number;
    companyCapitalEligible: number;
    generatedAt: string;
  };
  candidates: IntelligenceScanCandidate[];
  warnings: string[];
};

export type AnalystCommandCentre = {
  assignmentQueue: AnalystAssignment[];
  workspace: {
    pendingSubmissions: AnalystIntelligenceSubmission[];
    approvedSubmissions: AnalystIntelligenceSubmission[];
    rejectedSubmissions: AnalystIntelligenceSubmission[];
    publishedSubmissions: AnalystIntelligenceSubmission[];
  };
  evidenceCollection: Array<{
    fixtureId: string;
    match: string;
    evidenceStatus: "MISSING" | "PARTIAL" | "READY";
    collectedEvidence: string[];
    missingEvidence: string[];
  }>;
  recommendationWorkflow: Array<{
    submissionId: string;
    fixtureId: string;
    match: string;
    status: IntelligenceSubmissionStatus;
    confidence: number;
    riskLevel: string;
    seniorReviewRequired: boolean;
    publicationReady: boolean;
  }>;
  seniorReviewQueue: AnalystIntelligenceSubmission[];
  approvalPipeline: {
    pendingReview: number;
    approved: number;
    rejected: number;
    published: number;
  };
  integrationStatus: {
    verifiedSelections: "READY";
    companyCapitalDesk: "READY";
    financialEngine: "READY";
    auditLogs: "READY";
  };
};

export type PublishedIntelligence = {
  id: string;
  fixtureId: string;
  match: string;
  leagueName: string;
  market: string;
  prediction: string;
  confidence: number;
  riskRating: string;
  briefExplanation: string;
  recommendedStake: string;
  publishedAt: string | null;
};

export type SubscriberOpportunity = {
  id: string;
  fixtureId: string;
  match: string;
  league: string;
  kickoffTime: string | null;
  market: string;
  prediction: string;
  aiConfidence: number;
  riskGrade: "Low" | "Medium" | "High";
  expectedValue: string;
  status: "Live" | "Upcoming" | "Published" | "Monitoring";
  explanation: string;
  source: "AI Prediction" | "FPF Intelligence";
};

export type SubscriberIntelligenceFeedItem = {
  id: string;
  type: "Market Movement" | "Odds Movement" | "Injury Alert" | "Line-up Confirmation" | "Weather Impact" | "Value Opportunity" | "System Announcement";
  title: string;
  description: string;
  severity: "Info" | "Watch" | "Important";
  timestamp: string;
};

export type SubscriberPerformanceSummary = {
  wins: number;
  losses: number;
  strikeRate: number;
  roi: number;
  weeklyProfit: number;
  monthlyProfit: number;
  chart: Array<{ label: string; value: number }>;
};

export type SubscriberReport = {
  id: string;
  title: string;
  category: "Daily Briefing" | "Weekly Report" | "Monthly Report" | "Market Trends" | "League Analysis";
  summary: string;
  publishedAt: string;
};

export type SubscriberNotification = {
  id: string;
  type: "New Opportunity" | "Line-up Change" | "Odds Movement" | "Subscription Update" | "System Announcement";
  title: string;
  message: string;
  createdAt: string;
};

export type SubscriberReferralSummary = {
  referralCode: string;
  referralLink: string;
  earningsCents: number;
  invitedSubscribers: number;
  rewards: string[];
};

export type SubscriberCommandCenter = {
  executiveOverview: {
    welcomeMessage: string;
    membershipTier: string;
    aiIntelligenceScore: number;
    subscriptionStatus: "Active" | "Trial" | "Expired";
    walletBalanceCents: number;
    performanceSummary: string;
  };
  opportunities: SubscriberOpportunity[];
  liveIntelligenceFeed: SubscriberIntelligenceFeedItem[];
  performance: SubscriberPerformanceSummary;
  reports: SubscriberReport[];
  notifications: SubscriberNotification[];
  referral: SubscriberReferralSummary;
};

export type DecisionRecommendationStatus = "APPROVED_CANDIDATE" | "NEEDS_REVIEW" | "REJECTED";

export type DecisionEngineScoreBreakdown = {
  teamFormScore: number;
  attackStrengthScore: number;
  defenceStrengthScore: number;
  homeAwayAdvantageScore: number;
  injuryImpactScore: number;
  oddsMovementScore: number;
  marketValueScore: number;
  liveMomentumScore: number;
  riskScore: number;
  confidenceScore: number;
  opportunityScore: number;
  valueScore: number;
  momentumScore: number;
  volatilityScore: number;
};

export type DecisionEngineOutput = {
  id: string;
  fixtureId: string;
  match: string;
  league: string;
  kickoffTime: string | null;
  recommendedMarket: string;
  predictedOutcome: string;
  status: DecisionRecommendationStatus;
  scores: DecisionEngineScoreBreakdown;
  reasoning: string[];
  warnings: string[];
  dataQualityStatus: PredictionDataQualityStatus;
  generatedAt: string;
};

export type PredictionLifecycleStatus =
  | "NEW"
  | "ANALYZING"
  | "PENDING_REVIEW"
  | "UNDER_REVIEW"
  | "SENIOR_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHED"
  | "EXPIRED"
  | "ARCHIVED";

export type PredictionQueueItem = {
  id: string;
  fixtureId: string;
  match: string;
  league: string;
  kickoffTime: string | null;
  recommendedMarket: string;
  predictedOutcome: string;
  confidenceScore: number;
  riskScore: number;
  opportunityScore: number;
  valueScore: number;
  priority: number;
  status: PredictionLifecycleStatus;
  predictionType: string;
  explanation: string;
  reasoning: string[];
  warnings: string[];
  analystNotes: string | null;
  flags: string[];
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
};

export type PredictionQueueSummary = {
  pending: number;
  approved: number;
  rejected: number;
  published: number;
  draft: number;
  expired: number;
  archived: number;
};

export type PredictionWorkflowQueue = {
  items: PredictionQueueItem[];
  summary: PredictionQueueSummary;
};

export type PredictionWorkflowAction =
  | "APPROVE"
  | "REJECT"
  | "SAVE_DRAFT"
  | "REQUEST_REVIEW"
  | "SENIOR_REVIEW"
  | "FLAG_HIGH_RISK"
  | "FLAG_HIGH_OPPORTUNITY"
  | "MARK_FEATURED"
  | "PUBLISH"
  | "ARCHIVE"
  | "RESTORE";

export type TreasuryRiskGrade = "LOW" | "MEDIUM" | "HIGH";
export type TreasuryExecutionStatus = "RECOMMENDED" | "PENDING_EXECUTION" | "PLACED" | "PARTIALLY_PLACED" | "NOT_EXECUTED" | "CANCELLED" | "SETTLED";
export type TreasurySettlementOutcome = "WIN" | "LOSS" | "VOID" | "HALF_WIN" | "HALF_LOSS" | "CANCELLED" | "PENDING_VERIFICATION";
export type TreasuryReconciliationStatus = "NOT_STARTED" | "PENDING" | "PARTIALLY_RECONCILED" | "RECONCILED" | "DISPUTED" | "CLOSED";

export type TreasuryAccountSummary = {
  companyTreasuryBalanceCents: number;
  investorCapitalBalanceCents: number;
  companyOperatingCapitalCents: number;
  capitalAvailableForStakingCents: number;
  capitalCurrentlyExposedCents: number;
  capitalReturnedCents: number;
  profitBalanceCents: number;
  lossBalanceCents: number;
  outstandingReconciliationCents: number;
  closingBalanceCents: number;
};

export type TreasuryLedgerEntry = {
  id: string;
  account: string;
  direction: "DEBIT" | "CREDIT";
  amountCents: number;
  classification: string;
  referenceType: string;
  referenceId: string | null;
  notes: string;
  createdBy: string;
  createdAt: string;
};

export type CapitalAllocationExtension = {
  id: string;
  fixture: string;
  market: string;
  selection: string;
  analystIds: string[];
  recommendedStakeCents: number;
  maximumAllowedStakeCents: number;
  dailyAllocationCents: number;
  weeklyAllocationCents: number;
  matchAllocationCents: number;
  marketAllocationCents: number;
  riskGrade: TreasuryRiskGrade;
  expectedReturnCents: number;
  approvalStatus: "APPROVED" | "PENDING" | "REJECTED";
  allocationTimestamp: string;
  allocatedBy: string;
  controls: {
    analystRank: string;
    reliabilityIndex: number;
    disciplineScore: number;
    historicalRoi: number;
    recentPerformance: string;
    drawdown: number;
    capitalEfficiency: number;
    dailyExposureLimitCents: number;
    weeklyExposureLimitCents: number;
  };
};

export type BetExecutionRecord = {
  id: string;
  allocationId: string;
  fixture: string;
  market: string;
  selection: string;
  recommendedStakeCents: number;
  actualStakeCents: number;
  recommendedOdds: number;
  actualOdds: number;
  bookmaker: string;
  betReference: string;
  placedAt: string;
  currency: string;
  status: TreasuryExecutionStatus;
  varianceReason: string | null;
  executionNotes: string | null;
  evidencePlaceholder: string | null;
  executedBy: string;
};

export type MatchSettlement = {
  id: string;
  executionId: string;
  outcome: TreasurySettlementOutcome;
  actualStakeCents: number;
  actualOdds: number;
  grossReturnCents: number;
  capitalReturnedCents: number;
  grossProfitCents: number;
  lossCents: number;
  netResultCents: number;
  bookmakerDeductionCents: number;
  currencyConversionPlaceholderCents: number;
  verificationStatus: "PENDING" | "VERIFIED";
  settledBy: string;
  settledAt: string;
};

export type MatchReconciliation = {
  id: string;
  settlementId: string;
  capitalApprovedCents: number;
  capitalActuallyStakedCents: number;
  expectedReturnCents: number;
  actualReturnCents: number;
  capitalExpectedBackCents: number;
  amountDepositedBackCents: number;
  outstandingDifferenceCents: number;
  status: TreasuryReconciliationStatus;
  notes: string | null;
  evidencePlaceholder: string | null;
  reconciledBy: string;
  reconciledAt: string;
};

export type TradingDaySummary = {
  id: string;
  date: string;
  openingTreasuryBalanceCents: number;
  capitalAllocatedCents: number;
  capitalActuallyStakedCents: number;
  unusedAllocatedCapitalCents: number;
  openExposureCents: number;
  settledCapitalCents: number;
  grossReturnsCents: number;
  grossProfitCents: number;
  totalLossesCents: number;
  netDailyProfitCents: number;
  amountExpectedBackCents: number;
  amountDepositedBackCents: number;
  outstandingReconciliationCents: number;
  closingTreasuryBalanceCents: number;
  status: "OPEN" | "CLOSED" | "CLOSED_WITH_OVERRIDE";
  closureNotes: string | null;
};

export type ProfitDistributionPolicy = {
  id: string;
  version: number;
  companySharePercent: number;
  analystRewardPercent: number;
  investorDistributionPercent: number;
  active: boolean;
  updatedBy: string;
  updatedAt: string;
};

export type WeeklyFinancialPeriod = {
  id: string;
  weekLabel: string;
  openingTreasuryCents: number;
  investorPrincipalCents: number;
  companyCapitalCents: number;
  totalCapitalStakedCents: number;
  grossReturnsCents: number;
  grossProfitCents: number;
  totalLossesCents: number;
  confirmedWeeklyNetProfitCents: number;
  outstandingReconciliationsCents: number;
  closingTreasuryBalanceCents: number;
  status: "OPEN" | "READY_FOR_CLOSURE" | "CLOSED" | "BLOCKED";
};

export type AnalystRewardAllocation = {
  id: string;
  analystId: string;
  analystName: string;
  contributionWeight: number;
  rewardCents: number;
  status: "CALCULATED" | "PENDING_APPROVAL" | "APPROVED" | "PENDING_PAYOUT" | "PAID_PLACEHOLDER" | "DISPUTED" | "ADJUSTED" | "CANCELLED";
  breakdown: string[];
};

export type InvestorDistributionAllocation = {
  id: string;
  investorId: string;
  participationWeight: number;
  distributionCents: number;
  reinvestmentCents: number;
  withdrawalCents: number;
  status: "CALCULATED" | "PENDING_APPROVAL" | "APPROVED" | "REINVESTED" | "PENDING_PAYOUT" | "PAID_PLACEHOLDER" | "FAILED" | "DISPUTED" | "CANCELLED";
  explanation: string;
};

export type CompanyShareAllocation = {
  id: string;
  amountCents: number;
  classification: "RETAINED_EARNINGS" | "FUTURE_STAKING_CAPITAL" | "COMPANY_RESERVE" | "OPERATING_EXPENSES" | "GROWTH_CAPITAL" | "TAX_PLACEHOLDER" | "OTHER_APPROVED_USE";
  ledgerEntryId: string;
  notes: string;
};

export type FinancialException = {
  id: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  message: string;
  relatedId: string | null;
  createdAt: string;
};

export type TreasuryDashboard = {
  accounts: TreasuryAccountSummary;
  ledger: TreasuryLedgerEntry[];
  capitalAllocations: CapitalAllocationExtension[];
  executions: BetExecutionRecord[];
  settlements: MatchSettlement[];
  reconciliations: MatchReconciliation[];
  daily: TradingDaySummary;
  weekly: WeeklyFinancialPeriod;
  policy: ProfitDistributionPolicy;
  analystRewards: AnalystRewardAllocation[];
  investorDistributions: InvestorDistributionAllocation[];
  companyShares: CompanyShareAllocation[];
  exceptions: FinancialException[];
};

export type ExecutiveSituationRoom = {
  approvedSelectionsToday: number;
  capitalRecommendedCents: number;
  capitalActuallyPlacedCents: number;
  openExposureCents: number;
  matchesInPlay: number;
  expectedTreasuryReturnCents: number;
  actualTreasuryReturnCents: number;
  outstandingReconciliationCents: number;
  dailyProfitOrLossCents: number;
  weeklyConfirmedNetProfitCents: number;
  companyShareProjectionCents: number;
  analystRewardPoolProjectionCents: number;
  investorDistributionPoolProjectionCents: number;
  highRiskPositions: CapitalAllocationExtension[];
  pendingSettlements: BetExecutionRecord[];
  pendingReconciliations: MatchReconciliation[];
  pendingApprovals: string[];
  currentAnalystAllocations: Array<{ analystId: string; allocatedCents: number; riskGrade: TreasuryRiskGrade }>;
  criticalFinancialAlerts: FinancialException[];
  systemHealth: "READY" | "WATCH" | "BLOCKED";
};

export type AnalystTreasuryView = {
  allocations: CapitalAllocationExtension[];
  rewards: AnalystRewardAllocation[];
  notice: string;
};

export type AnalyticsTrendPoint = { label: string; value: number };
export type AnalyticsKpi = { label: string; value: number | string; changePercent: number; status: "UP" | "DOWN" | "FLAT" };
export type AnalystAnalytics = {
  analystId: string;
  analystName: string;
  totalPicks: number;
  winningPicks: number;
  losingPicks: number;
  voidPicks: number;
  winRate: number;
  roi: number;
  profitGeneratedCents: number;
  capitalUsedCents: number;
  capitalEfficiency: number;
  averageOdds: number;
  leaguePerformance: Array<{ league: string; roi: number; accuracy: number; profitCents: number }>;
  competitionPerformance: Array<{ competition: string; roi: number; accuracy: number; profitCents: number }>;
  homePerformance: number;
  awayPerformance: number;
  monthlyTrend: AnalyticsTrendPoint[];
  dailyTrend: AnalyticsTrendPoint[];
  confidenceAccuracy: number;
  drawdown: number;
  currentRank: string;
  historicalRank: string[];
  reliabilityIndex: number;
  disciplineScore: number;
};
export type LeagueAnalytics = { league: string; matchesPlayed: number; profitCents: number; roi: number; accuracy: number; risk: number; averageOdds: number; averageConfidence: number; rank: number };
export type MarketAnalytics = { market: string; roi: number; accuracy: number; averageOdds: number; averageRisk: number; profitGeneratedCents: number; capitalAllocationCents: number; rank: number };
export type SubscriberAnalytics = {
  activeSubscribers: number;
  freeUsers: number;
  paidUsers: number;
  premiumUsers: number;
  enterpriseUsers: number;
  conversionRate: number;
  churnRate: number;
  averageSubscriptionValueCents: number;
  lifetimeValueCents: number;
  retention: number;
  countryDistribution: Array<{ country: string; count: number }>;
  deviceDistribution: Array<{ device: string; count: number }>;
};
export type InvestorAnalytics = {
  totalInvestors: number;
  activeInvestors: number;
  lockedCapitalCents: number;
  distributionPaidCents: number;
  averageInvestmentCents: number;
  averageRoi: number;
  averageHoldingPeriodDays: number;
  reinvestmentRate: number;
  withdrawalsCents: number;
  pendingDistributionsCents: number;
  capitalGrowth: AnalyticsTrendPoint[];
};
export type TreasuryAnalytics = {
  openingBalanceCents: number;
  closingBalanceCents: number;
  netProfitCents: number;
  netLossCents: number;
  capitalAllocationCents: number;
  capitalReturnedCents: number;
  dailyCashFlow: AnalyticsTrendPoint[];
  weeklyCashFlow: AnalyticsTrendPoint[];
  monthlyCashFlow: AnalyticsTrendPoint[];
};
export type AiBusinessInsight = { id: string; category: "PERFORMANCE" | "RISK" | "REVENUE" | "CAPITAL" | "ANOMALY"; title: string; recommendation: string; confidence: number; severity: "INFO" | "WATCH" | "ACTION" };
export type PredictiveForecast = { metric: string; expectedValueCents: number; confidence: number; trend: "UP" | "DOWN" | "FLAT"; explanation: string };
export type ExportCenterItem = { id: string; reportType: "PDF" | "EXCEL" | "CSV"; title: string; cadence: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ON_DEMAND"; providerStatus: "PLACEHOLDER_READY" };
export type ExecutiveAnalyticsDashboard = {
  generatedAt: string;
  executiveKpis: AnalyticsKpi[];
  analystLeaderboard: AnalystAnalytics[];
  leagueIntelligence: LeagueAnalytics[];
  marketIntelligence: MarketAnalytics[];
  subscriberAnalytics: SubscriberAnalytics;
  investorAnalytics: InvestorAnalytics;
  treasuryAnalytics: TreasuryAnalytics;
  aiInsights: AiBusinessInsight[];
  forecasts: PredictiveForecast[];
  exportCenter: ExportCenterItem[];
  visualizations: {
    revenueTimeline: AnalyticsTrendPoint[];
    profitTimeline: AnalyticsTrendPoint[];
    capitalAllocation: Array<{ label: string; value: number }>;
    riskHeatMap: Array<{ label: string; risk: number; exposureCents: number }>;
  };
};
export type AnalystPrivateAnalytics = {
  analyst: AnalystAnalytics;
  aiRecommendations: AiBusinessInsight[];
  exportCenter: ExportCenterItem[];
};

export type ProviderStatus =
  | "NOT_CONFIGURED"
  | "TRIAL"
  | "ACTIVE"
  | "CONNECTED"
  | "DEGRADED"
  | "RATE_LIMITED"
  | "PAYMENT_DUE"
  | "RENEWAL_DUE"
  | "EXPIRED"
  | "SUSPENDED"
  | "OFFLINE"
  | "CANCELLED"
  | "REPLACED"
  | "ARCHIVED";

export type ProviderRecord = {
  id: string;
  name: string;
  category: string;
  servicePurpose: string;
  internalOwner: string;
  providerWebsite: string;
  dashboardUrl: string;
  billingUrl: string;
  renewalUrl: string;
  documentationUrl: string;
  supportUrl: string;
  supportEmail: string;
  currentPlan: string;
  planTier: string;
  accountEmail: string;
  billingCurrency: string;
  monthlyCostCents: number;
  annualCostCents: number;
  setupCostCents: number;
  usageBasedCostCents: number;
  transactionFeePercent: number;
  taxEstimateCents: number;
  billingCycle: "MONTHLY" | "ANNUAL" | "USAGE" | "TRIAL" | "MANUAL";
  contractStartDate: string | null;
  trialEndDate: string | null;
  nextRenewalDate: string | null;
  cancellationDeadline: string | null;
  autoRenewal: boolean;
  paymentMethodLabel: string;
  invoiceReference: string | null;
  environment: "DEVELOPMENT" | "PREVIEW" | "PRODUCTION" | "GLOBAL";
  developmentStatus: ProviderStatus;
  productionStatus: ProviderStatus;
  apiConnectionStatus: ProviderStatus;
  webhookStatus: ProviderStatus;
  healthStatus: ProviderStatus;
  lastSuccessfulConnection: string | null;
  lastFailedConnection: string | null;
  lastHealthCheck: string | null;
  averageResponseTimeMs: number;
  usageLimit: number;
  currentUsage: number;
  remainingQuota: number;
  notes: string;
  tags: string[];
  active: boolean;
};

export type ProviderCredentialMetadata = {
  id: string;
  providerId: string;
  credentialName: string;
  credentialType: string;
  environment: string;
  secretManagerReference: string;
  maskedIdentifier: string;
  lastFourPlaceholder: string;
  createdAt: string;
  lastRotatedAt: string | null;
  nextRotationAt: string | null;
  rotationStatus: "CURRENT" | "ROTATION_DUE" | "EXPIRED" | "UNKNOWN";
  connectionTestStatus: "PASSED" | "FAILED" | "NOT_TESTED";
  lastTestedAt: string | null;
  credentialOwner: string;
  expiryDate: string | null;
  notes: string;
};

export type ProviderRenewal = {
  id: string;
  providerId: string;
  providerName: string;
  plan: string;
  renewalDate: string;
  amountDueCents: number;
  currency: string;
  billingCycle: string;
  autoRenewal: boolean;
  daysRemaining: number;
  paymentStatus: "UPCOMING" | "PENDING" | "PAID" | "PARTIALLY_PAID" | "FAILED" | "OVERDUE" | "REFUNDED" | "CANCELLED";
  responsiblePerson: string;
  billingUrl: string;
  renewalUrl: string;
  reminderDays: number[];
};

export type ProviderCostAnalytics = {
  monthlyRecurringCostCents: number;
  annualRecurringCostCents: number;
  setupCostsCents: number;
  usageBasedCostsCents: number;
  transactionFeesCents: number;
  taxesCents: number;
  totalInfrastructureCostCents: number;
  costByProvider: Array<{ providerId: string; providerName: string; monthlyCostCents: number }>;
  costByCategory: Array<{ category: string; monthlyCostCents: number; budgetCents: number; status: "OK" | "OVER_BUDGET" }>;
  costByEnvironment: Array<{ environment: string; monthlyCostCents: number }>;
  costTrend: Array<{ label: string; value: number }>;
  forecastedMonthlyCostCents: number;
  forecastedAnnualCostCents: number;
  budgetAlerts: string[];
};

export type ProviderUsage = {
  providerId: string;
  providerName: string;
  metric: string;
  used: number;
  limit: number;
  remaining: number;
  usagePercent: number;
  thresholds: number[];
  status: "OK" | "WATCH" | "CRITICAL";
};

export type ProcurementRequest = {
  id: string;
  businessNeed: string;
  requestedProvider: string;
  alternativeProviders: string[];
  recommendedPlan: string;
  estimatedMonthlyCostCents: number;
  estimatedAnnualCostCents: number;
  setupCostCents: number;
  requestedBy: string;
  approvedBy: string | null;
  approvalDate: string | null;
  purchaseDate: string | null;
  status: string;
  notes: string;
};

export type ProviderComparison = {
  id: string;
  category: string;
  providerName: string;
  status: "RECOMMENDED" | "CURRENT" | "ALTERNATIVE" | "UNDER_REVIEW" | "REJECTED" | "LEGACY";
  features: string[];
  freeTier: string;
  monthlyCostCents: number;
  annualCostCents: number;
  usageLimits: string;
  coverage: string;
  reliability: string;
  support: string;
  integrationComplexity: "LOW" | "MEDIUM" | "HIGH";
  contractCommitment: string;
};

export type ProviderAlert = {
  id: string;
  providerId: string;
  providerName: string;
  type: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  message: string;
  createdAt: string;
};

export type ProviderTask = {
  id: string;
  title: string;
  providerId: string;
  providerName: string;
  category: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assignedPerson: string;
  dueDate: string;
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED";
  notes: string;
};

export type ApiProcurementReport = {
  providers: Array<{
    provider: string;
    category: string;
    purpose: string;
    required: boolean;
    recommendedPlan: string;
    monthlyCostCents: number;
    annualCostCents: number;
    setupCostCents: number;
    freeTier: string;
    purchaseStatus: string;
    renewalDate: string | null;
    officialLinks: string[];
    notes: string;
  }>;
  totals: {
    essentialLaunchTotalCents: number;
    recommendedGrowthTotalCents: number;
    optionalServicesTotalCents: number;
    monthlyTotalCents: number;
    annualTotalCents: number;
    oneTimeSetupTotalCents: number;
    estimatedFirstYearTotalCents: number;
  };
};

export type InfrastructureOverview = {
  totalProviders: number;
  activeProviders: number;
  connectedApis: number;
  notConfiguredApis: number;
  healthyServices: number;
  degradedServices: number;
  offlineServices: number;
  renewalsDueIn7Days: number;
  renewalsDueIn30Days: number;
  overdueRenewals: number;
  monthlyOperatingCostCents: number;
  annualOperatingCostCents: number;
  usageBasedCostThisMonthCents: number;
  highestCostProvider: string;
  fastestGrowingCost: string;
  providersOverBudget: number;
  credentialsRequiringRotation: number;
  criticalIncidents: number;
  procurementRequestsAwaitingApproval: number;
  executiveSummary: string;
};

export type InfrastructureControlCenter = {
  overview: InfrastructureOverview;
  providers: ProviderRecord[];
  credentialMetadata: ProviderCredentialMetadata[];
  renewals: ProviderRenewal[];
  costs: ProviderCostAnalytics;
  usage: ProviderUsage[];
  procurement: ProcurementRequest[];
  comparisons: ProviderComparison[];
  alerts: ProviderAlert[];
  tasks: ProviderTask[];
  procurementReport: ApiProcurementReport;
  securityNotice: string;
};
