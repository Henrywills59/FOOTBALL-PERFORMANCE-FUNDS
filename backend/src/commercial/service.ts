import type { AdminSettings, CommercialControlCenter, CommercialStructure, InfrastructureProvider, ProcurementItem, SubscriberPlanCode } from "@fpf/shared";
import type { AdminService } from "../admin/adminService.js";
import {
  defaultBusinessDashboard,
  defaultCommercialStructure,
  defaultInfrastructureProviders,
  defaultProcurement,
  defaultRenewals,
  defaultSubscriptionRecord,
} from "./defaults.js";

export class CommercialService {
  constructor(private readonly adminService: AdminService) {}

  async structure(): Promise<CommercialStructure> {
    const settings = await this.adminService.settings();
    return {
      ...defaultCommercialStructure,
      minimumInvestmentCents: settings.minimumInvestmentCents ?? defaultCommercialStructure.minimumInvestmentCents,
      lockPeriods: defaultCommercialStructure.lockPeriods.map((period) => ({
        ...period,
        enabled: settings.enabledLockPeriods?.length ? settings.enabledLockPeriods.includes(period.code) : period.enabled,
      })),
      simulatorDefaults: {
        weeklyReturnPercent:
          settings.defaultSimulationWeeklyReturnPercent ?? defaultCommercialStructure.simulatorDefaults.weeklyReturnPercent,
        platformFeePercent: settings.defaultPlatformFeePercent ?? defaultCommercialStructure.simulatorDefaults.platformFeePercent,
      },
    };
  }

  async controlCenter(userId: string): Promise<CommercialControlCenter> {
    const structure = await this.structure();
    return {
      structure,
      businessDashboard: defaultBusinessDashboard,
      subscription: { ...defaultSubscriptionRecord, userId },
      lockSnapshots: [],
      infrastructureProviders: defaultInfrastructureProviders,
      renewals: defaultRenewals,
      procurement: defaultProcurement,
    };
  }

  async subscription(userId: string) {
    return { ...defaultSubscriptionRecord, userId };
  }

  async changeSubscription(actorUserId: string, input: { planCode: SubscriberPlanCode; billingCycle: "MONTHLY" | "ANNUAL"; action: "UPGRADE" | "DOWNGRADE" | "CANCEL" | "RENEW" }) {
    await this.adminService.audit(actorUserId, `SUBSCRIPTION_${input.action}`, "SUBSCRIPTION", actorUserId);
    const cancelled = input.action === "CANCEL";
    return {
      ...defaultSubscriptionRecord,
      userId: actorUserId,
      planCode: input.planCode,
      billingCycle: input.billingCycle,
      status: cancelled ? "CANCELLED" as const : "ACTIVE" as const,
      renewalDate: cancelled ? null : defaultSubscriptionRecord.renewalDate,
    };
  }

  async investorPackages() {
    return (await this.structure()).investorPackages;
  }

  async updateInvestorPackage(actorUserId: string, packageId: string, input: Partial<CommercialStructure["investorPackages"][number]>) {
    await this.adminService.audit(actorUserId, "INVESTOR_PACKAGE_UPDATED", "INVESTOR_PACKAGE", packageId);
    const existing = defaultCommercialStructure.investorPackages.find((item) => item.id === packageId) ?? defaultCommercialStructure.investorPackages[0];
    return { ...existing, ...input, id: packageId };
  }

  async pricingRules() {
    return (await this.structure()).pricingRules;
  }

  async createPricingRule(actorUserId: string, input: CommercialStructure["pricingRules"][number]) {
    await this.adminService.audit(actorUserId, "PRICING_RULE_CREATED", "PRICING_RULE", input.id);
    return input;
  }

  businessDashboard() {
    return defaultBusinessDashboard;
  }

  infrastructureProviders() {
    return defaultInfrastructureProviders;
  }

  async createInfrastructureProvider(actorUserId: string, input: InfrastructureProvider) {
    await this.adminService.audit(actorUserId, "INFRASTRUCTURE_PROVIDER_CREATED", "PROVIDER", input.id);
    return input;
  }

  renewals() {
    return defaultRenewals;
  }

  procurement() {
    return defaultProcurement;
  }

  async createProcurement(actorUserId: string, input: ProcurementItem) {
    await this.adminService.audit(actorUserId, "PROCUREMENT_CREATED", "PROCUREMENT", input.id);
    return input;
  }

  async updateSettings(actorUserId: string, input: Partial<AdminSettings>) {
    return this.adminService.updateSettings(actorUserId, {
      minimumInvestmentCents: input.minimumInvestmentCents,
      enabledLockPeriods: input.enabledLockPeriods,
      defaultSimulationWeeklyReturnPercent: input.defaultSimulationWeeklyReturnPercent,
      defaultPlatformFeePercent: input.defaultPlatformFeePercent,
    });
  }
}
