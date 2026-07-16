import { Router } from "express";
import { z } from "zod";
import type { ParticipationSimulatorInput } from "@fpf/shared";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { SeasonService } from "./seasonService.js";

const participationCreateSchema = z.object({
  participationAmountCents: z.number().int().min(10000).max(1_000_000_000),
  planCode: z.enum(["HALF_SEASON", "FULL_SEASON", "REMAINING_SEASON"]),
  seasonId: z.string().optional(),
});

const participationSimulatorSchema = z.object({
  participationAmountCents: z.number().int().min(0).max(1_000_000_000),
  planCode: z.enum(["HALF_SEASON", "FULL_SEASON", "REMAINING_SEASON"]),
  currentSeasonId: z.string().optional(),
  remainingWeeks: z.number().int().min(0).max(260).optional(),
});

export function createSeasonRouter(input: {
  authService: AuthService;
  seasonService: SeasonService;
}) {
  const router = Router();
  const signedIn = requireAuth(input.authService);
  const performancePartnerOnly = [signedIn, requireRole(["INVESTOR", "ADMIN"])];
  const adminOnly = [signedIn, requireRole(["ADMIN"])];

  router.get("/seasons/operating-model", signedIn, async (_request, response, next) => {
    try {
      response.status(200).json(await input.seasonService.operatingModel());
    } catch (error) {
      next(error);
    }
  });

  router.get("/seasons/current", signedIn, async (_request, response, next) => {
    try {
      response.status(200).json({ season: (await input.seasonService.operatingModel()).currentSeason });
    } catch (error) {
      next(error);
    }
  });

  router.get("/performance-partner/participation-model", ...performancePartnerOnly, async (_request, response, next) => {
    try {
      const model = await input.seasonService.operatingModel();
      response.status(200).json({
        currentSeason: model.currentSeason,
        participationPlans: model.participationPlans,
        financialConstitution: model.financialConstitution,
        notices: model.notices,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/performance-partner/participations", ...performancePartnerOnly, async (request, response, next) => {
    try {
      response.status(200).json({
        participations: await input.seasonService.listParticipations(request.user!.id),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/performance-partner/participations", ...performancePartnerOnly, async (request, response, next) => {
    try {
      const body = participationCreateSchema.parse(request.body);
      response.status(201).json({
        participation: await input.seasonService.createParticipation({
          userId: request.user!.id,
          seasonId: body.seasonId,
          planCode: body.planCode,
          participationAmountCents: body.participationAmountCents,
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/performance-partner/participation-simulator", ...performancePartnerOnly, async (request, response, next) => {
    try {
      const body = participationSimulatorSchema.parse(request.body) as ParticipationSimulatorInput;
      response.status(200).json({
        simulation: await input.seasonService.simulateParticipation(body),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/performance-partner/participations/:id/complete", ...adminOnly, async (request, response, next) => {
    try {
      const participation = await input.seasonService.completeParticipation(request.user!.id, request.params.id);
      if (!participation) {
        response.status(404).json({ error: "Participation agreement not found" });
        return;
      }
      response.status(200).json({ participation });
    } catch (error) {
      next(error);
    }
  });

  router.post("/performance-partner/participations/:id/renew", ...performancePartnerOnly, async (request, response, next) => {
    try {
      const renewal = await input.seasonService.openRenewal(request.user!.id, request.params.id);
      if (!renewal) {
        response.status(404).json({ error: "Participation agreement not found" });
        return;
      }
      response.status(200).json({ renewal });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/seasons/operating-model", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json(await input.seasonService.operatingModel());
    } catch (error) {
      next(error);
    }
  });

  return router;
}
