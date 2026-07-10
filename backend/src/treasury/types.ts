export type TreasuryRiskGrade = "LOW" | "MEDIUM" | "HIGH";
export type TreasuryExecutionStatus =
  | "RECOMMENDED"
  | "PENDING_EXECUTION"
  | "PLACED"
  | "PARTIALLY_PLACED"
  | "NOT_EXECUTED"
  | "CANCELLED"
  | "SETTLED";
export type TreasurySettlementOutcome =
  | "WIN"
  | "LOSS"
  | "VOID"
  | "HALF_WIN"
  | "HALF_LOSS"
  | "CANCELLED"
  | "PENDING_VERIFICATION";
export type TreasuryReconciliationStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "PARTIALLY_RECONCILED"
  | "RECONCILED"
  | "DISPUTED"
  | "CLOSED";

export type TreasuryAccountSummary = {
  companyTreasuryBalanceCents: number;
  investorCapitalBalanceCents: number;
  companyOperatingCapitalCents: number;
  capitalAvailableForStakingCents: number;
  capitalCurrentlyExposedCents: number;
  capitalReturnedCents: number;
  profitBalanceCents: number;
  lossBalanceCents: number;
  outstandingReconciliationCents: number;
  closingBalanceCents: number;
};

export type TreasuryLedgerEntry = {
  id: string;
  account: string;
  direction: "DEBIT" | "CREDIT";
  amountCents: number;
  classification: string;
  referenceType: string;
  referenceId: string | null;
  notes: string;
  createdBy: string;
  createdAt: string;
};

export type CapitalAllocationExtension = {
  id: string;
  fixture: string;
  market: string;
  selection: string;
  analystIds: string[];
  recommendedStakeCents: number;
  maximumAllowedStakeCents: number;
  dailyAllocationCents: number;
  weeklyAllocationCents: number;
  matchAllocationCents: number;
  marketAllocationCents: number;
  riskGrade: TreasuryRiskGrade;
  expectedReturnCents: number;
  approvalStatus: "APPROVED" | "PENDING" | "REJECTED";
  allocationTimestamp: string;
  allocatedBy: string;
  controls: {
    analystRank: string;
    reliabilityIndex: number;
    disciplineScore: number;
    historicalRoi: number;
    recentPerformance: string;
    drawdown: number;
    capitalEfficiency: number;
    dailyExposureLimitCents: number;
    weeklyExposureLimitCents: number;
  };
};

export type BetExecutionRecord = {
  id: string;
  allocationId: string;
  fixture: string;
  market: string;
  selection: string;
  recommendedStakeCents: number;
  actualStakeCents: number;
  recommendedOdds: number;
  actualOdds: number;
  bookmaker: string;
  betReference: string;
  placedAt: string;
  currency: string;
  status: TreasuryExecutionStatus;
  varianceReason: string | null;
  executionNotes: string | null;
  evidencePlaceholder: string | null;
  executedBy: string;
};

export type MatchSettlement = {
  id: string;
  executionId: string;
  outcome: TreasurySettlementOutcome;
  actualStakeCents: number;
  actualOdds: number;
  grossReturnCents: number;
  capitalReturnedCents: number;
  grossProfitCents: number;
  lossCents: number;
  netResultCents: number;
  bookmakerDeductionCents: number;
  currencyConversionPlaceholderCents: number;
  verificationStatus: "PENDING" | "VERIFIED";
  settledBy: string;
  settledAt: string;
};

export type MatchReconciliation = {
  id: string;
  settlementId: string;
  capitalApprovedCents: number;
  capitalActuallyStakedCents: number;
  expectedReturnCents: number;
  actualReturnCents: number;
  capitalExpectedBackCents: number;
  amountDepositedBackCents: number;
  outstandingDifferenceCents: number;
  status: TreasuryReconciliationStatus;
  notes: string | null;
  evidencePlaceholder: string | null;
  reconciledBy: string;
  reconciledAt: string;
};

export type TradingDaySummary = {
  id: string;
  date: string;
  openingTreasuryBalanceCents: number;
  capitalAllocatedCents: number;
  capitalActuallyStakedCents: number;
  unusedAllocatedCapitalCents: number;
  openExposureCents: number;
  settledCapitalCents: number;
  grossReturnsCents: number;
  grossProfitCents: number;
  totalLossesCents: number;
  netDailyProfitCents: number;
  amountExpectedBackCents: number;
  amountDepositedBackCents: number;
  outstandingReconciliationCents: number;
  closingTreasuryBalanceCents: number;
  status: "OPEN" | "CLOSED" | "CLOSED_WITH_OVERRIDE";
  closureNotes: string | null;
};

export type ProfitDistributionPolicy = {
  id: string;
  version: number;
  companySharePercent: number;
  analystRewardPercent: number;
  investorDistributionPercent: number;
  active: boolean;
  updatedBy: string;
  updatedAt: string;
};

export type WeeklyFinancialPeriod = {
  id: string;
  weekLabel: string;
  openingTreasuryCents: number;
  investorPrincipalCents: number;
  companyCapitalCents: number;
  totalCapitalStakedCents: number;
  grossReturnsCents: number;
  grossProfitCents: number;
  totalLossesCents: number;
  confirmedWeeklyNetProfitCents: number;
  outstandingReconciliationsCents: number;
  closingTreasuryBalanceCents: number;
  status: "OPEN" | "READY_FOR_CLOSURE" | "CLOSED" | "BLOCKED";
};

export type AnalystRewardAllocation = {
  id: string;
  analystId: string;
  analystName: string;
  contributionWeight: number;
  rewardCents: number;
  status: "CALCULATED" | "PENDING_APPROVAL" | "APPROVED" | "PENDING_PAYOUT" | "PAID_PLACEHOLDER" | "DISPUTED" | "ADJUSTED" | "CANCELLED";
  breakdown: string[];
};

export type InvestorDistributionAllocation = {
  id: string;
  investorId: string;
  participationWeight: number;
  distributionCents: number;
  reinvestmentCents: number;
  withdrawalCents: number;
  status: "CALCULATED" | "PENDING_APPROVAL" | "APPROVED" | "REINVESTED" | "PENDING_PAYOUT" | "PAID_PLACEHOLDER" | "FAILED" | "DISPUTED" | "CANCELLED";
  explanation: string;
};

export type CompanyShareAllocation = {
  id: string;
  amountCents: number;
  classification: "RETAINED_EARNINGS" | "FUTURE_STAKING_CAPITAL" | "COMPANY_RESERVE" | "OPERATING_EXPENSES" | "GROWTH_CAPITAL" | "TAX_PLACEHOLDER" | "OTHER_APPROVED_USE";
  ledgerEntryId: string;
  notes: string;
};

export type FinancialException = {
  id: string;
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  message: string;
  relatedId: string | null;
  createdAt: string;
};

export type TreasuryDashboard = {
  accounts: TreasuryAccountSummary;
  ledger: TreasuryLedgerEntry[];
  capitalAllocations: CapitalAllocationExtension[];
  executions: BetExecutionRecord[];
  settlements: MatchSettlement[];
  reconciliations: MatchReconciliation[];
  daily: TradingDaySummary;
  weekly: WeeklyFinancialPeriod;
  policy: ProfitDistributionPolicy;
  analystRewards: AnalystRewardAllocation[];
  investorDistributions: InvestorDistributionAllocation[];
  companyShares: CompanyShareAllocation[];
  exceptions: FinancialException[];
};

export type ExecutiveSituationRoom = {
  approvedSelectionsToday: number;
  capitalRecommendedCents: number;
  capitalActuallyPlacedCents: number;
  openExposureCents: number;
  matchesInPlay: number;
  expectedTreasuryReturnCents: number;
  actualTreasuryReturnCents: number;
  outstandingReconciliationCents: number;
  dailyProfitOrLossCents: number;
  weeklyConfirmedNetProfitCents: number;
  companyShareProjectionCents: number;
  analystRewardPoolProjectionCents: number;
  investorDistributionPoolProjectionCents: number;
  highRiskPositions: CapitalAllocationExtension[];
  pendingSettlements: BetExecutionRecord[];
  pendingReconciliations: MatchReconciliation[];
  pendingApprovals: string[];
  currentAnalystAllocations: Array<{ analystId: string; allocatedCents: number; riskGrade: TreasuryRiskGrade }>;
  criticalFinancialAlerts: FinancialException[];
  systemHealth: "READY" | "WATCH" | "BLOCKED";
};

export type AnalystTreasuryView = {
  allocations: CapitalAllocationExtension[];
  rewards: AnalystRewardAllocation[];
  notice: string;
};
