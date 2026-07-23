import type {
  AiIntelligenceRecord,
  AiIntelligenceReview,
  AiIntelligenceStatus,
  BettingLedgerEntry,
  BettingLedgerResult,
  CompanyBet,
  CompanyBetPlacementStatus,
  IntelligenceExecutiveSummary,
  IntelligenceReviewDecision,
  SubscriberIntelligence,
  SubscriberPublication,
  SubscriberPublicationStatus,
} from "@fpf/shared";

export type IntelligenceListFilters = {
  status?: AiIntelligenceStatus;
  limit?: number;
};

export type CompanyBetFilters = {
  status?: CompanyBetPlacementStatus;
  limit?: number;
};

export type BettingLedgerFilters = {
  result?: BettingLedgerResult;
  limit?: number;
};

export type CreateAiIntelligenceInput = {
  fixtureId: string;
  matchLabel: string;
  leagueName: string;
  kickoffAt?: string | null;
  recommendedMarket: string;
  predictedOutcome: string;
  confidenceScore: number;
  riskScore: number;
  valueScore: number;
  opportunityScore: number;
  reasoningSummary: string;
  supportingMetrics?: Record<string, unknown>;
  riskFactors?: string[];
  alternativeMarkets?: string[];
  subscriberSummary?: string | null;
  dataQualityStatus?: AiIntelligenceRecord["dataQualityStatus"];
  createdByUserId?: string | null;
  decisionEngineRunId?: string | null;
};

export type ReviewIntelligenceInput = {
  reviewerUserId: string;
  decision: IntelligenceReviewDecision;
  notes?: string | null;
};

export type CreateSubscriberPublicationInput = {
  actorUserId: string;
  title?: string;
  summary?: string;
  visibleFrom?: string | null;
};

export type UpdateSubscriberPublicationInput = {
  actorUserId: string;
  title?: string;
  summary?: string;
  status?: SubscriberPublicationStatus;
  visibleFrom?: string | null;
};

export type CreateCompanyBetInput = {
  actorUserId: string;
  market?: string;
  selection?: string;
  requestedStakeCents: number;
  currency?: string;
  targetOdds?: number | null;
  bookmaker?: string | null;
  notes?: string | null;
};

export type UpdateCompanyBetInput = {
  actorUserId: string;
  requestedStakeCents?: number;
  approvedStakeCents?: number;
  currency?: string;
  targetOdds?: number | null;
  finalOdds?: number | null;
  bookmaker?: string | null;
  notes?: string | null;
  riskGrade?: string;
};

export type CreateBettingLedgerInput = {
  actorUserId: string;
  odds?: number | null;
  stakeCents?: number | null;
  bookmaker?: string | null;
  externalBetReference?: string | null;
};

export type SettleBettingLedgerInput = {
  actorUserId: string;
  result: BettingLedgerResult;
  settledReturnCents?: number | null;
  reconciliationStatus?: string;
};

export type IntelligenceWorkflowRepository = {
  createIntelligence(input: CreateAiIntelligenceInput): Promise<AiIntelligenceRecord>;
  listIntelligence(filters: IntelligenceListFilters): Promise<AiIntelligenceRecord[]>;
  getIntelligence(id: string): Promise<AiIntelligenceRecord | null>;
  updateIntelligenceStatus(input: {
    id: string;
    status: AiIntelligenceStatus;
    lastReviewedByUserId?: string | null;
    operationsNotes?: string | null;
    reviewedAt?: string | null;
  }): Promise<AiIntelligenceRecord | null>;
  createReview(input: {
    intelligenceId: string;
    reviewerUserId: string;
    decision: IntelligenceReviewDecision;
    previousStatus: AiIntelligenceStatus;
    nextStatus: AiIntelligenceStatus;
    notes?: string | null;
  }): Promise<AiIntelligenceReview>;
  listReviews(intelligenceId: string): Promise<AiIntelligenceReview[]>;
  createSubscriberPublication(input: {
    intelligence: AiIntelligenceRecord;
    actorUserId: string;
    title: string;
    summary: string;
    visibleFrom?: string | null;
  }): Promise<SubscriberPublication>;
  listSubscriberPublications(status?: SubscriberPublicationStatus): Promise<SubscriberPublication[]>;
  updateSubscriberPublication(id: string, input: UpdateSubscriberPublicationInput): Promise<SubscriberPublication | null>;
  getSubscriberPublication(id: string): Promise<SubscriberPublication | null>;
  listPublishedSubscriberIntelligence(): Promise<SubscriberIntelligence[]>;
  getPublishedSubscriberIntelligence(id: string): Promise<SubscriberIntelligence | null>;
  createCompanyBet(input: {
    intelligence: AiIntelligenceRecord;
    actorUserId: string;
    market: string;
    selection: string;
    requestedStakeCents: number;
    currency: string;
    targetOdds?: number | null;
    bookmaker?: string | null;
    notes?: string | null;
  }): Promise<CompanyBet>;
  listCompanyBets(filters: CompanyBetFilters): Promise<CompanyBet[]>;
  getCompanyBet(id: string): Promise<CompanyBet | null>;
  updateCompanyBet(id: string, input: UpdateCompanyBetInput & { status?: CompanyBetPlacementStatus }): Promise<CompanyBet | null>;
  createBettingLedger(input: {
    companyBet: CompanyBet;
    intelligence: AiIntelligenceRecord;
    actorUserId: string;
    odds: number;
    stakeCents: number;
    bookmaker?: string | null;
    externalBetReference?: string | null;
  }): Promise<BettingLedgerEntry>;
  listBettingLedger(filters: BettingLedgerFilters): Promise<BettingLedgerEntry[]>;
  getBettingLedger(id: string): Promise<BettingLedgerEntry | null>;
  settleBettingLedger(id: string, input: SettleBettingLedgerInput & { profitLossCents: number; settledReturnCents: number }): Promise<BettingLedgerEntry | null>;
  executiveSummary(): Promise<IntelligenceExecutiveSummary>;
};

export type AuditWriter = (input: {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: unknown;
}) => Promise<void>;
