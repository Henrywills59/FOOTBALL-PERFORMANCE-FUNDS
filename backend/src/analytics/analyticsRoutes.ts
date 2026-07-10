import { Router } from "express";
import type { AuthService } from "../auth/authService.js";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import { AnalyticsService } from "./analyticsService.js";

export function createAnalyticsRouter({
  authService,
  analyticsService,
}: {
  authService: AuthService;
  analyticsService: AnalyticsService;
}) {
  const router = Router();
  const adminOnly = [requireAuth(authService), requireRole(["ADMIN"])];
  const analystOnly = [requireAuth(authService), requireRole(["ANALYST"])];

  router.get("/analytics/executive", adminOnly, (_request, response) => {
    response.json(analyticsService.dashboard());
  });

  router.get("/analytics/kpis", adminOnly, (_request, response) => {
    response.json({ kpis: analyticsService.dashboard().executiveKpis });
  });

  router.get("/analytics/analysts", adminOnly, (_request, response) => {
    response.json({ analysts: analyticsService.dashboard().analystLeaderboard });
  });

  router.get("/analytics/leagues", adminOnly, (_request, response) => {
    response.json({ leagues: analyticsService.dashboard().leagueIntelligence });
  });

  router.get("/analytics/markets", adminOnly, (_request, response) => {
    response.json({ markets: analyticsService.dashboard().marketIntelligence });
  });

  router.get("/analytics/subscribers", adminOnly, (_request, response) => {
    response.json(analyticsService.dashboard().subscriberAnalytics);
  });

  router.get("/analytics/investors", adminOnly, (_request, response) => {
    response.json(analyticsService.dashboard().investorAnalytics);
  });

  router.get("/analytics/treasury", adminOnly, (_request, response) => {
    response.json(analyticsService.dashboard().treasuryAnalytics);
  });

  router.get("/analytics/ai-insights", adminOnly, (_request, response) => {
    response.json({ insights: analyticsService.dashboard().aiInsights });
  });

  router.get("/analytics/forecasts", adminOnly, (_request, response) => {
    response.json({ forecasts: analyticsService.dashboard().forecasts });
  });

  router.get("/analytics/exports", adminOnly, (_request, response) => {
    response.json({ exports: analyticsService.dashboard().exportCenter });
  });

  router.get("/analytics/analyst/me", analystOnly, (request, response) => {
    response.json(analyticsService.analystPrivate(request.user?.id ?? "unknown-analyst"));
  });

  return router;
}
