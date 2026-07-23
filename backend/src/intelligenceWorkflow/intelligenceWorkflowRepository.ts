import { Prisma, PrismaClient } from "@prisma/client";
import type {
  AiIntelligenceRecord,
  AiIntelligenceReview,
  AiIntelligenceStatus,
  BettingLedgerEntry,
  CompanyBet,
  IntelligenceExecutiveSummary,
  SubscriberIntelligence,
  SubscriberPublication,
} from "@fpf/shared";
import { getPrismaClient } from "../database/prismaClient.js";
import { isPrismaRecoverableReadError, logOptionalDataFallback } from "../database/prismaErrors.js";
import type {
  BettingLedgerFilters,
  CompanyBetFilters,
  CreateAiIntelligenceInput,
  IntelligenceListFilters,
  IntelligenceWorkflowRepository,
  SettleBettingLedgerInput,
  UpdateCompanyBetInput,
  UpdateSubscriberPublicationInput,
} from "./types.js";

function toIso(value?: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

type AiIntelligenceRow = {
  id: string;
  fixtureId: string;
  matchLabel: string;
  leagueName: string;
  kickoffAt: Date | null;
  source: string;
  scanStatus: string;
  confidenceScore: number;
  riskScore: number;
  valueScore: number;
  opportunityScore: number;
  recommendedMarket: string;
  predictedOutcome: string;
  reasoningSummary: string;
  supportingMetrics: unknown;
  riskFactors: unknown;
  alternativeMarkets: unknown;
  operationsNotes: string | null;
  subscriberSummary: string | null;
  dataQualityStatus: string;
  decisionEngineRunId: string | null;
  createdByUserId: string | null;
  lastReviewedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  expiresAt: Date | null;
};

type ReviewRow = {
  id: string;
  intelligenceId: string;
  reviewerUserId: string | null;
  decision: string;
  previousStatus: string;
  nextStatus: string;
  notes: string | null;
  createdAt: Date;
};

type PublicationRow = {
  id: string;
  intelligenceId: string;
  status: string;
  title: string;
  summary: string;
  recommendedMarket: string;
  predictedOutcome: string;
  confidenceScore: number;
  riskScore: number;
  valueScore: number;
  opportunityScore: number;
  riskGrade: string;
  visibleFrom: Date | null;
  publishedAt: Date | null;
  withdrawnAt: Date | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CompanyBetRow = {
  id: string;
  intelligenceId: string;
  status: string;
  market: string;
  selection: string;
  requestedStakeCents: number;
  approvedStakeCents: number;
  currency: string;
  targetOdds: number | null;
  finalOdds: number | null;
  bookmaker: string | null;
  exposureCents: number;
  maxLossCents: number;
  expectedReturnCents: number;
  riskGrade: string;
  approvedByUserId: string | null;
  placedByUserId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  placedAt: Date | null;
  cancelledAt: Date | null;
};

type LedgerRow = {
  id: string;
  companyBetId: string;
  fixtureId: string;
  market: string;
  selection: string;
  stakeCents: number;
  currency: string;
  odds: number;
  potentialReturnCents: number;
  settledReturnCents: number;
  profitLossCents: number;
  result: string;
  bookmaker: string | null;
  placedAt: Date | null;
  settledAt: Date | null;
  reconciliationStatus: string;
  externalBetReference: string | null;
  createdByUserId: string | null;
  settledByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toIntelligence(row: AiIntelligenceRow): AiIntelligenceRecord {
  return {
    id: row.id,
    fixtureId: row.fixtureId,
    matchLabel: row.matchLabel,
    leagueName: row.leagueName,
    kickoffAt: toIso(row.kickoffAt),
    source: row.source,
    scanStatus: row.scanStatus as AiIntelligenceStatus,
    confidenceScore: row.confidenceScore,
    riskScore: row.riskScore,
    valueScore: row.valueScore,
    opportunityScore: row.opportunityScore,
    recommendedMarket: row.recommendedMarket,
    predictedOutcome: row.predictedOutcome,
    reasoningSummary: row.reasoningSummary,
    supportingMetrics: asRecord(row.supportingMetrics),
    riskFactors: asStringArray(row.riskFactors),
    alternativeMarkets: asStringArray(row.alternativeMarkets),
    operationsNotes: row.operationsNotes,
    subscriberSummary: row.subscriberSummary,
    dataQualityStatus: row.dataQualityStatus as AiIntelligenceRecord["dataQualityStatus"],
    decisionEngineRunId: row.decisionEngineRunId,
    createdByUserId: row.createdByUserId,
    lastReviewedByUserId: row.lastReviewedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    reviewedAt: toIso(row.reviewedAt),
    expiresAt: toIso(row.expiresAt),
  };
}

function toReview(row: ReviewRow): AiIntelligenceReview {
  return {
    id: row.id,
    intelligenceId: row.intelligenceId,
    reviewerUserId: row.reviewerUserId,
    decision: row.decision as AiIntelligenceReview["decision"],
    previousStatus: row.previousStatus as AiIntelligenceStatus,
    nextStatus: row.nextStatus as AiIntelligenceStatus,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

function toPublication(row: PublicationRow): SubscriberPublication {
  return {
    id: row.id,
    intelligenceId: row.intelligenceId,
    status: row.status as SubscriberPublication["status"],
    title: row.title,
    summary: row.summary,
    recommendedMarket: row.recommendedMarket,
    predictedOutcome: row.predictedOutcome,
    confidenceScore: row.confidenceScore,
    riskScore: row.riskScore,
    valueScore: row.valueScore,
    opportunityScore: row.opportunityScore,
    riskGrade: row.riskGrade,
    visibleFrom: toIso(row.visibleFrom),
    publishedAt: toIso(row.publishedAt),
    withdrawnAt: toIso(row.withdrawnAt),
    createdByUserId: row.createdByUserId,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCompanyBet(row: CompanyBetRow): CompanyBet {
  return {
    id: row.id,
    intelligenceId: row.intelligenceId,
    status: row.status as CompanyBet["status"],
    market: row.market,
    selection: row.selection,
    requestedStakeCents: row.requestedStakeCents,
    approvedStakeCents: row.approvedStakeCents,
    currency: row.currency,
    targetOdds: row.targetOdds,
    finalOdds: row.finalOdds,
    bookmaker: row.bookmaker,
    exposureCents: row.exposureCents,
    maxLossCents: row.maxLossCents,
    expectedReturnCents: row.expectedReturnCents,
    riskGrade: row.riskGrade,
    approvedByUserId: row.approvedByUserId,
    placedByUserId: row.placedByUserId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    approvedAt: toIso(row.approvedAt),
    placedAt: toIso(row.placedAt),
    cancelledAt: toIso(row.cancelledAt),
  };
}

function toLedger(row: LedgerRow): BettingLedgerEntry {
  return {
    id: row.id,
    companyBetId: row.companyBetId,
    fixtureId: row.fixtureId,
    market: row.market,
    selection: row.selection,
    stakeCents: row.stakeCents,
    currency: row.currency,
    odds: row.odds,
    potentialReturnCents: row.potentialReturnCents,
    settledReturnCents: row.settledReturnCents,
    profitLossCents: row.profitLossCents,
    result: row.result as BettingLedgerEntry["result"],
    bookmaker: row.bookmaker,
    placedAt: toIso(row.placedAt),
    settledAt: toIso(row.settledAt),
    reconciliationStatus: row.reconciliationStatus,
    externalBetReference: row.externalBetReference,
    createdByUserId: row.createdByUserId,
    settledByUserId: row.settledByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function riskGrade(riskScore: number) {
  if (riskScore >= 70) return "HIGH";
  if (riskScore >= 40) return "MEDIUM";
  return "LOW";
}

export class PrismaIntelligenceWorkflowRepository implements IntelligenceWorkflowRepository {
  constructor(private readonly prismaClient?: PrismaClient) {}

  private get prisma() {
    return this.prismaClient ?? getPrismaClient();
  }

  async createIntelligence(input: CreateAiIntelligenceInput): Promise<AiIntelligenceRecord> {
    const created = await this.prisma.aiIntelligence.create({
      data: {
        fixtureId: input.fixtureId,
        matchLabel: input.matchLabel,
        leagueName: input.leagueName,
        kickoffAt: input.kickoffAt ? new Date(input.kickoffAt) : null,
        scanStatus: "REQUIRES_REVIEW",
        confidenceScore: input.confidenceScore,
        riskScore: input.riskScore,
        valueScore: input.valueScore,
        opportunityScore: input.opportunityScore,
        recommendedMarket: input.recommendedMarket,
        predictedOutcome: input.predictedOutcome,
        reasoningSummary: input.reasoningSummary,
        supportingMetrics: (input.supportingMetrics ?? {}) as Prisma.InputJsonValue,
        riskFactors: (input.riskFactors ?? []) as Prisma.InputJsonValue,
        alternativeMarkets: (input.alternativeMarkets ?? []) as Prisma.InputJsonValue,
        subscriberSummary: input.subscriberSummary ?? null,
        dataQualityStatus: input.dataQualityStatus ?? "INSUFFICIENT_DATA",
        decisionEngineRunId: input.decisionEngineRunId ?? null,
        createdByUserId: input.createdByUserId ?? null,
      },
    });
    return toIntelligence(created);
  }

  async listIntelligence(filters: IntelligenceListFilters): Promise<AiIntelligenceRecord[]> {
    try {
      const rows = await this.prisma.aiIntelligence.findMany({
        where: filters.status ? { scanStatus: filters.status } : undefined,
        orderBy: { createdAt: "desc" },
        take: filters.limit ?? 50,
      });
      return rows.map(toIntelligence);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("intelligenceWorkflow.listIntelligence", error);
      return [];
    }
  }

  async getIntelligence(id: string): Promise<AiIntelligenceRecord | null> {
    try {
      const row = await this.prisma.aiIntelligence.findUnique({ where: { id } });
      return row ? toIntelligence(row) : null;
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("intelligenceWorkflow.getIntelligence", error);
      return null;
    }
  }

  async updateIntelligenceStatus(input: {
    id: string;
    status: AiIntelligenceStatus;
    lastReviewedByUserId?: string | null;
    operationsNotes?: string | null;
    reviewedAt?: string | null;
  }): Promise<AiIntelligenceRecord | null> {
    const row = await this.prisma.aiIntelligence.update({
      where: { id: input.id },
      data: {
        scanStatus: input.status,
        lastReviewedByUserId: input.lastReviewedByUserId,
        operationsNotes: input.operationsNotes,
        reviewedAt: input.reviewedAt ? new Date(input.reviewedAt) : null,
      },
    });
    return toIntelligence(row);
  }

  async createReview(input: {
    intelligenceId: string;
    reviewerUserId: string;
    decision: AiIntelligenceReview["decision"];
    previousStatus: AiIntelligenceStatus;
    nextStatus: AiIntelligenceStatus;
    notes?: string | null;
  }): Promise<AiIntelligenceReview> {
    const row = await this.prisma.aiIntelligenceReview.create({
      data: {
        intelligenceId: input.intelligenceId,
        reviewerUserId: input.reviewerUserId,
        decision: input.decision,
        previousStatus: input.previousStatus,
        nextStatus: input.nextStatus,
        notes: input.notes ?? null,
      },
    });
    return toReview(row);
  }

  async listReviews(intelligenceId: string): Promise<AiIntelligenceReview[]> {
    const rows = await this.prisma.aiIntelligenceReview.findMany({ where: { intelligenceId }, orderBy: { createdAt: "desc" } });
    return rows.map(toReview);
  }

  async createSubscriberPublication(input: {
    intelligence: AiIntelligenceRecord;
    actorUserId: string;
    title: string;
    summary: string;
    visibleFrom?: string | null;
  }): Promise<SubscriberPublication> {
    const row = await this.prisma.subscriberPublication.create({
      data: {
        intelligenceId: input.intelligence.id,
        title: input.title,
        summary: input.summary,
        recommendedMarket: input.intelligence.recommendedMarket,
        predictedOutcome: input.intelligence.predictedOutcome,
        confidenceScore: input.intelligence.confidenceScore,
        riskScore: input.intelligence.riskScore,
        valueScore: input.intelligence.valueScore,
        opportunityScore: input.intelligence.opportunityScore,
        riskGrade: riskGrade(input.intelligence.riskScore),
        visibleFrom: input.visibleFrom ? new Date(input.visibleFrom) : null,
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
      },
    });
    return toPublication(row);
  }

  async listSubscriberPublications(status?: SubscriberPublication["status"]): Promise<SubscriberPublication[]> {
    const rows = await this.prisma.subscriberPublication.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map(toPublication);
  }

  async updateSubscriberPublication(id: string, input: UpdateSubscriberPublicationInput): Promise<SubscriberPublication | null> {
    const row = await this.prisma.subscriberPublication.update({
      where: { id },
      data: {
        title: input.title,
        summary: input.summary,
        status: input.status,
        visibleFrom: input.visibleFrom ? new Date(input.visibleFrom) : input.visibleFrom === null ? null : undefined,
        updatedByUserId: input.actorUserId,
        publishedAt: input.status === "PUBLISHED" ? new Date() : undefined,
        withdrawnAt: input.status === "WITHDRAWN" ? new Date() : undefined,
      },
    });
    return toPublication(row);
  }

  async getSubscriberPublication(id: string): Promise<SubscriberPublication | null> {
    const row = await this.prisma.subscriberPublication.findUnique({ where: { id } });
    return row ? toPublication(row) : null;
  }

  async listPublishedSubscriberIntelligence(): Promise<SubscriberIntelligence[]> {
    const rows = await this.prisma.subscriberPublication.findMany({
      where: { status: "PUBLISHED" },
      include: { intelligence: true },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });
    return rows.map((row) => ({
      ...toPublication(row),
      matchLabel: row.intelligence.matchLabel,
      leagueName: row.intelligence.leagueName,
      kickoffAt: toIso(row.intelligence.kickoffAt),
    }));
  }

  async getPublishedSubscriberIntelligence(id: string): Promise<SubscriberIntelligence | null> {
    const row = await this.prisma.subscriberPublication.findFirst({
      where: { id, status: "PUBLISHED" },
      include: { intelligence: true },
    });
    return row
      ? {
          ...toPublication(row),
          matchLabel: row.intelligence.matchLabel,
          leagueName: row.intelligence.leagueName,
          kickoffAt: toIso(row.intelligence.kickoffAt),
        }
      : null;
  }

  async createCompanyBet(input: {
    intelligence: AiIntelligenceRecord;
    actorUserId: string;
    market: string;
    selection: string;
    requestedStakeCents: number;
    currency: string;
    targetOdds?: number | null;
    bookmaker?: string | null;
    notes?: string | null;
  }): Promise<CompanyBet> {
    const row = await this.prisma.companyBet.create({
      data: {
        intelligenceId: input.intelligence.id,
        market: input.market,
        selection: input.selection,
        requestedStakeCents: input.requestedStakeCents,
        currency: input.currency,
        targetOdds: input.targetOdds ?? null,
        bookmaker: input.bookmaker ?? null,
        notes: input.notes ?? null,
        exposureCents: input.requestedStakeCents,
        maxLossCents: input.requestedStakeCents,
        expectedReturnCents: input.targetOdds ? Math.round(input.requestedStakeCents * input.targetOdds) : 0,
        riskGrade: riskGrade(input.intelligence.riskScore),
      },
    });
    return toCompanyBet(row);
  }

  async listCompanyBets(filters: CompanyBetFilters): Promise<CompanyBet[]> {
    const rows = await this.prisma.companyBet.findMany({
      where: filters.status ? { status: filters.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
    });
    return rows.map(toCompanyBet);
  }

  async getCompanyBet(id: string): Promise<CompanyBet | null> {
    const row = await this.prisma.companyBet.findUnique({ where: { id } });
    return row ? toCompanyBet(row) : null;
  }

  async updateCompanyBet(id: string, input: UpdateCompanyBetInput & { status?: CompanyBet["status"] }): Promise<CompanyBet | null> {
    const status = input.status;
    const row = await this.prisma.companyBet.update({
      where: { id },
      data: {
        status,
        requestedStakeCents: input.requestedStakeCents,
        approvedStakeCents: input.approvedStakeCents,
        currency: input.currency,
        targetOdds: input.targetOdds,
        finalOdds: input.finalOdds,
        bookmaker: input.bookmaker,
        notes: input.notes,
        riskGrade: input.riskGrade,
        exposureCents: input.approvedStakeCents ?? input.requestedStakeCents,
        maxLossCents: input.approvedStakeCents ?? input.requestedStakeCents,
        expectedReturnCents:
          input.approvedStakeCents && (input.finalOdds ?? input.targetOdds)
            ? Math.round(input.approvedStakeCents * (input.finalOdds ?? input.targetOdds)!)
            : undefined,
        approvedByUserId: status === "APPROVED" ? input.actorUserId : undefined,
        placedByUserId: status === "PLACED" ? input.actorUserId : undefined,
        approvedAt: status === "APPROVED" ? new Date() : undefined,
        placedAt: status === "PLACED" ? new Date() : undefined,
        cancelledAt: status === "CANCELLED" ? new Date() : undefined,
      },
    });
    return toCompanyBet(row);
  }

  async createBettingLedger(input: {
    companyBet: CompanyBet;
    intelligence: AiIntelligenceRecord;
    actorUserId: string;
    odds: number;
    stakeCents: number;
    bookmaker?: string | null;
    externalBetReference?: string | null;
  }): Promise<BettingLedgerEntry> {
    const row = await this.prisma.bettingLedgerEntry.create({
      data: {
        companyBetId: input.companyBet.id,
        fixtureId: input.intelligence.fixtureId,
        market: input.companyBet.market,
        selection: input.companyBet.selection,
        stakeCents: input.stakeCents,
        currency: input.companyBet.currency,
        odds: input.odds,
        potentialReturnCents: Math.round(input.stakeCents * input.odds),
        bookmaker: input.bookmaker ?? input.companyBet.bookmaker,
        placedAt: input.companyBet.placedAt ? new Date(input.companyBet.placedAt) : null,
        externalBetReference: input.externalBetReference ?? null,
        createdByUserId: input.actorUserId,
      },
    });
    return toLedger(row);
  }

  async listBettingLedger(filters: BettingLedgerFilters): Promise<BettingLedgerEntry[]> {
    const rows = await this.prisma.bettingLedgerEntry.findMany({
      where: filters.result ? { result: filters.result } : undefined,
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
    });
    return rows.map(toLedger);
  }

  async getBettingLedger(id: string): Promise<BettingLedgerEntry | null> {
    const row = await this.prisma.bettingLedgerEntry.findUnique({ where: { id } });
    return row ? toLedger(row) : null;
  }

  async settleBettingLedger(
    id: string,
    input: SettleBettingLedgerInput & { profitLossCents: number; settledReturnCents: number },
  ): Promise<BettingLedgerEntry | null> {
    const row = await this.prisma.bettingLedgerEntry.update({
      where: { id },
      data: {
        result: input.result,
        settledReturnCents: input.settledReturnCents,
        profitLossCents: input.profitLossCents,
        reconciliationStatus: input.reconciliationStatus,
        settledByUserId: input.actorUserId,
        settledAt: new Date(),
      },
    });
    return toLedger(row);
  }

  async executiveSummary(): Promise<IntelligenceExecutiveSummary> {
    try {
      const [scanned, reviewQueue, approvedForSubscribers, publishedToSubscribers, companyBetsPending, companyBetsPlaced, ledgerOpen, ledgerRows] =
        await Promise.all([
          this.prisma.aiIntelligence.count(),
          this.prisma.aiIntelligence.count({ where: { scanStatus: "REQUIRES_REVIEW" } }),
          this.prisma.aiIntelligence.count({ where: { scanStatus: { in: ["APPROVED_SUBSCRIBER", "APPROVED_BOTH", "PUBLISHED"] } } }),
          this.prisma.subscriberPublication.count({ where: { status: "PUBLISHED" } }),
          this.prisma.companyBet.count({ where: { status: { in: ["PENDING_APPROVAL", "APPROVED", "READY_TO_PLACE"] } } }),
          this.prisma.companyBet.count({ where: { status: "PLACED" } }),
          this.prisma.bettingLedgerEntry.count({ where: { result: "PENDING" } }),
          this.prisma.bettingLedgerEntry.findMany({ select: { result: true, profitLossCents: true }, take: 1000 }),
        ]);
      const companyBets = await this.prisma.companyBet.findMany({ select: { exposureCents: true }, take: 1000 });
      return {
        scanned,
        reviewQueue,
        approvedForSubscribers,
        publishedToSubscribers,
        companyBetsPending,
        companyBetsPlaced,
        ledgerOpen,
        ledgerSettled: ledgerRows.filter((entry) => entry.result !== "PENDING").length,
        exposureCents: companyBets.reduce((sum, bet) => sum + bet.exposureCents, 0),
        profitLossCents: ledgerRows.reduce((sum, entry) => sum + entry.profitLossCents, 0),
      };
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("intelligenceWorkflow.executiveSummary", error);
      return {
        scanned: 0,
        reviewQueue: 0,
        approvedForSubscribers: 0,
        publishedToSubscribers: 0,
        companyBetsPending: 0,
        companyBetsPlaced: 0,
        ledgerOpen: 0,
        ledgerSettled: 0,
        exposureCents: 0,
        profitLossCents: 0,
      };
    }
  }
}
