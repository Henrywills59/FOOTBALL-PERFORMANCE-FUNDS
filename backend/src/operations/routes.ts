import { Router } from "express";
import { z } from "zod";
import { USER_ROLES } from "@fpf/shared";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { AdminService } from "../admin/adminService.js";
import type { OperationsService } from "./service.js";
import type { AnnouncementCreateInput, IncidentCreateInput } from "./types.js";

const reportTypeSchema = z.enum([
  "SUBSCRIBER",
  "INVESTOR",
  "PREDICTION_PERFORMANCE",
  "ANALYST_PERFORMANCE",
  "CAMPAIGN",
  "PLATFORM_ACTIVITY",
  "FINANCIAL_SUMMARY",
  "DISTRIBUTION",
  "USER_GROWTH",
  "SYSTEM_HEALTH",
]);

const reportGenerateSchema = z.object({
  type: reportTypeSchema,
  filters: z.record(z.unknown()).default({}),
});

const incidentCreateSchema = z.object({
  title: z.string().min(3).max(200),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  affectedModules: z.array(z.string().min(1)).default([]),
});

const incidentUpdateSchema = z.object({
  status: z.enum(["OPEN", "INVESTIGATING", "IDENTIFIED", "MONITORING", "RESOLVED", "CLOSED"]).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assignedToUserId: z.string().nullable().optional(),
  rootCause: z.string().max(2000).nullable().optional(),
  resolution: z.string().max(2000).nullable().optional(),
  affectedModules: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
  note: z.string().max(2000).optional(),
});

const preferencesSchema = z.object({
  inAppEnabled: z.boolean().default(true),
  emailPlaceholderEnabled: z.boolean().default(false),
  smsPlaceholderEnabled: z.boolean().default(false),
  whatsappPlaceholderEnabled: z.boolean().default(false),
  pushPlaceholderEnabled: z.boolean().default(false),
  marketingEnabled: z.boolean().default(true),
  financialEnabled: z.boolean().default(true),
  predictionEnabled: z.boolean().default(true),
});

const targetRoleSchema = z.enum([...USER_ROLES, "ALL", "EXECUTIVE", "MEDIA_TEAM"] as [string, ...string[]]);
const announcementSchema = z.object({
  title: z.string().min(3).max(200),
  message: z.string().min(3).max(4000),
  status: z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "EXPIRED", "ARCHIVED"]).default("DRAFT"),
  targetRoles: z.array(targetRoleSchema).default(["ALL"]),
  targetCountries: z.array(z.string()).default([]),
  targetLanguages: z.array(z.string()).default([]),
  targetSubscriptionPlans: z.array(z.string()).default([]),
  scheduledAt: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
});

export function createOperationsRouter(input: {
  authService: AuthService;
  operationsService: OperationsService;
  adminService: AdminService;
}) {
  const router = Router();
  const signedIn = requireAuth(input.authService);
  const adminOnly = [signedIn, requireRole(["ADMIN"])];

  router.get("/reports", signedIn, async (request, response, next) => {
    try {
      response.status(200).json({
        reports: await input.operationsService.listReports(request.user!, {
          reportType: request.query.reportType ? reportTypeSchema.parse(request.query.reportType) : undefined,
          userRole: request.query.userRole ? z.enum(USER_ROLES).parse(request.query.userRole) : undefined,
          dateFrom: request.query.dateFrom ? String(request.query.dateFrom) : undefined,
          dateTo: request.query.dateTo ? String(request.query.dateTo) : undefined,
          league: request.query.league ? String(request.query.league) : undefined,
          predictionMarket: request.query.predictionMarket ? String(request.query.predictionMarket) : undefined,
          investorId: request.query.investor ? String(request.query.investor) : undefined,
          subscriptionPlan: request.query.subscriptionPlan ? String(request.query.subscriptionPlan) : undefined,
          status: request.query.status ? String(request.query.status) : undefined,
          currency: request.query.currency ? String(request.query.currency) : undefined,
          country: request.query.country ? String(request.query.country) : undefined,
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/reports/:id", signedIn, async (request, response, next) => {
    try {
      const report = await input.operationsService.getReport(request.params.id, request.user!);
      if (!report) {
        response.status(404).json({ error: "Report not found" });
        return;
      }
      response.status(200).json({ report });
    } catch (error) {
      next(error);
    }
  });

  router.post("/reports/generate", signedIn, async (request, response, next) => {
    try {
      const body = reportGenerateSchema.parse(request.body);
      const report = await input.operationsService.generateReport(request.user!, { type: body.type, filters: body.filters });
      await input.adminService.audit(request.user!.id, "REPORT_GENERATED", "REPORT", report.id);
      response.status(201).json({ report });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/monitoring/overview", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json(await input.operationsService.monitoringOverview());
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/monitoring/incidents", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ incidents: await input.operationsService.listIncidents() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/monitoring/incidents", ...adminOnly, async (request, response, next) => {
    try {
      const body = incidentCreateSchema.parse(request.body);
      const incidentInput: IncidentCreateInput = {
        title: body.title,
        severity: body.severity,
        affectedModules: body.affectedModules,
        createdByUserId: request.user!.id,
      };
      const incident = await input.operationsService.createIncident(incidentInput);
      await input.adminService.audit(request.user!.id, "INCIDENT_CREATED", "INCIDENT", incident.id);
      response.status(201).json({ incident });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/monitoring/incidents/:id", ...adminOnly, async (request, response, next) => {
    try {
      const body = incidentUpdateSchema.parse(request.body);
      const incident = await input.operationsService.updateIncident(request.params.id, { ...body, actorUserId: request.user!.id });
      await input.adminService.audit(request.user!.id, "INCIDENT_UPDATED", "INCIDENT", incident.id);
      response.status(200).json({ incident });
    } catch (error) {
      next(error);
    }
  });

  router.get("/notifications", signedIn, async (request, response, next) => {
    try {
      const notifications = await input.operationsService.ensureWelcomeNotification(request.user!.id, request.user!.role);
      response.status(200).json({ notifications });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/notifications/:id/read", signedIn, async (request, response, next) => {
    try {
      const notification = await input.operationsService.markNotificationRead(request.params.id, request.user!.id);
      if (!notification) {
        response.status(404).json({ error: "Notification not found" });
        return;
      }
      response.status(200).json({ notification });
    } catch (error) {
      next(error);
    }
  });

  router.get("/notifications/preferences", signedIn, async (request, response, next) => {
    try {
      response.status(200).json(await input.operationsService.getNotificationPreferences(request.user!.id));
    } catch (error) {
      next(error);
    }
  });

  router.put("/notifications/preferences", signedIn, async (request, response, next) => {
    try {
      const body = preferencesSchema.parse(request.body);
      response.status(200).json(await input.operationsService.updateNotificationPreferences(request.user!.id, {
        inAppEnabled: body.inAppEnabled,
        emailPlaceholderEnabled: body.emailPlaceholderEnabled,
        smsPlaceholderEnabled: body.smsPlaceholderEnabled,
        whatsappPlaceholderEnabled: body.whatsappPlaceholderEnabled,
        pushPlaceholderEnabled: body.pushPlaceholderEnabled,
        marketingEnabled: body.marketingEnabled,
        financialEnabled: body.financialEnabled,
        predictionEnabled: body.predictionEnabled,
      }));
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/announcements", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ announcements: await input.operationsService.listAnnouncements() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/announcements", ...adminOnly, async (request, response, next) => {
    try {
      const body = announcementSchema.parse(request.body);
      const announcementInput: AnnouncementCreateInput = {
        title: body.title,
        message: body.message,
        status: body.status,
        targetRoles: body.targetRoles as AnnouncementCreateInput["targetRoles"],
        targetCountries: body.targetCountries,
        targetLanguages: body.targetLanguages,
        targetSubscriptionPlans: body.targetSubscriptionPlans,
        scheduledAt: body.scheduledAt,
        expiresAt: body.expiresAt,
        createdByUserId: request.user!.id,
      };
      const announcement = await input.operationsService.createAnnouncement(announcementInput);
      await input.adminService.audit(request.user!.id, "ANNOUNCEMENT_CREATED", "ANNOUNCEMENT", announcement.id);
      response.status(201).json({ announcement });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/announcements/:id", ...adminOnly, async (request, response, next) => {
    try {
      const body = announcementSchema.partial().parse(request.body);
      const announcement = await input.operationsService.updateAnnouncement(request.params.id, {
        ...body,
        targetRoles: body.targetRoles as AnnouncementCreateInput["targetRoles"] | undefined,
      });
      await input.adminService.audit(request.user!.id, "ANNOUNCEMENT_UPDATED", "ANNOUNCEMENT", announcement.id);
      response.status(200).json({ announcement });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
