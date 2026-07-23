import bcrypt from "bcryptjs";
import type { AdminSettings, UserRole } from "@fpf/shared";
import type { AdminRepository } from "./types.js";

const temporaryPassword = "Temporary123";

export class AdminService {
  constructor(private readonly repository: AdminRepository) {}

  overview() {
    return this.repository.overview();
  }

  searchUsers(search?: string) {
    return this.repository.searchUsers(search);
  }

  async suspendUser(actorUserId: string, userId: string) {
    const user = await this.repository.updateUserStatus(userId, "DISABLED");
    await this.repository.audit({ actorUserId, action: "USER_SUSPENDED", entityType: "USER", entityId: userId });
    return user;
  }

  async activateUser(actorUserId: string, userId: string) {
    const user = await this.repository.updateUserStatus(userId, "ACTIVE");
    await this.repository.audit({ actorUserId, action: "USER_ACTIVATED", entityType: "USER", entityId: userId });
    return user;
  }

  async assignRole(actorUserId: string, userId: string, role: UserRole) {
    const user = await this.repository.updateUserRole(userId, role);
    await this.repository.audit({ actorUserId, action: "USER_ROLE_ASSIGNED", entityType: "USER", entityId: userId, details: { role } });
    return user;
  }

  async resetPassword(actorUserId: string, userId: string) {
    await this.repository.resetUserPassword(userId, await bcrypt.hash(temporaryPassword, 12));
    await this.repository.audit({ actorUserId, action: "USER_PASSWORD_RESET", entityType: "USER", entityId: userId });
    return { message: "Temporary password set.", temporaryPassword };
  }

  settings() {
    return this.repository.settings();
  }

  reports() {
    return this.repository.reports();
  }

  async updateSettings(actorUserId: string, settings: Partial<AdminSettings>) {
    const updated = await this.repository.updateSettings(settings);
    await this.repository.audit({ actorUserId, action: "SETTINGS_UPDATED", entityType: "SETTINGS", details: settings });
    return updated;
  }

  auditLogs() {
    return this.repository.auditLogs();
  }

  loginHistory() {
    return this.repository.loginHistory();
  }

  syncLogs() {
    return this.repository.syncLogs();
  }

  audit(actorUserId: string | null, action: string, entityType: string, entityId?: string | null, details?: unknown) {
    return this.repository.audit({ actorUserId, action, entityType, entityId, details });
  }
}
