import { Router } from "express";
import type { RequestHandler } from "express";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { IntelligenceService } from "./service.js";
import { intelligenceLogger } from "./logger.js";

function toLimit(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.round(parsed), 100);
}

function timed(endpoint: string, handler: RequestHandler): RequestHandler {
  return async (request, response, next) => {
    const startedAt = Date.now();
    try {
      await handler(request, response, next);
    } catch (error) {
      intelligenceLogger.apiFailure(endpoint, error, {
        userId: request.user?.id,
        role: request.user?.role,
      });
      response.status(200).json({
        error: "Intelligence data is temporarily unavailable.",
        dataQualityStatus: "INSUFFICIENT_DATA",
      });
    } finally {
      intelligenceLogger.responseTime(endpoint, startedAt, {
        userId: request.user?.id,
        role: request.user?.role,
      });
    }
  };
}

export function createIntelligenceRouter(input: {
  authService: AuthService;
  intelligenceService: IntelligenceService;
}) {
  const router = Router();
  const signedIn = requireAuth(input.authService);
  const intelligenceAccess = [signedIn, requireRole(["SUBSCRIBER", "ANALYST", "ADMIN"])];

  router.get(
    "/intelligence/fixtures",
    ...intelligenceAccess,
    timed("/api/intelligence/fixtures", async (request, response) => {
      const fixtures = await input.intelligenceService.getTodayFixtures({
        limit: toLimit(request.query.limit, 30),
        search: request.query.search ? String(request.query.search) : undefined,
        league: request.query.league ? String(request.query.league) : undefined,
        date: request.query.date ? String(request.query.date) : undefined,
      });
      response.status(200).json({ fixtures });
    }),
  );

  router.get(
    "/intelligence/live",
    ...intelligenceAccess,
    timed("/api/intelligence/live", async (request, response) => {
      const fixtures = await input.intelligenceService.getLiveMatches({
        limit: toLimit(request.query.limit, 20),
      });
      response.status(200).json({ fixtures });
    }),
  );

  router.get(
    "/intelligence/opportunities",
    ...intelligenceAccess,
    timed("/api/intelligence/opportunities", async (_request, response) => {
      response.status(200).json({ opportunities: await input.intelligenceService.getOpportunityFeed() });
    }),
  );

  router.get(
    "/intelligence/team/:id",
    ...intelligenceAccess,
    timed("/api/intelligence/team/:id", async (request, response) => {
      response.status(200).json({ profile: await input.intelligenceService.getTeamProfile(request.params.id) });
    }),
  );

  router.get(
    "/intelligence/player/:id",
    ...intelligenceAccess,
    timed("/api/intelligence/player/:id", async (request, response) => {
      response.status(200).json({ profile: await input.intelligenceService.getPlayerProfile(request.params.id) });
    }),
  );

  router.get(
    "/intelligence/match/:id",
    ...intelligenceAccess,
    timed("/api/intelligence/match/:id", async (request, response) => {
      response.status(200).json({ intelligence: await input.intelligenceService.getMatchIntelligence(request.params.id) });
    }),
  );

  router.get(
    "/intelligence/dashboard",
    ...intelligenceAccess,
    timed("/api/intelligence/dashboard", async (request, response) => {
      response.status(200).json(await input.intelligenceService.getDashboard(request.user!));
    }),
  );

  return router;
}
