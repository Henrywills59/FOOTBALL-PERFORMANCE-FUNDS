import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { AdminService } from "../admin/adminService.js";
import type { PredictionService } from "./predictionService.js";

export function createPredictionRouter(input: {
  authService: AuthService;
  predictionService: PredictionService;
  adminService?: AdminService;
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
        await input.adminService?.audit(request.user!.id, "PREDICTION_APPROVED", "PREDICTION", request.params.id);
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
        await input.adminService?.audit(request.user!.id, "PREDICTION_REJECTED", "PREDICTION", request.params.id);
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

  router.patch(
    "/admin/predictions/:id/notes",
    signedIn,
    requireRole(["ADMIN"]),
    async (request, response, next) => {
      try {
        const body = z.object({ adminNotes: z.string().max(1000) }).parse(request.body);
        const prediction = await input.predictionService.updateNotes(request.params.id, body.adminNotes);
        if (!prediction) {
          response.status(404).json({ error: "Prediction not found" });
          return;
        }
        await input.adminService?.audit(request.user!.id, "PREDICTION_NOTES_UPDATED", "PREDICTION", request.params.id);
        response.status(200).json({ prediction });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
