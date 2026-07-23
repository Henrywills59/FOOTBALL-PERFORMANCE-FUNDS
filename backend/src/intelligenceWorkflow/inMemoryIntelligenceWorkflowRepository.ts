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

function id(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

function now() {
  return new Date().toISOString();
}

function riskGrade(riskScore: number) {
  if (riskScore >= 70) return "HIGH";
  if (riskScore >= 40) return "MEDIUM";
  return "LOW";
}

function asArray(value?: string[]) {
  return Array.isArray(value) ? value : [];
}

export class InMemoryIntelligenceWorkflowRepository implements IntelligenceWorkflowRepository {
  intelligence = new Map<string, AiIntelligenceRecord>();
  reviews = new Map<string, AiIntelligenceReview>();
  publications = new Map<string, SubscriberPublication>();
  companyBets = new Map<string, CompanyBet>();
  ledger = new Map<string, BettingLedgerEntry>();

  async createIntelligence(input: CreateAiIntelligenceInput): Promise<AiIntelligenceRecord> {
    const createdAt = now();
    const record: AiIntelligenceRecord = {
      id: id("intel"),
      fixtureId: input.fixtureId,
      matchLabel: input.matchLabel,
      leagueName: input.leagueName,
      kickoffAt: input.kickoffAt ?? null,
      source: "AI_DECISION_ENGINE",
      scanStatus: "REQUIRES_REVIEW",
      confidenceScore: input.confidenceScore,
      riskScore: input.riskScore,
      valueScore: input.valueScore,
      opportunityScore: input.opportunityScore,
      recommendedMarket: input.recommendedMarket,
      predictedOutcome: input.predictedOutcome,
      reasoningSummary: input.reasoningSummary,
      supportingMetrics: input.supportingMetrics ?? {},
      riskFactors: asArray(input.riskFactors),
      alternativeMarkets: asArray(input.alternativeMarkets),
      operationsNotes: null,
      subscriberSummary: input.subscriberSummary ?? null,
      dataQualityStatus: input.dataQualityStatus ?? "INSUFFICIENT_DATA",
      decisionEngineRunId: input.decisionEngineRunId ?? null,
      createdByUserId: input.createdByUserId ?? null,
      lastReviewedByUserId: null,
      createdAt,
      updatedAt: createdAt,
      reviewedAt: null,
      expiresAt: null,
    };
    this.intelligence.set(record.id, record);
    return record;
  }

  async listIntelligence(filters: IntelligenceListFilters): Promise<AiIntelligenceRecord[]> {
    return Array.from(this.intelligence.values())
      .filter((item) => (filters.status ? item.scanStatus === filters.status : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, filters.limit ?? 50);
  }

  async getIntelligence(id: string): Promise<AiIntelligenceRecord | null> {
    return this.intelligence.get(id) ?? null;
  }

  async updateIntelligenceStatus(input: {
    id: string;
    status: AiIntelligenceStatus;
    lastReviewedByUserId?: string | null;
    operationsNotes?: string | null;
    reviewedAt?: string | null;
  }): Promise<AiIntelligenceRecord | null> {
    const current = this.intelligence.get(input.id);
    if (!current) return null;
    const updated: AiIntelligenceRecord = {
      ...current,
      scanStatus: input.status,
      lastReviewedByUserId: input.lastReviewedByUserId ?? current.lastReviewedByUserId,
      operationsNotes: input.operationsNotes ?? current.operationsNotes,
      reviewedAt: input.reviewedAt ?? current.reviewedAt,
      updatedAt: now(),
    };
    this.intelligence.set(input.id, updated);
    return updated;
  }

  async createReview(input: {
    intelligenceId: string;
    reviewerUserId: string;
    decision: AiIntelligenceReview["decision"];
    previousStatus: AiIntelligenceStatus;
    nextStatus: AiIntelligenceStatus;
    notes?: string | null;
  }): Promise<AiIntelligenceReview> {
    const review: AiIntelligenceReview = {
      id: id("review"),
      intelligenceId: input.intelligenceId,
      reviewerUserId: input.reviewerUserId,
      decision: input.decision,
      previousStatus: input.previousStatus,
      nextStatus: input.nextStatus,
      notes: input.notes ?? null,
      createdAt: now(),
    };
    this.reviews.set(review.id, review);
    return review;
  }

  async listReviews(intelligenceId: string): Promise<AiIntelligenceReview[]> {
    return Array.from(this.reviews.values()).filter((review) => review.intelligenceId === intelligenceId);
  }

  async createSubscriberPublication(input: {
    intelligence: AiIntelligenceRecord;
    actorUserId: string;
    title: string;
    summary: string;
    visibleFrom?: string | null;
  }): Promise<SubscriberPublication> {
    const createdAt = now();
    const publication: SubscriberPublication = {
      id: id("publication"),
      intelligenceId: input.intelligence.id,
      status: "DRAFT",
      title: input.title,
      summary: input.summary,
      recommendedMarket: input.intelligence.recommendedMarket,
      predictedOutcome: input.intelligence.predictedOutcome,
      confidenceScore: input.intelligence.confidenceScore,
      riskScore: input.intelligence.riskScore,
      valueScore: input.intelligence.valueScore,
      opportunityScore: input.intelligence.opportunityScore,
      riskGrade: riskGrade(input.intelligence.riskScore),
      visibleFrom: input.visibleFrom ?? null,
      publishedAt: null,
      withdrawnAt: null,
      createdByUserId: input.actorUserId,
      updatedByUserId: input.actorUserId,
      createdAt,
      updatedAt: createdAt,
    };
    this.publications.set(publication.id, publication);
    return publication;
  }

  async listSubscriberPublications(status?: SubscriberPublication["status"]): Promise<SubscriberPublication[]> {
    return Array.from(this.publications.values()).filter((publication) => (status ? publication.status === status : true));
  }

  async updateSubscriberPublication(id: string, input: UpdateSubscriberPublicationInput): Promise<SubscriberPublication | null> {
    const current = this.publications.get(id);
    if (!current) return null;
    const updated: SubscriberPublication = {
      ...current,
      title: input.title ?? current.title,
      summary: input.summary ?? current.summary,
      status: input.status ?? current.status,
      visibleFrom: input.visibleFrom ?? current.visibleFrom,
      updatedByUserId: input.actorUserId,
      updatedAt: now(),
      publishedAt: input.status === "PUBLISHED" ? now() : current.publishedAt,
      withdrawnAt: input.status === "WITHDRAWN" ? now() : current.withdrawnAt,
    };
    this.publications.set(id, updated);
    return updated;
  }

  async getSubscriberPublication(id: string): Promise<SubscriberPublication | null> {
    return this.publications.get(id) ?? null;
  }

  async listPublishedSubscriberIntelligence(): Promise<SubscriberIntelligence[]> {
    return Array.from(this.publications.values())
      .filter((publication) => publication.status === "PUBLISHED")
      .map((publication) => this.toSubscriberIntelligence(publication))
      .filter((item): item is SubscriberIntelligence => Boolean(item));
  }

  async getPublishedSubscriberIntelligence(id: string): Promise<SubscriberIntelligence | null> {
    const publication = this.publications.get(id);
    if (!publication || publication.status !== "PUBLISHED") return null;
    return this.toSubscriberIntelligence(publication);
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
    const createdAt = now();
    const bet: CompanyBet = {
      id: id("company-bet"),
      intelligenceId: input.intelligence.id,
      status: "PENDING_APPROVAL",
      market: input.market,
      selection: input.selection,
      requestedStakeCents: input.requestedStakeCents,
      approvedStakeCents: 0,
      currency: input.currency,
      targetOdds: input.targetOdds ?? null,
      finalOdds: null,
      bookmaker: input.bookmaker ?? null,
      exposureCents: input.requestedStakeCents,
      maxLossCents: input.requestedStakeCents,
      expectedReturnCents: input.targetOdds ? Math.round(input.requestedStakeCents * input.targetOdds) : 0,
      riskGrade: riskGrade(input.intelligence.riskScore),
      approvedByUserId: null,
      placedByUserId: null,
      notes: input.notes ?? null,
      createdAt,
      updatedAt: createdAt,
      approvedAt: null,
      placedAt: null,
      cancelledAt: null,
    };
    this.companyBets.set(bet.id, bet);
    return bet;
  }

  async listCompanyBets(filters: CompanyBetFilters): Promise<CompanyBet[]> {
    return Array.from(this.companyBets.values())
      .filter((bet) => (filters.status ? bet.status === filters.status : true))
      .slice(0, filters.limit ?? 50);
  }

  async getCompanyBet(id: string): Promise<CompanyBet | null> {
    return this.companyBets.get(id) ?? null;
  }

  async updateCompanyBet(id: string, input: UpdateCompanyBetInput & { status?: CompanyBet["status"] }): Promise<CompanyBet | null> {
    const current = this.companyBets.get(id);
    if (!current) return null;
    const stake = input.approvedStakeCents ?? current.approvedStakeCents;
    const odds = input.finalOdds ?? input.targetOdds ?? current.finalOdds ?? current.targetOdds;
    const updated: CompanyBet = {
      ...current,
      status: input.status ?? current.status,
      requestedStakeCents: input.requestedStakeCents ?? current.requestedStakeCents,
      approvedStakeCents: stake,
      currency: input.currency ?? current.currency,
      targetOdds: input.targetOdds ?? current.targetOdds,
      finalOdds: input.finalOdds ?? current.finalOdds,
      bookmaker: input.bookmaker ?? current.bookmaker,
      notes: input.notes ?? current.notes,
      riskGrade: input.riskGrade ?? current.riskGrade,
      exposureCents: stake || current.requestedStakeCents,
      maxLossCents: stake || current.requestedStakeCents,
      expectedReturnCents: odds ? Math.round((stake || current.requestedStakeCents) * odds) : current.expectedReturnCents,
      approvedByUserId: input.status === "APPROVED" ? input.actorUserId : current.approvedByUserId,
      placedByUserId: input.status === "PLACED" ? input.actorUserId : current.placedByUserId,
      updatedAt: now(),
      approvedAt: input.status === "APPROVED" ? now() : current.approvedAt,
      placedAt: input.status === "PLACED" ? now() : current.placedAt,
      cancelledAt: input.status === "CANCELLED" ? now() : current.cancelledAt,
    };
    this.companyBets.set(id, updated);
    return updated;
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
    const createdAt = now();
    const entry: BettingLedgerEntry = {
      id: id("ledger"),
      companyBetId: input.companyBet.id,
      fixtureId: input.intelligence.fixtureId,
      market: input.companyBet.market,
      selection: input.companyBet.selection,
      stakeCents: input.stakeCents,
      currency: input.companyBet.currency,
      odds: input.odds,
      potentialReturnCents: Math.round(input.stakeCents * input.odds),
      settledReturnCents: 0,
      profitLossCents: 0,
      result: "PENDING",
      bookmaker: input.bookmaker ?? input.companyBet.bookmaker,
      placedAt: input.companyBet.placedAt,
      settledAt: null,
      reconciliationStatus: "PENDING",
      externalBetReference: input.externalBetReference ?? null,
      createdByUserId: input.actorUserId,
      settledByUserId: null,
      createdAt,
      updatedAt: createdAt,
    };
    this.ledger.set(entry.id, entry);
    return entry;
  }

  async listBettingLedger(filters: BettingLedgerFilters): Promise<BettingLedgerEntry[]> {
    return Array.from(this.ledger.values())
      .filter((entry) => (filters.result ? entry.result === filters.result : true))
      .slice(0, filters.limit ?? 50);
  }

  async getBettingLedger(id: string): Promise<BettingLedgerEntry | null> {
    return this.ledger.get(id) ?? null;
  }

  async settleBettingLedger(
    id: string,
    input: SettleBettingLedgerInput & { profitLossCents: number; settledReturnCents: number },
  ): Promise<BettingLedgerEntry | null> {
    const current = this.ledger.get(id);
    if (!current) return null;
    const updated: BettingLedgerEntry = {
      ...current,
      result: input.result,
      settledReturnCents: input.settledReturnCents,
      profitLossCents: input.profitLossCents,
      reconciliationStatus: input.reconciliationStatus ?? current.reconciliationStatus,
      settledByUserId: input.actorUserId,
      settledAt: now(),
      updatedAt: now(),
    };
    this.ledger.set(id, updated);
    return updated;
  }

  async executiveSummary(): Promise<IntelligenceExecutiveSummary> {
    const intelligence = Array.from(this.intelligence.values());
    const companyBets = Array.from(this.companyBets.values());
    const ledger = Array.from(this.ledger.values());
    return {
      scanned: intelligence.length,
      reviewQueue: intelligence.filter((item) => item.scanStatus === "REQUIRES_REVIEW").length,
      approvedForSubscribers: intelligence.filter((item) => ["APPROVED_SUBSCRIBER", "APPROVED_BOTH", "PUBLISHED"].includes(item.scanStatus)).length,
      publishedToSubscribers: Array.from(this.publications.values()).filter((publication) => publication.status === "PUBLISHED").length,
      companyBetsPending: companyBets.filter((bet) => ["PENDING_APPROVAL", "APPROVED", "READY_TO_PLACE"].includes(bet.status)).length,
      companyBetsPlaced: companyBets.filter((bet) => bet.status === "PLACED").length,
      ledgerOpen: ledger.filter((entry) => entry.result === "PENDING").length,
      ledgerSettled: ledger.filter((entry) => entry.result !== "PENDING").length,
      exposureCents: companyBets.reduce((total, bet) => total + bet.exposureCents, 0),
      profitLossCents: ledger.reduce((total, entry) => total + entry.profitLossCents, 0),
    };
  }

  private toSubscriberIntelligence(publication: SubscriberPublication): SubscriberIntelligence | null {
    const intelligence = this.intelligence.get(publication.intelligenceId);
    if (!intelligence) return null;
    return {
      id: publication.id,
      intelligenceId: publication.intelligenceId,
      title: publication.title,
      summary: publication.summary,
      recommendedMarket: publication.recommendedMarket,
      predictedOutcome: publication.predictedOutcome,
      confidenceScore: publication.confidenceScore,
      riskScore: publication.riskScore,
      valueScore: publication.valueScore,
      opportunityScore: publication.opportunityScore,
      riskGrade: publication.riskGrade,
      publishedAt: publication.publishedAt,
      matchLabel: intelligence.matchLabel,
      leagueName: intelligence.leagueName,
      kickoffAt: intelligence.kickoffAt,
    };
  }
}
