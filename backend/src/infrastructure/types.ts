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

export type ProviderCategory =
  | "Football Data"
  | "Odds Data"
  | "Artificial Intelligence"
  | "Payments"
  | "Crypto Payments"
  | "Email"
  | "SMS"
  | "WhatsApp"
  | "Hosting"
  | "Database"
  | "Storage"
  | "Security"
  | "Analytics"
  | "Error Monitoring"
  | "Uptime Monitoring"
  | "Other";

export type ProviderRecord = {
  id: string;
  name: string;
  category: ProviderCategory | string;
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
  credentialType: "API Key" | "Access Token" | "Refresh Token" | "Webhook Secret" | "OAuth Client" | "Database Credential" | "Service Account" | "Signing Secret" | "Wallet Address" | "Other";
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
  status: "IDENTIFIED" | "RESEARCHING" | "TRIAL_REQUESTED" | "TRIAL_ACTIVE" | "APPROVAL_REQUIRED" | "APPROVED" | "PENDING_PURCHASE" | "PURCHASED" | "CONFIGURATION_PENDING" | "CONNECTED" | "REJECTED" | "CANCELLED" | "EXPIRED" | "REPLACED";
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
