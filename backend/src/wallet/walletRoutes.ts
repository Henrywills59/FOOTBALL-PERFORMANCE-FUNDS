import { Router } from "express";
import { z } from "zod";
import { AuthError } from "../auth/authService.js";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { WalletService } from "./walletService.js";

const amountSchema = z.object({ amountCents: z.number().int().positive() });
const reviewSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });

export function createWalletRouter(input: { authService: AuthService; walletService: WalletService }) {
  const router = Router();
  const investorOnly = [requireAuth(input.authService), requireRole(["INVESTOR"])];
  const adminOnly = [requireAuth(input.authService), requireRole(["ADMIN"])];

  router.get("/wallet", ...investorOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.walletService.getWallet(request.user!.id));
    } catch (error) {
      next(error instanceof Error ? new AuthError(error.message, 400) : error);
    }
  });

  router.post("/wallet/deposits", ...investorOnly, async (request, response, next) => {
    try {
      const body = amountSchema.parse(request.body);
      response.status(201).json(await input.walletService.createDepositInvoice(request.user!.id, body.amountCents));
    } catch (error) {
      next(error instanceof Error ? new AuthError(error.message, 400) : error);
    }
  });

  router.post("/wallet/withdrawals", ...investorOnly, async (request, response, next) => {
    try {
      const body = amountSchema.parse(request.body);
      response.status(201).json({ transaction: await input.walletService.createWithdrawal(request.user!.id, body.amountCents) });
    } catch (error) {
      next(error instanceof Error ? new AuthError(error.message, 400) : error);
    }
  });

  router.post("/nowpayments/ipn", async (request, response, next) => {
    try {
      response.status(200).json(
        await input.walletService.handleIpn(request.body, request.header("x-nowpayments-sig")),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/wallet/withdrawals/:id/review", ...adminOnly, async (request, response, next) => {
    try {
      const body = reviewSchema.parse(request.body);
      const transaction = await input.walletService.reviewWithdrawal(request.user!.id, request.params.id, body.status);
      if (!transaction) {
        response.status(404).json({ error: "Withdrawal transaction not found" });
        return;
      }
      response.status(200).json({ transaction });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
