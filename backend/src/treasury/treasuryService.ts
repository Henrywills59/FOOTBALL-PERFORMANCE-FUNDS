import type {
  AnalystRewardAllocation,
  AnalystTreasuryView,
  BetExecutionRecord,
  CapitalAllocationExtension,
  CompanyShareAllocation,
  ExecutiveSituationRoom,
  FinancialException,
  InvestorDistributionAllocation,
  MatchReconciliation,
  MatchSettlement,
  ProfitDistributionPolicy,
  TradingDaySummary,
  TreasuryDashboard,
  TreasuryDoubleEntryTransaction,
  TreasuryAnalystPoolAllocation,
  TreasuryAutomationOverview,
  TreasuryLedgerAccount,
  TreasuryLedgerAccountCode,
  TreasuryLedgerAuditLog,
  TreasuryLedgerApprovalStatus,
  TreasuryLedgerEntry,
  TreasuryLedgerPurpose,
  TreasuryLedgerReconciliationStatus,
  TreasuryLedgerOverview,
  TreasuryMoney,
  TreasuryPartnerDistribution,
  TreasuryPaymentRecord,
  TreasuryPayoutBatch,
  TreasuryPayoutInstruction,
  TreasuryApprovalEvent,
  TreasurySettlementOutcome,
  WeeklyFinancialPeriod,
} from "./types.js";

const now = () => new Date().toISOString();
const cents = (value: number) => Math.max(0, Math.round(value));

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function sum(items: number[]) {
  return items.reduce((total, item) => total + item, 0);
}

const ledgerAccountDefinitions: Array<Omit<TreasuryLedgerAccount, "currencyBalances">> = [
  { code: "PERFORMANCE_PARTNER_CAPITAL", name: "Performance Partner Capital", category: "PARTNER_CAPITAL" },
  { code: "SUBSCRIBER_REVENUE", name: "Subscriber Revenue", category: "REVENUE" },
  { code: "COMPANY_TRADING_CAPITAL", name: "Company Trading Capital", category: "COMPANY_CAPITAL" },
  { code: "PERFORMANCE_PARTNER_DISTRIBUTIONS", name: "Performance Partner Distributions", category: "LIABILITY" },
  { code: "ANALYST_PERFORMANCE_POOL", name: "Analyst Performance Pool", category: "POOL" },
  { code: "RISK_STABILITY_RESERVE", name: "Risk & Stability Reserve", category: "RESERVE" },
  { code: "COMPANY_GROWTH_OPERATIONS", name: "Company Growth & Operations", category: "COMPANY_CAPITAL" },
  { code: "PAYMENT_FEES_CLEARING", name: "Payment Fees Clearing", category: "CLEARING" },
  { code: "TREASURY_SUSPENSE", name: "Treasury Suspense", category: "SUSPENSE" },
  { code: "TREASURY_REVERSALS", name: "Treasury Reversals", category: "REVERSAL" },
];

const financialConstitutionVersion = "FPF_FINANCIAL_CONSTITUTION_35_15_15_35_V1";

const currencyScale: Record<string, number> = {
  BHD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  UGX: 0,
  JPY: 0,
};

function scaleFor(currency: string) {
  return currencyScale[currency.toUpperCase()] ?? 2;
}

function parseMoney(amount: string | number, currency: string, allowZero = false): TreasuryMoney {
  const scale = scaleFor(currency);
  const normalized = String(amount).trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new TreasuryControlError("Amount must be a positive decimal string.");
  const [major, fraction = ""] = normalized.split(".");
  if (fraction.length > scale) throw new TreasuryControlError(`Amount exceeds ${scale} decimal places for ${currency.toUpperCase()}.`);
  const minorUnits = BigInt(major) * 10n ** BigInt(scale) + BigInt((fraction.padEnd(scale, "0") || "0"));
  if (allowZero ? minorUnits < 0n : minorUnits <= 0n) throw new TreasuryControlError("Amount must be greater than zero.");
  return formatMoney(minorUnits, currency.toUpperCase(), scale);
}

function formatMoney(minorUnits: bigint, currency: string, scale = scaleFor(currency)): TreasuryMoney {
  const negative = minorUnits < 0n;
  const absolute = negative ? -minorUnits : minorUnits;
  const divisor = 10n ** BigInt(scale);
  const major = absolute / divisor;
  const fraction = absolute % divisor;
  const amount = scale === 0
    ? `${negative ? "-" : ""}${major.toString()}`
    : `${negative ? "-" : ""}${major.toString()}.${fraction.toString().padStart(scale, "0")}`;
  return { amount, minorUnits: `${negative ? "-" : ""}${absolute.toString()}`, currency, scale };
}

function moneyToBigInt(value: TreasuryMoney) {
  return BigInt(value.minorUnits);
}

function defaultAllocation(): CapitalAllocationExtension {
  return {
    id: "alloc_fpf_placeholder_001",
    fixture: "FPF Intelligence Candidate vs Market Risk",
    market: "Over/Under 2.5",
    selection: "Over 2.5 Goals",
    analystIds: ["analyst-placeholder"],
    recommendedStakeCents: 25000,
    maximumAllowedStakeCents: 30000,
    dailyAllocationCents: 25000,
    weeklyAllocationCents: 25000,
    matchAllocationCents: 25000,
    marketAllocationCents: 25000,
    riskGrade: "MEDIUM",
    expectedReturnCents: 45000,
    approvalStatus: "APPROVED",
    allocationTimestamp: now(),
    allocatedBy: "SYSTEM_PLACEHOLDER",
    controls: {
      analystRank: "Internal analyst placeholder",
      reliabilityIndex: 82,
      disciplineScore: 91,
      historicalRoi: 8.4,
      recentPerformance: "Positive controlled exposure",
      drawdown: 2.1,
      capitalEfficiency: 78,
      dailyExposureLimitCents: 100000,
      weeklyExposureLimitCents: 500000,
    },
  };
}

export class TreasuryControlError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

export class TreasuryService {
  private readonly ledgerBalances = new Map<TreasuryLedgerAccountCode, Map<string, bigint>>();
  private readonly ledgerTransactions: TreasuryDoubleEntryTransaction[] = [];
  private readonly ledgerAuditLogs: TreasuryLedgerAuditLog[] = [];
  private readonly paymentRecords: TreasuryPaymentRecord[] = [];
  private readonly partnerDistributions: TreasuryPartnerDistribution[] = [];
  private readonly analystPoolAllocations: TreasuryAnalystPoolAllocation[] = [];
  private readonly payoutBatches: TreasuryPayoutBatch[] = [];
  private readonly approvalEvents: TreasuryApprovalEvent[] = [];
  private readonly allocations: CapitalAllocationExtension[] = [defaultAllocation()];
  private readonly ledger: TreasuryLedgerEntry[] = [
    {
      id: "ledger_initial_treasury",
      account: "COMPANY_TREASURY",
      direction: "CREDIT",
      amountCents: 1000000,
      classification: "OPENING_BALANCE_PLACEHOLDER",
      referenceType: "SYSTEM",
      referenceId: null,
      notes: "Safe placeholder treasury balance for manual execution controls.",
      createdBy: "SYSTEM_PLACEHOLDER",
      createdAt: now(),
    },
  ];
  private readonly executions: BetExecutionRecord[] = [];
  private readonly settlements: MatchSettlement[] = [];
  private readonly reconciliations: MatchReconciliation[] = [];
  private readonly companyShares: CompanyShareAllocation[] = [];
  private readonly analystRewards: AnalystRewardAllocation[] = [];
  private readonly investorDistributions: InvestorDistributionAllocation[] = [];
  private readonly exceptions: FinancialException[] = [];
  private policy: ProfitDistributionPolicy = {
    id: "policy_50_20_30",
    version: 1,
    companySharePercent: 50,
    analystRewardPercent: 20,
    investorDistributionPercent: 30,
    active: true,
    updatedBy: "SYSTEM_PLACEHOLDER",
    updatedAt: now(),
  };
  private dailyStatus: TradingDaySummary["status"] = "OPEN";
  private dailyClosureNotes: string | null = null;
  private weeklyStatus: WeeklyFinancialPeriod["status"] = "OPEN";

  ledgerOverview(): TreasuryLedgerOverview {
    return {
      accounts: this.ledgerAccounts(),
      transactions: this.ledgerTransactions.slice().reverse(),
      auditLogs: this.ledgerAuditLogs.slice().reverse(),
      invariant: {
        balanced: this.ledgerTransactions.every((transaction) => this.transactionBalances(transaction)),
        transactionCount: this.ledgerTransactions.length,
        checkedAt: now(),
      },
    };
  }

  automationOverview(): TreasuryAutomationOverview {
    const accounts = this.ledgerAccounts();
    const balanceByAccount = Object.fromEntries(accounts.map((account) => [account.code, account.currencyBalances]));
    const balanceByCurrency: Record<string, bigint> = {};
    for (const account of accounts) {
      for (const [currency, money] of Object.entries(account.currencyBalances)) {
        balanceByCurrency[currency] = (balanceByCurrency[currency] ?? 0n) + moneyToBigInt(money);
      }
    }
    const balanceByNetwork: Record<string, bigint> = {};
    for (const record of this.paymentRecords) {
      if (record.reconciliationStatus === "MATCHED" || record.reconciliationStatus === "RESOLVED") {
        balanceByNetwork[record.blockchainNetwork] = (balanceByNetwork[record.blockchainNetwork] ?? 0n) + moneyToBigInt(record.payAmount);
      }
    }
    return {
      controlledAccounts: ledgerAccountDefinitions.map((account) => account.code),
      paymentRecords: this.paymentRecords.slice().reverse(),
      partnerDistributions: this.partnerDistributions.slice().reverse(),
      analystPoolAllocations: this.analystPoolAllocations.slice().reverse(),
      payoutBatches: this.payoutBatches.slice().reverse(),
      approvalEvents: this.approvalEvents.slice().reverse(),
      reconciliationQueue: this.paymentRecords.filter((record) => record.reconciliationStatus !== "MATCHED" && record.reconciliationStatus !== "RESOLVED"),
      auditAlerts: this.exceptions,
      dashboard: {
        balanceByAccount,
        balanceByCurrency: Object.fromEntries(Object.entries(balanceByCurrency).map(([currency, value]) => [currency, formatMoney(value, currency)])),
        balanceByNetwork: Object.fromEntries(Object.entries(balanceByNetwork).map(([network, value]) => [network, formatMoney(value, "USD")])),
        pendingConfirmations: this.paymentRecords.filter((record) => !["CONFIRMED", "FINISHED"].includes(record.paymentStatus)).length,
        pendingReconciliation: this.paymentRecords.filter((record) => record.reconciliationStatus !== "MATCHED" && record.reconciliationStatus !== "RESOLVED").length,
        approvedPayoutBatches: this.payoutBatches.filter((batch) => batch.status === "APPROVED").length,
        failedPayouts: this.payoutBatches.flatMap((batch) => batch.instructions).filter((instruction) => instruction.status === "INVALID").length,
      },
    };
  }

  classifyIncomingPayment(actorUserId: string, input: {
    internalPaymentId?: string | null;
    nowPaymentsPaymentId?: string | null;
    orderId?: string | null;
    userId?: string | null;
    contractOrSubscriptionId?: string | null;
    paymentPurpose?: string | null;
    originalAmount: string | number;
    originalCurrency?: string;
    payAmount?: string | number;
    payCurrency?: string;
    blockchainNetwork?: "USDT_TRC20" | "USDT_ERC20" | "UNKNOWN";
    payoutWalletReference?: string | null;
    transactionHash?: string | null;
    paymentStatus?: string;
    confirmationCount?: number | null;
    exchangeRateSnapshot?: Record<string, unknown>;
    networkFee?: string | number;
    providerFee?: string | number;
    webhookReceiptId?: string | null;
  }) {
    const paymentPurpose = String(input.paymentPurpose ?? "UNRECOGNISED").trim().toUpperCase();
    const originalCurrency = (input.originalCurrency ?? "USD").toUpperCase();
    const payCurrency = (input.payCurrency ?? originalCurrency).toUpperCase();
    const classification = this.classifyPurpose(paymentPurpose);
    const destinationAccount = this.destinationForClassification(classification);
    const reconciliationStatus = classification === "TREASURY_SUSPENSE" ? "EXCEPTION" : "MATCHED";
    const reconciliationAlert = classification === "TREASURY_SUSPENSE"
      ? "Payment purpose was unrecognised, incomplete, conflicting or unmatched. Routed to Treasury Suspense."
      : null;
    const transaction = this.createLedgerTransaction(actorUserId, {
      sourceAccount: destinationAccount === "TREASURY_SUSPENSE" ? "PAYMENT_FEES_CLEARING" : "TREASURY_SUSPENSE",
      destinationAccount,
      amount: input.originalAmount,
      currency: originalCurrency,
      purpose: this.purposeForClassification(classification, paymentPurpose),
      referenceType: "NOWPAYMENTS_PAYMENT",
      referenceId: input.orderId ?? input.nowPaymentsPaymentId ?? null,
      externalTransactionReference: input.transactionHash ?? null,
      reconciliationStatus: reconciliationStatus === "MATCHED" ? "MATCHED" : "DISPUTED",
      approvalStatus: "APPROVED",
      metadata: {
        paymentPurpose,
        classification,
        blockchainNetwork: input.blockchainNetwork ?? "UNKNOWN",
        payoutWalletReference: input.payoutWalletReference ?? null,
        webhookReceiptId: input.webhookReceiptId ?? null,
        financialConstitutionVersion,
      },
    });
    const auditReference = this.auditLedger(actorUserId, "PAYMENT_CLASSIFIED", transaction.id, {
      classification,
      paymentPurpose,
      reconciliationStatus,
      secretValuesExposed: false,
    });
    const record: TreasuryPaymentRecord = {
      id: id("treasury_payment"),
      internalPaymentId: input.internalPaymentId?.trim() || transaction.id,
      nowPaymentsPaymentId: input.nowPaymentsPaymentId ?? null,
      orderId: input.orderId ?? null,
      userId: input.userId ?? null,
      contractOrSubscriptionId: input.contractOrSubscriptionId ?? null,
      paymentPurpose,
      classification,
      originalAmount: parseMoney(input.originalAmount, originalCurrency),
      payAmount: parseMoney(input.payAmount ?? input.originalAmount, payCurrency),
      blockchainNetwork: input.blockchainNetwork ?? "UNKNOWN",
      payoutWalletReference: input.payoutWalletReference ?? null,
      transactionHash: input.transactionHash ?? null,
      paymentStatus: input.paymentStatus ?? "CONFIRMED",
      confirmationCount: input.confirmationCount ?? null,
      exchangeRateSnapshot: input.exchangeRateSnapshot ?? {},
      networkFee: parseMoney(input.networkFee ?? 0, originalCurrency, true),
      providerFee: parseMoney(input.providerFee ?? 0, originalCurrency, true),
      createdAt: now(),
      confirmedAt: ["CONFIRMED", "FINISHED"].includes(input.paymentStatus ?? "CONFIRMED") ? now() : null,
      reconciledAt: reconciliationStatus === "MATCHED" ? now() : null,
      treasuryTransactionId: transaction.id,
      webhookReceiptId: input.webhookReceiptId ?? null,
      auditLogReference: auditReference.id,
      reconciliationStatus,
      reconciliationAlert,
    };
    this.paymentRecords.push(record);
    if (reconciliationAlert) this.flagException("PAYMENT_RECONCILIATION_ALERT", "HIGH", record.id, reconciliationAlert);
    return record;
  }

  calculatePerformancePartnerDistributions(actorUserId: string, input: {
    approvedPoolAmount: string | number;
    currency?: string;
    seasonId?: string | null;
    calculationVersion?: string;
    participations: Array<{
      participationId: string;
      userId: string;
      participationAmount: string | number;
      participationPlan: string;
      activeFrom: string;
      activeTo?: string | null;
      eligible?: boolean;
      holdReason?: string | null;
      adjustmentAmount?: string | number;
      adjustmentReason?: string | null;
    }>;
  }) {
    const currency = (input.currency ?? "USD").toUpperCase();
    const pool = parseMoney(input.approvedPoolAmount, currency, true);
    const poolMinor = moneyToBigInt(pool);
    if (poolMinor <= 0n) return [];
    const eligible = input.participations.filter((item) => item.eligible !== false && !item.holdReason && item.userId && item.participationId);
    const weights = eligible.map((item) => moneyToBigInt(parseMoney(item.participationAmount, currency)));
    const totalWeight = weights.reduce((total, item) => total + item, 0n);
    if (totalWeight <= 0n) return [];
    let allocated = 0n;
    const distributions = eligible.map((item, index) => {
      const baseAmount = index === eligible.length - 1 ? poolMinor - allocated : (poolMinor * weights[index]) / totalWeight;
      allocated += baseAmount;
      const adjustment = moneyToBigInt(parseMoney(item.adjustmentAmount ?? 0, currency, true));
      const finalAmount = baseAmount + adjustment > 0n ? baseAmount + adjustment : 0n;
      const distribution: TreasuryPartnerDistribution = {
        id: id("partner_distribution"),
        userId: item.userId,
        participationId: item.participationId,
        participationAmount: parseMoney(item.participationAmount, currency),
        participationPlan: item.participationPlan,
        activeFrom: item.activeFrom,
        activeTo: item.activeTo ?? null,
        participationWeight: Number((Number(weights[index]) / Number(totalWeight)).toFixed(6)),
        distributionAmount: formatMoney(finalAmount, currency),
        status: "CALCULATED",
        holdReason: null,
        adjustmentReason: item.adjustmentReason ?? null,
        calculationVersion: input.calculationVersion ?? financialConstitutionVersion,
        seasonId: input.seasonId ?? null,
        createdAt: now(),
      };
      this.auditLedger(actorUserId, "PARTNER_DISTRIBUTION_CALCULATED", null, {
        distributionId: distribution.id,
        participationId: distribution.participationId,
        noRetroactiveEarnings: true,
        noPrincipalRepaymentAfterCompletion: true,
      });
      return distribution;
    });
    this.partnerDistributions.push(...distributions);
    return distributions;
  }

  calculateAnalystPerformancePool(actorUserId: string, input: {
    approvedPoolAmount: string | number;
    currency?: string;
    calculationVersion?: string;
    analysts: Array<{ analystId: string; eligiblePoints: number; adjustmentReason?: string | null }>;
  }) {
    const currency = (input.currency ?? "USD").toUpperCase();
    const pool = parseMoney(input.approvedPoolAmount, currency, true);
    const poolMinor = moneyToBigInt(pool);
    const analysts = input.analysts.filter((item) => item.analystId && item.eligiblePoints > 0);
    const totalPoints = analysts.reduce((total, item) => total + item.eligiblePoints, 0);
    if (poolMinor <= 0n || totalPoints <= 0) return [];
    let allocated = 0n;
    const allocations = analysts.map((item, index) => {
      const amount = index === analysts.length - 1 ? poolMinor - allocated : (poolMinor * BigInt(Math.round(item.eligiblePoints * 1000))) / BigInt(Math.round(totalPoints * 1000));
      allocated += amount;
      const allocation: TreasuryAnalystPoolAllocation = {
        id: id("analyst_pool"),
        analystId: item.analystId,
        eligiblePoints: item.eligiblePoints,
        totalEligiblePoints: totalPoints,
        rewardAmount: formatMoney(amount, currency),
        status: "CALCULATED",
        calculationVersion: input.calculationVersion ?? financialConstitutionVersion,
        adjustmentReason: item.adjustmentReason ?? null,
        createdAt: now(),
      };
      this.auditLedger(actorUserId, "ANALYST_POOL_CALCULATED", null, {
        allocationId: allocation.id,
        analystId: allocation.analystId,
        equalSharingProhibited: true,
      });
      return allocation;
    });
    this.analystPoolAllocations.push(...allocations);
    return allocations;
  }

  recordApproval(actorUserId: string, input: {
    actorRole: string;
    entityType: string;
    entityId: string;
    reason: string;
    previousStatus: string;
    newStatus: string;
  }) {
    if (this.approvalEvents.some((event) => event.entityId === input.entityId && event.actorUserId === actorUserId && event.previousStatus !== input.previousStatus)) {
      throw new TreasuryControlError("Segregation of duties violation: actor already completed an incompatible approval stage.", 403);
    }
    const audit = this.auditLedger(actorUserId, "TREASURY_APPROVAL_EVENT", null, input);
    const event: TreasuryApprovalEvent = {
      id: id("approval"),
      entityType: input.entityType,
      entityId: input.entityId,
      actorUserId,
      actorRole: input.actorRole,
      reason: input.reason,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      auditReference: audit.id,
      createdAt: now(),
    };
    this.approvalEvents.push(event);
    this.applyApprovalStatus(event);
    return event;
  }

  preparePayoutBatch(actorUserId: string, input: {
    network: "USDT_TRC20" | "USDT_ERC20";
    minimumPayoutAmount?: string | number;
    providerFeeEstimate?: string | number;
    instructions: Array<{ distributionId: string; recipientUserId: string; recipientAddress: string; amount: string | number }>;
  }) {
    const currency = input.network === "USDT_TRC20" ? "USDTTRC20" : "USDTERC20";
    const minimum = moneyToBigInt(parseMoney(input.minimumPayoutAmount ?? "1", currency));
    const seen = new Set<string>();
    let total = 0n;
    const instructions: TreasuryPayoutInstruction[] = input.instructions.map((item) => {
      const amount = parseMoney(item.amount, currency);
      const duplicateKey = `${input.network}:${item.recipientAddress}:${item.distributionId}`;
      const validationErrors = [
        ...this.validatePayoutAddress(input.network, item.recipientAddress),
        ...(moneyToBigInt(amount) < minimum ? ["Amount is below minimum payout threshold."] : []),
        ...(seen.has(duplicateKey) || this.payoutBatches.some((batch) => batch.instructions.some((instruction) => instruction.idempotencyKey === duplicateKey))
          ? ["Duplicate payout instruction blocked."]
          : []),
      ];
      seen.add(duplicateKey);
      if (!validationErrors.length) total += moneyToBigInt(amount);
      return {
        id: id("payout_instruction"),
        recipientUserId: item.recipientUserId,
        distributionId: item.distributionId,
        amount,
        network: input.network,
        recipientAddress: item.recipientAddress,
        status: validationErrors.length ? validationErrors.some((error) => error.includes("Duplicate")) ? "DUPLICATE_BLOCKED" : "INVALID" : "READY_FOR_APPROVAL",
        validationErrors,
        idempotencyKey: duplicateKey,
      };
    });
    const batch: TreasuryPayoutBatch = {
      id: id("payout_batch"),
      network: input.network,
      status: instructions.every((instruction) => instruction.status === "READY_FOR_APPROVAL") ? "READY_FOR_APPROVAL" : "BLOCKED",
      instructions,
      totalAmount: formatMoney(total, currency),
      providerFeeEstimate: parseMoney(input.providerFeeEstimate ?? 0, currency, true),
      idempotencyKey: `${input.network}:${instructions.map((instruction) => instruction.idempotencyKey).join("|")}`,
      createdBy: actorUserId,
      createdAt: now(),
    };
    this.payoutBatches.push(batch);
    this.auditLedger(actorUserId, "PAYOUT_BATCH_PREPARED", null, {
      batchId: batch.id,
      network: batch.network,
      livePayoutExecuted: false,
      status: batch.status,
    });
    return batch;
  }

  createReversal(actorUserId: string, input: {
    originalTransactionId: string;
    reason: string;
    amount: string | number;
    currency?: string;
    externalTransactionReference?: string | null;
  }) {
    const transaction = this.createLedgerTransaction(actorUserId, {
      sourceAccount: "TREASURY_REVERSALS",
      destinationAccount: "TREASURY_SUSPENSE",
      amount: input.amount,
      currency: input.currency ?? "USD",
      purpose: "REVERSAL",
      referenceType: "REVERSAL",
      referenceId: input.originalTransactionId,
      externalTransactionReference: input.externalTransactionReference ?? null,
      approvalStatus: "APPROVED",
      reconciliationStatus: "DISPUTED",
      metadata: {
        reversalReason: input.reason,
        immutableCorrection: true,
      },
    });
    this.flagException("TREASURY_REVERSAL_CREATED", "MEDIUM", transaction.id, input.reason);
    return transaction;
  }

  resolveReconciliationException(actorUserId: string, input: { paymentRecordId: string; reason: string; compensatingTransactionId?: string | null }) {
    const record = this.paymentRecords.find((candidate) => candidate.id === input.paymentRecordId);
    if (!record) throw new TreasuryControlError("Payment record not found.", 404);
    record.reconciliationStatus = "RESOLVED";
    record.reconciledAt = now();
    record.reconciliationAlert = null;
    const audit = this.auditLedger(actorUserId, "RECONCILIATION_EXCEPTION_RESOLVED", record.treasuryTransactionId, {
      paymentRecordId: record.id,
      reason: input.reason,
      compensatingTransactionId: input.compensatingTransactionId ?? null,
      directBalanceEditing: false,
    });
    record.auditLogReference = audit.id;
    return record;
  }

  createLedgerTransaction(actorUserId: string, input: {
    sourceAccount: TreasuryLedgerAccountCode;
    destinationAccount: TreasuryLedgerAccountCode;
    amount: string | number;
    currency?: string;
    purpose: TreasuryLedgerPurpose;
    referenceType?: string;
    referenceId?: string | null;
    externalTransactionReference?: string | null;
    reconciliationStatus?: TreasuryLedgerReconciliationStatus;
    metadata?: Record<string, unknown>;
    approvalStatus?: TreasuryLedgerApprovalStatus;
  }) {
    const currency = (input.currency ?? "USD").toUpperCase();
    this.validateLedgerTransaction(input.sourceAccount, input.destinationAccount, input.purpose);
    const amount = parseMoney(input.amount, currency);
    const transaction: TreasuryDoubleEntryTransaction = {
      id: id("treasury_txn"),
      sourceAccount: input.sourceAccount,
      destinationAccount: input.destinationAccount,
      amount,
      currency,
      purpose: input.purpose,
      actorUserId,
      approvalStatus: input.approvalStatus ?? "PENDING_APPROVAL",
      approvedByUserId: null,
      approvedAt: null,
      referenceType: input.referenceType ?? "INTERNAL_LEDGER",
      referenceId: input.referenceId ?? null,
      externalTransactionReference: input.externalTransactionReference ?? null,
      reconciliationStatus: input.reconciliationStatus ?? "UNRECONCILED",
      timestamp: now(),
      lines: [],
      metadata: input.metadata ?? {},
    };
    this.ledgerTransactions.push(transaction);
    this.auditLedger(actorUserId, "LEDGER_TRANSACTION_CREATED", transaction.id, {
      purpose: transaction.purpose,
      currency,
      amountMinorUnits: amount.minorUnits,
      approvalStatus: transaction.approvalStatus,
    });
    if (transaction.approvalStatus === "APPROVED") {
      return this.approveLedgerTransaction(actorUserId, transaction.id);
    }
    return transaction;
  }

  approveLedgerTransaction(actorUserId: string, transactionId: string) {
    const transaction = this.ledgerTransactions.find((candidate) => candidate.id === transactionId);
    if (!transaction) throw new TreasuryControlError("Ledger transaction not found", 404);
    if (transaction.approvalStatus === "REJECTED") throw new TreasuryControlError("Rejected ledger transactions cannot be approved.");
    if (transaction.lines.length) return transaction;

    const amount = moneyToBigInt(transaction.amount);
    const sourceBalance = this.adjustLedgerBalance(transaction.sourceAccount, transaction.currency, -amount);
    const destinationBalance = this.adjustLedgerBalance(transaction.destinationAccount, transaction.currency, amount);
    transaction.lines.push(
      {
        account: transaction.sourceAccount,
        direction: "CREDIT",
        amount: transaction.amount,
        resultingBalance: sourceBalance,
      },
      {
        account: transaction.destinationAccount,
        direction: "DEBIT",
        amount: transaction.amount,
        resultingBalance: destinationBalance,
      },
    );
    transaction.approvalStatus = "APPROVED";
    transaction.approvedByUserId = actorUserId;
    transaction.approvedAt = now();
    this.auditLedger(actorUserId, "LEDGER_TRANSACTION_APPROVED", transaction.id, {
      sourceAccount: transaction.sourceAccount,
      destinationAccount: transaction.destinationAccount,
      amountMinorUnits: transaction.amount.minorUnits,
      currency: transaction.currency,
    });
    return transaction;
  }

  rejectLedgerTransaction(actorUserId: string, transactionId: string, reason?: string | null) {
    const transaction = this.ledgerTransactions.find((candidate) => candidate.id === transactionId);
    if (!transaction) throw new TreasuryControlError("Ledger transaction not found", 404);
    if (transaction.lines.length) throw new TreasuryControlError("Approved ledger transactions are immutable and cannot be rejected.");
    transaction.approvalStatus = "REJECTED";
    this.auditLedger(actorUserId, "LEDGER_TRANSACTION_REJECTED", transaction.id, { reason: reason ?? null });
    return transaction;
  }

  updateLedgerReconciliation(actorUserId: string, transactionId: string, input: {
    reconciliationStatus: TreasuryLedgerReconciliationStatus;
    externalTransactionReference?: string | null;
  }) {
    const transaction = this.ledgerTransactions.find((candidate) => candidate.id === transactionId);
    if (!transaction) throw new TreasuryControlError("Ledger transaction not found", 404);
    transaction.reconciliationStatus = input.reconciliationStatus;
    transaction.externalTransactionReference = input.externalTransactionReference ?? transaction.externalTransactionReference;
    this.auditLedger(actorUserId, "LEDGER_RECONCILIATION_UPDATED", transaction.id, {
      reconciliationStatus: transaction.reconciliationStatus,
      externalTransactionReferencePresent: Boolean(transaction.externalTransactionReference),
    });
    return transaction;
  }

  allocateEligibleProfit(actorUserId: string, input: {
    amount: string | number;
    currency?: string;
    referenceId?: string | null;
    externalTransactionReference?: string | null;
  }) {
    const currency = (input.currency ?? "USD").toUpperCase();
    const eligibleProfit = parseMoney(input.amount, currency);
    const total = moneyToBigInt(eligibleProfit);
    const allocations: Array<{ destinationAccount: TreasuryLedgerAccountCode; basisPoints: bigint; purpose: TreasuryLedgerPurpose }> = [
      { destinationAccount: "PERFORMANCE_PARTNER_DISTRIBUTIONS", basisPoints: 3500n, purpose: "PERFORMANCE_PARTNER_DISTRIBUTION" },
      { destinationAccount: "ANALYST_PERFORMANCE_POOL", basisPoints: 1500n, purpose: "ANALYST_REWARD_ALLOCATION" },
      { destinationAccount: "RISK_STABILITY_RESERVE", basisPoints: 1500n, purpose: "RISK_RESERVE_ALLOCATION" },
      { destinationAccount: "COMPANY_GROWTH_OPERATIONS", basisPoints: 3500n, purpose: "COMPANY_GROWTH_ALLOCATION" },
    ];
    let allocated = 0n;
    return allocations.map((allocation, index) => {
      const amountMinor = index === allocations.length - 1 ? total - allocated : (total * allocation.basisPoints) / 10000n;
      allocated += amountMinor;
      return this.createLedgerTransaction(actorUserId, {
        sourceAccount: "COMPANY_TRADING_CAPITAL",
        destinationAccount: allocation.destinationAccount,
        amount: formatMoney(amountMinor, currency).amount,
        currency,
        purpose: allocation.purpose,
        referenceType: "VERIFIED_ELIGIBLE_PROFIT",
        referenceId: input.referenceId ?? null,
        externalTransactionReference: input.externalTransactionReference ?? null,
        approvalStatus: "APPROVED",
        metadata: {
          allocationPolicy: "35/15/15/35",
          eligibleProfitOnly: true,
          excludesPartnerPrincipal: true,
          excludesGrossDeposits: true,
        },
      });
    });
  }

  dashboard(): TreasuryDashboard {
    return {
      accounts: this.accounts(),
      ledger: this.ledger.slice(0, 25),
      capitalAllocations: this.allocations,
      executions: this.executions,
      settlements: this.settlements,
      reconciliations: this.reconciliations,
      daily: this.daily(),
      weekly: this.weekly(),
      policy: this.policy,
      analystRewards: this.analystRewards,
      investorDistributions: this.investorDistributions,
      companyShares: this.companyShares,
      exceptions: this.exceptions,
    };
  }

  analystView(analystId: string): AnalystTreasuryView {
    return {
      allocations: this.allocations.filter((allocation) => allocation.analystIds.includes(analystId)),
      rewards: this.analystRewards.filter((reward) => reward.analystId === analystId),
      notice: "Analysts only see their own approved allocations and calculated reward placeholders. Company treasury and investor data remain private.",
    };
  }

  createExecution(actorUserId: string, input: Partial<BetExecutionRecord> & { allocationId: string }) {
    const allocation = this.allocations.find((candidate) => candidate.id === input.allocationId);
    if (!allocation) throw new TreasuryControlError("Approved allocation not found", 404);

    const actualStakeCents = cents(input.actualStakeCents ?? allocation.recommendedStakeCents);
    const actualOdds = Number(input.actualOdds ?? 1.8);
    const recommendedOdds = Number(input.recommendedOdds ?? 1.8);
    const stakeVariance = actualStakeCents !== allocation.recommendedStakeCents;
    const oddsVariance = Math.abs(actualOdds - recommendedOdds) > 0.001;
    const varianceReason = input.varianceReason?.trim() || null;

    if ((stakeVariance || oddsVariance) && !varianceReason) {
      this.flagException("EXECUTION_VARIANCE_REASON_MISSING", "HIGH", allocation.id, "Stake or odds variance requires an execution reason.");
      throw new TreasuryControlError("Stake or odds variance requires a reason.");
    }
    if (actualStakeCents > allocation.maximumAllowedStakeCents) {
      this.flagException("STAKE_ABOVE_AUTHORIZED_ALLOCATION", "CRITICAL", allocation.id, "Actual stake is above the authorized allocation.");
      throw new TreasuryControlError("Actual stake exceeds maximum allowed stake.");
    }

    const execution: BetExecutionRecord = {
      id: id("exec"),
      allocationId: allocation.id,
      fixture: allocation.fixture,
      market: allocation.market,
      selection: allocation.selection,
      recommendedStakeCents: allocation.recommendedStakeCents,
      actualStakeCents,
      recommendedOdds,
      actualOdds,
      bookmaker: input.bookmaker?.trim() || "Manual bookmaker placeholder",
      betReference: input.betReference?.trim() || "PENDING_REFERENCE",
      placedAt: input.placedAt ?? now(),
      currency: input.currency ?? "USD",
      status: input.status ?? "PLACED",
      varianceReason,
      executionNotes: input.executionNotes ?? null,
      evidencePlaceholder: input.evidencePlaceholder ?? "Evidence upload placeholder",
      executedBy: actorUserId,
    };
    if (execution.betReference === "PENDING_REFERENCE") {
      this.flagException("MISSING_BOOKMAKER_REFERENCE", "MEDIUM", execution.id, "Manual execution is missing a bookmaker reference.");
    }
    this.executions.push(execution);
    this.ledger.push(this.ledgerEntry("CAPITAL_EXPOSURE", "DEBIT", actualStakeCents, "MANUAL_BET_EXECUTION", "BET_EXECUTION", execution.id, actorUserId));
    return execution;
  }

  settleExecution(actorUserId: string, executionId: string, input: { outcome: TreasurySettlementOutcome; verificationStatus?: "PENDING" | "VERIFIED" }) {
    const execution = this.executions.find((candidate) => candidate.id === executionId);
    if (!execution) throw new TreasuryControlError("Execution record not found", 404);
    if (this.settlements.some((settlement) => settlement.executionId === executionId)) {
      this.flagException("DUPLICATE_SETTLEMENT", "CRITICAL", executionId, "Duplicate settlement attempt blocked.");
      throw new TreasuryControlError("Settlement already exists for this execution.");
    }

    const settlement = this.calculateSettlement(actorUserId, execution, input.outcome, input.verificationStatus ?? "PENDING");
    this.settlements.push(settlement);
    execution.status = "SETTLED";
    this.ledger.push(this.ledgerEntry("TREASURY_RETURN", "CREDIT", settlement.grossReturnCents, "MATCH_SETTLEMENT", "MATCH_SETTLEMENT", settlement.id, actorUserId));
    return settlement;
  }

  reconcileSettlement(actorUserId: string, settlementId: string, input: { amountDepositedBackCents: number; notes?: string | null; evidencePlaceholder?: string | null }) {
    const settlement = this.settlements.find((candidate) => candidate.id === settlementId);
    if (!settlement) throw new TreasuryControlError("Settlement not found", 404);
    const execution = this.executions.find((candidate) => candidate.id === settlement.executionId);
    if (!execution) throw new TreasuryControlError("Execution record not found", 404);

    const amountDepositedBackCents = cents(input.amountDepositedBackCents);
    const outstandingDifferenceCents = settlement.grossReturnCents - amountDepositedBackCents;
    const status = outstandingDifferenceCents === 0 ? "RECONCILED" : outstandingDifferenceCents > 0 ? "PARTIALLY_RECONCILED" : "DISPUTED";
    const reconciliation: MatchReconciliation = {
      id: id("recon"),
      settlementId,
      capitalApprovedCents: execution.recommendedStakeCents,
      capitalActuallyStakedCents: execution.actualStakeCents,
      expectedReturnCents: Math.round(execution.recommendedStakeCents * execution.recommendedOdds),
      actualReturnCents: settlement.grossReturnCents,
      capitalExpectedBackCents: settlement.capitalReturnedCents,
      amountDepositedBackCents,
      outstandingDifferenceCents,
      status,
      notes: input.notes ?? null,
      evidencePlaceholder: input.evidencePlaceholder ?? "Reconciliation evidence placeholder",
      reconciledBy: actorUserId,
      reconciledAt: now(),
    };
    this.reconciliations.push(reconciliation);
    if (outstandingDifferenceCents !== 0) {
      this.flagException("RECONCILIATION_DIFFERENCE", "HIGH", reconciliation.id, "Actual returned funds do not match expected return.");
    }
    return reconciliation;
  }

  updatePolicy(actorUserId: string, input: { companySharePercent: number; analystRewardPercent: number; investorDistributionPercent: number }) {
    const total = input.companySharePercent + input.analystRewardPercent + input.investorDistributionPercent;
    if (Math.round(total * 100) !== 10000) {
      this.flagException("PROFIT_SPLIT_NOT_TOTALING_100", "CRITICAL", this.policy.id, "Rejected profit policy because percentages do not total 100%.");
      throw new TreasuryControlError("Distribution policy percentages must total exactly 100%.");
    }
    this.policy = {
      id: this.policy.id,
      version: this.policy.version + 1,
      companySharePercent: input.companySharePercent,
      analystRewardPercent: input.analystRewardPercent,
      investorDistributionPercent: input.investorDistributionPercent,
      active: true,
      updatedBy: actorUserId,
      updatedAt: now(),
    };
    this.ledger.push(this.ledgerEntry("POLICY_VERSION", "CREDIT", 0, "POLICY_CHANGE_AUDIT", "PROFIT_DISTRIBUTION_POLICY", this.policy.id, actorUserId));
    return this.policy;
  }

  closeTradingDay(actorUserId: string, input: { overrideReason?: string | null; followUpAction?: string | null }) {
    const daily = this.daily();
    if (daily.outstandingReconciliationCents > 0 && !input.overrideReason?.trim()) {
      throw new TreasuryControlError("Cannot close trading day while unexplained reconciliation differences remain.");
    }
    this.dailyStatus = daily.outstandingReconciliationCents > 0 ? "CLOSED_WITH_OVERRIDE" : "CLOSED";
    this.dailyClosureNotes = input.overrideReason?.trim() || "Closed with all current placeholder controls satisfied.";
    if (daily.outstandingReconciliationCents > 0) {
      this.flagException("MANUAL_OVERRIDE", "HIGH", daily.id, `Override: ${this.dailyClosureNotes}. Follow-up: ${input.followUpAction ?? "Not supplied"}`);
    }
    this.ledger.push(this.ledgerEntry("TRADING_DAY_CLOSE", "CREDIT", daily.closingTreasuryBalanceCents, "DAILY_CLOSE", "TRADING_DAY", daily.id, actorUserId));
    return this.daily();
  }

  closeWeeklyPeriod(actorUserId: string, input: { executiveApproval: boolean; approvalNotes?: string | null }) {
    const weekly = this.weekly();
    if (!input.executiveApproval) throw new TreasuryControlError("Executive approval is required before weekly closure.");
    if (this.daily().status === "OPEN") throw new TreasuryControlError("Weekly closure blocked while trading day is open.");
    if (weekly.outstandingReconciliationsCents > 0) throw new TreasuryControlError("Weekly closure blocked by unresolved reconciliation.");
    if (weekly.confirmedWeeklyNetProfitCents <= 0) {
      this.weeklyStatus = "CLOSED";
      return { weekly: this.weekly(), companyShares: [], analystRewards: [], investorDistributions: [] };
    }

    const netProfit = weekly.confirmedWeeklyNetProfitCents;
    const companyShareCents = Math.round(netProfit * (this.policy.companySharePercent / 100));
    const analystPoolCents = Math.round(netProfit * (this.policy.analystRewardPercent / 100));
    const investorPoolCents = netProfit - companyShareCents - analystPoolCents;
    const ledgerEntry = this.ledgerEntry("COMPANY_PROFIT_SHARE", "CREDIT", companyShareCents, "COMPANY_SHARE", "WEEKLY_PERIOD", weekly.id, actorUserId);
    this.ledger.push(ledgerEntry);
    this.companyShares.push({
      id: id("company_share"),
      amountCents: companyShareCents,
      classification: "RETAINED_EARNINGS",
      ledgerEntryId: ledgerEntry.id,
      notes: input.approvalNotes ?? "Placeholder company share allocation recorded only.",
    });
    this.analystRewards.splice(0, this.analystRewards.length, ...this.calculateAnalystRewards(analystPoolCents));
    this.investorDistributions.splice(0, this.investorDistributions.length, ...this.calculateInvestorDistributions(investorPoolCents));
    this.weeklyStatus = "CLOSED";
    return {
      weekly: this.weekly(),
      companyShares: this.companyShares,
      analystRewards: this.analystRewards,
      investorDistributions: this.investorDistributions,
    };
  }

  executiveSituationRoom(): ExecutiveSituationRoom {
    const daily = this.daily();
    const weekly = this.weekly();
    const highRiskPositions = this.allocations.filter((allocation) => allocation.riskGrade === "HIGH");
    return {
      approvedSelectionsToday: this.allocations.filter((allocation) => allocation.approvalStatus === "APPROVED").length,
      capitalRecommendedCents: sum(this.allocations.map((allocation) => allocation.recommendedStakeCents)),
      capitalActuallyPlacedCents: sum(this.executions.map((execution) => execution.actualStakeCents)),
      openExposureCents: this.accounts().capitalCurrentlyExposedCents,
      matchesInPlay: this.executions.filter((execution) => execution.status === "PLACED" || execution.status === "PARTIALLY_PLACED").length,
      expectedTreasuryReturnCents: sum(this.allocations.map((allocation) => allocation.expectedReturnCents)),
      actualTreasuryReturnCents: sum(this.reconciliations.map((reconciliation) => reconciliation.amountDepositedBackCents)),
      outstandingReconciliationCents: daily.outstandingReconciliationCents,
      dailyProfitOrLossCents: daily.netDailyProfitCents,
      weeklyConfirmedNetProfitCents: weekly.confirmedWeeklyNetProfitCents,
      companyShareProjectionCents: Math.max(0, Math.round(weekly.confirmedWeeklyNetProfitCents * (this.policy.companySharePercent / 100))),
      analystRewardPoolProjectionCents: Math.max(0, Math.round(weekly.confirmedWeeklyNetProfitCents * (this.policy.analystRewardPercent / 100))),
      investorDistributionPoolProjectionCents: Math.max(0, Math.round(weekly.confirmedWeeklyNetProfitCents * (this.policy.investorDistributionPercent / 100))),
      highRiskPositions,
      pendingSettlements: this.executions.filter((execution) => !this.settlements.some((settlement) => settlement.executionId === execution.id)),
      pendingReconciliations: this.reconciliations.filter((reconciliation) => reconciliation.status !== "RECONCILED" && reconciliation.status !== "CLOSED"),
      pendingApprovals: this.exceptions.filter((item) => item.status === "OPEN").map((item) => item.message),
      currentAnalystAllocations: this.allocations.flatMap((allocation) =>
        allocation.analystIds.map((analystId) => ({
          analystId,
          allocatedCents: allocation.recommendedStakeCents,
          riskGrade: allocation.riskGrade,
        })),
      ),
      criticalFinancialAlerts: this.exceptions.filter((item) => item.severity === "CRITICAL" || item.severity === "HIGH"),
      systemHealth: this.exceptions.some((item) => item.severity === "CRITICAL") ? "BLOCKED" : this.exceptions.length ? "WATCH" : "READY",
    };
  }

  private accounts() {
    const capitalActuallyStakedCents = sum(this.executions.map((execution) => execution.actualStakeCents));
    const returned = sum(this.reconciliations.map((reconciliation) => reconciliation.amountDepositedBackCents));
    const profit = sum(this.settlements.map((settlement) => Math.max(0, settlement.grossProfitCents)));
    const losses = sum(this.settlements.map((settlement) => settlement.lossCents));
    const outstanding = sum(this.reconciliations.map((reconciliation) => Math.max(0, reconciliation.outstandingDifferenceCents)));
    const opening = 1000000;
    return {
      companyTreasuryBalanceCents: opening + returned - capitalActuallyStakedCents,
      investorCapitalBalanceCents: 750000,
      companyOperatingCapitalCents: 250000,
      capitalAvailableForStakingCents: Math.max(0, opening - capitalActuallyStakedCents),
      capitalCurrentlyExposedCents: Math.max(0, capitalActuallyStakedCents - sum(this.settlements.map((settlement) => settlement.actualStakeCents))),
      capitalReturnedCents: returned,
      profitBalanceCents: profit,
      lossBalanceCents: losses,
      outstandingReconciliationCents: outstanding,
      closingBalanceCents: opening + returned - capitalActuallyStakedCents,
    };
  }

  private daily(): TradingDaySummary {
    const opening = 1000000;
    const allocated = sum(this.allocations.map((allocation) => allocation.recommendedStakeCents));
    const staked = sum(this.executions.map((execution) => execution.actualStakeCents));
    const grossReturns = sum(this.settlements.map((settlement) => settlement.grossReturnCents));
    const grossProfit = sum(this.settlements.map((settlement) => Math.max(0, settlement.grossProfitCents)));
    const losses = sum(this.settlements.map((settlement) => settlement.lossCents));
    const deposited = sum(this.reconciliations.map((reconciliation) => reconciliation.amountDepositedBackCents));
    const outstanding = sum(this.reconciliations.map((reconciliation) => Math.max(0, reconciliation.outstandingDifferenceCents)));
    return {
      id: "trading_day_current",
      date: new Date().toISOString().slice(0, 10),
      openingTreasuryBalanceCents: opening,
      capitalAllocatedCents: allocated,
      capitalActuallyStakedCents: staked,
      unusedAllocatedCapitalCents: Math.max(0, allocated - staked),
      openExposureCents: this.accounts().capitalCurrentlyExposedCents,
      settledCapitalCents: sum(this.settlements.map((settlement) => settlement.capitalReturnedCents)),
      grossReturnsCents: grossReturns,
      grossProfitCents: grossProfit,
      totalLossesCents: losses,
      netDailyProfitCents: grossProfit - losses,
      amountExpectedBackCents: grossReturns,
      amountDepositedBackCents: deposited,
      outstandingReconciliationCents: outstanding,
      closingTreasuryBalanceCents: opening + deposited - staked,
      status: this.dailyStatus,
      closureNotes: this.dailyClosureNotes,
    };
  }

  private weekly(): WeeklyFinancialPeriod {
    const daily = this.daily();
    return {
      id: "week_current",
      weekLabel: "Current financial week",
      openingTreasuryCents: daily.openingTreasuryBalanceCents,
      investorPrincipalCents: 750000,
      companyCapitalCents: 250000,
      totalCapitalStakedCents: daily.capitalActuallyStakedCents,
      grossReturnsCents: daily.grossReturnsCents,
      grossProfitCents: daily.grossProfitCents,
      totalLossesCents: daily.totalLossesCents,
      confirmedWeeklyNetProfitCents: daily.outstandingReconciliationCents === 0 ? daily.netDailyProfitCents : 0,
      outstandingReconciliationsCents: daily.outstandingReconciliationCents,
      closingTreasuryBalanceCents: daily.closingTreasuryBalanceCents,
      status: this.weeklyStatus,
    };
  }

  private calculateSettlement(
    actorUserId: string,
    execution: BetExecutionRecord,
    outcome: TreasurySettlementOutcome,
    verificationStatus: "PENDING" | "VERIFIED",
  ): MatchSettlement {
    const stake = execution.actualStakeCents;
    let grossReturnCents = 0;
    if (outcome === "WIN") grossReturnCents = Math.round(stake * execution.actualOdds);
    if (outcome === "VOID" || outcome === "CANCELLED" || outcome === "PENDING_VERIFICATION") grossReturnCents = stake;
    if (outcome === "HALF_WIN") grossReturnCents = Math.round(stake + ((stake * execution.actualOdds - stake) / 2));
    if (outcome === "HALF_LOSS") grossReturnCents = Math.round(stake / 2);

    const grossProfitCents = Math.max(0, grossReturnCents - stake);
    const lossCents = Math.max(0, stake - grossReturnCents);
    return {
      id: id("settlement"),
      executionId: execution.id,
      outcome,
      actualStakeCents: stake,
      actualOdds: execution.actualOdds,
      grossReturnCents,
      capitalReturnedCents: Math.min(stake, grossReturnCents),
      grossProfitCents,
      lossCents,
      netResultCents: grossProfitCents - lossCents,
      bookmakerDeductionCents: 0,
      currencyConversionPlaceholderCents: 0,
      verificationStatus,
      settledBy: actorUserId,
      settledAt: now(),
    };
  }

  private calculateAnalystRewards(poolCents: number): AnalystRewardAllocation[] {
    const analysts = Array.from(new Set(this.allocations.flatMap((allocation) => allocation.analystIds)));
    const totalWeight = sum(analysts.map((analystId) => this.analystWeight(analystId)));
    return analysts.map((analystId) => {
      const weight = this.analystWeight(analystId);
      return {
        id: id("analyst_reward"),
        analystId,
        analystName: analystId === "analyst-placeholder" ? "Internal Analyst Placeholder" : analystId,
        contributionWeight: totalWeight ? Number((weight / totalWeight).toFixed(4)) : 0,
        rewardCents: totalWeight ? Math.round(poolCents * (weight / totalWeight)) : 0,
        status: "CALCULATED",
        breakdown: [
          "Weighted by profit contribution, reliability, discipline, risk control, and capital efficiency placeholders.",
          "No payment movement occurs until future approved payment APIs are connected.",
        ],
      };
    });
  }

  private calculateInvestorDistributions(poolCents: number): InvestorDistributionAllocation[] {
    const investors = [
      { investorId: "investor-placeholder-1", capitalCents: 500000, daysActive: 7, reinvest: true },
      { investorId: "investor-placeholder-2", capitalCents: 250000, daysActive: 7, reinvest: false },
    ];
    const totalWeight = sum(investors.map((investor) => investor.capitalCents * investor.daysActive));
    return investors.map((investor) => {
      const weight = investor.capitalCents * investor.daysActive;
      const distributionCents = totalWeight ? Math.round(poolCents * (weight / totalWeight)) : 0;
      return {
        id: id("investor_distribution"),
        investorId: investor.investorId,
        participationWeight: totalWeight ? Number((weight / totalWeight).toFixed(4)) : 0,
        distributionCents,
        reinvestmentCents: investor.reinvest ? distributionCents : 0,
        withdrawalCents: investor.reinvest ? 0 : distributionCents,
        status: "CALCULATED",
        explanation: "Weighted by eligible invested capital and active days in the placeholder financial period. Investor principal is excluded from profit.",
      };
    });
  }

  private analystWeight(analystId: string) {
    const analystAllocations = this.allocations.filter((allocation) => allocation.analystIds.includes(analystId));
    return sum(
      analystAllocations.map(
        (allocation) =>
          allocation.controls.reliabilityIndex +
          allocation.controls.disciplineScore +
          allocation.controls.capitalEfficiency +
          Math.max(0, allocation.controls.historicalRoi * 10) -
          allocation.controls.drawdown,
      ),
    );
  }

  private ledgerEntry(
    account: string,
    direction: "DEBIT" | "CREDIT",
    amountCents: number,
    classification: string,
    referenceType: string,
    referenceId: string | null,
    createdBy: string,
  ): TreasuryLedgerEntry {
    return {
      id: id("ledger"),
      account,
      direction,
      amountCents,
      classification,
      referenceType,
      referenceId,
      notes: "Provider-ready placeholder ledger record. No external money movement occurred.",
      createdBy,
      createdAt: now(),
    };
  }

  private flagException(type: string, severity: FinancialException["severity"], relatedId: string | null, message: string) {
    this.exceptions.push({
      id: id("exception"),
      type,
      severity,
      status: "OPEN",
      message,
      relatedId,
      createdAt: now(),
    });
  }

  private ledgerAccounts(): TreasuryLedgerAccount[] {
    return ledgerAccountDefinitions.map((definition) => {
      const balances = this.ledgerBalances.get(definition.code) ?? new Map<string, bigint>();
      return {
        ...definition,
        currencyBalances: Object.fromEntries(
          Array.from(balances.entries()).map(([currency, value]) => [currency, formatMoney(value, currency)]),
        ),
      };
    });
  }

  private validateLedgerTransaction(
    sourceAccount: TreasuryLedgerAccountCode,
    destinationAccount: TreasuryLedgerAccountCode,
    purpose: TreasuryLedgerPurpose,
  ) {
    const validAccounts = new Set(ledgerAccountDefinitions.map((account) => account.code));
    if (!validAccounts.has(sourceAccount) || !validAccounts.has(destinationAccount)) {
      throw new TreasuryControlError("Unknown ledger account.");
    }
    if (sourceAccount === destinationAccount) throw new TreasuryControlError("Source and destination accounts must be different.");
    if (purpose === "SUBSCRIBER_REVENUE" && destinationAccount === "PERFORMANCE_PARTNER_CAPITAL") {
      throw new TreasuryControlError("Subscriber revenue must never enter Performance Partner Capital.");
    }
    if (purpose === "PARTNER_CONTRIBUTION" && destinationAccount !== "PERFORMANCE_PARTNER_CAPITAL") {
      throw new TreasuryControlError("Partner contributions must be recorded only in Performance Partner Capital.");
    }
    if (purpose === "ELIGIBLE_PROFIT_ALLOCATION") {
      throw new TreasuryControlError("Use the eligible profit allocation workflow so policy percentages remain auditable.");
    }
  }

  private classifyPurpose(paymentPurpose: string): TreasuryPaymentRecord["classification"] {
    if (["PERFORMANCE_PARTNER_CONTRIBUTION", "INVESTOR_FUNDING", "PARTNER_CONTRIBUTION"].includes(paymentPurpose)) {
      return "PERFORMANCE_PARTNER_CAPITAL";
    }
    if (["PERFORMANCE_PARTNER_RENEWAL", "PARTNER_RENEWAL"].includes(paymentPurpose)) {
      return "PERFORMANCE_PARTNER_CAPITAL";
    }
    if (["SUBSCRIPTION", "SUBSCRIBER_SUBSCRIPTION", "SUBSCRIPTION_RENEWAL"].includes(paymentPurpose)) {
      return "SUBSCRIBER_REVENUE";
    }
    if (["SUBSCRIPTION_UPGRADE", "SUBSCRIBER_UPGRADE"].includes(paymentPurpose)) {
      return "SUBSCRIBER_REVENUE";
    }
    if (["OTHER_ADMIN_APPROVED", "COMPANY_REVENUE"].includes(paymentPurpose)) {
      return "COMPANY_REVENUE";
    }
    return "TREASURY_SUSPENSE";
  }

  private destinationForClassification(classification: TreasuryPaymentRecord["classification"]): TreasuryLedgerAccountCode {
    if (classification === "PERFORMANCE_PARTNER_CAPITAL") return "PERFORMANCE_PARTNER_CAPITAL";
    if (classification === "SUBSCRIBER_REVENUE") return "SUBSCRIBER_REVENUE";
    if (classification === "COMPANY_REVENUE") return "COMPANY_GROWTH_OPERATIONS";
    return "TREASURY_SUSPENSE";
  }

  private purposeForClassification(classification: TreasuryPaymentRecord["classification"], paymentPurpose: string): TreasuryLedgerPurpose {
    if (classification === "PERFORMANCE_PARTNER_CAPITAL" && paymentPurpose.includes("RENEWAL")) return "PARTNER_RENEWAL";
    if (classification === "PERFORMANCE_PARTNER_CAPITAL") return "PARTNER_CONTRIBUTION";
    if (classification === "SUBSCRIBER_REVENUE" && paymentPurpose.includes("UPGRADE")) return "SUBSCRIBER_UPGRADE";
    if (classification === "SUBSCRIBER_REVENUE") return "SUBSCRIBER_REVENUE";
    if (classification === "COMPANY_REVENUE") return "COMPANY_REVENUE";
    return "PAYMENT_SUSPENSE";
  }

  private validatePayoutAddress(network: "USDT_TRC20" | "USDT_ERC20", address: string) {
    const value = address.trim();
    if (network === "USDT_TRC20") {
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value) ? [] : ["Invalid TRC20 address format."];
    }
    return /^0x[a-fA-F0-9]{40}$/.test(value) ? [] : ["Invalid ERC20 address format."];
  }

  private applyApprovalStatus(event: TreasuryApprovalEvent) {
    const partnerDistribution = this.partnerDistributions.find((item) => item.id === event.entityId);
    if (partnerDistribution) partnerDistribution.status = event.newStatus as TreasuryPartnerDistribution["status"];
    const analystAllocation = this.analystPoolAllocations.find((item) => item.id === event.entityId);
    if (analystAllocation) analystAllocation.status = event.newStatus as TreasuryAnalystPoolAllocation["status"];
    const payoutBatch = this.payoutBatches.find((item) => item.id === event.entityId);
    if (payoutBatch) payoutBatch.status = event.newStatus as TreasuryPayoutBatch["status"];
  }

  private adjustLedgerBalance(account: TreasuryLedgerAccountCode, currency: string, delta: bigint) {
    const balances = this.ledgerBalances.get(account) ?? new Map<string, bigint>();
    const next = (balances.get(currency) ?? 0n) + delta;
    balances.set(currency, next);
    this.ledgerBalances.set(account, balances);
    return formatMoney(next, currency);
  }

  private transactionBalances(transaction: TreasuryDoubleEntryTransaction) {
    if (transaction.approvalStatus !== "APPROVED") return true;
    const debit = transaction.lines
      .filter((line) => line.direction === "DEBIT")
      .reduce((total, line) => total + moneyToBigInt(line.amount), 0n);
    const credit = transaction.lines
      .filter((line) => line.direction === "CREDIT")
      .reduce((total, line) => total + moneyToBigInt(line.amount), 0n);
    return debit === credit;
  }

  private auditLedger(actorUserId: string, action: string, transactionId: string | null, details: Record<string, unknown>) {
    const log = {
      id: id("ledger_audit"),
      action,
      actorUserId,
      transactionId,
      details,
      createdAt: now(),
    };
    this.ledgerAuditLogs.push(log);
    return log;
  }
}
