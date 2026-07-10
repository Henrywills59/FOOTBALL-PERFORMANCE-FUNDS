import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { AnalystService } from "./analystService.js";
import type {
  CreateAcademyPredictionInput,
  CreateAnalystApplicationInput,
  CreateAssignmentInput,
  CreateSubmissionInput,
} from "./types.js";

const submissionSchema = z.object({
  fixtureId: z.string().min(1),
  leagueName: z.string().min(1),
  market: z.string().min(2),
  prediction: z.string().min(2),
  confidence: z.number().int().min(0).max(100),
  riskLevel: z.string().min(2),
  detailedReasoning: z.string().min(10),
  supportingStatistics: z.string().min(2),
  sourceNotes: z.string().min(2),
  briefExplanation: z.string().min(5),
  recommendedStake: z.string().min(2),
  status: z.enum(["DRAFT", "PENDING_REVIEW"]).default("DRAFT"),
});

const assignmentSchema = z.object({
  analystId: z.string().min(1),
  fixtureId: z.string().min(1),
  leagueName: z.string().min(1).optional().default(""),
  adminNotes: z.string().max(1000).optional(),
});

const notesSchema = z.object({ adminNotes: z.string().max(1000).default("") });
const applicationSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  country: z.string().min(2).max(80),
  footballExperience: z.string().min(10).max(2000),
  preferredLeagues: z.array(z.string().min(2)).default([]),
  yearsOfExperience: z.number().int().min(0).max(80),
  countriesCovered: z.array(z.string().min(2)).default([]),
  predictionStyle: z.string().min(2).max(120),
  motivationStatement: z.string().min(20).max(3000),
});
const applicationStatusSchema = z.object({
  status: z.enum(["SUBMITTED", "UNDER_REVIEW", "APPROVED_FOR_ACADEMY", "REJECTED", "WAITING_LIST"]),
  adminNotes: z.string().max(1000).optional(),
});
const demoPredictionSchema = z.object({
  matchName: z.string().min(2).max(160),
  leagueName: z.string().min(2).max(120),
  market: z.enum([
    "MATCH_WINNER",
    "DOUBLE_CHANCE",
    "BTTS",
    "OVER_UNDER",
    "CORRECT_SCORE",
    "CORNERS",
    "CARDS",
    "ANYTIME_SCORER",
    "FIRST_GOAL_SCORER",
  ]),
  prediction: z.string().min(2).max(160),
  confidence: z.number().int().min(0).max(100),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
  explanation: z.string().min(10).max(2000),
  supportingNotes: z.string().min(2).max(2000),
  stakeCents: z.number().int().min(0).max(1000000).optional(),
  odds: z.number().min(1).max(1000).optional(),
});
const analystActionSchema = z.object({
  analystId: z.string().min(1),
  adminNotes: z.string().max(1000).optional(),
});

export function createAnalystRouter(input: {
  authService: AuthService;
  analystService: AnalystService;
}) {
  const router = Router();
  const signedIn = requireAuth(input.authService);
  const analystOnly = [signedIn, requireRole(["ANALYST"])];
  const adminOnly = [signedIn, requireRole(["ADMIN"])];

  router.post("/analyst-applications", async (request, response, next) => {
    try {
      const body = applicationSchema.parse(request.body) as CreateAnalystApplicationInput;
      const application = await input.analystService.createApplication(body);
      response.status(201).json({
        application,
        message: "Application submitted. FPF reviews analyst candidates internally before academy access.",
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/analysts", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json(await input.analystService.adminControlCenter());
    } catch (error) {
      next(error);
    }
  });

  router.get("/analyst/dashboard", ...analystOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.analystService.dashboard(request.user!.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/analyst/performance", ...analystOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.analystService.performanceDashboard(request.user!.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/analyst/predictions", ...analystOnly, async (request, response, next) => {
    try {
      const body = demoPredictionSchema.parse(request.body) as Omit<CreateAcademyPredictionInput, "analystId">;
      response.status(201).json({
        prediction: await input.analystService.createAcademyPrediction({
          ...body,
          analystId: request.user!.id,
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/analyst/assignments", ...analystOnly, async (request, response, next) => {
    try {
      response.status(200).json({ assignments: await input.analystService.listAssignments(request.user!.id) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/analyst/intelligence", ...analystOnly, async (request, response, next) => {
    try {
      response.status(200).json({ submissions: await input.analystService.listAnalystSubmissions(request.user!.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/analyst/intelligence", ...analystOnly, async (request, response, next) => {
    try {
      const body = submissionSchema.parse(request.body) as Omit<CreateSubmissionInput, "analystId">;
      const submission = await input.analystService.createSubmission({
        ...body,
        analystId: request.user!.id,
      });
      response.status(201).json({ submission });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/analyst/intelligence/:id", ...analystOnly, async (request, response, next) => {
    try {
      const body = submissionSchema.partial().parse(request.body);
      response.status(200).json({
        submission: await input.analystService.updateSubmission(request.params.id, request.user!.id, body),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/analyst/intelligence/:id/submit", ...analystOnly, async (request, response, next) => {
    try {
      response.status(200).json({
        submission: await input.analystService.submitForReview(request.params.id, request.user!.id),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/analyst/fixtures/:fixtureId/assistance", ...analystOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.analystService.assistance(request.params.fixtureId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/intelligence/assign", ...adminOnly, async (request, response, next) => {
    try {
      const body = assignmentSchema.parse(request.body) as CreateAssignmentInput;
      response.status(201).json({
        assignment: await input.analystService.createAssignment(request.user!.id, body),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/intelligence", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ submissions: await input.analystService.listAdminSubmissions() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/analyst-applications", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ applications: await input.analystService.listApplications() });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/analyst-applications/:id/status", ...adminOnly, async (request, response, next) => {
    try {
      const body = applicationStatusSchema.parse(request.body);
      response.status(200).json({
        application: await input.analystService.updateApplicationStatus(
          request.user!.id,
          request.params.id,
          body.status,
          body.adminNotes,
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/analyst/promote", ...adminOnly, async (request, response, next) => {
    try {
      const body = analystActionSchema.parse(request.body);
      response.status(200).json({
        profile: await input.analystService.promoteAnalyst(request.user!.id, body.analystId, body.adminNotes),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/analyst/suspend", ...adminOnly, async (request, response, next) => {
    try {
      const body = analystActionSchema.parse(request.body);
      response.status(200).json({
        profile: await input.analystService.suspendAnalyst(request.user!.id, body.analystId, body.adminNotes),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/analyst/reward-calculate", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.analystService.calculateRewards(request.user!.id));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/intelligence/:id/notes", ...adminOnly, async (request, response, next) => {
    try {
      const body = notesSchema.parse(request.body);
      response.status(200).json({
        submission: await input.analystService.updateAdminNotes(request.user!.id, request.params.id, body.adminNotes),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/intelligence/:id/approve", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ submission: await input.analystService.approve(request.user!.id, request.params.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/intelligence/:id/reject", ...adminOnly, async (request, response, next) => {
    try {
      const body = notesSchema.partial().parse(request.body);
      response.status(200).json({
        submission: await input.analystService.reject(request.user!.id, request.params.id, body.adminNotes),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/intelligence/:id/request-revision", ...adminOnly, async (request, response, next) => {
    try {
      const body = notesSchema.parse(request.body);
      response.status(200).json({
        submission: await input.analystService.requestRevision(request.user!.id, request.params.id, body.adminNotes),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/intelligence/:id/publish", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ submission: await input.analystService.publish(request.user!.id, request.params.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/intelligence/:id/withdraw", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ submission: await input.analystService.withdraw(request.user!.id, request.params.id) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/intelligence/published", signedIn, requireRole(["SUBSCRIBER", "ADMIN"]), async (_request, response, next) => {
    try {
      response.status(200).json({ intelligence: await input.analystService.listPublished() });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
