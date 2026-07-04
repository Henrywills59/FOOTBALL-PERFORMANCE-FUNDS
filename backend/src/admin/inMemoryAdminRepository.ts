import type { AccountStatus, AdminSettings, AdminUser, UserRole } from "@fpf/shared";
import type { AdminRepository, AuditInput } from "./types.js";

const defaultSettings: AdminSettings = {
  predictionConfidenceThreshold: 60,
  riskThreshold: 70,
  maximumSelections: 5,
  scheduledSyncEnabled: false,
  maintenanceMode: false,
};

export class InMemoryAdminRepository implements AdminRepository {
  users: AdminUser[] = [];
  logs: Array<AuditInput & { id: string; createdAt: string }> = [];
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

  async updateSettings(settings: Partial<AdminSettings>) {
    this.currentSettings = { ...this.currentSettings, ...settings };
    return this.currentSettings;
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
