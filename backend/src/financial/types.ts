export type FinancialAllocationType =
  | "PERFORMANCE_PARTNER_POOL"
  | "ANALYST_PERFORMANCE_POOL"
  | "RISK_STABILITY_RESERVE"
  | "COMPANY_GROWTH_OPERATIONS_FUND";

export type FinancialRunStatus = "CALCULATED" | "PENDING_APPROVAL" | "APPROVED" | "CLOSED";

export type EligibleProfitInput = {
  weekLabel: string;
  seasonId?: string | null;
  grossReturnsCents: number;
  returnedStakeCents?: number;
  totalStakeCents?: number;
  totalLossesCents?: number;
  operatingAdjustmentsCents?: number;
  analystContributions?: Array<{
    analystId: string;
    analystName?: string;
    contributionScore: number;
  }>;
};

export type FinancialAllocation = {
  id: string;
  runId: string;
  allocationType: FinancialAllocationType;
  label: string;
  percent: number;
  amountCents: number;
  distributable: boolean;
  auditExplanation: string;
  createdAt: string;
};

export type FinancialPartnerDistribution = {
  id: string;
  runId: string;
  participationId: string | null;
  userId: string | null;
  participationWeight: number;
  distributionCents: number;
  status: "CALCULATED" | "PENDING_APPROVAL" | "APPROVED" | "PAID_PLACEHOLDER";
  explanation: string;
  createdAt: string;
};

export type FinancialAnalystReward = {
  id: string;
  runId: string;
  analystId: string;
  analystName: string;
  contributionWeight: number;
  rewardCents: number;
  status: "CALCULATED" | "PENDING_APPROVAL" | "APPROVED" | "PAID_PLACEHOLDER";
  breakdown: string[];
  createdAt: string;
};

export type ReserveLedgerEntry = {
  id: string;
  runId: string;
  direction: "CREDIT" | "DEBIT";
  amountCents: number;
  balanceAfterCents: number;
  classification: string;
  notes: string;
  createdBy: string;
  createdAt: string;
};

export type CompanyGrowthLedgerEntry = ReserveLedgerEntry;

export type FinancialReport = {
  id: string;
  runId: string;
  reportType: "WEEKLY_DISTRIBUTION" | "ALLOCATION_SUMMARY" | "AUDIT_SUMMARY";
  title: string;
  summary: string;
  metrics: Record<string, unknown>;
  generatedBy: string;
  generatedAt: string;
};

export type FinancialAuditRecord = {
  id: string;
  runId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  calculationRef: string | null;
  notes: string | null;
  createdAt: string;
};

export type FinancialEngineRun = {
  id: string;
  weekLabel: string;
  seasonId: string | null;
  grossReturnsCents: number;
  returnedStakeCents: number;
  totalStakeCents: number;
  totalLossesCents: number;
  operatingAdjustmentsCents: number;
  eligibleProfitCents: number;
  status: FinancialRunStatus;
  calculationInput: EligibleProfitInput;
  calculationOutput: Record<string, unknown>;
  calculatedBy: string;
  calculatedAt: string;
  allocations: FinancialAllocation[];
  partnerDistributions: FinancialPartnerDistribution[];
  analystRewards: FinancialAnalystReward[];
  reserveLedgerEntries: ReserveLedgerEntry[];
  companyGrowthLedgerEntries: CompanyGrowthLedgerEntry[];
  reports: FinancialReport[];
  auditRecords: FinancialAuditRecord[];
};

export type FinancialEngineOverview = {
  allocationPolicy: Array<{
    allocationType: FinancialAllocationType;
    label: string;
    percent: number;
    distributable: boolean;
  }>;
  latestRun: FinancialEngineRun | null;
  totals: {
    eligibleProfitCents: number;
    performancePartnerPoolCents: number;
    analystPerformancePoolCents: number;
    riskStabilityReserveCents: number;
    companyGrowthOperationsFundCents: number;
    reserveBalanceCents: number;
    companyGrowthBalanceCents: number;
  };
};

export type EligibleParticipationSnapshot = {
  participationId: string;
  userId: string;
  participationAmountCents: number;
  remainingDistributions: number;
};

export type FinancialRepository = {
  latestRun(): Promise<FinancialEngineRun | null>;
  listRuns(): Promise<FinancialEngineRun[]>;
  listReports(): Promise<FinancialReport[]>;
  listAuditRecords(): Promise<FinancialAuditRecord[]>;
  eligibleParticipations(): Promise<EligibleParticipationSnapshot[]>;
  reserveBalance(): Promise<number>;
  companyGrowthBalance(): Promise<number>;
  saveRun(run: FinancialEngineRun): Promise<FinancialEngineRun>;
};
