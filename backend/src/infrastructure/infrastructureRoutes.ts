import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { AdminService } from "../admin/adminService.js";
import {
  InfrastructureControlError,
  InfrastructureService,
} from "./infrastructureService.js";

const safeUrlSchema = z.string().url().startsWith("https://").optional();

const providerCreateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  providerName: z.string().min(2).max(120).optional(),
  category: z.string().min(2).max(80),
  servicePurpose: z.string().min(3).max(500).optional(),
  purpose: z.string().min(3).max(500).optional(),
  providerWebsite: safeUrlSchema,
  dashboardUrl: safeUrlSchema,
  billingUrl: safeUrlSchema,
  renewalUrl: safeUrlSchema,
  documentationUrl: safeUrlSchema,
  supportUrl: safeUrlSchema,
  monthlyCostCents: z.coerce.number().int().nonnegative().default(0),
  annualCostCents: z.coerce.number().int().nonnegative().default(0),
  usageBasedCostCents: z.coerce.number().int().nonnegative().default(0),
  usageLimit: z.coerce.number().int().positive().default(1),
  currentUsage: z.coerce.number().int().nonnegative().default(0),
  nextRenewalDate: z.string().nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).default([]),
});

const providerUpdateSchema = providerCreateSchema.partial().extend({
  currentPlan: z.string().max(120).optional(),
  internalOwner: z.string().max(120).optional(),
  notes: z.string().max(1000).optional(),
  active: z.boolean().optional(),
});

const procurementCreateSchema = z.object({
  businessNeed: z.string().min(3).max(500),
  requestedProvider: z.string().min(2).max(120),
  alternativeProviders: z.array(z.string().min(1).max(120)).default([]),
  recommendedPlan: z.string().min(2).max(160),
  estimatedMonthlyCostCents: z.coerce.number().int().nonnegative().default(0),
  estimatedAnnualCostCents: z.coerce.number().int().nonnegative().default(0),
  setupCostCents: z.coerce.number().int().nonnegative().default(0),
  notes: z.string().max(1000).default("Manual procurement placeholder."),
});

const procurementUpdateSchema = procurementCreateSchema.partial().extend({
  status: z
    .enum([
      "IDENTIFIED",
      "RESEARCHING",
      "TRIAL_REQUESTED",
      "TRIAL_ACTIVE",
      "APPROVAL_REQUIRED",
      "APPROVED",
      "PENDING_PURCHASE",
      "PURCHASED",
      "CONFIGURATION_PENDING",
      "CONNECTED",
      "REJECTED",
      "CANCELLED",
      "EXPIRED",
      "REPLACED",
    ])
    .optional(),
});

function handleInfrastructureError(error: unknown, response: Response, next: (error: unknown) => void) {
  if (error instanceof InfrastructureControlError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  next(error);
}

export function createInfrastructureRouter(input: {
  authService: AuthService;
  infrastructureService: InfrastructureService;
  adminService: AdminService;
}) {
  const router = Router();
  const signedIn = requireAuth(input.authService);
  const adminOnly = [signedIn, requireRole(["ADMIN"])];

  router.get("/admin/infrastructure", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json(input.infrastructureService.controlCenter());
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.get("/admin/infrastructure/overview", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ overview: input.infrastructureService.controlCenter().overview });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.get("/admin/infrastructure/providers", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ providers: input.infrastructureService.listProviders() });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

router.post("/admin/infrastructure/providers", ...adminOnly, async (request, response, next) => {
    try {
      const body = providerCreateSchema.parse(request.body);
      const provider = input.infrastructureService.createProvider({
        ...body,
        name: body.name ?? body.providerName,
        servicePurpose: body.servicePurpose ?? body.purpose,
      });
      await input.adminService.audit(request.user!.id, "INFRA_PROVIDER_CREATED", "INFRASTRUCTURE_PROVIDER", provider.id);
      response.status(201).json({ provider });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.get("/admin/infrastructure/providers/:id", ...adminOnly, async (request, response, next) => {
    try {
      const provider = input.infrastructureService.getProvider(request.params.id);
      if (!provider) {
        response.status(404).json({ error: "Provider not found" });
        return;
      }
      response.status(200).json({ provider });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.patch("/admin/infrastructure/providers/:id", ...adminOnly, async (request, response, next) => {
    try {
      const provider = input.infrastructureService.updateProvider(
        request.params.id,
        providerUpdateSchema.parse(request.body),
      );
      await input.adminService.audit(request.user!.id, "INFRA_PROVIDER_UPDATED", "INFRASTRUCTURE_PROVIDER", provider.id);
      response.status(200).json({ provider });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.post("/admin/infrastructure/providers/:id/test", ...adminOnly, async (request, response, next) => {
    try {
      const result = input.infrastructureService.testProvider(request.params.id);
      await input.adminService.audit(request.user!.id, "INFRA_PROVIDER_TESTED", "INFRASTRUCTURE_PROVIDER", result.providerId);
      response.status(200).json(result);
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.get("/admin/infrastructure/credentials", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ credentials: input.infrastructureService.controlCenter().credentialMetadata });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.get("/admin/infrastructure/renewals", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ renewals: input.infrastructureService.controlCenter().renewals });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.patch("/admin/infrastructure/renewals/:id", ...adminOnly, async (request, response, next) => {
    try {
      const renewal = input.infrastructureService.controlCenter().renewals.find((item) => item.id === request.params.id);
      if (!renewal) {
        response.status(404).json({ error: "Renewal not found" });
        return;
      }
      await input.adminService.audit(request.user!.id, "INFRA_RENEWAL_REVIEWED", "INFRASTRUCTURE_RENEWAL", renewal.id);
      response.status(200).json({ renewal, status: "REVIEWED_PLACEHOLDER" });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.get("/admin/infrastructure/costs", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ costs: input.infrastructureService.controlCenter().costs });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.get("/admin/infrastructure/usage", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ usage: input.infrastructureService.controlCenter().usage });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.get("/admin/infrastructure/comparisons", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ comparisons: input.infrastructureService.controlCenter().comparisons });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.get("/admin/infrastructure/alerts", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ alerts: input.infrastructureService.controlCenter().alerts });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.patch("/admin/infrastructure/alerts/:id", ...adminOnly, async (request, response, next) => {
    try {
      const alert = input.infrastructureService.acknowledgeAlert(request.params.id);
      await input.adminService.audit(request.user!.id, "INFRA_ALERT_ACKNOWLEDGED", "INFRASTRUCTURE_ALERT", alert.id);
      response.status(200).json({ alert });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.get("/admin/infrastructure/tasks", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ tasks: input.infrastructureService.controlCenter().tasks });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.get("/admin/infrastructure/procurement", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ procurement: input.infrastructureService.controlCenter().procurement });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.post("/admin/infrastructure/procurement", ...adminOnly, async (request, response, next) => {
    try {
      const procurement = input.infrastructureService.createProcurement({
        ...procurementCreateSchema.parse(request.body),
        requestedBy: request.user!.email,
      });
      await input.adminService.audit(request.user!.id, "INFRA_PROCUREMENT_CREATED", "INFRASTRUCTURE_PROCUREMENT", procurement.id);
      response.status(201).json({ procurement });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.patch("/admin/infrastructure/procurement/:id", ...adminOnly, async (request, response, next) => {
    try {
      const procurement = input.infrastructureService.updateProcurement(
        request.params.id,
        procurementUpdateSchema.parse(request.body),
      );
      await input.adminService.audit(request.user!.id, "INFRA_PROCUREMENT_UPDATED", "INFRASTRUCTURE_PROCUREMENT", procurement.id);
      response.status(200).json({ procurement });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  router.get("/admin/infrastructure/report", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ report: input.infrastructureService.controlCenter().procurementReport });
    } catch (error) {
      handleInfrastructureError(error, response, next);
    }
  });

  return router;
}
