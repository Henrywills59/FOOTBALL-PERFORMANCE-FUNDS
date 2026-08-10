import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { AdminSettings, HistoricalArchiveUpdateInput, UserRole } from "@fpf/shared";
import { AuthError } from "../auth/authService.js";
import type { AdminRepository } from "./types.js";

const administratorRoles: UserRole[] = ["ADMIN", "SUPER_ADMINISTRATOR"];

export class AdminService {
  constructor(private readonly repository: AdminRepository) {}

  overview() {
    return this.repository.overview();
  }

  searchUsers(search?: string) {
    return this.repository.searchUsers(search);
  }

  async suspendUser(actorUserId: string, userId: string) {
    const current = await this.repository.findUserById?.(userId);
    if (current && administratorRoles.includes(current.role)) {
      const activeAdmins = await this.repository.countActiveAdministrators?.();
      if (activeAdmins !== undefined && activeAdmins <= 1) {
        throw new AuthError("The last active administrator cannot be suspended.", 409);
      }
    }
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
    const current = await this.repository.findUserById?.(userId);
    if (current && administratorRoles.includes(current.role) && !administratorRoles.includes(role)) {
      const activeAdmins = await this.repository.countActiveAdministrators?.();
      if (activeAdmins !== undefined && activeAdmins <= 1) {
        throw new AuthError("The last active administrator cannot lose administrator access.", 409);
      }
    }
    const user = await this.repository.updateUserRole(userId, role);
    await this.repository.audit({ actorUserId, action: "USER_ROLE_ASSIGNED", entityType: "USER", entityId: userId, details: { role } });
    return user;
  }

  async resetPassword(actorUserId: string, userId: string) {
    const temporaryPassword = randomBytes(24).toString("base64url");
    await this.repository.resetUserPassword(userId, await bcrypt.hash(temporaryPassword, 12));
    await this.repository.audit({ actorUserId, action: "USER_PASSWORD_RESET", entityType: "USER", entityId: userId });
    return {
      message: "Password reset initiated. The user must complete the standard password reset flow.",
    };
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

  historicalArchive() {
    return this.repository.historicalArchive();
  }

  async updateHistoricalArchive(actorUserId: string, metricKey: string, input: HistoricalArchiveUpdateInput) {
    const updated = await this.repository.updateHistoricalArchive(metricKey, { ...input, updatedByUserId: actorUserId });
    await this.repository.audit({
      actorUserId,
      action: "HISTORICAL_ARCHIVE_UPDATED",
      entityType: "HISTORICAL_ARCHIVE",
      entityId: updated.id,
      details: {
        metricKey,
        visible: updated.visible,
        reviewStatus: updated.reviewStatus,
        evidenceReferencePresent: Boolean(updated.evidenceReference?.trim()),
      },
    });
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
