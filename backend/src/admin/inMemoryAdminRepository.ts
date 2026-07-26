import type { AccountStatus, AdminSettings, AdminUser, HistoricalArchiveRecord, HistoricalArchiveUpdateInput, UserRole } from "@fpf/shared";
import type { AdminRepository, AuditInput } from "./types.js";

const defaultSettings: AdminSettings = {
  predictionConfidenceThreshold: 60,
  riskThreshold: 70,
  maximumSelections: 5,
  scheduledSyncEnabled: false,
  maintenanceMode: false,
  enabledLanguages: ["en", "fr", "es", "pt", "de", "it", "ar", "zh"],
  enabledCurrencies: ["USD", "EUR", "GBP", "UGX", "KES", "TZS", "NGN", "ZAR", "CAD", "AUD"],
  defaultLanguage: "en",
  defaultCurrency: "USD",
  minimumInvestmentCents: 10000,
  enabledLockPeriods: ["SIX_MONTHS", "TWELVE_MONTHS"],
  defaultSimulationWeeklyReturnPercent: 1.25,
  defaultPlatformFeePercent: 10,
};

export class InMemoryAdminRepository implements AdminRepository {
  users: AdminUser[] = [];
  logs: Array<AuditInput & { id: string; createdAt: string }> = [];
  historicalRecords: HistoricalArchiveRecord[] = [
    {
      id: "baseline-operations-established",
      metricKey: "operations_established",
      label: "FPF football intelligence operations established",
      value: "2024",
      valueType: "YEAR",
      displayValue: "2024",
      reportingPeriod: "Pre-platform operating archive",
      archiveNotes: "Management-approved historical operating baseline.",
      evidenceReference: "Internal historical archive baseline",
      visible: true,
      reviewStatus: "APPROVED",
      lastReviewedAt: new Date(0).toISOString(),
      updatedByUserId: null,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
  ];
  private currentSettings = { ...defaultSettings };

  constructor(users: AdminUser[] = []) {
    this.users = users;
  }

  async overview() {
    return {
      totalUsers: this.users.length,
      activeSubscribers: this.users.filter((user) => user.role === "SUBSCRIBER" && user.status === "ACTIVE").length,
      activeInvestors: this.users.filter((user) => user.role === "INVESTOR" && user.status === "ACTIVE").length,
      todaysFixtures: 0,
      pendingPredictions: 0,
      approvedPredictions: 0,
      systemHealth: "OK" as const,
    };
  }

  async searchUsers(search?: string) {
    return this.users.filter((user) =>
      search ? `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase()) : true,
    );
  }

  async updateUserStatus(userId: string, status: AccountStatus) {
    const user = this.users.find((item) => item.id === userId);
    if (user) user.status = status;
    return user ?? null;
  }

  async updateUserRole(userId: string, role: UserRole) {
    const user = this.users.find((item) => item.id === userId);
    if (user) user.role = role;
    return user ?? null;
  }

  async resetUserPassword() {}

  async settings() {
    return this.currentSettings;
  }

  async reports() {
    return {
      subscribers: {
        total: this.users.filter((user) => user.role === "SUBSCRIBER").length,
        active: this.users.filter((user) => user.role === "SUBSCRIBER" && user.status === "ACTIVE").length,
        disabled: this.users.filter((user) => user.role === "SUBSCRIBER" && user.status === "DISABLED").length,
      },
      investors: {
        total: this.users.filter((user) => user.role === "INVESTOR").length,
        active: this.users.filter((user) => user.role === "INVESTOR" && user.status === "ACTIVE").length,
      },
      revenue: {
        trackedWalletDepositsCents: 0,
        note: "Tracked deposits are wallet funding records only; no new payment features are introduced here.",
      },
      withdrawals: {
        pendingCount: 0,
        approvedCount: 0,
        pendingAmountCents: 0,
        approvedAmountCents: 0,
      },
      analystPerformance: {
        submitted: 0,
        approved: 0,
        published: 0,
        rejected: 0,
      },
      predictionAccuracy: {
        approvedPredictions: 0,
        publishedIntelligence: 0,
        accuracyNote: "Accuracy is a production reporting placeholder until settled match result grading is enabled.",
      },
      dailyPlatformActivity: [],
    };
  }

  async updateSettings(settings: Partial<AdminSettings>) {
    this.currentSettings = { ...this.currentSettings, ...settings };
    return this.currentSettings;
  }

  async historicalArchive() {
    return this.historicalRecords;
  }

  async updateHistoricalArchive(metricKey: string, input: HistoricalArchiveUpdateInput & { updatedByUserId: string }) {
    if (input.visible && (!input.evidenceReference?.trim() || input.reviewStatus !== "APPROVED")) {
      throw new Error("Evidence reference and approved review status are required before public visibility.");
    }
    const now = new Date().toISOString();
    const existing = this.historicalRecords.find((record) => record.metricKey === metricKey);
    const updated: HistoricalArchiveRecord = {
      id: existing?.id ?? `archive-${metricKey}`,
      metricKey,
      label: input.label ?? existing?.label ?? metricKey,
      value: input.value ?? existing?.value ?? "",
      valueType: input.valueType ?? existing?.valueType ?? "TEXT",
      displayValue: input.displayValue ?? existing?.displayValue ?? input.value ?? "",
      reportingPeriod: input.reportingPeriod ?? existing?.reportingPeriod ?? null,
      archiveNotes: input.archiveNotes ?? existing?.archiveNotes ?? null,
      evidenceReference: input.evidenceReference ?? existing?.evidenceReference ?? null,
      visible: input.visible ?? existing?.visible ?? false,
      reviewStatus: input.reviewStatus ?? existing?.reviewStatus ?? "DRAFT",
      lastReviewedAt: input.reviewStatus === "APPROVED" ? now : existing?.lastReviewedAt ?? null,
      updatedByUserId: input.updatedByUserId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing) {
      this.historicalRecords = this.historicalRecords.map((record) => record.metricKey === metricKey ? updated : record);
    } else {
      this.historicalRecords.push(updated);
    }
    return updated;
  }

  async audit(input: AuditInput) {
    this.logs.push({ ...input, id: String(this.logs.length + 1), createdAt: new Date().toISOString() });
  }

  async auditLogs() {
    return this.logs.map((log) => ({
      id: log.id,
      actorUserId: log.actorUserId ?? null,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId ?? null,
      createdAt: log.createdAt,
    }));
  }

  async loginHistory() {
    return [];
  }

  async syncLogs() {
    return [];
  }
}
