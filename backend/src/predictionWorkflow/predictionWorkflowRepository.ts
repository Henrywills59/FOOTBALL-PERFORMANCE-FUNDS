import { PrismaClient } from "@prisma/client";
import type {
  DecisionEngineOutput,
  PredictionLifecycleStatus,
  PredictionQueueItem,
  PredictionWorkflowAction,
} from "@fpf/shared";
import { getPrismaClient } from "../database/prismaClient.js";
import { isPrismaRecoverableReadError, logOptionalDataFallback } from "../database/prismaErrors.js";
import type {
  PredictionWorkflowActionInput,
  PredictionWorkflowFilters,
  PredictionWorkflowRepository,
} from "./types.js";
import { priorityFromDecision, suggestedStatus } from "./workflowRules.js";

const systemVersion = process.env.npm_package_version ?? "0.1.0";
const aiVersion = "decision-engine-v1";

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function lifecycle(value: string): PredictionLifecycleStatus {
  if (
    [
      "NEW",
      "ANALYZING",
      "PENDING_REVIEW",
      "UNDER_REVIEW",
      "SENIOR_REVIEW",
      "APPROVED",
      "REJECTED",
      "PUBLISHED",
      "EXPIRED",
      "ARCHIVED",
    ].includes(value)
  ) {
    return value as PredictionLifecycleStatus;
  }
  return "NEW";
}

type QueueRow = {
  id: string;
  fixtureId: string;
  match: string;
  league: string;
  kickoffTime: Date | null;
  recommendedMarket: string;
  predictedOutcome: string;
  confidenceScore: number;
  riskScore: number;
  opportunityScore: number;
  valueScore: number;
  priority: number;
  status: string;
  predictionType: string;
  explanation: string;
  reasoning: unknown;
  warnings: unknown;
  analystNotes: string | null;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  archivedAt: Date | null;
  flags?: Array<{ flag: string }>;
};

function toQueueItem(row: QueueRow): PredictionQueueItem {
  return {
    id: row.id,
    fixtureId: row.fixtureId,
    match: row.match,
    league: row.league,
    kickoffTime: row.kickoffTime?.toISOString() ?? null,
    recommendedMarket: row.recommendedMarket,
    predictedOutcome: row.predictedOutcome,
    confidenceScore: row.confidenceScore,
    riskScore: row.riskScore,
    opportunityScore: row.opportunityScore,
    valueScore: row.valueScore,
    priority: row.priority,
    status: lifecycle(row.status),
    predictionType: row.predictionType,
    explanation: row.explanation,
    reasoning: stringArray(row.reasoning),
    warnings: stringArray(row.warnings),
    analystNotes: row.analystNotes,
    flags: row.flags?.map((flag) => flag.flag) ?? [],
    featured: row.featured,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

function statusForAction(action: PredictionWorkflowAction, previous: PredictionLifecycleStatus): PredictionLifecycleStatus {
  switch (action) {
    case "APPROVE":
      return "APPROVED";
    case "REJECT":
      return "REJECTED";
    case "SAVE_DRAFT":
      return "NEW";
    case "REQUEST_REVIEW":
      return "PENDING_REVIEW";
    case "SENIOR_REVIEW":
      return "SENIOR_REVIEW";
    case "ARCHIVE":
      return "ARCHIVED";
    case "RESTORE":
      return "PENDING_REVIEW";
    case "PUBLISH":
      return "PUBLISHED";
    default:
      return previous;
  }
}

export class PrismaPredictionWorkflowRepository implements PredictionWorkflowRepository {
  constructor(private readonly prismaClient?: PrismaClient) {}

  private get prisma() {
    return this.prismaClient ?? getPrismaClient();
  }

  async upsertCandidate(decision: DecisionEngineOutput): Promise<PredictionQueueItem> {
    try {
      const status = suggestedStatus(decision);
      const item = await this.prisma.predictionQueue.upsert({
        where: { id: `decision:${decision.fixtureId}` },
        update: {
          match: decision.match,
          league: decision.league,
          kickoffTime: decision.kickoffTime ? new Date(decision.kickoffTime) : null,
          recommendedMarket: decision.recommendedMarket,
          predictedOutcome: decision.predictedOutcome,
          confidenceScore: decision.scores.confidenceScore,
          riskScore: decision.scores.riskScore,
          opportunityScore: decision.scores.opportunityScore,
          valueScore: decision.scores.valueScore,
          priority: priorityFromDecision(decision),
          explanation: decision.reasoning.join(" "),
          reasoning: decision.reasoning,
          warnings: decision.warnings,
        },
        create: {
          id: `decision:${decision.fixtureId}`,
          fixtureId: decision.fixtureId,
          decisionId: decision.id,
          match: decision.match,
          league: decision.league,
          kickoffTime: decision.kickoffTime ? new Date(decision.kickoffTime) : null,
          recommendedMarket: decision.recommendedMarket,
          predictedOutcome: decision.predictedOutcome,
          confidenceScore: decision.scores.confidenceScore,
          riskScore: decision.scores.riskScore,
          opportunityScore: decision.scores.opportunityScore,
          valueScore: decision.scores.valueScore,
          priority: priorityFromDecision(decision),
          status,
          explanation: decision.reasoning.join(" "),
          reasoning: decision.reasoning,
          warnings: decision.warnings,
          statusHistory: {
            create: {
              action: "AI_DECISION_CANDIDATE_CREATED",
              previousStatus: null,
              newStatus: status,
              reason: "Created from AI Decision Engine output.",
              systemVersion,
              aiVersion,
            },
          },
        },
        include: { flags: true },
      });
      return toQueueItem(item);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("predictionWorkflow.upsertCandidate", error);
      return {
        id: `decision:${decision.fixtureId}`,
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
        status: suggestedStatus(decision),
        predictionType: "AI_DECISION",
        explanation: decision.reasoning.join(" "),
        reasoning: decision.reasoning,
        warnings: decision.warnings,
        analystNotes: null,
        flags: [],
        featured: false,
        createdAt: decision.generatedAt,
        updatedAt: decision.generatedAt,
        publishedAt: null,
        archivedAt: null,
      };
    }
  }

  async listQueue(filters: PredictionWorkflowFilters): Promise<PredictionQueueItem[]> {
    try {
      const items = await this.prisma.predictionQueue.findMany({
        where: filters.status ? { status: filters.status } : undefined,
        include: { flags: true },
        orderBy: this.orderBy(filters.sort),
        take: 100,
      });
      return items.map(toQueueItem);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("predictionWorkflow.listQueue", error);
      return [];
    }
  }

  async getQueueItem(id: string): Promise<PredictionQueueItem | null> {
    try {
      const item = await this.prisma.predictionQueue.findUnique({ where: { id }, include: { flags: true } });
      return item ? toQueueItem(item) : null;
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("predictionWorkflow.getQueueItem", error);
      return null;
    }
  }

  async applyAction(id: string, input: PredictionWorkflowActionInput): Promise<PredictionQueueItem | null> {
    try {
      const current = await this.prisma.predictionQueue.findUnique({ where: { id }, include: { flags: true } });
      if (!current) return null;
      const previousStatus = lifecycle(current.status);
      const nextStatus = statusForAction(input.action, previousStatus);
      const flag = input.action === "FLAG_HIGH_RISK" ? "HIGH_RISK" : input.action === "FLAG_HIGH_OPPORTUNITY" ? "HIGH_OPPORTUNITY" : null;

      const updated = await this.prisma.predictionQueue.update({
        where: { id },
        data: {
          status: nextStatus,
          analystNotes: input.notes ?? current.analystNotes,
          featured: input.action === "MARK_FEATURED" ? true : current.featured,
          publishedAt: nextStatus === "PUBLISHED" ? new Date() : current.publishedAt,
          archivedAt: nextStatus === "ARCHIVED" ? new Date() : input.action === "RESTORE" ? null : current.archivedAt,
          flags: flag
            ? {
                upsert: {
                  where: { queueItemId_flag: { queueItemId: id, flag } },
                  update: {},
                  create: { flag, createdById: input.actorUserId },
                },
              }
            : undefined,
          notes: input.notes ? { create: { note: input.notes, userId: input.actorUserId } } : undefined,
          reviews: ["APPROVE", "REJECT", "REQUEST_REVIEW", "SENIOR_REVIEW", "SAVE_DRAFT"].includes(input.action)
            ? { create: { reviewerId: input.actorUserId, status: nextStatus, notes: input.notes } }
            : undefined,
          publications: nextStatus === "PUBLISHED" ? { create: { channel: "SUBSCRIBER_PORTAL" } } : undefined,
          statusHistory: {
            create: {
              userId: input.actorUserId,
              action: input.action,
              previousStatus,
              newStatus: nextStatus,
              reason: input.reason,
              notes: input.notes,
              systemVersion,
              aiVersion,
            },
          },
        },
        include: { flags: true },
      });

      return toQueueItem(updated);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("predictionWorkflow.applyAction", error);
      return null;
    }
  }

  async listPublished(): Promise<PredictionQueueItem[]> {
    return this.listQueue({ status: "PUBLISHED", sort: "priority" });
  }

  private orderBy(sort: PredictionWorkflowFilters["sort"]) {
    if (sort === "league") return { league: "asc" as const };
    if (sort === "kickoffTime") return { kickoffTime: "asc" as const };
    if (sort === "confidence") return { confidenceScore: "desc" as const };
    if (sort === "risk") return { riskScore: "asc" as const };
    if (sort === "predictionType") return { predictionType: "asc" as const };
    return { priority: "desc" as const };
  }
}
