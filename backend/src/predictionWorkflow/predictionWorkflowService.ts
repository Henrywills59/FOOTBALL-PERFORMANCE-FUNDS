import type {
  DecisionEngineOutput,
  PredictionLifecycleStatus,
  PredictionQueueItem,
  PredictionWorkflowAction,
  PredictionWorkflowQueue,
} from "@fpf/shared";
import type { DecisionEngineService } from "../intelligence/decision/decisionService.js";
import type { PredictionNotificationService } from "./notificationService.js";
import type { PredictionWorkflowFilters, PredictionWorkflowRepository } from "./types.js";
import { statusBucket } from "./workflowRules.js";

function emptySummary() {
  return {
    pending: 0,
    approved: 0,
    rejected: 0,
    published: 0,
    draft: 0,
    expired: 0,
    archived: 0,
  };
}

function summarize(items: PredictionQueueItem[]) {
  const summary = emptySummary();
  for (const item of items) {
    summary[statusBucket(item.status)] += 1;
  }
  return summary;
}

export class PredictionWorkflowService {
  constructor(
    private readonly repository: PredictionWorkflowRepository,
    private readonly decisionEngineService: DecisionEngineService,
    private readonly notificationService: PredictionNotificationService,
  ) {}

  async listQueue(filters: PredictionWorkflowFilters): Promise<PredictionWorkflowQueue> {
    await this.refreshFromDecisionEngine();
    const items = await this.repository.listQueue(filters);
    return {
      items,
      summary: summarize(items),
    };
  }

  async createCandidateFromDecision(fixtureId: string) {
    const decision = await this.decisionEngineService.evaluateMatch(fixtureId);
    return this.createCandidate(decision);
  }

  async createCandidate(decision: DecisionEngineOutput) {
    const item = await this.repository.upsertCandidate(decision);
    await this.notificationService.notify({
      channel: "IN_APP",
      queueItemId: item.id,
      event: "PREDICTION_CANDIDATE_READY",
      payload: { status: item.status, priority: item.priority },
    });
    return item;
  }

  async applyAction(id: string, actorUserId: string, action: PredictionWorkflowAction, input: { reason?: string | null; notes?: string | null }) {
    const item = await this.repository.applyAction(id, {
      actorUserId,
      action,
      reason: input.reason,
      notes: input.notes,
    });
    if (item) {
      await this.notificationService.notify({
        channel: "IN_APP",
        queueItemId: item.id,
        event: `PREDICTION_${action}`,
        payload: { status: item.status },
      });
    }
    return item;
  }

  async publishedForSubscribers() {
    return this.repository.listPublished();
  }

  async refreshFromDecisionEngine(limit = 20) {
    const decisions = await this.decisionEngineService.getOpportunities(limit);
    await Promise.all(decisions.map((decision) => this.repository.upsertCandidate(decision)));
    return decisions.length;
  }

  async getQueueItem(id: string) {
    return this.repository.getQueueItem(id);
  }

  validStatus(value?: string): PredictionLifecycleStatus | undefined {
    if (
      value &&
      ["NEW", "ANALYZING", "PENDING_REVIEW", "UNDER_REVIEW", "APPROVED", "REJECTED", "PUBLISHED", "EXPIRED", "ARCHIVED"].includes(value)
    ) {
      return value as PredictionLifecycleStatus;
    }
    return undefined;
  }
}
