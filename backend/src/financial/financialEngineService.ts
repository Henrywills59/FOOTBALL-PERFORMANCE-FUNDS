import crypto from "node:crypto";
import { financialAllocationPolicy, allocationPolicyTotal } from "./financialPolicy.js";
import type {
  EligibleParticipationSnapshot,
  EligibleProfitInput,
  FinancialAllocation,
  FinancialAnalystReward,
  FinancialAuditRecord,
  FinancialEngineOverview,
  FinancialEngineRun,
  FinancialPartnerDistribution,
  FinancialReport,
  FinancialRepository,
} from "./types.js";

const now = () => new Date().toISOString();
const cents = (value: number | undefined) => Math.max(0, Math.round(Number(value ?? 0)));

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export class FinancialEngineError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

export class FinancialEngineService {
  constructor(private readonly repository: FinancialRepository) {}

  async overview(): Promise<FinancialEngineOverview> {
    const latestRun = await this.repository.latestRun();
    return {
      allocationPolicy: financialAllocationPolicy,
      latestRun,
      totals: {
        eligibleProfitCents: latestRun?.eligibleProfitCents ?? 0,
        performancePartnerPoolCents: this.allocationAmount(latestRun, "PERFORMANCE_PARTNER_POOL"),
        analystPerformancePoolCents: this.allocationAmount(latestRun, "ANALYST_PERFORMANCE_POOL"),
        riskStabilityReserveCents: this.allocationAmount(latestRun, "RISK_STABILITY_RESERVE"),
        companyGrowthOperationsFundCents: this.allocationAmount(latestRun, "COMPANY_GROWTH_OPERATIONS_FUND"),
        reserveBalanceCents: await this.repository.reserveBalance(),
        companyGrowthBalanceCents: await this.repository.companyGrowthBalance(),
      },
    };
  }

  async reports() {
    return this.repository.listReports();
  }

  async auditRecords() {
    return this.repository.listAuditRecords();
  }

  async calculateWeeklyDistribution(actorUserId: string, input: EligibleProfitInput): Promise<FinancialEngineRun> {
    this.validatePolicy();
    const normalizedInput = this.normalizeInput(input);
    const eligibleProfitCents = this.calculateEligibleProfit(normalizedInput);
    const allocations = this.allocateProfit("pending-run", eligibleProfitCents);
    const eligibleParticipations = await this.repository.eligibleParticipations();
    const reserveOpeningBalance = await this.repository.reserveBalance();
    const companyOpeningBalance = await this.repository.companyGrowthBalance();
    const reserveAmount = this.mustAllocation(allocations, "RISK_STABILITY_RESERVE").amountCents;
    const companyAmount = this.mustAllocation(allocations, "COMPANY_GROWTH_OPERATIONS_FUND").amountCents;
    const calculatedAt = now();

    const runId = id("financial_run");
    const runAllocations = allocations.map((allocation) => ({ ...allocation, runId }));
    const partnerDistributions = this.calculatePartnerDistributions(
      runId,
      this.mustAllocation(runAllocations, "PERFORMANCE_PARTNER_POOL").amountCents,
      eligibleParticipations,
    );
    const analystRewards = this.calculateAnalystRewards(
      runId,
      this.mustAllocation(runAllocations, "ANALYST_PERFORMANCE_POOL").amountCents,
      normalizedInput,
    );
    const reserveLedgerEntries = [
      {
        id: id("reserve_ledger"),
        runId,
        direction: "CREDIT" as const,
        amountCents: reserveAmount,
        balanceAfterCents: reserveOpeningBalance + reserveAmount,
        classification: "WEEKLY_RISK_STABILITY_ALLOCATION",
        notes: "15% of eligible weekly profit allocated to Risk & Stability Reserve.",
        createdBy: actorUserId,
        createdAt: calculatedAt,
      },
    ];
    const companyGrowthLedgerEntries = [
      {
        id: id("company_growth_ledger"),
        runId,
        direction: "CREDIT" as const,
        amountCents: companyAmount,
        balanceAfterCents: companyOpeningBalance + companyAmount,
        classification: "WEEKLY_COMPANY_GROWTH_OPERATIONS_ALLOCATION",
        notes: "35% of eligible weekly profit allocated to Company Growth & Operations Fund.",
        createdBy: actorUserId,
        createdAt: calculatedAt,
      },
    ];
    const reports = this.buildReports(runId, actorUserId, normalizedInput, eligibleProfitCents, runAllocations, partnerDistributions, analystRewards);
    const calculationOutput = {
      formula: "max(0, grossReturnsCents - returnedStakeCents - totalLossesCents - operatingAdjustmentsCents)",
      allocationPolicy: financialAllocationPolicy,
      allocationIntegrityCents: sum(runAllocations.map((allocation) => allocation.amountCents)),
      eligibleParticipationCount: eligibleParticipations.length,
      analystContributionCount: normalizedInput.analystContributions?.length ?? 0,
      auditNotice: "All generated allocations, ledgers, rewards, reports, and audit records are persisted for review. No external payouts are executed by this foundation.",
    };
    const auditRecords: FinancialAuditRecord[] = [
      {
        id: id("financial_audit"),
        runId,
        actorUserId,
        action: "ELIGIBLE_PROFIT_CALCULATED",
        entityType: "FINANCIAL_ENGINE_RUN",
        entityId: runId,
        beforeState: null,
        afterState: { eligibleProfitCents, input: normalizedInput },
        calculationRef: "eligibleProfit=max(0,grossReturns-returnedStake-losses-adjustments)",
        notes: "Eligible profit calculation completed for weekly financial engine foundation.",
        createdAt: calculatedAt,
      },
      {
        id: id("financial_audit"),
        runId,
        actorUserId,
        action: "PROFIT_ALLOCATED",
        entityType: "FINANCIAL_ENGINE_RUN",
        entityId: runId,
        beforeState: null,
        afterState: runAllocations,
        calculationRef: "35/15/15/35 FPF financial constitution",
        notes: "Profit allocation engine reconciled all pool allocations to eligible profit.",
        createdAt: calculatedAt,
      },
    ];

    const run: FinancialEngineRun = {
      id: runId,
      weekLabel: normalizedInput.weekLabel,
      seasonId: normalizedInput.seasonId ?? null,
      grossReturnsCents: normalizedInput.grossReturnsCents,
      returnedStakeCents: normalizedInput.returnedStakeCents ?? 0,
      totalStakeCents: normalizedInput.totalStakeCents ?? 0,
      totalLossesCents: normalizedInput.totalLossesCents ?? 0,
      operatingAdjustmentsCents: normalizedInput.operatingAdjustmentsCents ?? 0,
      eligibleProfitCents,
      status: "CALCULATED",
      calculationInput: normalizedInput,
      calculationOutput,
      calculatedBy: actorUserId,
      calculatedAt,
      allocations: runAllocations,
      partnerDistributions,
      analystRewards,
      reserveLedgerEntries,
      companyGrowthLedgerEntries,
      reports,
      auditRecords,
    };

    return this.repository.saveRun(run);
  }

  private normalizeInput(input: EligibleProfitInput): EligibleProfitInput {
    const weekLabel = input.weekLabel?.trim();
    if (!weekLabel) throw new FinancialEngineError("weekLabel is required.");
    return {
      weekLabel,
      seasonId: input.seasonId?.trim() || null,
      grossReturnsCents: cents(input.grossReturnsCents),
      returnedStakeCents: cents(input.returnedStakeCents ?? input.totalStakeCents),
      totalStakeCents: cents(input.totalStakeCents ?? input.returnedStakeCents),
      totalLossesCents: cents(input.totalLossesCents),
      operatingAdjustmentsCents: cents(input.operatingAdjustmentsCents),
      analystContributions: input.analystContributions?.map((item) => ({
        analystId: item.analystId.trim(),
        analystName: item.analystName?.trim() || item.analystId.trim(),
        contributionScore: Math.max(0, Number(item.contributionScore ?? 0)),
      })).filter((item) => item.analystId) ?? [],
    };
  }

  private calculateEligibleProfit(input: EligibleProfitInput) {
    return Math.max(
      0,
      cents(input.grossReturnsCents) -
      cents(input.returnedStakeCents) -
      cents(input.totalLossesCents) -
      cents(input.operatingAdjustmentsCents),
    );
  }

  private allocateProfit(runId: string, eligibleProfitCents: number): FinancialAllocation[] {
    let allocated = 0;
    return financialAllocationPolicy.map((policy, index) => {
      const isLast = index === financialAllocationPolicy.length - 1;
      const amountCents = isLast ? eligibleProfitCents - allocated : Math.round(eligibleProfitCents * (policy.percent / 100));
      allocated += amountCents;
      return {
        id: id("financial_allocation"),
        runId,
        allocationType: policy.allocationType,
        label: policy.label,
        percent: policy.percent,
        amountCents,
        distributable: policy.distributable,
        auditExplanation: `${policy.percent}% of eligible profit allocated to ${policy.label}.`,
        createdAt: now(),
      };
    });
  }

  private calculatePartnerDistributions(
    runId: string,
    poolCents: number,
    participations: EligibleParticipationSnapshot[],
  ): FinancialPartnerDistribution[] {
    const totalWeight = sum(participations.map((item) => item.participationAmountCents * Math.max(1, item.remainingDistributions)));
    return participations.map((item, index) => {
      const weight = item.participationAmountCents * Math.max(1, item.remainingDistributions);
      const isLast = index === participations.length - 1;
      const alreadyAllocated = 0;
      const distributionCents = totalWeight
        ? isLast
          ? poolCents - sum(participations.slice(0, -1).map((previous) => Math.round(poolCents * ((previous.participationAmountCents * Math.max(1, previous.remainingDistributions)) / totalWeight))))
          : Math.round(poolCents * (weight / totalWeight))
        : alreadyAllocated;
      return {
        id: id("partner_distribution"),
        runId,
        participationId: item.participationId,
        userId: item.userId,
        participationWeight: totalWeight ? Number((weight / totalWeight).toFixed(6)) : 0,
        distributionCents,
        status: "CALCULATED",
        explanation: "Weighted by active participation amount and remaining distribution eligibility. Principal is excluded from eligible profit.",
        createdAt: now(),
      };
    });
  }

  private calculateAnalystRewards(runId: string, poolCents: number, input: EligibleProfitInput): FinancialAnalystReward[] {
    const contributions = input.analystContributions ?? [];
    const totalScore = sum(contributions.map((item) => Math.max(0, Number(item.contributionScore))));
    return contributions.map((item, index) => {
      const score = Math.max(0, Number(item.contributionScore));
      const rewardCents = totalScore
        ? index === contributions.length - 1
          ? poolCents - sum(contributions.slice(0, -1).map((previous) => Math.round(poolCents * (Math.max(0, Number(previous.contributionScore)) / totalScore))))
          : Math.round(poolCents * (score / totalScore))
        : 0;
      return {
        id: id("analyst_reward"),
        runId,
        analystId: item.analystId,
        analystName: item.analystName || item.analystId,
        contributionWeight: totalScore ? Number((score / totalScore).toFixed(6)) : 0,
        rewardCents,
        status: "CALCULATED",
        breakdown: [
          "Weighted by submitted contribution score for the Phase 3 foundation.",
          "Reward remains internal and requires future approval before any payout workflow.",
        ],
        createdAt: now(),
      };
    });
  }

  private buildReports(
    runId: string,
    actorUserId: string,
    input: EligibleProfitInput,
    eligibleProfitCents: number,
    allocations: FinancialAllocation[],
    partnerDistributions: FinancialPartnerDistribution[],
    analystRewards: FinancialAnalystReward[],
  ): FinancialReport[] {
    return [
      {
        id: id("financial_report"),
        runId,
        reportType: "WEEKLY_DISTRIBUTION",
        title: `${input.weekLabel} Financial Engine Report`,
        summary: "Eligible profit calculated and allocated through the FPF financial constitution. No public exposure and no external payout was executed.",
        metrics: {
          eligibleProfitCents,
          allocations,
          partnerDistributionCount: partnerDistributions.length,
          analystRewardCount: analystRewards.length,
        },
        generatedBy: actorUserId,
        generatedAt: now(),
      },
    ];
  }

  private allocationAmount(run: FinancialEngineRun | null, allocationType: FinancialAllocation["allocationType"]) {
    return run?.allocations.find((allocation) => allocation.allocationType === allocationType)?.amountCents ?? 0;
  }

  private mustAllocation(allocations: FinancialAllocation[], allocationType: FinancialAllocation["allocationType"]) {
    const allocation = allocations.find((item) => item.allocationType === allocationType);
    if (!allocation) throw new FinancialEngineError(`Missing allocation: ${allocationType}`, 500);
    return allocation;
  }

  private validatePolicy() {
    if (allocationPolicyTotal() !== 100) {
      throw new FinancialEngineError("Financial allocation policy must total exactly 100%.", 500);
    }
  }
}
