import crypto from "node:crypto";
import type { PredictionQueueItem } from "@fpf/shared";
import type { PredictionWorkflowService } from "../predictionWorkflow/predictionWorkflowService.js";
import type {
  ApproveAllocationInput,
  CapitalRiskGrade,
  CompanyCapitalAllocation,
  CompanyCapitalDashboard,
  CompanyCapitalReportPeriod,
  CompanyCapitalRepository,
  CreateCapitalAllocationInput,
  PlaceStakeInput,
  RecordSettlementInput,
} from "./types.js";

const now = () => new Date().toISOString();
const cents = (value: number | undefined) => Math.max(0, Math.round(Number(value ?? 0)));
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function riskFromScore(score: number): CapitalRiskGrade {
  if (score >= 80) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

function stakeFromCandidate(candidate: PredictionQueueItem) {
  const confidenceFactor = Math.max(0.25, Math.min(1, candidate.confidenceScore / 100));
  const riskDiscount = Math.max(0.25, 1 - (candidate.riskScore / 150));
  return Math.round(50000 * confidenceFactor * riskDiscount);
}

export class CompanyCapitalError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
  }
}

export class CompanyCapitalService {
  constructor(
    private readonly repository: CompanyCapitalRepository,
    private readonly predictionWorkflowService: PredictionWorkflowService,
  ) {}

  async dashboard(actorUserId: string): Promise<CompanyCapitalDashboard> {
    const portfolio = await this.repository.getOrCreatePortfolio(actorUserId);
    const data = await this.repository.dashboardData();
    const candidateQueue = await this.candidateQueue();
    const allocations = data.allocations;
    return {
      portfolio: data.portfolio ?? portfolio,
      allocations,
      stakes: data.stakes,
      settlements: data.settlements,
      riskEvents: data.riskEvents,
      reports: data.reports,
      auditTrail: data.auditTrail,
      candidateQueue,
      exposure: {
        totalExposureCents: sum(allocations.map((allocation) => allocation.exposureCents)),
        availableCapitalCents: (data.portfolio ?? portfolio).availableCapitalCents,
        exposurePercent: (data.portfolio ?? portfolio).openingBalanceCents
          ? Number((((data.portfolio ?? portfolio).exposureCents / (data.portfolio ?? portfolio).openingBalanceCents) * 100).toFixed(2))
          : 0,
        openAllocations: allocations.filter((allocation) => ["DRAFT", "PENDING_APPROVAL"].includes(allocation.status)).length,
        approvedAllocations: allocations.filter((allocation) => allocation.status === "APPROVED" || allocation.status === "STAKED").length,
        settledAllocations: allocations.filter((allocation) => allocation.status === "SETTLED").length,
        highRiskAllocations: allocations.filter((allocation) => allocation.riskGrade === "HIGH" || allocation.riskGrade === "CRITICAL").length,
      },
      privateNotice: "Company Capital Desk is private internal infrastructure. It is never exposed to subscribers or Performance Partners.",
    };
  }

  async candidateQueue() {
    const queue = await this.predictionWorkflowService.listQueue({ sort: "priority" });
    return queue.items.filter((item) => ["APPROVED", "PUBLISHED"].includes(item.status));
  }

  async createAllocation(actorUserId: string, input: CreateCapitalAllocationInput) {
    const portfolio = await this.repository.getOrCreatePortfolio(actorUserId);
    this.validateAllocationInput(input);
    const allocation = await this.repository.createAllocation(actorUserId, {
      ...input,
      portfolioId: input.portfolioId ?? portfolio.id,
      recommendedStakeCents: cents(input.recommendedStakeCents),
      maxStakeCents: cents(input.maxStakeCents),
      odds: Number(input.odds),
    });
    await this.repository.audit({
      actorUserId,
      action: "COMPANY_CAPITAL_ALLOCATION_CREATED",
      entityType: "COMPANY_CAPITAL_ALLOCATION",
      entityId: allocation.id,
      beforeState: null,
      afterState: allocation,
      notes: "Capital allocation created for internal approval workflow.",
    });
    if (allocation.riskGrade === "HIGH" || allocation.riskGrade === "CRITICAL") {
      await this.repository.createRiskEvent({
        allocationId: allocation.id,
        severity: allocation.riskGrade,
        message: `${allocation.riskGrade} risk allocation requires Risk Manager review before staking.`,
        createdBy: actorUserId,
      });
    }
    return allocation;
  }

  async createAllocationFromCandidate(actorUserId: string, candidateId: string) {
    const candidate = await this.predictionWorkflowService.getQueueItem(candidateId);
    if (!candidate) throw new CompanyCapitalError("Prediction candidate not found.", 404);
    if (!["APPROVED", "PUBLISHED"].includes(candidate.status)) {
      throw new CompanyCapitalError("Only analyst/admin-approved intelligence candidates can enter the Company Capital Desk.");
    }
    const recommendedStakeCents = Math.max(1000, stakeFromCandidate(candidate));
    return this.createAllocation(actorUserId, {
      candidateId: candidate.id,
      fixtureId: candidate.fixtureId,
      matchLabel: candidate.match,
      market: candidate.recommendedMarket,
      selection: candidate.predictedOutcome,
      recommendedStakeCents,
      maxStakeCents: Math.round(recommendedStakeCents * 1.25),
      odds: 1.8,
      riskGrade: riskFromScore(candidate.riskScore),
      analystApprovalStatus: "APPROVED",
      intelligenceStatus: candidate.status,
      rationale: candidate.explanation,
    });
  }

  async approveAllocation(actorUserId: string, allocationId: string, input: ApproveAllocationInput) {
    const portfolio = await this.repository.getOrCreatePortfolio(actorUserId);
    const allocation = await this.requireAllocation(allocationId);
    if (allocation.approvalStatus === "APPROVED") throw new CompanyCapitalError("Allocation is already approved.");
    if (allocation.approvalStatus === "REJECTED") throw new CompanyCapitalError("Rejected allocation cannot be approved.");
    if (allocation.analystApprovalStatus !== "APPROVED") {
      throw new CompanyCapitalError("Allocation requires approved analyst/intelligence workflow before capital approval.");
    }
    const approvedStakeCents = cents(input.approvedStakeCents);
    if (approvedStakeCents <= 0) throw new CompanyCapitalError("Approved stake must be greater than zero.");
    if (approvedStakeCents > allocation.maxStakeCents) throw new CompanyCapitalError("Approved stake exceeds maximum stake control.");
    if (approvedStakeCents > portfolio.availableCapitalCents) throw new CompanyCapitalError("Insufficient available company capital.");

    const before = { allocation, portfolio };
    const updatedAllocation = await this.repository.updateAllocation({
      ...allocation,
      approvedStakeCents,
      exposureCents: approvedStakeCents,
      status: "APPROVED",
      approvalStatus: "APPROVED",
      approvedBy: actorUserId,
      approvedAt: now(),
    });
    const updatedPortfolio = await this.repository.updatePortfolio({
      ...portfolio,
      availableCapitalCents: portfolio.availableCapitalCents - approvedStakeCents,
      allocatedCapitalCents: portfolio.allocatedCapitalCents + approvedStakeCents,
      exposureCents: portfolio.exposureCents + approvedStakeCents,
    });
    await this.repository.audit({
      actorUserId,
      action: "COMPANY_CAPITAL_ALLOCATION_APPROVED",
      entityType: "COMPANY_CAPITAL_ALLOCATION",
      entityId: allocation.id,
      beforeState: before,
      afterState: { allocation: updatedAllocation, portfolio: updatedPortfolio },
      notes: input.notes ?? "Capital allocation approved with exposure controls.",
    });
    return updatedAllocation;
  }

  async rejectAllocation(actorUserId: string, allocationId: string, notes?: string | null) {
    const allocation = await this.requireAllocation(allocationId);
    const updated = await this.repository.updateAllocation({
      ...allocation,
      status: "REJECTED",
      approvalStatus: "REJECTED",
      rejectedBy: actorUserId,
      rejectedAt: now(),
    });
    await this.repository.audit({
      actorUserId,
      action: "COMPANY_CAPITAL_ALLOCATION_REJECTED",
      entityType: "COMPANY_CAPITAL_ALLOCATION",
      entityId: allocation.id,
      beforeState: allocation,
      afterState: updated,
      notes: notes ?? "Capital allocation rejected.",
    });
    return updated;
  }

  async placeStake(actorUserId: string, allocationId: string, input: PlaceStakeInput) {
    const allocation = await this.requireAllocation(allocationId);
    if (allocation.approvalStatus !== "APPROVED") throw new CompanyCapitalError("Allocation must be approved before staking.");
    const stakeCents = cents(input.stakeCents);
    if (stakeCents <= 0) throw new CompanyCapitalError("Stake must be greater than zero.");
    if (stakeCents > allocation.approvedStakeCents) throw new CompanyCapitalError("Stake exceeds approved stake.");
    const stake = await this.repository.createStake(actorUserId, {
      allocationId,
      stakeCents,
      odds: Number(input.odds),
      bookmaker: input.bookmaker.trim(),
      reference: input.reference ?? null,
      notes: input.notes ?? null,
    });
    await this.repository.updateAllocation({ ...allocation, status: "STAKED" });
    await this.repository.audit({
      actorUserId,
      action: "COMPANY_CAPITAL_STAKE_PLACED",
      entityType: "COMPANY_CAPITAL_STAKE",
      entityId: stake.id,
      beforeState: null,
      afterState: stake,
      notes: "Manual company capital stake recorded. No external bookmaker API integration.",
    });
    return stake;
  }

  async recordSettlement(actorUserId: string, allocationId: string, input: RecordSettlementInput) {
    const portfolio = await this.repository.getOrCreatePortfolio(actorUserId);
    const allocation = await this.requireAllocation(allocationId);
    const stake = input.stakeId ? await this.repository.getStake(input.stakeId) : null;
    const stakeCents = stake?.stakeCents ?? allocation.approvedStakeCents;
    const grossReturnCents = input.grossReturnCents === undefined ? this.defaultGrossReturn(stakeCents, stake?.odds ?? allocation.odds, input.outcome) : cents(input.grossReturnCents);
    const profitCents = Math.max(0, grossReturnCents - stakeCents);
    const lossCents = Math.max(0, stakeCents - grossReturnCents);
    const settlement = await this.repository.createSettlement(actorUserId, {
      id: id("capital_settlement"),
      allocationId,
      stakeId: stake?.id ?? null,
      outcome: input.outcome,
      grossReturnCents,
      profitCents,
      lossCents,
      netResultCents: profitCents - lossCents,
      settlementStatus: "RECORDED",
      settledBy: actorUserId,
      settledAt: now(),
      notes: input.notes ?? null,
    });
    const updatedAllocation = await this.repository.updateAllocation({ ...allocation, status: "SETTLED", exposureCents: 0 });
    if (stake) await this.repository.updateStake({ ...stake, status: "SETTLED" });
    const updatedPortfolio = await this.repository.updatePortfolio({
      ...portfolio,
      availableCapitalCents: portfolio.availableCapitalCents + grossReturnCents,
      allocatedCapitalCents: Math.max(0, portfolio.allocatedCapitalCents - stakeCents),
      exposureCents: Math.max(0, portfolio.exposureCents - stakeCents),
      settledProfitCents: portfolio.settledProfitCents + profitCents,
      settledLossCents: portfolio.settledLossCents + lossCents,
    });
    await this.repository.audit({
      actorUserId,
      action: "COMPANY_CAPITAL_SETTLEMENT_RECORDED",
      entityType: "COMPANY_CAPITAL_SETTLEMENT",
      entityId: settlement.id,
      beforeState: { allocation, portfolio, stake },
      afterState: { settlement, allocation: updatedAllocation, portfolio: updatedPortfolio },
      notes: "Settlement recorded and company portfolio exposure updated.",
    });
    return settlement;
  }

  async generateReport(actorUserId: string, periodType: CompanyCapitalReportPeriod, periodLabel: string) {
    const dashboard = await this.dashboard(actorUserId);
    const metrics = {
      availableCapitalCents: dashboard.portfolio.availableCapitalCents,
      exposureCents: dashboard.portfolio.exposureCents,
      settledProfitCents: dashboard.portfolio.settledProfitCents,
      settledLossCents: dashboard.portfolio.settledLossCents,
      allocations: dashboard.allocations.length,
      settlements: dashboard.settlements.length,
      openRiskEvents: dashboard.riskEvents.filter((event) => event.status === "OPEN").length,
    };
    const report = await this.repository.createReport({
      periodType,
      periodLabel,
      summary: `${periodType.toLowerCase()} company capital performance summary generated for ${periodLabel}.`,
      metrics,
      generatedBy: actorUserId,
    });
    await this.repository.audit({
      actorUserId,
      action: "COMPANY_CAPITAL_REPORT_GENERATED",
      entityType: "COMPANY_CAPITAL_REPORT",
      entityId: report.id,
      beforeState: null,
      afterState: report,
      notes: "Private company capital performance report generated.",
    });
    return report;
  }

  private validateAllocationInput(input: CreateCapitalAllocationInput) {
    if (!input.matchLabel.trim()) throw new CompanyCapitalError("matchLabel is required.");
    if (!input.market.trim()) throw new CompanyCapitalError("market is required.");
    if (!input.selection.trim()) throw new CompanyCapitalError("selection is required.");
    if (cents(input.recommendedStakeCents) <= 0) throw new CompanyCapitalError("recommendedStakeCents must be greater than zero.");
    if (cents(input.maxStakeCents) < cents(input.recommendedStakeCents)) throw new CompanyCapitalError("maxStakeCents must be at least the recommended stake.");
    if (Number(input.odds) <= 1) throw new CompanyCapitalError("odds must be greater than 1.00.");
  }

  private async requireAllocation(allocationId: string): Promise<CompanyCapitalAllocation> {
    const allocation = await this.repository.getAllocation(allocationId);
    if (!allocation) throw new CompanyCapitalError("Capital allocation not found.", 404);
    return allocation;
  }

  private defaultGrossReturn(stakeCents: number, odds: number, outcome: RecordSettlementInput["outcome"]) {
    if (outcome === "WIN") return Math.round(stakeCents * odds);
    if (outcome === "HALF_WIN") return Math.round(stakeCents + ((stakeCents * odds - stakeCents) / 2));
    if (outcome === "HALF_LOSS") return Math.round(stakeCents / 2);
    if (outcome === "VOID" || outcome === "CANCELLED") return stakeCents;
    return 0;
  }
}
