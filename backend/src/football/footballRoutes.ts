import { Router } from "express";
import type { FootballRepository } from "./types.js";
import type { FootballSyncService } from "./footballSyncService.js";
import type { FootballConfig } from "./config.js";
import type { FootballJobScheduler } from "./footballJobs.js";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";

export function createFootballRouter(input: {
  repository: FootballRepository;
  syncService: FootballSyncService;
  scheduler: FootballJobScheduler;
  config: FootballConfig;
  authService: AuthService;
}) {
  const router = Router();
  const signedIn = requireAuth(input.authService);

  router.get("/football/fixtures", signedIn, async (request, response, next) => {
    try {
      response.status(200).json({
        fixtures: await input.repository.listFixtures({
          live: request.query.live === "true",
          limit: request.query.limit ? Number(request.query.limit) : undefined,
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/football/fixtures/:id", signedIn, async (request, response, next) => {
    try {
      const fixture = await input.repository.getFixture(request.params.id);
      if (!fixture) {
        response.status(404).json({ error: "Fixture not found" });
        return;
      }
      response.status(200).json({ fixture });
    } catch (error) {
      next(error);
    }
  });

  router.get("/football/sync/status", signedIn, async (_request, response, next) => {
    try {
      response.status(200).json(await input.repository.getSyncStatus(input.config.jobsEnabled, input.scheduler.isStarted()));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/football/sync",
    signedIn,
    requireRole(["ANALYST", "ADMIN"]),
    async (_request, response, next) => {
      try {
        await input.scheduler.runOnce();
        response.status(202).json({ message: "Football data sync completed." });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
