import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import { AuthError } from "../auth/authService.js";
import {
  COMPANY_CAPITAL_ACCESS_ROLES,
  type ApproveAllocationInput,
  type CreateCapitalAllocationInput,
  type PlaceStakeInput,
  type RecordSettlementInput,
} from "./types.js";
import { CompanyCapitalError, CompanyCapitalService } from "./companyCapitalService.js";

const allocationSchema = z.object({
  portfolioId: z.string().optional(),
  candidateId: z.string().optional().nullable(),
  fixtureId: z.string().optional().nullable(),
  matchLabel: z.string().min(1),
  market: z.string().min(1),
  selection: z.string().min(1),
  recommendedStakeCents: z.number().int().min(1),
  maxStakeCents: z.number().int().min(1),
  odds: z.number().gt(1),
  riskGrade: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  analystApprovalStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  intelligenceStatus: z.string().optional(),
  rationale: z.string().optional().nullable(),
});

const candidateSchema = z.object({
  candidateId: z.string().min(1),
});

const approvalSchema = z.object({
  approvedStakeCents: z.number().int().min(1),
  notes: z.string().optional().nullable(),
});

const rejectSchema = z.object({
  notes: z.string().optional().nullable(),
});

const stakeSchema = z.object({
  stakeCents: z.number().int().min(1),
  odds: z.number().gt(1),
  bookmaker: z.string().min(1),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const settlementSchema = z.object({
  stakeId: z.string().optional().nullable(),
  outcome: z.enum(["WIN", "LOSS", "VOID", "CANCELLED", "HALF_WIN", "HALF_LOSS"]),
  grossReturnCents: z.number().int().min(0).optional(),
  notes: z.string().optional().nullable(),
});

const reportSchema = z.object({
  periodType: z.enum(["WEEKLY", "MONTHLY", "SEASON"]),
  periodLabel: z.string().min(1),
});

function sendCapitalError(error: unknown, response: { status: (status: number) => { json: (body: object) => void } }, next: (error: unknown) => void) {
  if (error instanceof CompanyCapitalError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }
  if (error instanceof AuthError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }
  next(error);
}

export function createCompanyCapitalRouter({
  authService,
  companyCapitalService,
}: {
  authService: AuthService;
  companyCapitalService: CompanyCapitalService;
}) {
  const router = Router();
  const internalOnly = [requireAuth(authService), requireRole(COMPANY_CAPITAL_ACCESS_ROLES)];

  router.get("/internal/company-capital", ...internalOnly, async (request, response, next) => {
    try {
      response.status(200).json(await companyCapitalService.dashboard(request.user!.id));
    } catch (error) {
      sendCapitalError(error, response, next);
    }
  });

  router.get("/internal/company-capital/candidates", ...internalOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ candidates: await companyCapitalService.candidateQueue() });
    } catch (error) {
      sendCapitalError(error, response, next);
    }
  });

  router.post("/internal/company-capital/allocations", ...internalOnly, async (request, response, next) => {
    try {
      const body = allocationSchema.parse(request.body) as CreateCapitalAllocationInput;
      response.status(201).json({ allocation: await companyCapitalService.createAllocation(request.user!.id, body) });
    } catch (error) {
      sendCapitalError(error, response, next);
    }
  });

  router.post("/internal/company-capital/allocations/from-candidate", ...internalOnly, async (request, response, next) => {
    try {
      const body = candidateSchema.parse(request.body);
      response.status(201).json({ allocation: await companyCapitalService.createAllocationFromCandidate(request.user!.id, body.candidateId) });
    } catch (error) {
      sendCapitalError(error, response, next);
    }
  });

  router.post("/internal/company-capital/allocations/:id/approve", ...internalOnly, async (request, response, next) => {
    try {
      const body = approvalSchema.parse(request.body) as ApproveAllocationInput;
      response.status(200).json({ allocation: await companyCapitalService.approveAllocation(request.user!.id, request.params.id, body) });
    } catch (error) {
      sendCapitalError(error, response, next);
    }
  });

  router.post("/internal/company-capital/allocations/:id/reject", ...internalOnly, async (request, response, next) => {
    try {
      const body = rejectSchema.parse(request.body);
      response.status(200).json({ allocation: await companyCapitalService.rejectAllocation(request.user!.id, request.params.id, body.notes) });
    } catch (error) {
      sendCapitalError(error, response, next);
    }
  });

  router.post("/internal/company-capital/allocations/:id/stakes", ...internalOnly, async (request, response, next) => {
    try {
      const body = stakeSchema.parse(request.body) as PlaceStakeInput;
      response.status(201).json({ stake: await companyCapitalService.placeStake(request.user!.id, request.params.id, body) });
    } catch (error) {
      sendCapitalError(error, response, next);
    }
  });

  router.post("/internal/company-capital/allocations/:id/settlements", ...internalOnly, async (request, response, next) => {
    try {
      const body = settlementSchema.parse(request.body) as RecordSettlementInput;
      response.status(201).json({ settlement: await companyCapitalService.recordSettlement(request.user!.id, request.params.id, body) });
    } catch (error) {
      sendCapitalError(error, response, next);
    }
  });

  router.post("/internal/company-capital/reports", ...internalOnly, async (request, response, next) => {
    try {
      const body = reportSchema.parse(request.body);
      response.status(201).json({ report: await companyCapitalService.generateReport(request.user!.id, body.periodType, body.periodLabel) });
    } catch (error) {
      sendCapitalError(error, response, next);
    }
  });

  return router;
}
