import { Router } from "express";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { PredictionService } from "./predictionService.js";

export function createPredictionRouter(input: {
  authService: AuthService;
  predictionService: PredictionService;
}) {
  const router = Router();
  const signedIn = requireAuth(input.authService);

  router.post(
    "/predictions/fixtures/:fixtureId/generate",
    signedIn,
    requireRole(["ANALYST", "ADMIN"]),
    async (request, response, next) => {
      try {
        const prediction = await input.predictionService.generateForFixture(request.params.fixtureId);
        if (!prediction) {
          response.status(404).json({ error: "Fixture not found" });
          return;
        }
        response.status(prediction.dataQualityStatus === "READY" ? 201 : 200).json({ prediction });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/admin/predictions",
    signedIn,
    requireRole(["ADMIN"]),
    async (_request, response, next) => {
      try {
        response.status(200).json({ predictions: await input.predictionService.listAdminPredictions() });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/admin/predictions/:id/approve",
    signedIn,
    requireRole(["ADMIN"]),
    async (request, response, next) => {
      try {
        const prediction = await input.predictionService.approve(request.params.id);
        if (!prediction) {
          response.status(404).json({ error: "Prediction not found" });
          return;
        }
        response.status(200).json({ prediction });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/admin/predictions/:id/reject",
    signedIn,
    requireRole(["ADMIN"]),
    async (request, response, next) => {
      try {
        const prediction = await input.predictionService.reject(request.params.id);
        if (!prediction) {
          response.status(404).json({ error: "Prediction not found" });
          return;
        }
        response.status(200).json({ prediction });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/predictions/approved", signedIn, async (_request, response, next) => {
    try {
      response.status(200).json({ predictions: await input.predictionService.listApprovedPredictions() });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
