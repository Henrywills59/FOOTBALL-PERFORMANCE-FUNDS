import type {
  ApiProcurementReport,
  InfrastructureControlCenter,
  InfrastructureOverview,
  ProcurementRequest,
  ProviderAlert,
  ProviderComparison,
  ProviderCostAnalytics,
  ProviderCredentialMetadata,
  ProviderRecord,
  ProviderRenewal,
  ProviderTask,
  ProviderUsage,
} from "./types.js";

const securityNotice = "Payments and subscription changes are completed securely on the provider's official website.";
const now = () => new Date().toISOString();
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

export class InfrastructureControlError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
  }
}

function ensureHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error("Unsafe protocol");
    if (url.username || url.password) throw new Error("Credentials in URLs are not allowed");
    return url.toString();
  } catch {
    throw new InfrastructureControlError("Provider links must be approved HTTPS URLs without embedded credentials.");
  }
}

function renewal(provider: ProviderRecord): ProviderRenewal {
  const renewalDate = provider.nextRenewalDate ?? daysFromNow(30);
  const daysRemaining = Math.ceil((new Date(renewalDate).getTime() - Date.now()) / 86_400_000);
  return {
    id: `renewal_${provider.id}`,
    providerId: provider.id,
    providerName: provider.name,
    plan: provider.currentPlan,
    renewalDate,
    amountDueCents: provider.billingCycle === "ANNUAL" ? provider.annualCostCents : provider.monthlyCostCents,
    currency: provider.billingCurrency,
    billingCycle: provider.billingCycle,
    autoRenewal: provider.autoRenewal,
    daysRemaining,
    paymentStatus: daysRemaining < 0 ? "OVERDUE" : daysRemaining <= 7 ? "PENDING" : "UPCOMING",
    responsiblePerson: provider.internalOwner,
    billingUrl: provider.billingUrl,
    renewalUrl: provider.renewalUrl,
    reminderDays: [30, 14, 7, 3, 1, 0, -1, -7],
  };
}

export class InfrastructureService {
  private providers: ProviderRecord[] = [
    this.provider({
      id: "provider_api_football",
      name: "API-Football",
      category: "Football Data",
      servicePurpose: "Fixtures, live football data, standings, teams, injuries and statistics.",
      dashboardUrl: "https://dashboard.api-football.com/",
      billingUrl: "https://dashboard.api-football.com/billing",
      renewalUrl: "https://dashboard.api-football.com/subscription",
      documentationUrl: "https://www.api-football.com/documentation-v3",
      monthlyCostCents: 4900,
      annualCostCents: 58800,
      nextRenewalDate: daysFromNow(6),
      apiConnectionStatus: "CONNECTED",
      healthStatus: "CONNECTED",
      currentUsage: 4200,
      usageLimit: 10000,
      tags: ["football", "fixtures", "production"],
    }),
    this.provider({
      id: "provider_odds_api",
      name: "The Odds API",
      category: "Odds Data",
      servicePurpose: "Bookmaker odds and market pricing.",
      dashboardUrl: "https://the-odds-api.com/account/",
      billingUrl: "https://the-odds-api.com/account/billing",
      renewalUrl: "https://the-odds-api.com/account/",
      documentationUrl: "https://the-odds-api.com/liveapi/guides/v4/",
      monthlyCostCents: 7900,
      annualCostCents: 94800,
      nextRenewalDate: daysFromNow(24),
      apiConnectionStatus: "NOT_CONFIGURED",
      healthStatus: "NOT_CONFIGURED",
      currentUsage: 0,
      usageLimit: 5000,
      tags: ["odds", "markets", "placeholder"],
    }),
    this.provider({
      id: "provider_vercel",
      name: "Vercel",
      category: "Hosting",
      servicePurpose: "Frontend and backend serverless deployment hosting.",
      providerWebsite: "https://vercel.com/",
      dashboardUrl: "https://vercel.com/dashboard",
      billingUrl: "https://vercel.com/account/billing",
      renewalUrl: "https://vercel.com/account/billing",
      documentationUrl: "https://vercel.com/docs",
      monthlyCostCents: 2000,
      annualCostCents: 24000,
      nextRenewalDate: daysFromNow(18),
      apiConnectionStatus: "CONNECTED",
      healthStatus: "CONNECTED",
      currentUsage: 62,
      usageLimit: 100,
      tags: ["hosting", "deployment", "production"],
    }),
    this.provider({
      id: "provider_supabase",
      name: "Supabase",
      category: "Database",
      servicePurpose: "Production PostgreSQL database.",
      providerWebsite: "https://supabase.com/",
      dashboardUrl: "https://supabase.com/dashboard",
      billingUrl: "https://supabase.com/dashboard/org/_/billing",
      renewalUrl: "https://supabase.com/dashboard/org/_/billing",
      documentationUrl: "https://supabase.com/docs",
      monthlyCostCents: 2500,
      annualCostCents: 30000,
      nextRenewalDate: daysFromNow(31),
      apiConnectionStatus: "CONNECTED",
      healthStatus: "CONNECTED",
      currentUsage: 38,
      usageLimit: 100,
      tags: ["database", "postgres", "production"],
    }),
    this.provider({
      id: "provider_nowpayments",
      name: "NOWPayments",
      category: "Crypto Payments",
      servicePurpose: "Crypto payment invoices and payout placeholder integration.",
      dashboardUrl: "https://account.nowpayments.io/",
      billingUrl: "https://account.nowpayments.io/",
      renewalUrl: "https://account.nowpayments.io/",
      documentationUrl: "https://documenter.getpostman.com/view/7907941/2s93JusNJt",
      monthlyCostCents: 0,
      annualCostCents: 0,
      usageBasedCostCents: 0,
      transactionFeePercent: 0.5,
      nextRenewalDate: null,
      apiConnectionStatus: "NOT_CONFIGURED",
      healthStatus: "NOT_CONFIGURED",
      currentUsage: 0,
      usageLimit: 100,
      tags: ["payments", "crypto", "placeholder"],
    }),
    this.provider({
      id: "provider_openai",
      name: "OpenAI",
      category: "Artificial Intelligence",
      servicePurpose: "Future AI reasoning, explanations, media and assistant providers.",
      providerWebsite: "https://openai.com/",
      dashboardUrl: "https://platform.openai.com/",
      billingUrl: "https://platform.openai.com/settings/organization/billing/overview",
      renewalUrl: "https://platform.openai.com/settings/organization/billing/overview",
      documentationUrl: "https://platform.openai.com/docs",
      monthlyCostCents: 0,
      annualCostCents: 0,
      usageBasedCostCents: 15000,
      nextRenewalDate: null,
      apiConnectionStatus: "NOT_CONFIGURED",
      healthStatus: "NOT_CONFIGURED",
      currentUsage: 0,
      usageLimit: 1_000_000,
      tags: ["ai", "placeholder"],
    }),
  ];

  private procurement: ProcurementRequest[] = [
    {
      id: "proc_error_monitoring",
      businessNeed: "Production error monitoring",
      requestedProvider: "Sentry",
      alternativeProviders: ["Axiom", "Logtail"],
      recommendedPlan: "Team placeholder",
      estimatedMonthlyCostCents: 2600,
      estimatedAnnualCostCents: 31200,
      setupCostCents: 0,
      requestedBy: "Operations",
      approvedBy: null,
      approvalDate: null,
      purchaseDate: null,
      status: "APPROVAL_REQUIRED",
      notes: "Recommended before final live provider integrations.",
    },
  ];

  private tasks: ProviderAlert[] = [];

  controlCenter(): InfrastructureControlCenter {
    const providers = this.providers;
    const renewals = providers.filter((provider) => provider.nextRenewalDate).map(renewal);
    const alerts = this.alerts();
    return {
      overview: this.overview(providers, renewals, alerts),
      providers,
      credentialMetadata: this.credentials(providers),
      renewals,
      costs: this.costs(providers),
      usage: this.usage(providers),
      procurement: this.procurement,
      comparisons: this.comparisons(),
      alerts,
      tasks: this.tasksFromAlerts(alerts),
      procurementReport: this.procurementReport(providers),
      securityNotice,
    };
  }

  listProviders() {
    return this.providers;
  }

  getProvider(id: string) {
    return this.providers.find((provider) => provider.id === id) ?? null;
  }

  createProvider(input: Partial<ProviderRecord>) {
    const provider = this.provider({
      id: `provider_${Date.now()}`,
      name: String(input.name ?? "New Provider"),
      category: String(input.category ?? "Other"),
      servicePurpose: String(input.servicePurpose ?? "Provider purpose pending verification."),
      providerWebsite: ensureHttpsUrl(String(input.providerWebsite ?? "https://example.com/")),
      dashboardUrl: ensureHttpsUrl(String(input.dashboardUrl ?? input.providerWebsite ?? "https://example.com/")),
      billingUrl: ensureHttpsUrl(String(input.billingUrl ?? input.providerWebsite ?? "https://example.com/")),
      renewalUrl: ensureHttpsUrl(String(input.renewalUrl ?? input.providerWebsite ?? "https://example.com/")),
      documentationUrl: ensureHttpsUrl(String(input.documentationUrl ?? input.providerWebsite ?? "https://example.com/")),
      supportUrl: ensureHttpsUrl(String(input.supportUrl ?? input.providerWebsite ?? "https://example.com/")),
      monthlyCostCents: Number(input.monthlyCostCents ?? 0),
      annualCostCents: Number(input.annualCostCents ?? 0),
      nextRenewalDate: input.nextRenewalDate ?? daysFromNow(30),
      apiConnectionStatus: input.apiConnectionStatus ?? "NOT_CONFIGURED",
      healthStatus: input.healthStatus ?? "NOT_CONFIGURED",
      currentUsage: Number(input.currentUsage ?? 0),
      usageLimit: Number(input.usageLimit ?? 1),
      tags: input.tags ?? ["manual-entry"],
    });
    this.providers.unshift(provider);
    return provider;
  }

  updateProvider(id: string, input: Partial<ProviderRecord>) {
    const provider = this.getProvider(id);
    if (!provider) throw new InfrastructureControlError("Provider not found", 404);
    const urlKeys = ["providerWebsite", "dashboardUrl", "billingUrl", "renewalUrl", "documentationUrl", "supportUrl"] as const;
    for (const key of urlKeys) {
      if (input[key]) input[key] = ensureHttpsUrl(String(input[key]));
    }
    Object.assign(provider, input);
    return provider;
  }

  testProvider(id: string) {
    const provider = this.getProvider(id);
    if (!provider) throw new InfrastructureControlError("Provider not found", 404);
    provider.lastHealthCheck = now();
    provider.averageResponseTimeMs = provider.apiConnectionStatus === "NOT_CONFIGURED" ? 0 : Math.max(120, provider.averageResponseTimeMs);
    return {
      providerId: provider.id,
      status: provider.apiConnectionStatus === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : "HEALTHY",
      rawCredentialReturned: false,
      message: "Placeholder connection test completed without exposing credentials.",
      checkedAt: provider.lastHealthCheck,
    };
  }

  acknowledgeAlert(id: string) {
    const alert = this.alerts().find((item) => item.id === id);
    if (!alert) throw new InfrastructureControlError("Alert not found", 404);
    alert.status = "ACKNOWLEDGED";
    return alert;
  }

  createProcurement(input: Partial<ProcurementRequest>) {
    const request: ProcurementRequest = {
      id: `proc_${Date.now()}`,
      businessNeed: String(input.businessNeed ?? "Business need pending"),
      requestedProvider: String(input.requestedProvider ?? "Provider pending"),
      alternativeProviders: input.alternativeProviders ?? [],
      recommendedPlan: String(input.recommendedPlan ?? "Plan pending"),
      estimatedMonthlyCostCents: Number(input.estimatedMonthlyCostCents ?? 0),
      estimatedAnnualCostCents: Number(input.estimatedAnnualCostCents ?? 0),
      setupCostCents: Number(input.setupCostCents ?? 0),
      requestedBy: String(input.requestedBy ?? "Admin"),
      approvedBy: null,
      approvalDate: null,
      purchaseDate: null,
      status: input.status ?? "IDENTIFIED",
      notes: String(input.notes ?? "Manual procurement placeholder."),
    };
    this.procurement.unshift(request);
    return request;
  }

  updateProcurement(id: string, input: Partial<ProcurementRequest>) {
    const request = this.procurement.find((item) => item.id === id);
    if (!request) throw new InfrastructureControlError("Procurement request not found", 404);
    Object.assign(request, input);
    if (input.status === "APPROVED" && !request.approvalDate) request.approvalDate = now();
    return request;
  }

  private provider(input: Partial<ProviderRecord> & Pick<ProviderRecord, "id" | "name" | "category" | "servicePurpose">): ProviderRecord {
    const website = ensureHttpsUrl(input.providerWebsite ?? `https://${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com/`);
    return {
      id: input.id,
      name: input.name,
      category: input.category,
      servicePurpose: input.servicePurpose,
      internalOwner: input.internalOwner ?? "Platform Operations",
      providerWebsite: website,
      dashboardUrl: ensureHttpsUrl(input.dashboardUrl ?? website),
      billingUrl: ensureHttpsUrl(input.billingUrl ?? website),
      renewalUrl: ensureHttpsUrl(input.renewalUrl ?? website),
      documentationUrl: ensureHttpsUrl(input.documentationUrl ?? website),
      supportUrl: ensureHttpsUrl(input.supportUrl ?? website),
      supportEmail: input.supportEmail ?? "support@example.com",
      currentPlan: input.currentPlan ?? "Manual placeholder plan",
      planTier: input.planTier ?? "Production placeholder",
      accountEmail: input.accountEmail ?? "operations@footballperformancefund.com",
      billingCurrency: input.billingCurrency ?? "USD",
      monthlyCostCents: input.monthlyCostCents ?? 0,
      annualCostCents: input.annualCostCents ?? (input.monthlyCostCents ?? 0) * 12,
      setupCostCents: input.setupCostCents ?? 0,
      usageBasedCostCents: input.usageBasedCostCents ?? 0,
      transactionFeePercent: input.transactionFeePercent ?? 0,
      taxEstimateCents: input.taxEstimateCents ?? 0,
      billingCycle: input.billingCycle ?? "MONTHLY",
      contractStartDate: input.contractStartDate ?? daysFromNow(-30),
      trialEndDate: input.trialEndDate ?? null,
      nextRenewalDate: input.nextRenewalDate ?? null,
      cancellationDeadline: input.cancellationDeadline ?? null,
      autoRenewal: input.autoRenewal ?? false,
      paymentMethodLabel: input.paymentMethodLabel ?? "Provider billing portal",
      invoiceReference: input.invoiceReference ?? null,
      environment: input.environment ?? "PRODUCTION",
      developmentStatus: input.developmentStatus ?? input.apiConnectionStatus ?? "NOT_CONFIGURED",
      productionStatus: input.productionStatus ?? input.healthStatus ?? "NOT_CONFIGURED",
      apiConnectionStatus: input.apiConnectionStatus ?? "NOT_CONFIGURED",
      webhookStatus: input.webhookStatus ?? "NOT_CONFIGURED",
      healthStatus: input.healthStatus ?? "NOT_CONFIGURED",
      lastSuccessfulConnection: input.lastSuccessfulConnection ?? null,
      lastFailedConnection: input.lastFailedConnection ?? null,
      lastHealthCheck: input.lastHealthCheck ?? null,
      averageResponseTimeMs: input.averageResponseTimeMs ?? 180,
      usageLimit: input.usageLimit ?? 1,
      currentUsage: input.currentUsage ?? 0,
      remainingQuota: Math.max(0, (input.usageLimit ?? 1) - (input.currentUsage ?? 0)),
      notes: input.notes ?? "Manual provider registry entry. Pricing must be verified by Admin before procurement.",
      tags: input.tags ?? [],
      active: input.active ?? true,
    };
  }

  private overview(providers: ProviderRecord[], renewals: ProviderRenewal[], alerts: ProviderAlert[]): InfrastructureOverview {
    const active = providers.filter((provider) => provider.active);
    const connected = providers.filter((provider) => provider.apiConnectionStatus === "CONNECTED");
    const notConfigured = providers.filter((provider) => provider.apiConnectionStatus === "NOT_CONFIGURED");
    const degraded = providers.filter((provider) => ["DEGRADED", "RATE_LIMITED", "PAYMENT_DUE", "RENEWAL_DUE"].includes(provider.healthStatus));
    const offline = providers.filter((provider) => ["OFFLINE", "EXPIRED", "SUSPENDED"].includes(provider.healthStatus));
    const costs = this.costs(providers);
    const due7 = renewals.filter((item) => item.daysRemaining >= 0 && item.daysRemaining <= 7).length;
    const due30 = renewals.filter((item) => item.daysRemaining >= 0 && item.daysRemaining <= 30).length;
    return {
      totalProviders: providers.length,
      activeProviders: active.length,
      connectedApis: connected.length,
      notConfiguredApis: notConfigured.length,
      healthyServices: providers.filter((provider) => ["ACTIVE", "CONNECTED"].includes(provider.healthStatus)).length,
      degradedServices: degraded.length,
      offlineServices: offline.length,
      renewalsDueIn7Days: due7,
      renewalsDueIn30Days: due30,
      overdueRenewals: renewals.filter((item) => item.daysRemaining < 0).length,
      monthlyOperatingCostCents: costs.monthlyRecurringCostCents,
      annualOperatingCostCents: costs.annualRecurringCostCents,
      usageBasedCostThisMonthCents: costs.usageBasedCostsCents,
      highestCostProvider: costs.costByProvider[0]?.providerName ?? "None",
      fastestGrowingCost: "OpenAI usage placeholder",
      providersOverBudget: costs.costByCategory.filter((category) => category.status === "OVER_BUDGET").length,
      credentialsRequiringRotation: this.credentials(providers).filter((credential) => credential.rotationStatus === "ROTATION_DUE").length,
      criticalIncidents: alerts.filter((alert) => alert.severity === "CRITICAL").length,
      procurementRequestsAwaitingApproval: this.procurement.filter((item) => item.status === "APPROVAL_REQUIRED").length,
      executiveSummary: `FPF currently has ${active.length} active providers. ${due7} renewal(s) are due within seven days. ${this.credentials(providers).filter((credential) => credential.rotationStatus === "ROTATION_DUE").length} credential(s) require rotation. Estimated monthly infrastructure cost is $${(costs.monthlyRecurringCostCents / 100).toFixed(2)}. No critical provider outages are detected.`,
    };
  }

  private credentials(providers: ProviderRecord[]): ProviderCredentialMetadata[] {
    return providers.map((provider, index) => ({
      id: `cred_${provider.id}`,
      providerId: provider.id,
      credentialName: `${provider.name} production credential metadata`,
      credentialType: provider.category === "Database" ? "Database Credential" : provider.category.includes("Payment") ? "Webhook Secret" : "API Key",
      environment: provider.environment,
      secretManagerReference: `secret://fpf/${provider.id}/production`,
      maskedIdentifier: `${provider.name.slice(0, 3).toUpperCase()}_****_****_${String(index + 1042).slice(-4)}`,
      lastFourPlaceholder: String(index + 1042).slice(-4),
      createdAt: daysFromNow(-60),
      lastRotatedAt: index % 2 ? daysFromNow(-72) : daysFromNow(-20),
      nextRotationAt: index % 2 ? daysFromNow(5) : daysFromNow(45),
      rotationStatus: index % 2 ? "ROTATION_DUE" : "CURRENT",
      connectionTestStatus: provider.apiConnectionStatus === "CONNECTED" ? "PASSED" : "NOT_TESTED",
      lastTestedAt: provider.apiConnectionStatus === "CONNECTED" ? daysFromNow(-1) : null,
      credentialOwner: provider.internalOwner,
      expiryDate: index % 2 ? daysFromNow(30) : null,
      notes: "Raw credential is stored outside ordinary database records. Metadata only.",
    }));
  }

  private costs(providers: ProviderRecord[]): ProviderCostAnalytics {
    const monthly = providers.reduce((total, provider) => total + provider.monthlyCostCents, 0);
    const usage = providers.reduce((total, provider) => total + provider.usageBasedCostCents, 0);
    const setup = providers.reduce((total, provider) => total + provider.setupCostCents, 0);
    const taxes = Math.round((monthly + usage) * 0.08);
    const categories = Array.from(new Set(providers.map((provider) => provider.category)));
    return {
      monthlyRecurringCostCents: monthly,
      annualRecurringCostCents: providers.reduce((total, provider) => total + provider.annualCostCents, 0),
      setupCostsCents: setup,
      usageBasedCostsCents: usage,
      transactionFeesCents: 0,
      taxesCents: taxes,
      totalInfrastructureCostCents: monthly + usage + taxes,
      costByProvider: providers.map((provider) => ({ providerId: provider.id, providerName: provider.name, monthlyCostCents: provider.monthlyCostCents })).sort((a, b) => b.monthlyCostCents - a.monthlyCostCents),
      costByCategory: categories.map((category) => {
        const amount = providers.filter((provider) => provider.category === category).reduce((total, provider) => total + provider.monthlyCostCents + provider.usageBasedCostCents, 0);
        const budget = category === "Artificial Intelligence" ? 10000 : 15000;
        return { category, monthlyCostCents: amount, budgetCents: budget, status: amount > budget ? "OVER_BUDGET" : "OK" };
      }),
      costByEnvironment: [{ environment: "PRODUCTION", monthlyCostCents: monthly + usage }],
      costTrend: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((label, index) => ({ label, value: Math.round((monthly + usage) * (0.75 + index * 0.05)) })),
      forecastedMonthlyCostCents: Math.round((monthly + usage) * 1.12),
      forecastedAnnualCostCents: Math.round((monthly + usage) * 12 * 1.12),
      budgetAlerts: providers.filter((provider) => provider.apiConnectionStatus === "CONNECTED" && !provider.nextRenewalDate).map((provider) => `${provider.name} is connected but has no renewal date.`),
    };
  }

  private usage(providers: ProviderRecord[]): ProviderUsage[] {
    return providers.map((provider) => {
      const percent = provider.usageLimit ? Math.round((provider.currentUsage / provider.usageLimit) * 100) : 0;
      return {
        providerId: provider.id,
        providerName: provider.name,
        metric: provider.category === "Artificial Intelligence" ? "Tokens consumed" : "API requests used",
        used: provider.currentUsage,
        limit: provider.usageLimit,
        remaining: Math.max(0, provider.usageLimit - provider.currentUsage),
        usagePercent: percent,
        thresholds: [50, 75, 90, 100],
        status: percent >= 90 ? "CRITICAL" : percent >= 75 ? "WATCH" : "OK",
      };
    });
  }

  private comparisons(): ProviderComparison[] {
    return [
      { id: "compare_odds_current", category: "Odds Data", providerName: "The Odds API", status: "CURRENT", features: ["Odds", "Markets", "Regions"], freeTier: "Limited placeholder", monthlyCostCents: 7900, annualCostCents: 94800, usageLimits: "Manual verified quota", coverage: "Global", reliability: "Provider-ready", support: "Email", integrationComplexity: "MEDIUM", contractCommitment: "Monthly" },
      { id: "compare_odds_alt", category: "Odds Data", providerName: "SportMonks Odds", status: "UNDER_REVIEW", features: ["Odds", "Football data"], freeTier: "Unknown", monthlyCostCents: 0, annualCostCents: 0, usageLimits: "Requires admin pricing verification", coverage: "Global", reliability: "Under review", support: "Provider support", integrationComplexity: "HIGH", contractCommitment: "Unknown" },
    ];
  }

  private alerts(): ProviderAlert[] {
    const renewalAlerts = this.providers
      .filter((provider) => provider.nextRenewalDate)
      .map(renewal)
      .filter((item) => item.daysRemaining <= 30)
      .map((item): ProviderAlert => ({
        id: `alert_renewal_${item.providerId}`,
        providerId: item.providerId,
        providerName: item.providerName,
        type: item.daysRemaining <= 7 ? "UPCOMING_RENEWAL" : "RENEWAL_REMINDER",
        severity: item.daysRemaining <= 7 ? "WARNING" : "INFO",
        status: "OPEN",
        message: `${item.providerName} renews in ${item.daysRemaining} day(s). ${securityNotice}`,
        createdAt: now(),
      }));
    const usageAlerts = this.usage(this.providers)
      .filter((item) => item.status !== "OK")
      .map((item): ProviderAlert => ({
        id: `alert_usage_${item.providerId}`,
        providerId: item.providerId,
        providerName: item.providerName,
        type: "USAGE_THRESHOLD_REACHED",
        severity: item.status === "CRITICAL" ? "CRITICAL" : "WARNING",
        status: "OPEN",
        message: `${item.providerName} usage is at ${item.usagePercent}%.`,
        createdAt: now(),
      }));
    const credentialAlerts = this.credentials(this.providers)
      .filter((credential) => credential.rotationStatus === "ROTATION_DUE")
      .map((credential): ProviderAlert => ({
        id: `alert_credential_${credential.providerId}`,
        providerId: credential.providerId,
        providerName: this.getProvider(credential.providerId)?.name ?? "Provider",
        type: "CREDENTIAL_ROTATION_DUE",
        severity: "WARNING",
        status: "OPEN",
        message: `${credential.credentialName} rotation is due. Raw secrets are not exposed.`,
        createdAt: now(),
      }));
    return [...renewalAlerts, ...usageAlerts, ...credentialAlerts, ...this.tasks];
  }

  private tasksFromAlerts(alerts: ProviderAlert[]): ProviderTask[] {
    return alerts.slice(0, 8).map((alert, index) => ({
      id: `task_${alert.id}`,
      title: alert.message,
      providerId: alert.providerId,
      providerName: alert.providerName,
      category: alert.type,
      priority: alert.severity === "CRITICAL" ? "CRITICAL" : alert.severity === "WARNING" ? "HIGH" : "MEDIUM",
      assignedPerson: "Platform Operations",
      dueDate: daysFromNow(index + 1),
      status: "OPEN",
      notes: "Generated from infrastructure alert placeholder.",
    }));
  }

  private procurementReport(providers: ProviderRecord[]): ApiProcurementReport {
    const rows = providers.map((provider) => ({
      provider: provider.name,
      category: provider.category,
      purpose: provider.servicePurpose,
      required: ["Football Data", "Hosting", "Database"].includes(provider.category),
      recommendedPlan: provider.currentPlan,
      monthlyCostCents: provider.monthlyCostCents,
      annualCostCents: provider.annualCostCents,
      setupCostCents: provider.setupCostCents,
      freeTier: provider.monthlyCostCents === 0 ? "Available or usage-based placeholder" : "No verified free tier",
      purchaseStatus: provider.apiConnectionStatus,
      renewalDate: provider.nextRenewalDate,
      officialLinks: [provider.providerWebsite, provider.dashboardUrl, provider.billingUrl, provider.documentationUrl],
      notes: provider.notes,
    }));
    const monthly = rows.reduce((total, row) => total + row.monthlyCostCents, 0);
    const annual = rows.reduce((total, row) => total + row.annualCostCents, 0);
    const setup = rows.reduce((total, row) => total + row.setupCostCents, 0);
    return {
      providers: rows,
      totals: {
        essentialLaunchTotalCents: rows.filter((row) => row.required).reduce((total, row) => total + row.monthlyCostCents, 0),
        recommendedGrowthTotalCents: rows.filter((row) => !row.required && row.monthlyCostCents > 0).reduce((total, row) => total + row.monthlyCostCents, 0),
        optionalServicesTotalCents: rows.filter((row) => !row.required && row.monthlyCostCents === 0).reduce((total, row) => total + row.monthlyCostCents, 0),
        monthlyTotalCents: monthly,
        annualTotalCents: annual,
        oneTimeSetupTotalCents: setup,
        estimatedFirstYearTotalCents: annual + setup,
      },
    };
  }
}
