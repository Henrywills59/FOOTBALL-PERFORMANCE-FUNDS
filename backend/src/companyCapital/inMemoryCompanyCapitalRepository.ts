import crypto from "node:crypto";
import type {
  CompanyCapitalAllocation,
  CompanyCapitalAuditRecord,
  CompanyCapitalPortfolio,
  CompanyCapitalReport,
  CompanyCapitalRepository,
  CompanyCapitalRiskEvent,
  CompanyCapitalSettlement,
  CompanyCapitalStake,
  CreateCapitalAllocationInput,
  PlaceStakeInput,
} from "./types.js";

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

export class InMemoryCompanyCapitalRepository implements CompanyCapitalRepository {
  private portfolio: CompanyCapitalPortfolio | null = null;
  private allocations: CompanyCapitalAllocation[] = [];
  private stakes: CompanyCapitalStake[] = [];
  private settlements: CompanyCapitalSettlement[] = [];
  private riskEvents: CompanyCapitalRiskEvent[] = [];
  private reports: CompanyCapitalReport[] = [];
  private auditRecords: CompanyCapitalAuditRecord[] = [];

  async getOrCreatePortfolio(actorUserId: string): Promise<CompanyCapitalPortfolio> {
    if (!this.portfolio) {
      this.portfolio = {
        id: id("company_portfolio"),
        name: "FPF Company Capital Portfolio",
        baseCurrency: "USD",
        openingBalanceCents: 1000000,
        availableCapitalCents: 1000000,
        allocatedCapitalCents: 0,
        exposureCents: 0,
        settledProfitCents: 0,
        settledLossCents: 0,
        status: "ACTIVE",
        createdBy: actorUserId,
        createdAt: now(),
        updatedAt: now(),
      };
    }
    return this.portfolio;
  }

  async dashboardData() {
    return {
      portfolio: this.portfolio,
      allocations: this.allocations,
      stakes: this.stakes,
      settlements: this.settlements,
      riskEvents: this.riskEvents,
      reports: this.reports,
      auditTrail: this.auditRecords,
    };
  }

  async createAllocation(actorUserId: string, input: CreateCapitalAllocationInput & { portfolioId: string }) {
    const allocation: CompanyCapitalAllocation = {
      id: id("capital_allocation"),
      portfolioId: input.portfolioId,
      candidateId: input.candidateId ?? null,
      fixtureId: input.fixtureId ?? null,
      matchLabel: input.matchLabel,
      market: input.market,
      selection: input.selection,
      recommendedStakeCents: input.recommendedStakeCents,
      approvedStakeCents: 0,
      maxStakeCents: input.maxStakeCents,
      odds: input.odds,
      riskGrade: input.riskGrade,
      exposureCents: 0,
      status: "PENDING_APPROVAL",
      approvalStatus: "PENDING",
      analystApprovalStatus: input.analystApprovalStatus ?? "PENDING",
      intelligenceStatus: input.intelligenceStatus ?? "PENDING_REVIEW",
      rationale: input.rationale ?? null,
      createdBy: actorUserId,
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.allocations.unshift(allocation);
    return allocation;
  }

  async getAllocation(idValue: string) {
    return this.allocations.find((allocation) => allocation.id === idValue) ?? null;
  }

  async updateAllocation(allocation: CompanyCapitalAllocation) {
    this.allocations = this.allocations.map((item) => item.id === allocation.id ? { ...allocation, updatedAt: now() } : item);
    return (await this.getAllocation(allocation.id)) ?? allocation;
  }

  async createStake(actorUserId: string, input: PlaceStakeInput & { allocationId: string }) {
    const stake: CompanyCapitalStake = {
      id: id("capital_stake"),
      allocationId: input.allocationId,
      stakeCents: input.stakeCents,
      odds: input.odds,
      bookmaker: input.bookmaker,
      reference: input.reference ?? null,
      status: "PLACED",
      placedBy: actorUserId,
      placedAt: now(),
      notes: input.notes ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.stakes.unshift(stake);
    return stake;
  }

  async getStake(idValue: string) {
    return this.stakes.find((stake) => stake.id === idValue) ?? null;
  }

  async updateStake(stake: CompanyCapitalStake) {
    this.stakes = this.stakes.map((item) => item.id === stake.id ? { ...stake, updatedAt: now() } : item);
    return (await this.getStake(stake.id)) ?? stake;
  }

  async createSettlement(_actorUserId: string, input: CompanyCapitalSettlement) {
    this.settlements.unshift(input);
    return input;
  }

  async updatePortfolio(portfolio: CompanyCapitalPortfolio) {
    this.portfolio = { ...portfolio, updatedAt: now() };
    return this.portfolio;
  }

  async createRiskEvent(input: Omit<CompanyCapitalRiskEvent, "id" | "createdAt" | "resolvedAt" | "status">) {
    const riskEvent: CompanyCapitalRiskEvent = {
      id: id("capital_risk"),
      ...input,
      status: "OPEN",
      createdAt: now(),
      resolvedAt: null,
    };
    this.riskEvents.unshift(riskEvent);
    return riskEvent;
  }

  async createReport(input: Omit<CompanyCapitalReport, "id" | "generatedAt">) {
    const report: CompanyCapitalReport = {
      id: id("capital_report"),
      ...input,
      generatedAt: now(),
    };
    this.reports.unshift(report);
    return report;
  }

  async audit(input: Omit<CompanyCapitalAuditRecord, "id" | "createdAt">) {
    const record: CompanyCapitalAuditRecord = {
      id: id("capital_audit"),
      ...input,
      createdAt: now(),
    };
    this.auditRecords.unshift(record);
    return record;
  }
}
