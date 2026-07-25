import type {
  AiIntelligenceRecord,
  AiIntelligenceStatus,
  BettingLedgerResult,
  CompanyBetPlacementStatus,
  IntelligenceExecutiveSummary,
  IntelligenceReviewDecision,
  SubscriberPublicationStatus,
} from "@fpf/shared";
import type {
  AuditWriter,
  BettingLedgerFilters,
  CompanyBetFilters,
  CreateAiIntelligenceInput,
  CreateBettingLedgerInput,
  CreateCompanyBetInput,
  CreateSubscriberPublicationInput,
  IntelligenceListFilters,
  IntelligenceWorkflowRepository,
  ReviewIntelligenceInput,
  SettleBettingLedgerInput,
  UpdateCompanyBetInput,
  UpdateSubscriberPublicationInput,
} from "./types.js";

export class IntelligenceWorkflowError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
    this.name = "IntelligenceWorkflowError";
  }
}

function clampLimit(limit?: number) {
  if (!limit) return 50;
  return Math.max(1, Math.min(100, Math.floor(limit)));
}

function riskGrade(riskScore: number) {
  if (riskScore >= 70) return "HIGH";
  if (riskScore >= 40) return "MEDIUM";
  return "LOW";
}

function nextStatusForReview(decision: IntelligenceReviewDecision): AiIntelligenceStatus {
  switch (decision) {
    case "APPROVE_SUBSCRIBER":
      return "APPROVED_SUBSCRIBER";
    case "APPROVE_COMPANY":
      return "APPROVED_COMPANY";
    case "APPROVE_BOTH":
      return "APPROVED_BOTH";
    case "REJECT":
      return "REJECTED";
    case "REQUEST_MORE_ANALYSIS":
      return "REQUIRES_REVIEW";
    case "WITHDRAW":
      return "WITHDRAWN";
  }
}

function canCreatePublication(status: AiIntelligenceStatus) {
  return ["APPROVED_SUBSCRIBER", "APPROVED_BOTH", "PUBLISHED"].includes(status);
}

function canCreateCompanyBet(status: AiIntelligenceStatus) {
  return ["APPROVED_COMPANY", "APPROVED_BOTH"].includes(status);
}

function potentialReturnCents(stakeCents: number, odds: number) {
  return Math.round(stakeCents * odds);
}

function profitLossForResult(result: BettingLedgerResult, stakeCents: number, settledReturnCents?: number | null) {
  if (result === "WON") return { settledReturnCents: settledReturnCents ?? 0, profitLossCents: (settledReturnCents ?? 0) - stakeCents };
  if (result === "LOST") return { settledReturnCents: 0, profitLossCents: -stakeCents };
  if (result === "VOID" || result === "CANCELLED") return { settledReturnCents: stakeCents, profitLossCents: 0 };
  if (result === "PARTIAL_WIN" || result === "PARTIAL_LOSS") {
    const settled = settledReturnCents ?? stakeCents;
    return { settledReturnCents: settled, profitLossCents: settled - stakeCents };
  }
  return { settledReturnCents: settledReturnCents ?? 0, profitLossCents: 0 };
}

export class IntelligenceWorkflowService {
  constructor(
    private readonly repository: IntelligenceWorkflowRepository,
    private readonly audit: AuditWriter,
  ) {}

  createFromScan(input: CreateAiIntelligenceInput) {
    return this.repository.createIntelligence(input);
  }

  listIntelligence(filters: IntelligenceListFilters) {
    return this.repository.listIntelligence({ ...filters, limit: clampLimit(filters.limit) });
  }

  async getIntelligence(id: string) {
    const intelligence = await this.repository.getIntelligence(id);
    if (!intelligence) throw new IntelligenceWorkflowError("AI intelligence item not found.", 404);
    return intelligence;
  }

  listReviewQueue(limit?: number) {
    return this.repository.listIntelligence({ status: "REQUIRES_REVIEW", limit: clampLimit(limit) });
  }

  async reviewIntelligence(id: string, input: ReviewIntelligenceInput) {
    const intelligence = await this.getIntelligence(id);
    const nextStatus = nextStatusForReview(input.decision);
    const updated = await this.repository.updateIntelligenceStatus({
      id,
      status: nextStatus,
      lastReviewedByUserId: input.reviewerUserId,
      operationsNotes: input.notes ?? intelligence.operationsNotes,
      reviewedAt: new Date().toISOString(),
    });
    if (!updated) throw new IntelligenceWorkflowError("AI intelligence item not found.", 404);
    await this.repository.createReview({
      intelligenceId: id,
      reviewerUserId: input.reviewerUserId,
      decision: input.decision,
      previousStatus: intelligence.scanStatus,
      nextStatus,
      notes: input.notes,
    });
    await this.audit({
      actorUserId: input.reviewerUserId,
      action: "AI_INTELLIGENCE_REVIEWED",
      entityType: "AI_INTELLIGENCE",
      entityId: id,
      details: { decision: input.decision, previousStatus: intelligence.scanStatus, nextStatus },
    });
    return updated;
  }

  history(id: string) {
    return this.repository.listReviews(id);
  }

  async createSubscriberPublication(id: string, input: CreateSubscriberPublicationInput) {
    const intelligence = await this.getIntelligence(id);
    if (!canCreatePublication(intelligence.scanStatus)) {
      throw new IntelligenceWorkflowError("Intelligence must be approved for subscribers before publication can be drafted.");
    }
    const publication = await this.repository.createSubscriberPublication({
      intelligence,
      actorUserId: input.actorUserId,
      title: input.title ?? intelligence.matchLabel,
      summary: input.summary ?? intelligence.subscriberSummary ?? intelligence.reasoningSummary,
      visibleFrom: input.visibleFrom,
    });
    await this.audit({
      actorUserId: input.actorUserId,
      action: "SUBSCRIBER_PUBLICATION_CREATED",
      entityType: "SUBSCRIBER_PUBLICATION",
      entityId: publication.id,
      details: { intelligenceId: id },
    });
    return publication;
  }

  listSubscriberPublications(status?: SubscriberPublicationStatus) {
    return this.repository.listSubscriberPublications(status);
  }

  updateSubscriberPublication(id: string, input: UpdateSubscriberPublicationInput) {
    return this.repository.updateSubscriberPublication(id, input);
  }

  async publishSubscriberPublication(id: string, actorUserId: string) {
    const publication = await this.repository.updateSubscriberPublication(id, {
      actorUserId,
      status: "PUBLISHED",
    });
    if (!publication) throw new IntelligenceWorkflowError("Subscriber publication not found.", 404);
    await this.repository.updateIntelligenceStatus({ id: publication.intelligenceId, status: "PUBLISHED", reviewedAt: new Date().toISOString() });
    await this.audit({ actorUserId, action: "SUBSCRIBER_PUBLICATION_PUBLISHED", entityType: "SUBSCRIBER_PUBLICATION", entityId: id });
    return publication;
  }

  async withdrawSubscriberPublication(id: string, actorUserId: string) {
    const publication = await this.repository.updateSubscriberPublication(id, {
      actorUserId,
      status: "WITHDRAWN",
    });
    if (!publication) throw new IntelligenceWorkflowError("Subscriber publication not found.", 404);
    await this.repository.updateIntelligenceStatus({ id: publication.intelligenceId, status: "WITHDRAWN", reviewedAt: new Date().toISOString() });
    await this.audit({ actorUserId, action: "SUBSCRIBER_PUBLICATION_WITHDRAWN", entityType: "SUBSCRIBER_PUBLICATION", entityId: id });
    return publication;
  }

  publishedSubscriberIntelligence() {
    return this.repository.listPublishedSubscriberIntelligence();
  }

  async publishedSubscriberIntelligenceDetail(id: string) {
    const item = await this.repository.getPublishedSubscriberIntelligence(id);
    if (!item) throw new IntelligenceWorkflowError("Published intelligence item not found.", 404);
    return item;
  }

  async createCompanyBet(id: string, input: CreateCompanyBetInput) {
    const intelligence = await this.getIntelligence(id);
    if (!canCreateCompanyBet(intelligence.scanStatus)) {
      throw new IntelligenceWorkflowError("Intelligence must be approved for company execution before a company bet can be drafted.");
    }
    const companyBet = await this.repository.createCompanyBet({
      intelligence,
      actorUserId: input.actorUserId,
      market: input.market ?? intelligence.recommendedMarket,
      selection: input.selection ?? intelligence.predictedOutcome,
      requestedStakeCents: input.requestedStakeCents,
      currency: input.currency ?? "USD",
      targetOdds: input.targetOdds,
      bookmaker: input.bookmaker,
      notes: input.notes,
    });
    await this.audit({ actorUserId: input.actorUserId, action: "COMPANY_BET_CREATED", entityType: "COMPANY_BET", entityId: companyBet.id });
    return companyBet;
  }

  listCompanyBets(filters: CompanyBetFilters) {
    return this.repository.listCompanyBets({ ...filters, limit: clampLimit(filters.limit) });
  }

  async getCompanyBet(id: string) {
    const bet = await this.repository.getCompanyBet(id);
    if (!bet) throw new IntelligenceWorkflowError("Company bet not found.", 404);
    return bet;
  }

  updateCompanyBet(id: string, input: UpdateCompanyBetInput) {
    return this.repository.updateCompanyBet(id, input);
  }

  async approveCompanyBet(id: string, actorUserId: string) {
    const current = await this.getCompanyBet(id);
    const stake = current.approvedStakeCents || current.requestedStakeCents;
    const updated = await this.repository.updateCompanyBet(id, {
      actorUserId,
      status: "APPROVED",
      approvedStakeCents: stake,
    });
    if (!updated) throw new IntelligenceWorkflowError("Company bet not found.", 404);
    await this.audit({ actorUserId, action: "COMPANY_BET_APPROVED", entityType: "COMPANY_BET", entityId: id, details: { stakeCents: stake } });
    return updated;
  }

  async markCompanyBetPlaced(id: string, actorUserId: string) {
    const current = await this.getCompanyBet(id);
    if (!["APPROVED", "READY_TO_PLACE"].includes(current.status)) {
      throw new IntelligenceWorkflowError("Company bet must be approved before it can be marked placed.");
    }
    const updated = await this.repository.updateCompanyBet(id, { actorUserId, status: "PLACED" });
    if (!updated) throw new IntelligenceWorkflowError("Company bet not found.", 404);
    await this.audit({ actorUserId, action: "COMPANY_BET_PLACED", entityType: "COMPANY_BET", entityId: id });
    return updated;
  }

  async cancelCompanyBet(id: string, actorUserId: string) {
    const updated = await this.repository.updateCompanyBet(id, { actorUserId, status: "CANCELLED" });
    if (!updated) throw new IntelligenceWorkflowError("Company bet not found.", 404);
    await this.audit({ actorUserId, action: "COMPANY_BET_CANCELLED", entityType: "COMPANY_BET", entityId: id });
    return updated;
  }

  listBettingLedger(filters: BettingLedgerFilters) {
    return this.repository.listBettingLedger({ ...filters, limit: clampLimit(filters.limit) });
  }

  async getBettingLedger(id: string) {
    const ledger = await this.repository.getBettingLedger(id);
    if (!ledger) throw new IntelligenceWorkflowError("Betting ledger entry not found.", 404);
    return ledger;
  }

  async createBettingLedger(companyBetId: string, input: CreateBettingLedgerInput) {
    const companyBet = await this.getCompanyBet(companyBetId);
    if (companyBet.status !== "PLACED") {
      throw new IntelligenceWorkflowError("Company bet must be placed before ledger entry creation.");
    }
    const intelligence = await this.getIntelligence(companyBet.intelligenceId);
    const odds = input.odds ?? companyBet.finalOdds ?? companyBet.targetOdds;
    if (!odds || odds <= 1) throw new IntelligenceWorkflowError("Valid decimal odds are required.");
    const stakeCents = input.stakeCents ?? companyBet.approvedStakeCents;
    if (!Number.isInteger(stakeCents) || stakeCents <= 0) throw new IntelligenceWorkflowError("Positive stake cents are required.");
    const ledger = await this.repository.createBettingLedger({
      companyBet,
      intelligence,
      actorUserId: input.actorUserId,
      odds,
      stakeCents,
      bookmaker: input.bookmaker ?? companyBet.bookmaker,
      externalBetReference: input.externalBetReference,
    });
    await this.audit({ actorUserId: input.actorUserId, action: "BETTING_LEDGER_CREATED", entityType: "BETTING_LEDGER", entityId: ledger.id });
    return ledger;
  }

  async settleBettingLedger(id: string, input: SettleBettingLedgerInput) {
    const ledger = await this.getBettingLedger(id);
    const settlement = profitLossForResult(input.result, ledger.stakeCents, input.settledReturnCents);
    const updated = await this.repository.settleBettingLedger(id, {
      ...input,
      ...settlement,
      reconciliationStatus: input.reconciliationStatus ?? "RECONCILED",
    });
    if (!updated) throw new IntelligenceWorkflowError("Betting ledger entry not found.", 404);
    await this.audit({
      actorUserId: input.actorUserId,
      action: "BETTING_LEDGER_SETTLED",
      entityType: "BETTING_LEDGER",
      entityId: id,
      details: { result: input.result, profitLossCents: settlement.profitLossCents },
    });
    return updated;
  }

  executiveSummary(): Promise<IntelligenceExecutiveSummary> {
    return this.repository.executiveSummary();
  }

  riskGradeForIntelligence(item: AiIntelligenceRecord) {
    return riskGrade(item.riskScore);
  }

  expectedReturnCents(stakeCents: number, odds?: number | null) {
    return odds ? potentialReturnCents(stakeCents, odds) : 0;
  }
}
