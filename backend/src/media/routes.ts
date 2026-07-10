import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { AdminService } from "../admin/adminService.js";
import type { MediaService } from "./service.js";

const campaignSchema = z.object({
  name: z.string().min(3).max(160),
  type: z.enum(["LAUNCH", "EDUCATION", "PREDICTIONS", "INVESTOR", "REFERRAL", "SUBSCRIPTION", "HOLIDAY", "BRAND_AWARENESS"]),
  status: z.enum(["DRAFT", "SCHEDULED", "RUNNING", "PAUSED", "COMPLETED", "ARCHIVED"]).default("DRAFT"),
  objective: z.string().min(3).max(1000),
  startDate: z.string().nullable().default(null),
  endDate: z.string().nullable().default(null),
  budgetCents: z.coerce.number().int().min(0).default(0),
});

const postSchema = z.object({
  campaignId: z.string().nullable().default(null),
  title: z.string().min(3).max(220),
  contentType: z.enum([
    "ARTICLE",
    "MATCH_PREVIEW",
    "MATCH_REVIEW",
    "PREDICTION_EXPLANATION",
    "INVESTOR_UPDATE",
    "COMPANY_ANNOUNCEMENT",
    "EDUCATIONAL_POST",
    "PROMOTIONAL_CAMPAIGN",
    "SUBSCRIBER_NEWSLETTER",
  ]),
  status: z.enum(["DRAFT", "REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  body: z.string().min(3).max(8000),
  language: z.string().min(2).max(16).default("en"),
  country: z.string().max(80).nullable().default(null),
  audience: z.string().min(2).max(120).default("General"),
  platforms: z.array(z.enum(["FACEBOOK", "INSTAGRAM", "TIKTOK", "X", "LINKEDIN", "TELEGRAM", "WHATSAPP_CHANNELS", "YOUTUBE_COMMUNITY", "DISCORD"])).default([]),
  scheduledAt: z.string().nullable().default(null),
  timezone: z.string().min(2).max(80).default("UTC"),
  aiGenerated: z.boolean().default(false),
});

const transitionSchema = z.object({
  action: z.enum(["SUBMIT_REVIEW", "APPROVE", "SCHEDULE", "PUBLISH", "ARCHIVE"]),
  scheduledAt: z.string().nullable().optional(),
});

const assetSchema = z.object({
  name: z.string().min(2).max(160),
  assetType: z.enum(["LOGO", "IMAGE", "VIDEO", "DOCUMENT", "TEMPLATE"]),
  url: z.string().url().nullable().default(null),
  metadata: z.record(z.unknown()).default({}),
});

export function createMediaRouter(input: {
  authService: AuthService;
  mediaService: MediaService;
  adminService: AdminService;
}) {
  const router = Router();
  const signedIn = requireAuth(input.authService);
  const editorAccess = [signedIn, requireRole(["ADMIN", "ANALYST"])];
  const adminOnly = [signedIn, requireRole(["ADMIN"])];

  router.get("/admin/media/dashboard", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json(await input.mediaService.dashboard());
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/media/providers", ...adminOnly, async (_request, response, next) => {
    try {
      const dashboard = await input.mediaService.dashboard();
      response.status(200).json({ providers: dashboard.platformHealth });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/media/campaigns", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ campaigns: await input.mediaService.campaigns() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/media/campaigns", ...adminOnly, async (request, response, next) => {
    try {
      const body = campaignSchema.parse(request.body);
      const campaign = await input.mediaService.createCampaign({
        name: body.name,
        type: body.type,
        status: body.status,
        objective: body.objective,
        startDate: body.startDate,
        endDate: body.endDate,
        budgetCents: body.budgetCents,
      });
      await input.adminService.audit(request.user!.id, "MEDIA_CAMPAIGN_CREATED", "MEDIA_CAMPAIGN", campaign.id);
      response.status(201).json({ campaign });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/media/posts", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ posts: await input.mediaService.posts() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/media/posts", ...editorAccess, async (request, response, next) => {
    try {
      const body = postSchema.parse(request.body);
      const post = await input.mediaService.createPost({
        campaignId: body.campaignId,
        title: body.title,
        contentType: body.contentType,
        status: body.status,
        body: body.body,
        language: body.language,
        country: body.country,
        audience: body.audience,
        platforms: body.platforms,
        scheduledAt: body.scheduledAt,
        timezone: body.timezone,
        aiGenerated: body.aiGenerated,
        createdByUserId: request.user!.id,
      });
      await input.adminService.audit(request.user!.id, "MEDIA_POST_CREATED", "MEDIA_POST", post.id);
      response.status(201).json({ post });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/media/posts/:id", ...adminOnly, async (request, response, next) => {
    try {
      const body = transitionSchema.parse(request.body);
      const post = await input.mediaService.transitionPost(request.params.id, {
        action: body.action,
        actorUserId: request.user!.id,
        scheduledAt: body.scheduledAt,
      });
      await input.adminService.audit(request.user!.id, `MEDIA_POST_${body.action}`, "MEDIA_POST", post.id);
      response.status(200).json({ post });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/media/calendar", ...adminOnly, async (_request, response, next) => {
    try {
      const posts = await input.mediaService.posts();
      response.status(200).json({ posts: posts.filter((post) => ["SCHEDULED", "PUBLISHED"].includes(post.status)) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/media/assets", ...adminOnly, async (_request, response, next) => {
    try {
      response.status(200).json({ assets: await input.mediaService.assets() });
    } catch (error) {
      next(error);
    }
  });

  router.post("/admin/media/assets", ...adminOnly, async (request, response, next) => {
    try {
      const body = assetSchema.parse(request.body);
      const asset = await input.mediaService.createAsset({
        name: body.name,
        assetType: body.assetType,
        url: body.url,
        metadata: body.metadata,
      });
      await input.adminService.audit(request.user!.id, "MEDIA_ASSET_CREATED", "MEDIA_ASSET", asset.id);
      response.status(201).json({ asset });
    } catch (error) {
      next(error);
    }
  });

  router.get("/admin/media/analytics", ...adminOnly, async (_request, response, next) => {
    try {
      const dashboard = await input.mediaService.dashboard();
      response.status(200).json({ analytics: dashboard.performance });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
