import type { DecisionEngineOutput, PredictionQueueItem } from "@fpf/shared";
import type {
  PredictionWorkflowActionInput,
  PredictionWorkflowFilters,
  PredictionWorkflowRepository,
} from "./types.js";
import { priorityFromDecision, suggestedStatus } from "./workflowRules.js";

function nextStatus(action: PredictionWorkflowActionInput["action"], previous: PredictionQueueItem["status"]) {
  if (action === "APPROVE") return "APPROVED";
  if (action === "REJECT") return "REJECTED";
  if (action === "SAVE_DRAFT") return "NEW";
  if (action === "REQUEST_REVIEW") return "PENDING_REVIEW";
  if (action === "PUBLISH") return "PUBLISHED";
  if (action === "ARCHIVE") return "ARCHIVED";
  if (action === "RESTORE") return "PENDING_REVIEW";
  return previous;
}

export class InMemoryPredictionWorkflowRepository implements PredictionWorkflowRepository {
  items = new Map<string, PredictionQueueItem>();

  async upsertCandidate(decision: DecisionEngineOutput): Promise<PredictionQueueItem> {
    const now = new Date().toISOString();
    const id = `decision:${decision.fixtureId}`;
    const existing = this.items.get(id);
    const item: PredictionQueueItem = {
      id,
      fixtureId: decision.fixtureId,
      match: decision.match,
      league: decision.league,
      kickoffTime: decision.kickoffTime,
      recommendedMarket: decision.recommendedMarket,
      predictedOutcome: decision.predictedOutcome,
      confidenceScore: decision.scores.confidenceScore,
      riskScore: decision.scores.riskScore,
      opportunityScore: decision.scores.opportunityScore,
      valueScore: decision.scores.valueScore,
      priority: priorityFromDecision(decision),
      status: existing?.status ?? suggestedStatus(decision),
      predictionType: "AI_DECISION",
      explanation: decision.reasoning.join(" "),
      reasoning: decision.reasoning,
      warnings: decision.warnings,
      analystNotes: existing?.analystNotes ?? null,
      flags: existing?.flags ?? [],
      featured: existing?.featured ?? false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      publishedAt: existing?.publishedAt ?? null,
      archivedAt: existing?.archivedAt ?? null,
    };
    this.items.set(id, item);
    return item;
  }

  async listQueue(filters: PredictionWorkflowFilters): Promise<PredictionQueueItem[]> {
    const items = Array.from(this.items.values()).filter((item) => (filters.status ? item.status === filters.status : true));
    const sort = filters.sort ?? "priority";
    return items.sort((a, b) => {
      if (sort === "league") return a.league.localeCompare(b.league);
      if (sort === "kickoffTime") return (a.kickoffTime ?? "").localeCompare(b.kickoffTime ?? "");
      if (sort === "confidence") return b.confidenceScore - a.confidenceScore;
      if (sort === "risk") return a.riskScore - b.riskScore;
      if (sort === "predictionType") return a.predictionType.localeCompare(b.predictionType);
      return b.priority - a.priority;
    });
  }

  async getQueueItem(id: string): Promise<PredictionQueueItem | null> {
    return this.items.get(id) ?? null;
  }

  async applyAction(id: string, input: PredictionWorkflowActionInput): Promise<PredictionQueueItem | null> {
    const item = this.items.get(id);
    if (!item) return null;
    const flag = input.action === "FLAG_HIGH_RISK" ? "HIGH_RISK" : input.action === "FLAG_HIGH_OPPORTUNITY" ? "HIGH_OPPORTUNITY" : null;
    const updated: PredictionQueueItem = {
      ...item,
      status: nextStatus(input.action, item.status),
      analystNotes: input.notes ?? item.analystNotes,
      flags: flag && !item.flags.includes(flag) ? [...item.flags, flag] : item.flags,
      featured: input.action === "MARK_FEATURED" ? true : item.featured,
      updatedAt: new Date().toISOString(),
      publishedAt: nextStatus(input.action, item.status) === "PUBLISHED" ? new Date().toISOString() : item.publishedAt,
      archivedAt: input.action === "ARCHIVE" ? new Date().toISOString() : input.action === "RESTORE" ? null : item.archivedAt,
    };
    this.items.set(id, updated);
    return updated;
  }

  async listPublished(): Promise<PredictionQueueItem[]> {
    return this.listQueue({ status: "PUBLISHED", sort: "priority" });
  }
}
