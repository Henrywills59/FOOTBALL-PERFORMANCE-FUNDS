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

export type TreasuryLedgerAccountCode =
  | "PERFORMANCE_PARTNER_CAPITAL"
  | "SUBSCRIBER_REVENUE"
  | "COMPANY_TRADING_CAPITAL"
  | "PERFORMANCE_PARTNER_DISTRIBUTIONS"
  | "ANALYST_PERFORMANCE_POOL"
  | "RISK_STABILITY_RESERVE"
  | "COMPANY_GROWTH_OPERATIONS"
  | "PAYMENT_FEES_CLEARING"
  | "TREASURY_SUSPENSE"
  | "TREASURY_REVERSALS";

export type TreasuryLedgerPurpose =
  | "PARTNER_CONTRIBUTION"
  | "PARTNER_RENEWAL"
  | "COMPANY_CAPITALIZATION"
  | "SUBSCRIBER_REVENUE"
  | "SUBSCRIBER_UPGRADE"
  | "COMPANY_REVENUE"
  | "PAYMENT_SUSPENSE"
  | "ELIGIBLE_PROFIT_ALLOCATION"
  | "PERFORMANCE_PARTNER_DISTRIBUTION"
  | "ANALYST_REWARD_ALLOCATION"
  | "RISK_RESERVE_ALLOCATION"
  | "COMPANY_GROWTH_ALLOCATION"
  | "RECONCILIATION_ADJUSTMENT"
  | "PAYMENT_FEE_CLEARING"
  | "REVERSAL";

export type TreasuryLedgerApprovalStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
export type TreasuryLedgerReconciliationStatus = "UNRECONCILED" | "MATCHED" | "DISPUTED" | "EXTERNAL_PENDING";

export type TreasuryMoney = {
  amount: string;
  minorUnits: string;
  currency: string;
  scale: number;
};

export type TreasuryLedgerAccount = {
  code: TreasuryLedgerAccountCode;
  name: string;
  category: "PARTNER_CAPITAL" | "COMPANY_CAPITAL" | "LIABILITY" | "POOL" | "RESERVE" | "REVENUE" | "CLEARING" | "SUSPENSE" | "REVERSAL";
  currencyBalances: Record<string, TreasuryMoney>;
};

export type TreasuryDoubleEntryLine = {
  account: TreasuryLedgerAccountCode;
  direction: "DEBIT" | "CREDIT";
  amount: TreasuryMoney;
  resultingBalance: TreasuryMoney;
};

export type TreasuryDoubleEntryTransaction = {
  id: string;
  sourceAccount: TreasuryLedgerAccountCode;
  destinationAccount: TreasuryLedgerAccountCode;
  amount: TreasuryMoney;
  currency: string;
  purpose: TreasuryLedgerPurpose;
  actorUserId: string;
  approvalStatus: TreasuryLedgerApprovalStatus;
  approvedByUserId: string | null;
  approvedAt: string | null;
  referenceType: string;
  referenceId: string | null;
  externalTransactionReference: string | null;
  reconciliationStatus: TreasuryLedgerReconciliationStatus;
  timestamp: string;
  lines: TreasuryDoubleEntryLine[];
  metadata: Record<string, unknown>;
};

export type TreasuryLedgerAuditLog = {
  id: string;
  action: string;
  actorUserId: string;
  transactionId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export type TreasuryLedgerOverview = {
  accounts: TreasuryLedgerAccount[];
  transactions: TreasuryDoubleEntryTransaction[];
  auditLogs: TreasuryLedgerAuditLog[];
  invariant: {
    balanced: boolean;
    transactionCount: number;
    checkedAt: string;
  };
};

export type TreasuryPaymentClassification =
  | "PERFORMANCE_PARTNER_CAPITAL"
  | "SUBSCRIBER_REVENUE"
  | "COMPANY_REVENUE"
  | "TREASURY_SUSPENSE";

export type TreasuryPaymentRecord = {
  id: string;
  internalPaymentId: string;
  nowPaymentsPaymentId: string | null;
  orderId: string | null;
  userId: string | null;
  contractOrSubscriptionId: string | null;
  paymentPurpose: string;
  classification: TreasuryPaymentClassification;
  originalAmount: TreasuryMoney;
  payAmount: TreasuryMoney;
  blockchainNetwork: "USDT_TRC20" | "USDT_ERC20" | "UNKNOWN";
  payoutWalletReference: string | null;
  transactionHash: string | null;
  paymentStatus: string;
  confirmationCount: number | null;
  exchangeRateSnapshot: Record<string, unknown>;
  networkFee: TreasuryMoney;
  providerFee: TreasuryMoney;
  createdAt: string;
  confirmedAt: string | null;
  reconciledAt: string | null;
  treasuryTransactionId: string | null;
  webhookReceiptId: string | null;
  auditLogReference: string | null;
  reconciliationStatus: "UNMATCHED" | "PARTIALLY_MATCHED" | "MATCHED" | "EXCEPTION" | "RESOLVED";
  reconciliationAlert: string | null;
};

export type PartnerDistributionStatus =
  | "PENDING_CALCULATION"
  | "CALCULATED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "ON_HOLD"
  | "SCHEDULED"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "REVERSED";

export type TreasuryPartnerDistribution = {
  id: string;
  userId: string;
  participationId: string;
  participationAmount: TreasuryMoney;
  participationPlan: string;
  activeFrom: string;
  activeTo: string | null;
  participationWeight: number;
  distributionAmount: TreasuryMoney;
  status: PartnerDistributionStatus;
  holdReason: string | null;
  adjustmentReason: string | null;
  calculationVersion: string;
  seasonId: string | null;
  createdAt: string;
};

export type TreasuryAnalystPoolAllocation = {
  id: string;
  analystId: string;
  eligiblePoints: number;
  totalEligiblePoints: number;
  rewardAmount: TreasuryMoney;
  status: "CALCULATED" | "UNDER_REVIEW" | "APPROVED" | "ON_HOLD";
  calculationVersion: string;
  adjustmentReason: string | null;
  createdAt: string;
};

export type TreasuryApprovalEvent = {
  id: string;
  entityType: string;
  entityId: string;
  actorUserId: string;
  actorRole: string;
  reason: string;
  previousStatus: string;
  newStatus: string;
  auditReference: string;
  createdAt: string;
};

export type TreasuryPayoutInstruction = {
  id: string;
  recipientUserId: string;
  distributionId: string;
  amount: TreasuryMoney;
  network: "USDT_TRC20" | "USDT_ERC20";
  recipientAddress: string;
  status: "READY_FOR_APPROVAL" | "INVALID" | "DUPLICATE_BLOCKED";
  validationErrors: string[];
  idempotencyKey: string;
};

export type TreasuryPayoutBatch = {
  id: string;
  network: "USDT_TRC20" | "USDT_ERC20";
  status: "DRAFT" | "READY_FOR_APPROVAL" | "APPROVED" | "BLOCKED";
  instructions: TreasuryPayoutInstruction[];
  totalAmount: TreasuryMoney;
  providerFeeEstimate: TreasuryMoney;
  idempotencyKey: string;
  createdBy: string;
  createdAt: string;
};

export type TreasuryAutomationOverview = {
  controlledAccounts: TreasuryLedgerAccountCode[];
  paymentRecords: TreasuryPaymentRecord[];
  partnerDistributions: TreasuryPartnerDistribution[];
  analystPoolAllocations: TreasuryAnalystPoolAllocation[];
  payoutBatches: TreasuryPayoutBatch[];
  approvalEvents: TreasuryApprovalEvent[];
  reconciliationQueue: TreasuryPaymentRecord[];
  auditAlerts: FinancialException[];
  dashboard: {
    balanceByAccount: Record<string, Record<string, TreasuryMoney>>;
    balanceByCurrency: Record<string, TreasuryMoney>;
    balanceByNetwork: Record<string, TreasuryMoney>;
    pendingConfirmations: number;
    pendingReconciliation: number;
    approvedPayoutBatches: number;
    failedPayouts: number;
  };
};
