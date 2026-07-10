import type {
  AdminAnnouncement,
  IncidentNote,
  IncidentSeverity,
  IncidentStatus,
  NotificationPreferences,
  NotificationStatus,
  OperationalNotification,
  OperationalReport,
  OperationalReportType,
  SystemIncident,
  UserRole,
} from "@fpf/shared";

export type ReportFilters = {
  dateFrom?: string;
  dateTo?: string;
  userRole?: UserRole;
  league?: string;
  predictionMarket?: string;
  investorId?: string;
  subscriptionPlan?: string;
  status?: string;
  currency?: string;
  country?: string;
  reportType?: OperationalReportType;
};

export type ReportCreateInput = {
  title: string;
  type: OperationalReportType;
  ownerUserId: string | null;
  ownerRole: UserRole | "ALL" | null;
  filters: ReportFilters;
  summary: string;
  data: Record<string, unknown>;
};

export type IncidentCreateInput = {
  title: string;
  severity: IncidentSeverity;
  affectedModules: string[];
  createdByUserId: string;
};

export type IncidentUpdateInput = {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  assignedToUserId?: string | null;
  rootCause?: string | null;
  resolution?: string | null;
  affectedModules?: string[];
  archived?: boolean;
  note?: string;
  actorUserId: string;
};

export type NotificationCreateInput = {
  userId: string;
  category: OperationalNotification["category"];
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export type NotificationPreferenceInput = Omit<NotificationPreferences, "userId" | "securityEnabled" | "updatedAt">;

export type AnnouncementCreateInput = {
  title: string;
  message: string;
  status: AdminAnnouncement["status"];
  targetRoles: AdminAnnouncement["targetRoles"];
  targetCountries: string[];
  targetLanguages: string[];
  targetSubscriptionPlans: string[];
  scheduledAt: string | null;
  expiresAt: string | null;
  createdByUserId: string;
};

export type AnnouncementUpdateInput = Partial<Omit<AnnouncementCreateInput, "createdByUserId">>;

export interface OperationsRepository {
  listReports(user: { id: string; role: UserRole }, filters: ReportFilters): Promise<OperationalReport[]>;
  getReport(id: string, user: { id: string; role: UserRole }): Promise<OperationalReport | null>;
  createReport(input: ReportCreateInput): Promise<OperationalReport>;
  listIncidents(): Promise<SystemIncident[]>;
  createIncident(input: IncidentCreateInput): Promise<SystemIncident>;
  updateIncident(id: string, input: IncidentUpdateInput): Promise<SystemIncident>;
  addIncidentNote(incidentId: string, authorUserId: string, note: string): Promise<IncidentNote>;
  listNotifications(userId: string, status?: NotificationStatus): Promise<OperationalNotification[]>;
  createNotification(input: NotificationCreateInput): Promise<OperationalNotification>;
  markNotificationRead(id: string, userId: string): Promise<OperationalNotification | null>;
  getNotificationPreferences(userId: string): Promise<NotificationPreferences>;
  updateNotificationPreferences(userId: string, input: NotificationPreferenceInput): Promise<NotificationPreferences>;
  listAnnouncements(): Promise<AdminAnnouncement[]>;
  createAnnouncement(input: AnnouncementCreateInput): Promise<AdminAnnouncement>;
  updateAnnouncement(id: string, input: AnnouncementUpdateInput): Promise<AdminAnnouncement>;
}
