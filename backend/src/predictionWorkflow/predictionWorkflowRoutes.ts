import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { PredictionWorkflowService } from "./predictionWorkflowService.js";

const actionSchema = z.object({
  action: z.enum([
    "APPROVE",
    "REJECT",
    "SAVE_DRAFT",
    "REQUEST_REVIEW",
    "FLAG_HIGH_RISK",
    "FLAG_HIGH_OPPORTUNITY",
    "MARK_FEATURED",
    "PUBLISH",
    "ARCHIVE",
    "RESTORE",
  ]),
  reason: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});

const candidateSchema = z.object({ fixtureId: z.string().min(1) });

export function createPredictionWorkflowRouter(input: {
  authService: AuthService;
  predictionWorkflowService: PredictionWorkflowService;
}) {
  const router = Router();
  const signedIn = requireAuth(input.authService);
  const analystAccess = [signedIn, requireRole(["ANALYST", "ADMIN"])];
  const adminOnly = [signedIn, requireRole(["ADMIN"])];
  const subscriberAccess = [signedIn, requireRole(["SUBSCRIBER", "ADMIN"])];

  router.get("/prediction-workflow/queue", ...analystAccess, async (request, response, next) => {
    try {
      response.status(200).json(
        await input.predictionWorkflowService.listQueue({
          status: input.predictionWorkflowService.validStatus(request.query.status ? String(request.query.status) : undefined),
          sort: request.query.sort ? String(request.query.sort) as never : undefined,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/prediction-workflow/candidates", ...analystAccess, async (request, response, next) => {
    try {
      const body = candidateSchema.parse(request.body);
      response.status(201).json({ item: await input.predictionWorkflowService.createCandidateFromDecision(body.fixtureId) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/prediction-workflow/queue/:id", ...analystAccess, async (request, response, next) => {
    try {
      const item = await input.predictionWorkflowService.getQueueItem(request.params.id);
      if (!item) {
        response.status(404).json({ error: "Prediction queue item not found" });
        return;
      }
      response.status(200).json({ item });
    } catch (error) {
      next(error);
    }
  });

  router.post("/prediction-workflow/queue/:id/actions", ...analystAccess, async (request, response, next) => {
    try {
      const body = actionSchema.parse(request.body);
      const item = await input.predictionWorkflowService.applyAction(request.params.id, request.user!.id, body.action, {
        reason: body.reason,
        notes: body.notes,
      });
      if (!item) {
        response.status(404).json({ error: "Prediction queue item not found" });
        return;
      }
      response.status(200).json({ item });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/prediction-workflow/queue/:id/override", ...adminOnly, async (request, response, next) => {
    try {
      const body = actionSchema.parse(request.body);
      const item = await input.predictionWorkflowService.applyAction(request.params.id, request.user!.id, body.action, {
        reason: body.reason ?? "Administrator override",
        notes: body.notes,
      });
      if (!item) {
        response.status(404).json({ error: "Prediction queue item not found" });
        return;
      }
      response.status(200).json({ item });
    } catch (error) {
      next(error);
    }
  });

  router.get("/predictions/published-workflow", ...subscriberAccess, async (_request, response, next) => {
    try {
      response.status(200).json({ predictions: await input.predictionWorkflowService.publishedForSubscribers() });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
