import type { AdminOverview, AdminSettings, AdminUser, AuditLogEntry, UserRole } from "@fpf/shared";

export type AuditInput = {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: unknown;
};

export type AdminRepository = {
  overview(): Promise<AdminOverview>;
  searchUsers(search?: string): Promise<AdminUser[]>;
  updateUserStatus(userId: string, status: "ACTIVE" | "DISABLED"): Promise<AdminUser | null>;
  updateUserRole(userId: string, role: UserRole): Promise<AdminUser | null>;
  resetUserPassword(userId: string, passwordHash: string): Promise<void>;
  settings(): Promise<AdminSettings>;
  updateSettings(settings: Partial<AdminSettings>): Promise<AdminSettings>;
  audit(input: AuditInput): Promise<void>;
  auditLogs(): Promise<AuditLogEntry[]>;
  loginHistory(): Promise<AuditLogEntry[]>;
  syncLogs(): Promise<AuditLogEntry[]>;
};
