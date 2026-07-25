import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import { IntelligenceWorkflowError, IntelligenceWorkflowService } from "./intelligenceWorkflowService.js";

const statusSchema = z.enum([
  "SCANNED",
  "QUALIFIED",
  "REQUIRES_REVIEW",
  "APPROVED_SUBSCRIBER",
  "APPROVED_COMPANY",
  "APPROVED_BOTH",
  "REJECTED",
  "PUBLISHED",
  "WITHDRAWN",
  "EXPIRED",
]);

const reviewDecisionSchema = z.enum([
  "APPROVE_SUBSCRIBER",
  "APPROVE_COMPANY",
  "APPROVE_BOTH",
  "REJECT",
  "REQUEST_MORE_ANALYSIS",
  "WITHDRAW",
]);

const publicationStatusSchema = z.enum(["DRAFT", "SCHEDULED", "PUBLISHED", "WITHDRAWN", "EXPIRED"]);
const companyBetStatusSchema = z.enum(["PENDING_APPROVAL", "APPROVED", "READY_TO_PLACE", "PLACED", "CANCELLED", "EXPIRED", "SETTLED"]);
const ledgerResultSchema = z.enum(["PENDING", "WON", "LOST", "VOID", "PARTIAL_WIN", "PARTIAL_LOSS", "CANCELLED"]);

const limitSchema = z.coerce.number().int().min(1).max(100).optional();

const reviewSchema = z.object({
  decision: reviewDecisionSchema,
  notes: z.string().max(3000).optional(),
});

const publicationCreateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().min(1).max(2000).optional(),
  visibleFrom: z.string().datetime().nullable().optional(),
});

const publicationUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().min(1).max(2000).optional(),
  status: publicationStatusSchema.optional(),
  visibleFrom: z.string().datetime().nullable().optional(),
});

const companyBetCreateSchema = z.object({
  market: z.string().min(1).max(160).optional(),
  selection: z.string().min(1).max(160).optional(),
  requestedStakeCents: z.number().int().positive(),
  currency: z.string().min(3).max(8).optional(),
  targetOdds: z.number().positive().nullable().optional(),
  bookmaker: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const companyBetUpdateSchema = z.object({
  requestedStakeCents: z.number().int().positive().optional(),
  approvedStakeCents: z.number().int().positive().optional(),
  currency: z.string().min(3).max(8).optional(),
  targetOdds: z.number().positive().nullable().optional(),
  finalOdds: z.number().positive().nullable().optional(),
  bookmaker: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  riskGrade: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
});

const ledgerCreateSchema = z.object({
  odds: z.number().positive().nullable().optional(),
  stakeCents: z.number().int().positive().nullable().optional(),
  bookmaker: z.string().max(120).nullable().optional(),
  externalBetReference: z.string().max(180).nullable().optional(),
});

const ledgerSettleSchema = z.object({
  result: ledgerResultSchema,
  settledReturnCents: z.number().int().min(0).nullable().optional(),
  reconciliationStatus: z.string().min(1).max(80).optional(),
});

function queryString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function handleRouteError(error: unknown, response: import("express").Response, next: import("express").NextFunction) {
  if (error instanceof z.ZodError) {
    response.status(400).json({ error: "Invalid request", issues: error.issues.map((issue) => issue.message) });
    return;
  }
  if (error instanceof IntelligenceWorkflowError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }
  next(error);
}

export function createIntelligenceWorkflowRouter(input: {
  authService: AuthService;
  intelligenceWorkflowService: IntelligenceWorkflowService;
}) {
  const router = Router();
  const signedIn = requireAuth(input.authService);
  const operationsAccess = [signedIn, requireRole(["ADMIN", "ANALYST"])];
  const adminOnly = [signedIn, requireRole(["ADMIN"])];
  const subscriberAccess = [signedIn, requireRole(["SUBSCRIBER", "ADMIN"])];

  router.get("/admin/intelligence/executive-summary", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ summary: await input.intelligenceWorkflowService.executiveSummary() });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.get("/admin/intelligence/review-queue", ...operationsAccess, async (request, response, next) => {
    try {
      response.status(200).json({ items: await input.intelligenceWorkflowService.listReviewQueue(limitSchema.parse(request.query.limit)) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.get("/admin/intelligence", ...operationsAccess, async (request, response, next) => {
    try {
      response.status(200).json({
        items: await input.intelligenceWorkflowService.listIntelligence({
          status: queryString(request.query.status) ? statusSchema.parse(request.query.status) : undefined,
          limit: limitSchema.parse(request.query.limit),
        }),
      });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.get("/admin/intelligence/:id/history", ...operationsAccess, async (request, response, next) => {
    try {
      response.status(200).json({ history: await input.intelligenceWorkflowService.history(request.params.id) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.get("/admin/intelligence/:id", ...operationsAccess, async (request, response, next) => {
    try {
      response.status(200).json({ item: await input.intelligenceWorkflowService.getIntelligence(request.params.id) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.post("/admin/intelligence/:id/review", ...operationsAccess, async (request, response, next) => {
    try {
      const body = reviewSchema.parse(request.body);
      response.status(200).json({
        item: await input.intelligenceWorkflowService.reviewIntelligence(request.params.id, {
          reviewerUserId: request.user!.id,
          decision: body.decision,
          notes: body.notes,
        }),
      });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.get("/admin/subscriber-publications", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({
        publications: await input.intelligenceWorkflowService.listSubscriberPublications(
          queryString(request.query.status) ? publicationStatusSchema.parse(request.query.status) : undefined,
        ),
      });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.post("/admin/intelligence/:id/subscriber-publication", ...adminOnly, async (request, response, next) => {
    try {
      const body = publicationCreateSchema.parse(request.body);
      response.status(201).json({
        publication: await input.intelligenceWorkflowService.createSubscriberPublication(request.params.id, {
          actorUserId: request.user!.id,
          ...body,
        }),
      });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.patch("/admin/subscriber-publications/:id", ...adminOnly, async (request, response, next) => {
    try {
      const body = publicationUpdateSchema.parse(request.body);
      const publication = await input.intelligenceWorkflowService.updateSubscriberPublication(request.params.id, {
        actorUserId: request.user!.id,
        ...body,
      });
      if (!publication) {
        response.status(404).json({ error: "Subscriber publication not found." });
        return;
      }
      response.status(200).json({ publication });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.post("/admin/subscriber-publications/:id/publish", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ publication: await input.intelligenceWorkflowService.publishSubscriberPublication(request.params.id, request.user!.id) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.post("/admin/subscriber-publications/:id/withdraw", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ publication: await input.intelligenceWorkflowService.withdrawSubscriberPublication(request.params.id, request.user!.id) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.get("/subscriber/intelligence", ...subscriberAccess, async (_request, response, next) => {
    try {
      response.status(200).json({ intelligence: await input.intelligenceWorkflowService.publishedSubscriberIntelligence() });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.get("/subscriber/intelligence/:id", ...subscriberAccess, async (request, response, next) => {
    try {
      response.status(200).json({ intelligence: await input.intelligenceWorkflowService.publishedSubscriberIntelligenceDetail(request.params.id) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.get("/admin/company-bets", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({
        companyBets: await input.intelligenceWorkflowService.listCompanyBets({
          status: queryString(request.query.status) ? companyBetStatusSchema.parse(request.query.status) : undefined,
          limit: limitSchema.parse(request.query.limit),
        }),
      });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.get("/admin/company-bets/:id", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ companyBet: await input.intelligenceWorkflowService.getCompanyBet(request.params.id) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.post("/admin/intelligence/:id/company-bet", ...adminOnly, async (request, response, next) => {
    try {
      const body = companyBetCreateSchema.parse(request.body);
      response.status(201).json({
        companyBet: await input.intelligenceWorkflowService.createCompanyBet(request.params.id, {
          actorUserId: request.user!.id,
          market: body.market,
          selection: body.selection,
          requestedStakeCents: body.requestedStakeCents,
          currency: body.currency,
          targetOdds: body.targetOdds,
          bookmaker: body.bookmaker,
          notes: body.notes,
        }),
      });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.patch("/admin/company-bets/:id", ...adminOnly, async (request, response, next) => {
    try {
      const body = companyBetUpdateSchema.parse(request.body);
      const companyBet = await input.intelligenceWorkflowService.updateCompanyBet(request.params.id, { actorUserId: request.user!.id, ...body });
      if (!companyBet) {
        response.status(404).json({ error: "Company bet not found." });
        return;
      }
      response.status(200).json({ companyBet });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.post("/admin/company-bets/:id/approve", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ companyBet: await input.intelligenceWorkflowService.approveCompanyBet(request.params.id, request.user!.id) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.post("/admin/company-bets/:id/mark-placed", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ companyBet: await input.intelligenceWorkflowService.markCompanyBetPlaced(request.params.id, request.user!.id) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.post("/admin/company-bets/:id/cancel", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ companyBet: await input.intelligenceWorkflowService.cancelCompanyBet(request.params.id, request.user!.id) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.get("/admin/betting-ledger", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({
        ledger: await input.intelligenceWorkflowService.listBettingLedger({
          result: queryString(request.query.result) ? ledgerResultSchema.parse(request.query.result) : undefined,
          limit: limitSchema.parse(request.query.limit),
        }),
      });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.get("/admin/betting-ledger/:id", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ ledger: await input.intelligenceWorkflowService.getBettingLedger(request.params.id) });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.post("/admin/company-bets/:id/ledger", ...adminOnly, async (request, response, next) => {
    try {
      const body = ledgerCreateSchema.parse(request.body);
      response.status(201).json({
        ledger: await input.intelligenceWorkflowService.createBettingLedger(request.params.id, {
          actorUserId: request.user!.id,
          ...body,
        }),
      });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  router.post("/admin/betting-ledger/:id/settle", ...adminOnly, async (request, response, next) => {
    try {
      const body = ledgerSettleSchema.parse(request.body);
      response.status(200).json({
        ledger: await input.intelligenceWorkflowService.settleBettingLedger(request.params.id, {
          actorUserId: request.user!.id,
          result: body.result,
          settledReturnCents: body.settledReturnCents,
          reconciliationStatus: body.reconciliationStatus,
        }),
      });
    } catch (error) {
      handleRouteError(error, response, next);
    }
  });

  return router;
}
