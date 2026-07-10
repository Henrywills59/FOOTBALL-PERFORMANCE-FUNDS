import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { GlobalizationService } from "./service.js";

const preferenceSchema = z.object({
  language: z.enum(["en", "fr", "es", "pt", "de", "it", "ar", "zh"]).optional(),
  currency: z.enum(["USD", "EUR", "GBP", "UGX", "KES", "TZS", "NGN", "ZAR", "CAD", "AUD"]).optional(),
  timezone: z.string().min(1).max(80).optional(),
  country: z.string().min(2).max(2).optional(),
  region: z.string().min(1).max(80).optional(),
  measurementSystem: z.enum(["metric", "imperial"]).optional(),
  dateFormat: z.string().min(1).max(40).optional(),
  numberFormat: z.string().min(1).max(40).optional(),
});

const adminGlobalSchema = z.object({
  enabledLanguages: z.array(z.string()).optional(),
  enabledCurrencies: z.array(z.string()).optional(),
  defaultLanguage: z.string().optional(),
  defaultCurrency: z.string().optional(),
});

export function createGlobalizationRouter(input: {
  authService: AuthService;
  globalizationService: GlobalizationService;
}) {
  const router = Router();
  const authenticated = [requireAuth(input.authService)];
  const adminOnly = [requireAuth(input.authService), requireRole(["ADMIN"])];

  router.get("/settings/languages", (_request, response) => {
    response.status(200).json(input.globalizationService.languages());
  });

  router.get("/settings/currencies", (_request, response) => {
    response.status(200).json(input.globalizationService.currencies());
  });

  router.get("/settings/timezones", (_request, response) => {
    response.status(200).json(input.globalizationService.timezones());
  });

  router.get("/settings/preferences", ...authenticated, async (request, response, next) => {
    try {
      response.status(200).json(await input.globalizationService.preferences(request.user!.id));
    } catch (error) {
      next(error);
    }
  });

  router.put("/settings/preferences", ...authenticated, async (request, response, next) => {
    try {
      const preferences = preferenceSchema.parse(request.body);
      response.status(200).json({ preferences: await input.globalizationService.updatePreferences(request.user!.id, preferences) });
    } catch (error) {
      next(error);
    }
  });

  const updateAdminGlobalization = async (request: Request, response: Response, next: NextFunction) => {
    try {
      response.status(200).json(await input.globalizationService.updateAdminGlobalSettings(
        request.user!.id,
        adminGlobalSchema.parse(request.body),
      ));
    } catch (error) {
      next(error);
    }
  };

  router.put("/admin/globalization", ...adminOnly, updateAdminGlobalization);
  router.post("/admin/globalization", ...adminOnly, updateAdminGlobalization);

  return router;
}
