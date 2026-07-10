import type { MediaContentStatus } from "@fpf/shared";
import type { MediaAssetInput, MediaCampaignInput, MediaPostInput, MediaRepository } from "./types.js";

type MediaTransitionAction = "SUBMIT_REVIEW" | "APPROVE" | "SCHEDULE" | "PUBLISH" | "ARCHIVE";

export class MediaService {
  constructor(private readonly repository: MediaRepository) {}

  dashboard() {
    return this.repository.dashboard();
  }

  campaigns() {
    return this.repository.listCampaigns();
  }

  createCampaign(input: MediaCampaignInput) {
    return this.repository.createCampaign(input);
  }

  posts() {
    return this.repository.listPosts();
  }

  createPost(input: MediaPostInput) {
    return this.repository.createPost(input);
  }

  async transitionPost(postId: string, input: { action: MediaTransitionAction; actorUserId: string; scheduledAt?: string | null }) {
    const now = new Date().toISOString();
    const statusByAction: Record<MediaTransitionAction, MediaContentStatus> = {
      SUBMIT_REVIEW: "REVIEW",
      APPROVE: "APPROVED",
      SCHEDULE: "SCHEDULED",
      PUBLISH: "PUBLISHED",
      ARCHIVE: "ARCHIVED",
    };

    return this.repository.updatePost(postId, {
      status: statusByAction[input.action],
      approvedByUserId: ["APPROVE", "SCHEDULE", "PUBLISH"].includes(input.action) ? input.actorUserId : undefined,
      scheduledAt: input.action === "SCHEDULE" ? input.scheduledAt ?? now : undefined,
      publishedAt: input.action === "PUBLISH" ? now : undefined,
    });
  }

  assets() {
    return this.repository.listAssets();
  }

  createAsset(input: MediaAssetInput) {
    return this.repository.createAsset(input);
  }
}
