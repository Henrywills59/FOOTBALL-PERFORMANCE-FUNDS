import type { PredictionQueueItem, UserRole } from "@fpf/shared";

export const COMPANY_CAPITAL_ACCESS_ROLES: UserRole[] = [
  "ADMIN",
  "CEO",
  "FINANCE",
  "RISK_MANAGER",
  "CAPITAL_MANAGER",
  "SUPER_ADMINISTRATOR",
];

export type CapitalAllocationStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "STAKED" | "SETTLED" | "CANCELLED";
export type CapitalApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type CapitalRiskGrade = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CapitalStakeStatus = "PENDING_PLACEMENT" | "PLACED" | "PARTIALLY_PLACED" | "VOID" | "SETTLED" | "CANCELLED";
export type CapitalSettlementOutcome = "WIN" | "LOSS" | "VOID" | "CANCELLED" | "HALF_WIN" | "HALF_LOSS";
export type CompanyCapitalReportPeriod = "WEEKLY" | "MONTHLY" | "SEASON";

export type CompanyCapitalPortfolio = {
  id: string;
  name: string;
  baseCurrency: string;
  openingBalanceCents: number;
  availableCapitalCents: number;
  allocatedCapitalCents: number;
  exposureCents: number;
  settledProfitCents: number;
  settledLossCents: number;
  status: "ACTIVE" | "PAUSED" | "CLOSED";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CompanyCapitalAllocation = {
  id: string;
  portfolioId: string;
  candidateId: string | null;
  fixtureId: string | null;
  matchLabel: string;
  market: string;
  selection: string;
  recommendedStakeCents: number;
  approvedStakeCents: number;
  maxStakeCents: number;
  odds: number;
  riskGrade: CapitalRiskGrade;
  exposureCents: number;
  status: CapitalAllocationStatus;
  approvalStatus: CapitalApprovalStatus;
  analystApprovalStatus: CapitalApprovalStatus;
  intelligenceStatus: string;
  rationale: string | null;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyCapitalStake = {
  id: string;
  allocationId: string;
  stakeCents: number;
  odds: number;
  bookmaker: string;
  reference: string | null;
  status: CapitalStakeStatus;
  placedBy: string | null;
  placedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyCapitalSettlement = {
  id: string;
  allocationId: string;
  stakeId: string | null;
  outcome: CapitalSettlementOutcome;
  grossReturnCents: number;
  profitCents: number;
  lossCents: number;
  netResultCents: number;
  settlementStatus: "RECORDED" | "VERIFIED" | "DISPUTED";
  settledBy: string;
  settledAt: string;
  notes: string | null;
};

export type CompanyCapitalRiskEvent = {
  id: string;
  allocationId: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  message: string;
  createdBy: string;
  createdAt: string;
  resolvedAt: string | null;
};

export type CompanyCapitalReport = {
  id: string;
  periodType: CompanyCapitalReportPeriod;
  periodLabel: string;
  summary: string;
  metrics: Record<string, unknown>;
  generatedBy: string;
  generatedAt: string;
};

export type CompanyCapitalAuditRecord = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  notes: string | null;
  createdAt: string;
};

export type CompanyCapitalDashboard = {
  portfolio: CompanyCapitalPortfolio;
  allocations: CompanyCapitalAllocation[];
  stakes: CompanyCapitalStake[];
  settlements: CompanyCapitalSettlement[];
  riskEvents: CompanyCapitalRiskEvent[];
  reports: CompanyCapitalReport[];
  auditTrail: CompanyCapitalAuditRecord[];
  candidateQueue: PredictionQueueItem[];
  exposure: {
    totalExposureCents: number;
    availableCapitalCents: number;
    exposurePercent: number;
    openAllocations: number;
    approvedAllocations: number;
    settledAllocations: number;
    highRiskAllocations: number;
  };
  privateNotice: string;
};

export type CreateCapitalAllocationInput = {
  portfolioId?: string;
  candidateId?: string | null;
  fixtureId?: string | null;
  matchLabel: string;
  market: string;
  selection: string;
  recommendedStakeCents: number;
  maxStakeCents: number;
  odds: number;
  riskGrade: CapitalRiskGrade;
  analystApprovalStatus?: CapitalApprovalStatus;
  intelligenceStatus?: string;
  rationale?: string | null;
};

export type ApproveAllocationInput = {
  approvedStakeCents: number;
  notes?: string | null;
};

export type PlaceStakeInput = {
  stakeCents: number;
  odds: number;
  bookmaker: string;
  reference?: string | null;
  notes?: string | null;
};

export type RecordSettlementInput = {
  stakeId?: string | null;
  outcome: CapitalSettlementOutcome;
  grossReturnCents?: number;
  notes?: string | null;
};

export type CompanyCapitalRepository = {
  getOrCreatePortfolio(actorUserId: string): Promise<CompanyCapitalPortfolio>;
  dashboardData(): Promise<{
    portfolio: CompanyCapitalPortfolio | null;
    allocations: CompanyCapitalAllocation[];
    stakes: CompanyCapitalStake[];
    settlements: CompanyCapitalSettlement[];
    riskEvents: CompanyCapitalRiskEvent[];
    reports: CompanyCapitalReport[];
    auditTrail: CompanyCapitalAuditRecord[];
  }>;
  createAllocation(actorUserId: string, input: CreateCapitalAllocationInput & { portfolioId: string }): Promise<CompanyCapitalAllocation>;
  getAllocation(id: string): Promise<CompanyCapitalAllocation | null>;
  updateAllocation(allocation: CompanyCapitalAllocation): Promise<CompanyCapitalAllocation>;
  createStake(actorUserId: string, input: PlaceStakeInput & { allocationId: string }): Promise<CompanyCapitalStake>;
  getStake(id: string): Promise<CompanyCapitalStake | null>;
  updateStake(stake: CompanyCapitalStake): Promise<CompanyCapitalStake>;
  createSettlement(actorUserId: string, input: CompanyCapitalSettlement): Promise<CompanyCapitalSettlement>;
  updatePortfolio(portfolio: CompanyCapitalPortfolio): Promise<CompanyCapitalPortfolio>;
  createRiskEvent(input: Omit<CompanyCapitalRiskEvent, "id" | "createdAt" | "resolvedAt" | "status">): Promise<CompanyCapitalRiskEvent>;
  createReport(report: Omit<CompanyCapitalReport, "id" | "generatedAt">): Promise<CompanyCapitalReport>;
  audit(record: Omit<CompanyCapitalAuditRecord, "id" | "createdAt">): Promise<CompanyCapitalAuditRecord>;
};
