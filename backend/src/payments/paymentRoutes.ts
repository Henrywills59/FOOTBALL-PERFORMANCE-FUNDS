import rateLimit from "express-rate-limit";
import { Router } from "express";
import { z } from "zod";
import type { AuthService } from "../auth/authService.js";
import { AuthError } from "../auth/authService.js";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { PaymentService } from "./paymentService.js";
import { PaymentError } from "./paymentService.js";
import type { CreateInvestorFundingInput, CreateSubscriptionPaymentInput } from "./types.js";

const checkoutLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const subscriptionCheckoutSchema = z.object({
  planCode: z.enum(["STARTER", "PRO", "PROFESSIONAL", "PREMIUM", "ELITE", "ENTERPRISE"]),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]),
  purpose: z.enum(["SUBSCRIPTION", "SUBSCRIPTION_RENEWAL", "SUBSCRIPTION_UPGRADE"]).optional(),
});

const investorFundingSchema = z.object({
  packageId: z.string().min(1),
  lockPeriodCode: z.enum(["SIX_MONTHS", "TWELVE_MONTHS"]),
  amountCents: z.number().int().min(10000),
  acknowledgementsAccepted: z.literal(true),
  termsAccepted: z.literal(true),
});

const webhookSchema = z.object({
  payment_id: z.union([z.string(), z.number()]).optional(),
  invoice_id: z.union([z.string(), z.number()]).optional(),
  order_id: z.string().optional(),
  payment_status: z.string().optional(),
}).passthrough();

const noteSchema = z.object({ note: z.string().min(1).max(2000) });

export function createPaymentRouter(input: { authService: AuthService; paymentService: PaymentService }) {
  const router = Router();
  const authenticated = [requireAuth(input.authService)];
  const adminOnly = [requireAuth(input.authService), requireRole(["ADMIN"])];
  const investorOnly = [requireAuth(input.authService), requireRole(["INVESTOR", "ADMIN"])];

  router.get("/payments/config", (_request, response) => {
    response.status(200).json(input.paymentService.status());
  });

  router.get("/payments/center", ...authenticated, async (request, response, next) => {
    try {
      response.status(200).json(await input.paymentService.userCenter(request.user!.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/payments/subscription/checkout", checkoutLimiter, ...authenticated, async (request, response, next) => {
    try {
      const body = subscriptionCheckoutSchema.parse(request.body);
      const order = await input.paymentService.createSubscriptionPayment(request.user!, body as CreateSubscriptionPaymentInput);
      response.status(201).json({ order });
    } catch (error) {
      next(error);
    }
  });

  router.post("/payments/investor-funding/checkout", checkoutLimiter, ...investorOnly, async (request, response, next) => {
    try {
      const body = investorFundingSchema.parse(request.body);
      const order = await input.paymentService.createInvestorFunding(request.user!, body as CreateInvestorFundingInput);
      response.status(201).json({ order });
    } catch (error) {
      next(error);
    }
  });

  router.post("/payments/nowpayments/webhook", async (request, response, next) => {
    try {
      const payload = webhookSchema.parse(request.body);
      const result = await input.paymentService.processWebhook(payload, request.header("x-nowpayments-sig"));
      response.status(200).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/payments", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json(await input.paymentService.adminCenter());
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/payments/:id/refresh", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ order: await input.paymentService.refreshStatus(request.user!.id, request.params.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/payments/:id/test-signed-webhook", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.paymentService.runSignedWebhookSelfTest(request.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/payments/:id/notes", ...adminOnly, async (request, response, next) => {
    try {
      const body = noteSchema.parse(request.body);
      await input.paymentService.addAdminNote(request.user!.id, request.params.id, body.note);
      response.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.use((error: unknown, _request, _response, next) => {
    if (error instanceof PaymentError) {
      next(new AuthError(error.message, error.statusCode));
      return;
    }
    next(error);
  });

  return router;
}
