import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { CountryPartnerService } from "./service.js";
import { COUNTRY_PARTNER_ACCESS_ROLES, COUNTRY_PARTNER_HQ_ROLES } from "./types.js";

const leadSchema = z.object({
  name: z.string().min(2).max(160),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(4).max(40).nullable().optional(),
  interestType: z.string().min(2).max(80).default("SUBSCRIPTION"),
  estimatedValueCents: z.coerce.number().int().min(0).default(0),
  notes: z.string().max(2000).nullable().optional(),
});

const marketingSchema = z.object({
  language: z.string().min(2).max(16).default("en"),
  campaignType: z.string().min(2).max(120).default("Educational Campaign"),
  localContactDetails: z.record(z.unknown()).optional(),
});

const settingsSchema = z.object({
  rules: z
    .array(
      z.object({
        ruleCode: z.string().min(3).max(120),
        label: z.string().min(3).max(180),
        revenueType: z.enum(["NET_SUBSCRIPTION_REVENUE", "ELIGIBLE_COMPANY_REVENUE", "APPROVED_LOCAL_SERVICE"]),
        percent: z.coerce.number().min(0).max(100),
        active: z.boolean().default(true),
        notes: z.string().max(1000).optional(),
      }),
    )
    .optional(),
  levels: z
    .array(
      z.object({
        level: z.enum(["Emerging", "Bronze", "Silver", "Gold", "Platinum"]),
        minimumCbvCents: z.coerce.number().int().min(0),
        active: z.boolean().default(true),
      }),
    )
    .optional(),
});

export function createCountryPartnerRouter(input: {
  authService: AuthService;
  countryPartnerService: CountryPartnerService;
}) {
  const router = Router();
  const signedIn = requireAuth(input.authService);
  const countryPartnerOnly = [signedIn, requireRole([...COUNTRY_PARTNER_ACCESS_ROLES])];
  const hqOnly = [signedIn, requireRole([...COUNTRY_PARTNER_HQ_ROLES])];

  router.get("/country-partner/dashboard", ...countryPartnerOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.countryPartnerService.dashboard(request.user!));
    } catch (error) {
      next(error);
    }
  });

  router.get("/country-partner/territory", ...countryPartnerOnly, async (request, response, next) => {
    try {
      const dashboard = await input.countryPartnerService.dashboard(request.user!);
      response.status(200).json({
        profile: dashboard.profile,
        licence: dashboard.licence,
        compliance: dashboard.compliance,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/country-partner/cbv", ...countryPartnerOnly, async (request, response, next) => {
    try {
      const dashboard = await input.countryPartnerService.dashboard(request.user!);
      response.status(200).json({ cbv: dashboard.cbv });
    } catch (error) {
      next(error);
    }
  });

  router.get("/country-partner/commissions", ...countryPartnerOnly, async (request, response, next) => {
    try {
      const dashboard = await input.countryPartnerService.dashboard(request.user!);
      response.status(200).json({ commissionSummary: dashboard.commissionSummary });
    } catch (error) {
      next(error);
    }
  });

  router.get("/country-partner/leads", ...countryPartnerOnly, async (request, response, next) => {
    try {
      response.status(200).json({ leads: await input.countryPartnerService.leads(request.user!) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/country-partner/leads", ...countryPartnerOnly, async (request, response, next) => {
    try {
      const body = leadSchema.parse(request.body);
      const lead = await input.countryPartnerService.createLead(request.user!, {
        name: body.name,
        email: body.email ?? null,
        phone: body.phone ?? null,
        interestType: body.interestType ?? "SUBSCRIPTION",
        estimatedValueCents: body.estimatedValueCents ?? 0,
        notes: body.notes ?? null,
      });
      response.status(201).json({ lead });
    } catch (error) {
      next(error);
    }
  });

  router.get("/country-partner/marketing", ...countryPartnerOnly, async (request, response, next) => {
    try {
      response.status(200).json(await input.countryPartnerService.marketing(request.user!));
    } catch (error) {
      next(error);
    }
  });

  router.post("/country-partner/marketing/daily-content", ...countryPartnerOnly, async (request, response, next) => {
    try {
      const body = marketingSchema.parse(request.body);
      const result = await input.countryPartnerService.generateDailyMarketingContent(request.user!, {
        language: body.language ?? "en",
        campaignType: body.campaignType ?? "Educational Campaign",
        localContactDetails: body.localContactDetails,
      });
      response.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/country-partner/reports", ...countryPartnerOnly, async (request, response, next) => {
    try {
      const dashboard = await input.countryPartnerService.dashboard(request.user!);
      response.status(200).json({ reports: dashboard.reports });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/country-partners", ...hqOnly, async (_request, response, next) => {
    try {
      response.status(200).json(await input.countryPartnerService.adminOverview());
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/country-partners/settings", ...hqOnly, async (_request, response, next) => {
    try {
      const overview = await input.countryPartnerService.adminOverview();
      response.status(200).json({ rules: overview.rules, levels: overview.levels });
    } catch (error) {
      next(error);
    }
  });

  router.put("/admin/country-partners/settings", ...hqOnly, async (request, response, next) => {
    try {
      const body = settingsSchema.parse(request.body);
      response.status(200).json(await input.countryPartnerService.updateSettings(request.user!.id, {
        rules: body.rules?.map((rule) => ({
          ruleCode: rule.ruleCode,
          label: rule.label,
          revenueType: rule.revenueType,
          percent: rule.percent,
          active: rule.active ?? true,
          notes: rule.notes,
        })),
        levels: body.levels?.map((level) => ({
          level: level.level,
          minimumCbvCents: level.minimumCbvCents,
          active: level.active ?? true,
        })),
      }));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
