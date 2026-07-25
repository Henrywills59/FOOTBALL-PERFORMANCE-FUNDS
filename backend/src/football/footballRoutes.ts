import { Router } from "express";
import rateLimit from "express-rate-limit";
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
  const footballReadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.use("/football", footballReadLimiter);

  router.get("/football/status", signedIn, async (_request, response, next) => {
    try {
      const sync = await input.repository.getSyncStatus(input.config.jobsEnabled, input.scheduler.isStarted());
      response.status(200).json({
        provider: input.syncService.providerStatus(),
        oddsProvider: input.syncService.oddsProviderStatus(),
        sync,
        cacheStrategy: {
          countries: "long-lived",
          leagues: "daily",
          teams: "daily",
          standings: "periodic",
          upcomingFixtures: "several hours",
          liveFixtures: "short-lived during active matches",
          injuries: "periodic",
          lineups: "close to kickoff",
          finishedStatistics: "long-lived",
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/football/leagues", signedIn, async (_request, response, next) => {
    try {
      response.status(200).json({
        leagues: await input.repository.listLeagues(),
        freshness: input.syncService.providerStatus(),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/football/fixtures", signedIn, async (request, response, next) => {
    try {
      response.status(200).json({
        fixtures: await input.repository.listFixtures({
          live: request.query.live === "true",
          limit: request.query.limit ? Number(request.query.limit) : undefined,
          search: request.query.search ? String(request.query.search) : undefined,
          league: request.query.league ? String(request.query.league) : undefined,
          date: request.query.date ? String(request.query.date) : undefined,
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/football/fixtures/live", signedIn, async (request, response, next) => {
    try {
      response.status(200).json({
        fixtures: await input.repository.listFixtures({
          live: true,
          limit: request.query.limit ? Number(request.query.limit) : undefined,
          search: request.query.search ? String(request.query.search) : undefined,
          league: request.query.league ? String(request.query.league) : undefined,
          date: request.query.date ? String(request.query.date) : undefined,
        }),
        freshness: input.syncService.providerStatus(),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/football/standings", signedIn, async (request, response, next) => {
    try {
      const result = await input.repository.listStandings({
        leagueId: request.query.leagueId ? String(request.query.leagueId) : undefined,
        season: request.query.season ? Number(request.query.season) : undefined,
      });
      response.status(200).json({ standings: result.data, freshness: result.freshness });
    } catch (error) {
      next(error);
    }
  });

  router.get("/football/teams/:id", signedIn, async (request, response, next) => {
    try {
      const result = await input.repository.getTeam(request.params.id);
      response.status(200).json({ team: result.data, freshness: result.freshness });
    } catch (error) {
      next(error);
    }
  });

  router.get("/football/teams/:id/statistics", signedIn, async (request, response, next) => {
    try {
      const result = await input.repository.getTeamStatistics(request.params.id);
      response.status(200).json({ statistics: result.data, freshness: result.freshness });
    } catch (error) {
      next(error);
    }
  });

  router.get("/football/fixtures/:id/statistics", signedIn, async (request, response, next) => {
    try {
      const result = await input.repository.getFixtureStatistics(request.params.id);
      response.status(200).json({ statistics: result.data, freshness: result.freshness });
    } catch (error) {
      next(error);
    }
  });

  router.get("/football/fixtures/:id/events", signedIn, async (request, response, next) => {
    try {
      const result = await input.repository.getFixtureEvents(request.params.id);
      response.status(200).json({ events: result.data, freshness: result.freshness });
    } catch (error) {
      next(error);
    }
  });

  router.get("/football/fixtures/:id/lineups", signedIn, async (request, response, next) => {
    try {
      const result = await input.repository.getFixtureLineups(request.params.id);
      response.status(200).json({ lineups: result.data, freshness: result.freshness });
    } catch (error) {
      next(error);
    }
  });

  router.get("/football/fixtures/:id/injuries", signedIn, async (request, response, next) => {
    try {
      const result = await input.repository.getFixtureInjuries(request.params.id);
      response.status(200).json({ injuries: result.data, freshness: result.freshness });
    } catch (error) {
      next(error);
    }
  });

  router.get("/football/head-to-head", signedIn, async (request, response, next) => {
    try {
      const result = await input.repository.getHeadToHead(String(request.query.fixtureId ?? ""));
      response.status(200).json({ headToHead: result.data, freshness: result.freshness });
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

  router.post(
    "/football/sync/fixtures",
    signedIn,
    requireRole(["ANALYST", "ADMIN"]),
    async (_request, response, next) => {
      try {
        const result = await input.syncService.syncFixtures();
        response.status(result.status === "SUCCESS" ? 202 : 503).json({
          message: result.status === "SUCCESS" ? "Football fixture sync completed." : "Football fixture sync failed.",
          result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/football/provider/probe",
    signedIn,
    requireRole(["ADMIN"]),
    async (_request, response, next) => {
      try {
        const result = await input.syncService.probeProvider();
        response.status(result.ok ? 200 : 503).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/football/provider/diagnostics",
    signedIn,
    requireRole(["ADMIN"]),
    async (_request, response, next) => {
      try {
        const result = await input.syncService.diagnoseProvider();
        const ok = result.diagnostics.status.ok && result.diagnostics.timezone.ok && result.diagnostics.fixture.ok;
        response.status(ok ? 200 : 503).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/football/odds/diagnostics",
    signedIn,
    requireRole(["ADMIN"]),
    async (_request, response, next) => {
      try {
        const result = await input.syncService.diagnoseOddsProvider();
        response.status(result.ok ? 200 : 503).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/football/odds/competitions",
    signedIn,
    requireRole(["ANALYST", "ADMIN"]),
    async (_request, response, next) => {
      try {
        response.status(200).json(await input.syncService.listOddsCompetitions());
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/football/odds/markets",
    signedIn,
    requireRole(["ANALYST", "ADMIN"]),
    (_request, response) => {
      response.status(200).json(input.syncService.oddsMarkets());
    },
  );

  router.post(
    "/football/sync/odds",
    signedIn,
    requireRole(["ANALYST", "ADMIN"]),
    async (_request, response, next) => {
      try {
        await input.syncService.syncOdds();
        response.status(202).json({ message: "Odds sync completed." });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
