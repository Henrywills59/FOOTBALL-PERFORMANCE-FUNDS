import type {
  AdminAnnouncement,
  IncidentNote,
  NotificationPreferences,
  NotificationStatus,
  OperationalNotification,
  OperationalReport,
  SystemIncident,
  UserRole,
} from "@fpf/shared";
import type { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { getPrismaClient } from "../database/prismaClient.js";
import type {
  AnnouncementCreateInput,
  AnnouncementUpdateInput,
  IncidentCreateInput,
  IncidentUpdateInput,
  NotificationCreateInput,
  NotificationPreferenceInput,
  OperationsRepository,
  ReportCreateInput,
  ReportFilters,
} from "./types.js";

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function isMissingTableError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2021";
}

function recordObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function defaultPreferences(userId: string): NotificationPreferences {
  return {
    userId,
    inAppEnabled: true,
    emailPlaceholderEnabled: false,
    smsPlaceholderEnabled: false,
    whatsappPlaceholderEnabled: false,
    pushPlaceholderEnabled: false,
    marketingEnabled: true,
    financialEnabled: true,
    predictionEnabled: true,
    securityEnabled: true,
    updatedAt: nowIso(),
  };
}

export class InMemoryOperationsRepository implements OperationsRepository {
  private reports: OperationalReport[] = [];
  private incidents: SystemIncident[] = [];
  private incidentNotes: IncidentNote[] = [];
  private notifications: OperationalNotification[] = [];
  private preferences = new Map<string, NotificationPreferences>();
  private announcements: AdminAnnouncement[] = [];

  async listReports(user: { id: string; role: UserRole }, filters: ReportFilters) {
    return this.reports.filter((report) => {
      const canSee = user.role === "ADMIN" || report.ownerUserId === user.id || report.ownerRole === user.role || report.ownerRole === "ALL";
      return canSee && (!filters.reportType || report.type === filters.reportType);
    });
  }

  async getReport(id: string, user: { id: string; role: UserRole }) {
    const report = this.reports.find((item) => item.id === id) ?? null;
    if (!report) return null;
    if (user.role === "ADMIN" || report.ownerUserId === user.id || report.ownerRole === user.role || report.ownerRole === "ALL") return report;
    return null;
  }

  async createReport(input: ReportCreateInput) {
    const createdAt = nowIso();
    const report: OperationalReport = {
      id: id("report"),
      title: input.title,
      type: input.type,
      status: "READY",
      ownerUserId: input.ownerUserId,
      ownerRole: input.ownerRole,
      filters: input.filters,
      summary: input.summary,
      data: input.data,
      errorMessage: null,
      generatedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    };
    this.reports.unshift(report);
    return report;
  }

  async listIncidents() {
    return this.incidents;
  }

  async createIncident(input: IncidentCreateInput) {
    const createdAt = nowIso();
    const incident: SystemIncident = {
      id: id("incident"),
      title: input.title,
      severity: input.severity,
      status: "OPEN",
      affectedModules: input.affectedModules,
      assignedToUserId: null,
      rootCause: null,
      resolution: null,
      archived: false,
      createdByUserId: input.createdByUserId,
      createdAt,
      updatedAt: createdAt,
    };
    this.incidents.unshift(incident);
    return incident;
  }

  async updateIncident(idValue: string, input: IncidentUpdateInput) {
    const incident = this.incidents.find((item) => item.id === idValue);
    if (!incident) throw new Error("Incident not found");
    Object.assign(incident, {
      status: input.status ?? incident.status,
      severity: input.severity ?? incident.severity,
      assignedToUserId: input.assignedToUserId === undefined ? incident.assignedToUserId : input.assignedToUserId,
      rootCause: input.rootCause === undefined ? incident.rootCause : input.rootCause,
      resolution: input.resolution === undefined ? incident.resolution : input.resolution,
      affectedModules: input.affectedModules ?? incident.affectedModules,
      archived: input.archived ?? incident.archived,
      updatedAt: nowIso(),
    });
    if (input.note) await this.addIncidentNote(idValue, input.actorUserId, input.note);
    return incident;
  }

  async addIncidentNote(incidentId: string, authorUserId: string, note: string) {
    const createdAt = nowIso();
    const entry: IncidentNote = { id: id("incident_note"), incidentId, authorUserId, note, createdAt };
    this.incidentNotes.unshift(entry);
    return entry;
  }

  async listNotifications(userId: string, status?: NotificationStatus) {
    return this.notifications.filter((item) => item.userId === userId && (!status || item.status === status));
  }

  async createNotification(input: NotificationCreateInput) {
    const createdAt = nowIso();
    const notification: OperationalNotification = {
      id: id("notification"),
      userId: input.userId,
      category: input.category,
      status: "UNREAD",
      title: input.title,
      message: input.message,
      metadata: input.metadata ?? {},
      createdAt,
      readAt: null,
    };
    this.notifications.unshift(notification);
    return notification;
  }

  async markNotificationRead(idValue: string, userId: string) {
    const notification = this.notifications.find((item) => item.id === idValue && item.userId === userId) ?? null;
    if (!notification) return null;
    notification.status = "READ";
    notification.readAt = nowIso();
    return notification;
  }

  async getNotificationPreferences(userId: string) {
    const preferences = this.preferences.get(userId) ?? defaultPreferences(userId);
    this.preferences.set(userId, preferences);
    return preferences;
  }

  async updateNotificationPreferences(userId: string, input: NotificationPreferenceInput) {
    const preferences: NotificationPreferences = {
      ...defaultPreferences(userId),
      ...input,
      userId,
      securityEnabled: true,
      updatedAt: nowIso(),
    };
    this.preferences.set(userId, preferences);
    return preferences;
  }

  async listAnnouncements() {
    return this.announcements;
  }

  async createAnnouncement(input: AnnouncementCreateInput) {
    const createdAt = nowIso();
    const announcement: AdminAnnouncement = {
      id: id("announcement"),
      title: input.title,
      message: input.message,
      status: input.status,
      targetRoles: input.targetRoles,
      targetCountries: input.targetCountries,
      targetLanguages: input.targetLanguages,
      targetSubscriptionPlans: input.targetSubscriptionPlans,
      scheduledAt: input.scheduledAt,
      expiresAt: input.expiresAt,
      createdByUserId: input.createdByUserId,
      createdAt,
      updatedAt: createdAt,
    };
    this.announcements.unshift(announcement);
    return announcement;
  }

  async updateAnnouncement(idValue: string, input: AnnouncementUpdateInput) {
    const announcement = this.announcements.find((item) => item.id === idValue);
    if (!announcement) throw new Error("Announcement not found");
    Object.assign(announcement, {
      ...input,
      updatedAt: nowIso(),
    });
    return announcement;
  }
}

export class PrismaOperationsRepository implements OperationsRepository {
  private readonly prisma = getPrismaClient();
  private readonly fallback = new InMemoryOperationsRepository();

  private async safe<T>(operation: () => Promise<T>, fallback: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (isMissingTableError(error)) {
        console.warn("OPERATIONS_TABLE_FALLBACK", { message: error instanceof Error ? error.message : "Missing operations table" });
        return fallback();
      }
      throw error;
    }
  }

  async listReports(user: { id: string; role: UserRole }, filters: ReportFilters) {
    return this.safe(async () => {
      const rows = await this.prisma.report.findMany({
        where: {
          type: filters.reportType,
          OR: user.role === "ADMIN"
            ? undefined
            : [{ ownerUserId: user.id }, { ownerRole: user.role }, { ownerRole: "ALL" }],
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return rows.map((row): OperationalReport => ({
        id: row.id,
        title: row.title,
        type: row.type as OperationalReport["type"],
        status: row.status as OperationalReport["status"],
        ownerUserId: row.ownerUserId,
        ownerRole: row.ownerRole as OperationalReport["ownerRole"],
        filters: recordObject(row.filters),
        summary: row.summary,
        data: recordObject(row.data),
        errorMessage: row.errorMessage,
        generatedAt: row.generatedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    }, () => this.fallback.listReports(user, filters));
  }

  async getReport(idValue: string, user: { id: string; role: UserRole }) {
    const reports = await this.listReports(user, {});
    return reports.find((report) => report.id === idValue) ?? null;
  }

  async createReport(input: ReportCreateInput) {
    return this.safe(async () => {
      const row = await this.prisma.report.create({
        data: {
          title: input.title,
          type: input.type,
          status: "READY",
          ownerUserId: input.ownerUserId,
          ownerRole: input.ownerRole,
          filters: input.filters as Prisma.InputJsonValue,
          summary: input.summary,
          data: input.data as Prisma.InputJsonValue,
          generatedAt: new Date(),
        },
      });
      await this.prisma.reportRun.create({ data: { reportId: row.id, status: "READY", completedAt: new Date() } });
      return {
        id: row.id,
        title: row.title,
        type: row.type as OperationalReport["type"],
        status: row.status as OperationalReport["status"],
        ownerUserId: row.ownerUserId,
        ownerRole: row.ownerRole as OperationalReport["ownerRole"],
        filters: recordObject(row.filters),
        summary: row.summary,
        data: recordObject(row.data),
        errorMessage: row.errorMessage,
        generatedAt: row.generatedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    }, () => this.fallback.createReport(input));
  }

  async listIncidents() {
    return this.safe(async () => {
      const rows = await this.prisma.systemIncident.findMany({ orderBy: { updatedAt: "desc" }, take: 100 });
      return rows.map((row): SystemIncident => ({
        id: row.id,
        title: row.title,
        severity: row.severity as SystemIncident["severity"],
        status: row.status as SystemIncident["status"],
        affectedModules: stringArray(row.affectedModules),
        assignedToUserId: row.assignedToUserId,
        rootCause: row.rootCause,
        resolution: row.resolution,
        archived: row.archived,
        createdByUserId: row.createdByUserId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    }, () => this.fallback.listIncidents());
  }

  async createIncident(input: IncidentCreateInput) {
    return this.safe(async () => {
      const row = await this.prisma.systemIncident.create({
        data: {
          title: input.title,
          severity: input.severity,
          status: "OPEN",
          affectedModules: input.affectedModules,
          createdByUserId: input.createdByUserId,
        },
      });
      return {
        id: row.id,
        title: row.title,
        severity: row.severity as SystemIncident["severity"],
        status: row.status as SystemIncident["status"],
        affectedModules: stringArray(row.affectedModules),
        assignedToUserId: row.assignedToUserId,
        rootCause: row.rootCause,
        resolution: row.resolution,
        archived: row.archived,
        createdByUserId: row.createdByUserId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    }, () => this.fallback.createIncident(input));
  }

  async updateIncident(idValue: string, input: IncidentUpdateInput) {
    return this.safe(async () => {
      const row = await this.prisma.systemIncident.update({
        where: { id: idValue },
        data: {
          status: input.status,
          severity: input.severity,
          assignedToUserId: input.assignedToUserId,
          rootCause: input.rootCause,
          resolution: input.resolution,
          affectedModules: input.affectedModules,
          archived: input.archived,
        },
      });
      if (input.note) await this.addIncidentNote(idValue, input.actorUserId, input.note);
      return {
        id: row.id,
        title: row.title,
        severity: row.severity as SystemIncident["severity"],
        status: row.status as SystemIncident["status"],
        affectedModules: stringArray(row.affectedModules),
        assignedToUserId: row.assignedToUserId,
        rootCause: row.rootCause,
        resolution: row.resolution,
        archived: row.archived,
        createdByUserId: row.createdByUserId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    }, () => this.fallback.updateIncident(idValue, input));
  }

  async addIncidentNote(incidentId: string, authorUserId: string, note: string) {
    return this.safe(async () => {
      const row = await this.prisma.incidentNote.create({ data: { incidentId, authorUserId, note } });
      return { id: row.id, incidentId: row.incidentId, authorUserId: row.authorUserId, note: row.note, createdAt: row.createdAt.toISOString() };
    }, () => this.fallback.addIncidentNote(incidentId, authorUserId, note));
  }

  async listNotifications(userId: string, status?: NotificationStatus) {
    return this.safe(async () => {
      const rows = await this.prisma.notification.findMany({ where: { userId, status }, orderBy: { createdAt: "desc" }, take: 100 });
      return rows.map((row): OperationalNotification => ({
        id: row.id,
        userId: row.userId,
        category: row.category as OperationalNotification["category"],
        status: row.status as OperationalNotification["status"],
        title: row.title,
        message: row.message,
        metadata: recordObject(row.metadata),
        createdAt: row.createdAt.toISOString(),
        readAt: row.readAt?.toISOString() ?? null,
      }));
    }, () => this.fallback.listNotifications(userId, status));
  }

  async createNotification(input: NotificationCreateInput) {
    return this.safe(async () => {
      const row = await this.prisma.notification.create({
        data: { ...input, metadata: (input.metadata ?? {}) as Prisma.InputJsonValue, status: "UNREAD" },
      });
      return {
        id: row.id,
        userId: row.userId,
        category: row.category as OperationalNotification["category"],
        status: row.status as OperationalNotification["status"],
        title: row.title,
        message: row.message,
        metadata: recordObject(row.metadata),
        createdAt: row.createdAt.toISOString(),
        readAt: null,
      };
    }, () => this.fallback.createNotification(input));
  }

  async markNotificationRead(idValue: string, userId: string) {
    return this.safe(async () => {
      await this.prisma.notification.updateMany({
        where: { id: idValue, userId },
        data: { status: "READ", readAt: new Date() },
      });
      const row = await this.prisma.notification.findFirst({ where: { id: idValue, userId } });
      if (!row) return null;
      return {
        id: row.id,
        userId: row.userId,
        category: row.category as OperationalNotification["category"],
        status: row.status as OperationalNotification["status"],
        title: row.title,
        message: row.message,
        metadata: recordObject(row.metadata),
        createdAt: row.createdAt.toISOString(),
        readAt: row.readAt?.toISOString() ?? null,
      };
    }, () => this.fallback.markNotificationRead(idValue, userId));
  }

  async getNotificationPreferences(userId: string) {
    return this.safe(async () => {
      const row = await this.prisma.notificationPreference.upsert({
        where: { userId },
        update: {},
        create: defaultPreferences(userId),
      });
      return { ...defaultPreferences(userId), ...row, securityEnabled: true, updatedAt: row.updatedAt.toISOString() };
    }, () => this.fallback.getNotificationPreferences(userId));
  }

  async updateNotificationPreferences(userId: string, input: NotificationPreferenceInput) {
    return this.safe(async () => {
      const row = await this.prisma.notificationPreference.upsert({
        where: { userId },
        update: { ...input, securityEnabled: true },
        create: { ...defaultPreferences(userId), ...input, userId, securityEnabled: true },
      });
      return { ...defaultPreferences(userId), ...row, securityEnabled: true, updatedAt: row.updatedAt.toISOString() };
    }, () => this.fallback.updateNotificationPreferences(userId, input));
  }

  async listAnnouncements() {
    return this.safe(async () => {
      const rows = await this.prisma.adminAnnouncement.findMany({ orderBy: { updatedAt: "desc" }, take: 100 });
      return rows.map((row): AdminAnnouncement => ({
        id: row.id,
        title: row.title,
        message: row.message,
        status: row.status as AdminAnnouncement["status"],
        targetRoles: stringArray(row.targetRoles) as AdminAnnouncement["targetRoles"],
        targetCountries: stringArray(row.targetCountries),
        targetLanguages: stringArray(row.targetLanguages),
        targetSubscriptionPlans: stringArray(row.targetSubscriptionPlans),
        scheduledAt: row.scheduledAt?.toISOString() ?? null,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        createdByUserId: row.createdByUserId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    }, () => this.fallback.listAnnouncements());
  }

  async createAnnouncement(input: AnnouncementCreateInput) {
    return this.safe(async () => {
      const row = await this.prisma.adminAnnouncement.create({
        data: {
          ...input,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });
      return {
        id: row.id,
        title: row.title,
        message: row.message,
        status: row.status as AdminAnnouncement["status"],
        targetRoles: stringArray(row.targetRoles) as AdminAnnouncement["targetRoles"],
        targetCountries: stringArray(row.targetCountries),
        targetLanguages: stringArray(row.targetLanguages),
        targetSubscriptionPlans: stringArray(row.targetSubscriptionPlans),
        scheduledAt: row.scheduledAt?.toISOString() ?? null,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        createdByUserId: row.createdByUserId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    }, () => this.fallback.createAnnouncement(input));
  }

  async updateAnnouncement(idValue: string, input: AnnouncementUpdateInput) {
    return this.safe(async () => {
      const row = await this.prisma.adminAnnouncement.update({
        where: { id: idValue },
        data: {
          ...input,
          scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        },
      });
      return {
        id: row.id,
        title: row.title,
        message: row.message,
        status: row.status as AdminAnnouncement["status"],
        targetRoles: stringArray(row.targetRoles) as AdminAnnouncement["targetRoles"],
        targetCountries: stringArray(row.targetCountries),
        targetLanguages: stringArray(row.targetLanguages),
        targetSubscriptionPlans: stringArray(row.targetSubscriptionPlans),
        scheduledAt: row.scheduledAt?.toISOString() ?? null,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        createdByUserId: row.createdByUserId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    }, () => this.fallback.updateAnnouncement(idValue, input));
  }
}
