import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
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

  return router;
}
