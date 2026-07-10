import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { CommercialService } from "./service.js";

const commercialSettingsSchema = z.object({
  minimumInvestmentCents: z.number().int().min(10000).optional(),
  enabledLockPeriods: z.array(z.enum(["SIX_MONTHS", "TWELVE_MONTHS"])).optional(),
  defaultSimulationWeeklyReturnPercent: z.number().min(0).max(25).optional(),
  defaultPlatformFeePercent: z.number().min(0).max(50).optional(),
});

const subscriptionChangeSchema = z.object({
  planCode: z.enum(["FREE_TRIAL", "STARTER", "PRO", "PROFESSIONAL", "PREMIUM", "ENTERPRISE", "ELITE"]),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
  action: z.enum(["UPGRADE", "DOWNGRADE", "CANCEL", "RENEW"]),
});

const investorPackageUpdateSchema = z.object({
  minimumAmountCents: z.number().int().min(10000).optional(),
  maximumAmountCents: z.number().int().min(10000).nullable().optional(),
  lockPeriodCode: z.enum(["SIX_MONTHS", "TWELVE_MONTHS"]).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
  visible: z.boolean().optional(),
});

const pricingRuleSchema = z.object({
  id: z.string().min(2).default(() => `pricing_${Date.now()}`),
  name: z.string().min(2),
  countryCode: z.string().nullable().default(null),
  currency: z.string().min(3).max(3).default("USD"),
  discountPercent: z.number().min(0).max(100).default(0),
  couponCode: z.string().nullable().default(null),
  promotionType: z.enum(["DISCOUNT", "REFERRAL", "LAUNCH", "SEASONAL", "ADMIN_OVERRIDE"]).default("DISCOUNT"),
  active: z.boolean().default(true),
});

const providerSchema = z.object({
  id: z.string().min(2).default(() => `provider_${Date.now()}`),
  providerName: z.string().min(2),
  purpose: z.string().min(2),
  monthlyCostCents: z.number().int().min(0).default(0),
  annualCostCents: z.number().int().min(0).default(0),
  renewalDate: z.string().nullable().default(null),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]).default("MONTHLY"),
  dashboardUrl: z.string().url().nullable().default(null),
  documentationUrl: z.string().url().nullable().default(null),
  status: z.enum(["ACTIVE", "TRIAL", "PAUSED", "EXPIRED"]).default("TRIAL"),
  health: z.enum(["GREEN", "AMBER", "RED"]).default("AMBER"),
  apiKeyStatus: z.enum(["NOT_REQUIRED", "CONFIGURED", "MISSING", "PLACEHOLDER"]).default("PLACEHOLDER"),
  productionStatus: z.enum(["READY", "PLACEHOLDER", "NOT_CONNECTED"]).default("PLACEHOLDER"),
  developmentStatus: z.enum(["READY", "PLACEHOLDER", "NOT_CONNECTED"]).default("PLACEHOLDER"),
  supportContact: z.string().nullable().default(null),
  category: z.enum(["Football APIs", "AI APIs", "Payments", "Messaging", "Infrastructure", "Hosting", "Domains", "Analytics", "Security", "Marketing"]),
});

const procurementSchema = z.object({
  id: z.string().min(2).default(() => `procurement_${Date.now()}`),
  vendor: z.string().min(2),
  plan: z.string().min(2),
  status: z.enum(["PURCHASED", "PENDING_PURCHASE", "CANCELLED", "TRIAL", "EXPIRED", "RENEWAL_PENDING"]).default("PENDING_PURCHASE"),
  license: z.string().nullable().default(null),
  invoice: z.string().nullable().default(null),
  costCents: z.number().int().min(0).default(0),
  renewalDate: z.string().nullable().default(null),
});

export function createCommercialRouter(input: {
  authService: AuthService;
  commercialService: CommercialService;
}) {
  const router = Router();
  const signedIn = requireAuth(input.authService);
  const adminOnly = [signedIn, requireRole(["ADMIN"])];

  router.get("/commercial/structure", async (_request, response, next) => {
    try {
      response.status(200).json(await input.commercialService.structure());
    } catch (error) {
      next(error);
    }
  });

  router.get("/subscriptions/me", signedIn, async (request, response, next) => {
    try {
      response.status(200).json({ subscription: await input.commercialService.subscription(request.user!.id) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/subscriptions/change", signedIn, async (request, response, next) => {
    try {
      const body = subscriptionChangeSchema.parse(request.body);
      response.status(200).json({
        subscription: await input.commercialService.changeSubscription(request.user!.id, {
          planCode: body.planCode,
          billingCycle: body.billingCycle,
          action: body.action,
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/investor/packages", signedIn, async (_request, response, next) => {
    try {
      response.status(200).json({ packages: await input.commercialService.investorPackages() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/investor/lock-periods", signedIn, async (_request, response, next) => {
    try {
      response.status(200).json({ lockPeriods: (await input.commercialService.structure()).lockPeriods });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/commercial/control", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.commercialService.controlCenter(request.user!.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/business/dashboard", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ dashboard: input.commercialService.businessDashboard() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/commercial/investor-packages", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ packages: await input.commercialService.investorPackages() });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/commercial/investor-packages/:id", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json({ package: await input.commercialService.updateInvestorPackage(request.user!.id, request.params.id, investorPackageUpdateSchema.parse(request.body)) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/commercial/pricing", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ pricingRules: await input.commercialService.pricingRules() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/commercial/pricing-rules", ...adminOnly, async (request, response, next) => {
    try {
      const body = pricingRuleSchema.parse(request.body);
      response.status(201).json({
        pricingRule: await input.commercialService.createPricingRule(request.user!.id, {
          id: body.id,
          name: body.name,
          countryCode: body.countryCode,
          currency: body.currency,
          discountPercent: body.discountPercent,
          couponCode: body.couponCode,
          promotionType: body.promotionType,
          active: body.active,
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/infrastructure/providers", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ providers: input.commercialService.infrastructureProviders() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/infrastructure/providers", ...adminOnly, async (request, response, next) => {
    try {
      const body = providerSchema.parse(request.body);
      response.status(201).json({
        provider: await input.commercialService.createInfrastructureProvider(request.user!.id, {
          id: body.id,
          providerName: body.providerName,
          purpose: body.purpose,
          monthlyCostCents: body.monthlyCostCents,
          annualCostCents: body.annualCostCents,
          renewalDate: body.renewalDate,
          billingCycle: body.billingCycle,
          dashboardUrl: body.dashboardUrl,
          documentationUrl: body.documentationUrl,
          status: body.status,
          health: body.health,
          apiKeyStatus: body.apiKeyStatus,
          productionStatus: body.productionStatus,
          developmentStatus: body.developmentStatus,
          supportContact: body.supportContact,
          category: body.category,
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/renewals", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ renewals: input.commercialService.renewals() });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/procurement", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ procurement: input.commercialService.procurement() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/procurement", ...adminOnly, async (request, response, next) => {
    try {
      const body = procurementSchema.parse(request.body);
      response.status(201).json({
        procurement: await input.commercialService.createProcurement(request.user!.id, {
          id: body.id,
          vendor: body.vendor,
          plan: body.plan,
          status: body.status,
          license: body.license,
          invoice: body.invoice,
          costCents: body.costCents,
          renewalDate: body.renewalDate,
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/commercial/settings", ...adminOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.commercialService.updateSettings(
        request.user!.id,
        commercialSettingsSchema.parse(request.body),
      ));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
