import type {
  AdminAnnouncement,
  MonitoringOverview,
  NotificationPreferences,
  OperationalReportType,
  UserRole,
} from "@fpf/shared";
import { checkPrismaConnection } from "../database/prismaClient.js";
import type { DeliveryChannel, DeliveryRequest, NotificationDeliveryService } from "../integrations/notificationProviders.js";
import { operationsProviderCatalog } from "./providers.js";
import type {
  AnnouncementCreateInput,
  AnnouncementUpdateInput,
  IncidentCreateInput,
  IncidentUpdateInput,
  NotificationPreferenceInput,
  OperationsRepository,
  ReportFilters,
} from "./types.js";

const reportTitles: Record<OperationalReportType, string> = {
  SUBSCRIBER: "Subscriber Report",
  INVESTOR: "Investor Report",
  PREDICTION_PERFORMANCE: "Prediction Performance Report",
  ANALYST_PERFORMANCE: "Analyst Performance Report",
  CAMPAIGN: "Campaign Report",
  PLATFORM_ACTIVITY: "Platform Activity Report",
  FINANCIAL_SUMMARY: "Financial Summary Report",
  DISTRIBUTION: "Distribution Report",
  USER_GROWTH: "User Growth Report",
  SYSTEM_HEALTH: "System Health Report",
};

export class OperationsService {
  constructor(
    private readonly repository: OperationsRepository,
    private readonly notificationDeliveryService?: NotificationDeliveryService,
  ) {}

  listReports(user: { id: string; role: UserRole }, filters: ReportFilters) {
    return this.repository.listReports(user, filters);
  }

  getReport(id: string, user: { id: string; role: UserRole }) {
    return this.repository.getReport(id, user);
  }

  generateReport(user: { id: string; role: UserRole }, input: { type: OperationalReportType; filters: ReportFilters }) {
    const generatedAt = new Date().toISOString();
    const title = reportTitles[input.type] ?? "FPF Operational Report";
    const ownerRole = user.role === "ADMIN" ? input.filters.userRole ?? "ALL" : user.role;
    const ownerUserId = user.role === "ADMIN" ? null : user.id;

    return this.repository.createReport({
      title,
      type: input.type,
      ownerUserId,
      ownerRole,
      filters: input.filters,
      summary: `${title} generated from available FPF platform data. Placeholder sections are used where live providers are not connected.`,
      data: {
        generatedAt,
        filters: input.filters,
        totals: {
          records: 0,
          warnings: 0,
          failedItems: 0,
        },
        exportProviders: {
          pdf: "PLACEHOLDER",
          csv: "PLACEHOLDER",
          spreadsheet: "PLACEHOLDER",
        },
        sections: [
          "Executive summary",
          "Filtered activity",
          "Performance snapshot",
          "Safe placeholder data notice",
        ],
      },
    });
  }

  async monitoringOverview(): Promise<MonitoringOverview> {
    const checkedAt = new Date().toISOString();
    const database = await checkPrismaConnection();
    const incidents = await this.repository.listIncidents();
    const activeIncidents = incidents.filter((incident) => !["RESOLVED", "CLOSED"].includes(incident.status) && !incident.archived);
    const dbStatus = database.ok ? "GREEN" : "AMBER";

    return {
      components: [
        { name: "Backend health", status: "GREEN", message: "API process is responding.", lastCheckedAt: checkedAt },
        { name: "Frontend health", status: "GREEN", message: "Frontend deployment is provider-managed and reachable after deployment smoke.", lastCheckedAt: checkedAt },
        { name: "Database health", status: dbStatus, message: database.message, lastCheckedAt: checkedAt },
        { name: "Authentication health", status: "GREEN", message: "JWT authentication is active.", lastCheckedAt: checkedAt },
        { name: "Deployment health", status: "GREEN", message: "Deployment script records production PASS/FAIL results.", lastCheckedAt: checkedAt },
        { name: "Decision Engine health", status: "GREEN", message: "Decision engine uses safe fallbacks when provider data is missing.", lastCheckedAt: checkedAt },
        { name: "Prediction Workflow health", status: "GREEN", message: "Prediction workflow is available with placeholder notifications.", lastCheckedAt: checkedAt },
        { name: "Investor Engine health", status: "GREEN", message: "Investor distributions use placeholder calculation pending payment APIs.", lastCheckedAt: checkedAt },
        { name: "Notification health", status: "GREEN", message: "In-app notifications are stored internally.", lastCheckedAt: checkedAt },
        { name: "Provider placeholder health", status: "AMBER", message: "External notification and export providers are not connected yet.", lastCheckedAt: checkedAt },
        { name: "External delivery providers", status: this.notificationProvidersConfigured() ? "GREEN" : "AMBER", message: this.notificationProvidersConfigured() ? "External notification providers are configured." : "One or more external notification providers are not configured.", lastCheckedAt: checkedAt },
      ],
      errorCounts: { lastHour: 0, lastDay: 0 },
      failedJobs: 0,
      slowEndpoints: [],
      dataFreshness: [
        { source: "Football data", lastUpdatedAt: null, status: "AMBER" },
        { source: "Reports", lastUpdatedAt: checkedAt, status: "GREEN" },
        { source: "Notifications", lastUpdatedAt: checkedAt, status: "GREEN" },
      ],
      lastSuccessfulDeployment: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      lastHealthCheck: checkedAt,
      activeIncidents: activeIncidents.length,
      providerPlaceholders: operationsProviderCatalog().map((provider) => provider.status().name),
    };
  }

  listIncidents() {
    return this.repository.listIncidents();
  }

  createIncident(input: IncidentCreateInput) {
    return this.repository.createIncident(input);
  }

  updateIncident(id: string, input: IncidentUpdateInput) {
    return this.repository.updateIncident(id, input);
  }

  listNotifications(userId: string, status?: Parameters<OperationsRepository["listNotifications"]>[1]) {
    return this.repository.listNotifications(userId, status);
  }

  async ensureWelcomeNotification(userId: string, role: UserRole) {
    const existing = await this.repository.listNotifications(userId);
    if (existing.length) return existing;
    await this.repository.createNotification({
      userId,
      category: "GENERAL_ANNOUNCEMENT",
      title: "FPF Notification Center ready",
      message: `Your ${role.toLowerCase()} notification center is active. External delivery channels remain placeholders.`,
      metadata: { source: "operations" },
    });
    return this.repository.listNotifications(userId);
  }

  markNotificationRead(id: string, userId: string) {
    return this.repository.markNotificationRead(id, userId);
  }

  getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    return this.repository.getNotificationPreferences(userId);
  }

  updateNotificationPreferences(userId: string, input: NotificationPreferenceInput) {
    return this.repository.updateNotificationPreferences(userId, input);
  }

  notificationDeliveryStatus() {
    return this.notificationDeliveryService?.status() ?? {
      email: { channel: "EMAIL", provider: "NONE", configured: false, missingVariables: ["EMAIL_API_KEY"] },
      sms: { channel: "SMS", provider: "NONE", configured: false, missingVariables: ["TWILIO_ACCOUNT_SID"] },
      push: { channel: "PUSH", provider: "NONE", configured: false, missingVariables: ["PUSH_API_URL"] },
    };
  }

  sendNotificationTest(channel: DeliveryChannel, input: DeliveryRequest) {
    if (!this.notificationDeliveryService) {
      return Promise.resolve({
        channel,
        configured: false,
        delivered: false,
        provider: "NONE",
        status: "SKIPPED" as const,
        message: "Notification delivery service is not configured.",
        providerMessageId: null,
        attempts: 0,
      });
    }
    return this.notificationDeliveryService.send(channel, input);
  }

  listAnnouncements(): Promise<AdminAnnouncement[]> {
    return this.repository.listAnnouncements();
  }

  createAnnouncement(input: AnnouncementCreateInput) {
    return this.repository.createAnnouncement(input);
  }

  updateAnnouncement(id: string, input: AnnouncementUpdateInput) {
    return this.repository.updateAnnouncement(id, input);
  }

  private notificationProvidersConfigured() {
    const status = this.notificationDeliveryStatus();
    return status.email.configured && status.sms.configured && status.push.configured;
  }
}
