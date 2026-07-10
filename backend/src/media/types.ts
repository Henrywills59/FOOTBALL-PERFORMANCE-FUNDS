import type { MediaAsset, MediaCampaign, MediaCampaignStatus, MediaCampaignType, MediaContentStatus, MediaContentType, MediaDashboard, MediaPlatform, MediaPost } from "@fpf/shared";

export type MediaCampaignInput = {
  name: string;
  type: MediaCampaignType;
  status: MediaCampaignStatus;
  objective: string;
  startDate: string | null;
  endDate: string | null;
  budgetCents: number;
};

export type MediaPostInput = {
  campaignId: string | null;
  title: string;
  contentType: MediaContentType;
  status: MediaContentStatus;
  body: string;
  language: string;
  country: string | null;
  audience: string;
  platforms: MediaPlatform[];
  scheduledAt: string | null;
  timezone: string;
  aiGenerated: boolean;
  createdByUserId: string;
};

export type MediaPostUpdateInput = {
  status?: MediaContentStatus;
  scheduledAt?: string | null;
  approvedByUserId?: string | null;
  publishedAt?: string | null;
};

export type MediaAssetInput = {
  name: string;
  assetType: MediaAsset["assetType"];
  url: string | null;
  metadata: Record<string, unknown>;
};

export interface MediaRepository {
  dashboard(): Promise<MediaDashboard>;
  listCampaigns(): Promise<MediaCampaign[]>;
  createCampaign(input: MediaCampaignInput): Promise<MediaCampaign>;
  listPosts(): Promise<MediaPost[]>;
  createPost(input: MediaPostInput): Promise<MediaPost>;
  updatePost(id: string, input: MediaPostUpdateInput): Promise<MediaPost>;
  listAssets(): Promise<MediaAsset[]>;
  createAsset(input: MediaAssetInput): Promise<MediaAsset>;
}
