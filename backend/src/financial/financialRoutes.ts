import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import { AuthError } from "../auth/authService.js";
import { FinancialEngineError, FinancialEngineService } from "./financialEngineService.js";
import type { EligibleProfitInput } from "./types.js";

const analystContributionSchema = z.object({
  analystId: z.string().min(1),
  analystName: z.string().optional(),
  contributionScore: z.number().min(0),
});

const weeklyDistributionSchema = z.object({
  weekLabel: z.string().min(1),
  seasonId: z.string().optional().nullable(),
  grossReturnsCents: z.number().int().min(0),
  returnedStakeCents: z.number().int().min(0).optional(),
  totalStakeCents: z.number().int().min(0).optional(),
  totalLossesCents: z.number().int().min(0).optional(),
  operatingAdjustmentsCents: z.number().int().min(0).optional(),
  analystContributions: z.array(analystContributionSchema).optional(),
});

function sendFinancialError(error: unknown, response: { status: (status: number) => { json: (body: object) => void } }, next: (error: unknown) => void) {
  if (error instanceof FinancialEngineError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }
  if (error instanceof AuthError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }
  next(error);
}

export function createFinancialRouter({
  authService,
  financialEngineService,
}: {
  authService: AuthService;
  financialEngineService: FinancialEngineService;
}) {
  const router = Router();
  const adminOnly = [requireAuth(authService), requireRole(["ADMIN"])];

  router.get("/admin/financial-engine", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json(await financialEngineService.overview());
    } catch (error) {
      sendFinancialError(error, response, next);
    }
  });

  router.post("/admin/financial-engine/weekly-distributions/calculate", ...adminOnly, async (request, response, next) => {
    try {
      const body = weeklyDistributionSchema.parse(request.body) as EligibleProfitInput;
      const run = await financialEngineService.calculateWeeklyDistribution(request.user!.id, body);
      response.status(201).json({ run });
    } catch (error) {
      sendFinancialError(error, response, next);
    }
  });

  router.get("/admin/financial-engine/reports", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ reports: await financialEngineService.reports() });
    } catch (error) {
      sendFinancialError(error, response, next);
    }
  });

  router.get("/admin/financial-engine/audit-records", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ records: await financialEngineService.auditRecords() });
    } catch (error) {
      sendFinancialError(error, response, next);
    }
  });

  return router;
}
