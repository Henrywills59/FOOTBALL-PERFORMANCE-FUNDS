import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { OpenAiProvider } from "../integrations/openAiProvider.js";
import type { IntelligenceService } from "./service.js";

const reportSchema = z.object({
  title: z.string().min(2).max(200).default("FPF Internal Intelligence Report"),
  context: z.record(z.unknown()).default({}),
});

const contradictionSchema = z.object({
  submission: z.record(z.unknown()),
  evidence: z.record(z.unknown()).default({}),
});

export function createAiIntelligenceRouter(input: {
  authService: AuthService;
  openAiProvider: OpenAiProvider;
  intelligenceService: IntelligenceService;
}) {
  const router = Router();
  const signedIn = requireAuth(input.authService);
  const internalOnly = [signedIn, requireRole(["ANALYST", "ADMIN", "CEO", "RISK_MANAGER", "SUPER_ADMINISTRATOR"])];

  router.get("/intelligence/ai/status", ...internalOnly, (_request, response) => {
    response.status(200).json(input.openAiProvider.status());
  });

  router.get("/intelligence/ai/match/:id/summary", ...internalOnly, async (request, response, next) => {
    try {
      const intelligence = await input.intelligenceService.getMatchIntelligence(request.params.id);
      const insight = await input.openAiProvider.generateInsight({
        task: "MATCH_SUMMARY",
        prompt: "Summarize this match for FPF internal analysts. Include missing data warnings.",
        context: { intelligence },
      });
      response.status(200).json({ insight });
    } catch (error) {
      next(error);
    }
  });

  router.post("/intelligence/ai/internal-report", ...internalOnly, async (request, response, next) => {
    try {
      const body = reportSchema.parse(request.body);
      const insight = await input.openAiProvider.generateInsight({
        task: "INTERNAL_REPORT",
        prompt: `Draft internal report: ${body.title}`,
        context: body.context,
      });
      response.status(200).json({ insight });
    } catch (error) {
      next(error);
    }
  });

  router.post("/intelligence/ai/contradictions", ...internalOnly, async (request, response, next) => {
    try {
      const body = contradictionSchema.parse(request.body);
      const insight = await input.openAiProvider.generateInsight({
        task: "CONTRADICTION_DETECTION",
        prompt: "Detect contradictions between analyst submission and supporting evidence. Return only internal review notes.",
        context: body,
      });
      response.status(200).json({ insight });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
