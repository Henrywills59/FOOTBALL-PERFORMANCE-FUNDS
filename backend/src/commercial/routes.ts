import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { CommercialService } from "./service.js";

const commercialSettingsSchema = z.object({
  minimumInvestmentCents: z.number().int().min(10000).optional(),
  enabledLockPeriods: z.array(z.enum(["SIX_MONTHS", "TWELVE_MONTHS"])).optional(),
  defaultSimulationWeeklyReturnPercent: z.number().min(0).max(25).optional(),
  defaultPlatformFeePercent: z.number().min(0).max(50).optional(),
});

export function createCommercialRouter(input: {
  authService: AuthService;
  commercialService: CommercialService;
}) {
  const router = Router();
  const adminOnly = [requireAuth(input.authService), requireRole(["ADMIN"])];

  router.get("/commercial/structure", async (_request, response, next) => {
    try {
      response.status(200).json(await input.commercialService.structure());
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/commercial/settings", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.commercialService.updateSettings(
        request.user!.id,
        commercialSettingsSchema.parse(request.body),
      ));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
