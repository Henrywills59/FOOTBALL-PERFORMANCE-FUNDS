import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { InvestorSimulatorInput } from "@fpf/shared";
import type { InvestorService } from "./investorService.js";

const investmentSchema = z.object({
  planId: z.string().min(1),
  amountCents: z.number().int().positive(),
  riskAccepted: z.literal(true),
});

const withdrawalSchema = z.object({
  amountCents: z.number().int().positive(),
});

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  adminNotes: z.string().max(1000).optional(),
});

const noteSchema = z.object({
  note: z.string().min(1).max(2000),
});

const distributionReviewSchema = z.object({
  adminNotes: z.string().max(1000).optional(),
});

const simulatorSchema = z.object({
  investmentAmountCents: z.number().int().min(0).max(1_000_000_000),
  expectedWeeklyReturnPercent: z.number().min(0).max(25),
  numberOfWeeks: z.number().int().min(1).max(260),
  reinvest: z.boolean(),
  withdrawalFrequency: z.enum(["NONE", "WEEKLY", "MONTHLY", "END_OF_TERM"]),
  platformFeePercent: z.number().min(0).max(50),
});

function parseSimulatorInput(body: unknown): InvestorSimulatorInput {
  const parsed = simulatorSchema.parse(body);
  return {
    investmentAmountCents: parsed.investmentAmountCents,
    expectedWeeklyReturnPercent: parsed.expectedWeeklyReturnPercent,
    numberOfWeeks: parsed.numberOfWeeks,
    reinvest: parsed.reinvest,
    withdrawalFrequency: parsed.withdrawalFrequency,
    platformFeePercent: parsed.platformFeePercent,
  };
}

export function createInvestorRouter(input: {
  authService: AuthService;
  investorService: InvestorService;
}) {
  const router = Router();
  const investorOnly = [requireAuth(input.authService), requireRole(["INVESTOR"])];
  const adminOnly = [requireAuth(input.authService), requireRole(["ADMIN"])];

  router.get("/investor/dashboard", ...investorOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.investorService.dashboard(request.user!.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/performance-partner/dashboard", ...investorOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.investorService.dashboard(request.user!.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/investor/profile", ...investorOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.investorService.profile(request.user!.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/performance-partner/profile", ...investorOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.investorService.profile(request.user!.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/investor/plans", ...investorOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ plans: await input.investorService.plans() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/investor/investments", ...investorOnly, async (request, response, next) => {
    try {
      const body = investmentSchema.parse(request.body);
      response.status(201).json({
        investment: await input.investorService.createInvestment(request.user!.id, body.planId, body.amountCents),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/investor/portfolio", ...investorOnly, async (request, response, next) => {
    try {
      const investments = await input.investorService.investments(request.user!.id);
      response.status(200).json({
        active: investments.filter((investment) => investment.status === "ACTIVE"),
        completed: investments.filter((investment) => investment.status === "COMPLETED"),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/investor/reports", ...investorOnly, async (request, response, next) => {
    try {
      response.status(200).json({ reports: await input.investorService.reports(request.user!.id) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/investor/distributions", ...investorOnly, async (request, response, next) => {
    try {
      response.status(200).json({ distributions: await input.investorService.distributions(request.user!.id) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/performance-partner/distributions", ...investorOnly, async (request, response, next) => {
    try {
      response.status(200).json({ distributions: await input.investorService.distributions(request.user!.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/investor/simulator", ...investorOnly, async (request, response, next) => {
    try {
      const body = parseSimulatorInput(request.body);
      response.status(200).json({ simulation: input.investorService.simulate(body) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/performance-partner/simulator", ...investorOnly, async (request, response, next) => {
    try {
      const body = parseSimulatorInput(request.body);
      response.status(200).json({ simulation: input.investorService.simulate(body) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/investor/withdrawals", ...investorOnly, async (request, response, next) => {
    try {
      response.status(200).json({ withdrawals: await input.investorService.withdrawals(request.user!.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/investor/withdrawals", ...investorOnly, async (request, response, next) => {
    try {
      const body = withdrawalSchema.parse(request.body);
      response.status(201).json({
        withdrawal: await input.investorService.createWithdrawal(request.user!.id, body.amountCents),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/withdrawals/:id/review", ...adminOnly, async (request, response, next) => {
    try {
      const body = reviewSchema.parse(request.body);
      const withdrawal = await input.investorService.reviewWithdrawal(
        request.user!.id,
        request.params.id,
        body.status,
        body.adminNotes,
      );
      if (!withdrawal) {
        response.status(404).json({ error: "Withdrawal request not found" });
        return;
      }
      response.status(200).json({ withdrawal });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/investors", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json(await input.investorService.adminManagement());
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/performance-partners", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json(await input.investorService.adminManagement());
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/investors/:id", ...adminOnly, async (request, response, next) => {
    try {
      const detail = await input.investorService.adminInvestorDetail(request.params.id);
      if (!detail) {
        response.status(404).json({ error: "Investor not found" });
        return;
      }
      response.status(200).json(detail);
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/investors/:id/notes", ...adminOnly, async (request, response, next) => {
    try {
      const body = noteSchema.parse(request.body);
      const detail = await input.investorService.addInvestorNote(request.user!.id, request.params.id, body.note);
      if (!detail) {
        response.status(404).json({ error: "Investor not found" });
        return;
      }
      response.status(200).json(detail);
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/investor-distributions/calculate", ...adminOnly, async (request, response, next) => {
    try {
      response.status(201).json(await input.investorService.calculateWeeklyDistributions(request.user!.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/investor-simulator", ...adminOnly, async (request, response, next) => {
    try {
      const body = parseSimulatorInput(request.body);
      response.status(200).json({ simulation: input.investorService.simulate(body) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/investor-distributions/:id/approve", ...adminOnly, async (request, response, next) => {
    try {
      const body = distributionReviewSchema.parse(request.body);
      const distribution = await input.investorService.approveDistribution(request.user!.id, request.params.id, body.adminNotes);
      if (!distribution) {
        response.status(404).json({ error: "Distribution not found" });
        return;
      }
      response.status(200).json({ distribution });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/investor-distributions/:id/reject", ...adminOnly, async (request, response, next) => {
    try {
      const body = distributionReviewSchema.parse(request.body);
      const distribution = await input.investorService.rejectDistribution(request.user!.id, request.params.id, body.adminNotes);
      if (!distribution) {
        response.status(404).json({ error: "Distribution not found" });
        return;
      }
      response.status(200).json({ distribution });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/investor-distributions/:id/mark-paid", ...adminOnly, async (request, response, next) => {
    try {
      const body = distributionReviewSchema.parse(request.body);
      const distribution = await input.investorService.markDistributionPaid(request.user!.id, request.params.id, body.adminNotes);
      if (!distribution) {
        response.status(404).json({ error: "Distribution not found" });
        return;
      }
      response.status(200).json({ distribution });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
