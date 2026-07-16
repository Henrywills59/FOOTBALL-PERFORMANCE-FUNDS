import { Router } from "express";
import { z } from "zod";
import type { ParticipationSimulatorInput } from "@fpf/shared";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { SeasonService } from "./seasonService.js";

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

  router.get("/seasons/operating-model", signedIn, (_request, response) => {
    response.status(200).json(input.seasonService.operatingModel());
  });

  router.get("/seasons/current", signedIn, (_request, response) => {
    response.status(200).json({ season: input.seasonService.operatingModel().currentSeason });
  });

  router.get("/performance-partner/participation-model", ...performancePartnerOnly, (_request, response) => {
    const model = input.seasonService.operatingModel();
    response.status(200).json({
      currentSeason: model.currentSeason,
      participationPlans: model.participationPlans,
      financialConstitution: model.financialConstitution,
      notices: model.notices,
    });
  });

  router.post("/performance-partner/participation-simulator", ...performancePartnerOnly, (request, response) => {
    const body = participationSimulatorSchema.parse(request.body) as ParticipationSimulatorInput;
    response.status(200).json({
      simulation: input.seasonService.simulateParticipation(body),
    });
  });

  router.get("/admin/seasons/operating-model", ...adminOnly, (_request, response) => {
    response.status(200).json(input.seasonService.operatingModel());
  });

  return router;
}
