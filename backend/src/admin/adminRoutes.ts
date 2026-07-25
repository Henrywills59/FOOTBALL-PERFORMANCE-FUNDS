import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { FootballJobScheduler } from "../football/footballJobs.js";
import type { FootballRepository } from "../football/types.js";
import type { AdminService } from "./adminService.js";

const USER_ROLES = [
  "SUBSCRIBER",
  "INVESTOR",
  "ANALYST",
  "ADMIN",
  "CEO",
  "FINANCE",
  "RISK_MANAGER",
  "CAPITAL_MANAGER",
  "SUPER_ADMINISTRATOR",
  "COUNTRY_PARTNER",
] as const;

const roleSchema = z.object({ role: z.enum(USER_ROLES) });
const settingsSchema = z.object({
  predictionConfidenceThreshold: z.number().min(0).max(100).optional(),
  riskThreshold: z.number().min(0).max(100).optional(),
  maximumSelections: z.number().min(1).max(10).optional(),
  scheduledSyncEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  enabledLanguages: z.array(z.string()).optional(),
  enabledCurrencies: z.array(z.string()).optional(),
  defaultLanguage: z.string().optional(),
  defaultCurrency: z.string().optional(),
});

export function createAdminRouter(input: {
  adminService: AdminService;
  authService: AuthService;
  footballRepository: FootballRepository;
  footballScheduler: FootballJobScheduler;
}) {
  const router = Router();
  const adminOnly = [requireAuth(input.authService), requireRole(["ADMIN"])];

  router.get("/admin/overview", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json(await input.adminService.overview());
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/users", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ users: await input.adminService.searchUsers(request.query.search ? String(request.query.search) : undefined) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/users/:id/suspend", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ user: await input.adminService.suspendUser(request.user!.id, request.params.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/users/:id/activate", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ user: await input.adminService.activateUser(request.user!.id, request.params.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/users/:id/role", ...adminOnly, async (request, response, next) => {
    try {
      const inputBody = roleSchema.parse(request.body);
      response.status(200).json({ user: await input.adminService.assignRole(request.user!.id, request.params.id, inputBody.role) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/users/:id/reset-password", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.adminService.resetPassword(request.user!.id, request.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/audit-logs", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ logs: await input.adminService.auditLogs() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/login-history", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ logs: await input.adminService.loginHistory() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/settings", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json(await input.adminService.settings());
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/reports", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json(await input.adminService.reports());
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/monitoring", ...adminOnly, async (_request, response, next) => {
    try {
      const syncStatus = await input.footballRepository.getSyncStatus(true, input.footballScheduler.isStarted());
      response.status(200).json({
        api: "OK",
        database: "OK",
        footballJobs: input.footballScheduler.isStarted() ? "RUNNING" : "STOPPED",
        lastSyncAt: syncStatus.lastRunAt,
        version: process.env.npm_package_version ?? "0.1.0",
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/settings", ...adminOnly, async (request, response, next) => {
    try {
      const settings = settingsSchema.parse(request.body);
      response.status(200).json(await input.adminService.updateSettings(request.user!.id, settings));
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/fixtures/sync-logs", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ logs: await input.adminService.syncLogs() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/fixtures/api-status", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json(await input.footballRepository.getSyncStatus(true, input.footballScheduler.isStarted()));
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/fixtures/sync", ...adminOnly, async (request, response, next) => {
    try {
      await input.footballScheduler.runOnce();
      await input.adminService.audit(request.user!.id, "FOOTBALL_SYNC_FORCED", "FOOTBALL_SYNC");
      response.status(202).json({ message: "Football sync completed." });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
