import crypto from "node:crypto";
import type { MediaAnalytics, MediaAsset, MediaCampaign, MediaDashboard, MediaPost } from "@fpf/shared";
import { getPrismaClient, isDatabaseUrlConfigured } from "../database/prismaClient.js";
import { aiContentProviders, socialPublishingProviders } from "./providers.js";
import type { MediaAssetInput, MediaCampaignInput, MediaPostInput, MediaPostUpdateInput, MediaRepository } from "./types.js";

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function jsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function jsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

const emptyAnalytics: MediaAnalytics = {
  views: 0,
  clicks: 0,
  ctr: 0,
  conversions: 0,
  subscriptions: 0,
  investorSignups: 0,
  revenueAttributionCents: 0,
  campaignRoi: 0,
  growthTrends: [],
};

export class InMemoryMediaRepository implements MediaRepository {
  private campaigns: MediaCampaign[] = [];
  private posts: MediaPost[] = [];
  private assets: MediaAsset[] = [
    { id: "asset_logo", name: "Official FPF Logo", assetType: "LOGO", url: null, metadata: { placeholder: true }, createdAt: nowIso() },
  ];

  async dashboard(): Promise<MediaDashboard> {
    const campaigns = await this.listCampaigns();
    const posts = await this.listPosts();
    const assets = await this.listAssets();
    return {
      campaignOverview: {
        total: campaigns.length,
        running: campaigns.filter((campaign) => campaign.status === "RUNNING").length,
        scheduled: campaigns.filter((campaign) => campaign.status === "SCHEDULED").length,
      },
      scheduledPosts: posts.filter((post) => post.status === "SCHEDULED").length,
      publishedPosts: posts.filter((post) => post.status === "PUBLISHED").length,
      drafts: posts.filter((post) => post.status === "DRAFT").length,
      aiGeneratedContent: posts.filter((post) => post.aiGenerated).length,
      approvalQueue: posts.filter((post) => post.status === "REVIEW").length,
      performance: emptyAnalytics,
      engagementSummary: "Engagement analytics are placeholders until social providers are connected.",
      audienceGrowth: 0,
      clickTracking: 0,
      conversionTracking: 0,
      platformHealth: [...aiContentProviders(), ...socialPublishingProviders()].map((provider) => provider.status()),
      campaigns,
      posts,
      assets,
    };
  }

  async listCampaigns() {
    return this.campaigns;
  }

  async createCampaign(input: MediaCampaignInput) {
    const createdAt = nowIso();
    const campaign: MediaCampaign = { id: id("campaign"), ...input, createdAt, updatedAt: createdAt };
    this.campaigns.unshift(campaign);
    return campaign;
  }

  async listPosts() {
    return this.posts;
  }

  async createPost(input: MediaPostInput) {
    const createdAt = nowIso();
    const post: MediaPost = {
      id: id("post"),
      ...input,
      approvedByUserId: null,
      publishedAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    this.posts.unshift(post);
    return post;
  }

  async updatePost(postId: string, input: MediaPostUpdateInput) {
    const post = this.posts.find((item) => item.id === postId);
    if (!post) throw new Error("Post not found");
    Object.assign(post, { ...input, updatedAt: nowIso() });
    return post;
  }

  async listAssets() {
    return this.assets;
  }

  async createAsset(input: MediaAssetInput) {
    const asset: MediaAsset = { id: id("asset"), ...input, createdAt: nowIso() };
    this.assets.unshift(asset);
    return asset;
  }
}

export class PrismaMediaRepository implements MediaRepository {
  private readonly prisma = isDatabaseUrlConfigured() ? getPrismaClient() : null;
  private readonly fallback = new InMemoryMediaRepository();

  private async safe<T>(operation: () => Promise<T>, fallback: () => Promise<T>) {
    if (!this.prisma) return fallback();
    try {
      return await operation();
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2021") {
        console.warn("MEDIA_TABLE_FALLBACK", { message: error instanceof Error ? error.message : "Missing media table" });
        return fallback();
      }
      throw error;
    }
  }

  async dashboard() {
    const fallback = () => this.fallback.dashboard();
    return this.safe(async () => {
      const campaigns = await this.listCampaigns();
      const posts = await this.listPosts();
      const assets = await this.listAssets();
      return {
        campaignOverview: {
          total: campaigns.length,
          running: campaigns.filter((campaign) => campaign.status === "RUNNING").length,
          scheduled: campaigns.filter((campaign) => campaign.status === "SCHEDULED").length,
        },
        scheduledPosts: posts.filter((post) => post.status === "SCHEDULED").length,
        publishedPosts: posts.filter((post) => post.status === "PUBLISHED").length,
        drafts: posts.filter((post) => post.status === "DRAFT").length,
        aiGeneratedContent: posts.filter((post) => post.aiGenerated).length,
        approvalQueue: posts.filter((post) => post.status === "REVIEW").length,
        performance: emptyAnalytics,
        engagementSummary: "Engagement analytics are placeholders until social providers are connected.",
        audienceGrowth: 0,
        clickTracking: 0,
        conversionTracking: 0,
        platformHealth: [...aiContentProviders(), ...socialPublishingProviders()].map((provider) => provider.status()),
        campaigns,
        posts,
        assets,
      };
    }, fallback);
  }

  async listCampaigns() {
    return this.safe(async () => {
      const rows = await this.prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM "campaigns" ORDER BY "updatedAt" DESC LIMIT 100`);
      return rows.map((row): MediaCampaign => ({
        id: String(row.id),
        name: String(row.name),
        type: row.type as MediaCampaign["type"],
        status: row.status as MediaCampaign["status"],
        objective: String(row.objective ?? ""),
        startDate: row.startDate ? new Date(row.startDate as string).toISOString() : null,
        endDate: row.endDate ? new Date(row.endDate as string).toISOString() : null,
        budgetCents: Number(row.budgetCents ?? 0),
        createdAt: new Date(row.createdAt as string).toISOString(),
        updatedAt: new Date(row.updatedAt as string).toISOString(),
      }));
    }, () => this.fallback.listCampaigns());
  }

  async createCampaign(input: MediaCampaignInput) {
    return this.safe(async () => {
      const campaign = await this.fallback.createCampaign(input);
      await this.prisma!.$executeRawUnsafe(
        `INSERT INTO "campaigns" ("id","name","type","status","objective","startDate","endDate","budgetCents") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        campaign.id,
        campaign.name,
        campaign.type,
        campaign.status,
        campaign.objective,
        campaign.startDate ? new Date(campaign.startDate) : null,
        campaign.endDate ? new Date(campaign.endDate) : null,
        campaign.budgetCents,
      );
      return campaign;
    }, () => this.fallback.createCampaign(input));
  }

  async listPosts() {
    return this.safe(async () => {
      const rows = await this.prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM "posts" ORDER BY "updatedAt" DESC LIMIT 200`);
      return rows.map((row): MediaPost => ({
        id: String(row.id),
        campaignId: row.campaignId ? String(row.campaignId) : null,
        title: String(row.title),
        contentType: row.contentType as MediaPost["contentType"],
        status: row.status as MediaPost["status"],
        body: String(row.body ?? ""),
        language: String(row.language ?? "en"),
        country: row.country ? String(row.country) : null,
        audience: String(row.audience ?? "General"),
        platforms: jsonArray<MediaPost["platforms"][number]>(row.platforms),
        scheduledAt: row.scheduledAt ? new Date(row.scheduledAt as string).toISOString() : null,
        timezone: String(row.timezone ?? "UTC"),
        createdByUserId: String(row.createdByUserId),
        approvedByUserId: row.approvedByUserId ? String(row.approvedByUserId) : null,
        publishedAt: row.publishedAt ? new Date(row.publishedAt as string).toISOString() : null,
        aiGenerated: Boolean(row.aiGenerated),
        createdAt: new Date(row.createdAt as string).toISOString(),
        updatedAt: new Date(row.updatedAt as string).toISOString(),
      }));
    }, () => this.fallback.listPosts());
  }

  async createPost(input: MediaPostInput) {
    return this.safe(async () => {
      const post = await this.fallback.createPost(input);
      await this.prisma!.$executeRawUnsafe(
        `INSERT INTO "posts" ("id","campaignId","title","contentType","status","body","language","country","audience","platforms","scheduledAt","timezone","createdByUserId","aiGenerated") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14)`,
        post.id,
        post.campaignId,
        post.title,
        post.contentType,
        post.status,
        post.body,
        post.language,
        post.country,
        post.audience,
        JSON.stringify(post.platforms),
        post.scheduledAt ? new Date(post.scheduledAt) : null,
        post.timezone,
        post.createdByUserId,
        post.aiGenerated,
      );
      return post;
    }, () => this.fallback.createPost(input));
  }

  async updatePost(postId: string, input: MediaPostUpdateInput) {
    return this.safe(async () => {
      await this.prisma!.$executeRawUnsafe(
        `UPDATE "posts" SET "status" = COALESCE($2, "status"), "scheduledAt" = COALESCE($3, "scheduledAt"), "approvedByUserId" = COALESCE($4, "approvedByUserId"), "publishedAt" = COALESCE($5, "publishedAt"), "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
        postId,
        input.status ?? null,
        input.scheduledAt ? new Date(input.scheduledAt) : null,
        input.approvedByUserId ?? null,
        input.publishedAt ? new Date(input.publishedAt) : null,
      );
      const post = (await this.listPosts()).find((item) => item.id === postId);
      if (!post) throw new Error("Post not found");
      return post;
    }, () => this.fallback.updatePost(postId, input));
  }

  async listAssets() {
    return this.safe(async () => {
      const rows = await this.prisma!.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM "content_assets" ORDER BY "createdAt" DESC LIMIT 100`);
      return rows.map((row): MediaAsset => ({
        id: String(row.id),
        name: String(row.name),
        assetType: row.assetType as MediaAsset["assetType"],
        url: row.url ? String(row.url) : null,
        metadata: jsonObject(row.metadata),
        createdAt: new Date(row.createdAt as string).toISOString(),
      }));
    }, () => this.fallback.listAssets());
  }

  async createAsset(input: MediaAssetInput) {
    return this.safe(async () => {
      const asset = await this.fallback.createAsset(input);
      await this.prisma!.$executeRawUnsafe(
        `INSERT INTO "content_assets" ("id","name","assetType","url","metadata") VALUES ($1,$2,$3,$4,$5::jsonb)`,
        asset.id,
        asset.name,
        asset.assetType,
        asset.url,
        JSON.stringify(asset.metadata),
      );
      return asset;
    }, () => this.fallback.createAsset(input));
  }
}
