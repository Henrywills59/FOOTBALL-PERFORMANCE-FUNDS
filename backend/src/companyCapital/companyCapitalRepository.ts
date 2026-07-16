import { Prisma } from "@prisma/client";
import { getPrismaClient } from "../database/prismaClient.js";
import type {
  CapitalApprovalStatus,
  CapitalAllocationStatus,
  CapitalRiskGrade,
  CapitalSettlementOutcome,
  CapitalStakeStatus,
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

type PrismaClientLike = ReturnType<typeof getPrismaClient>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export class PrismaCompanyCapitalRepository implements CompanyCapitalRepository {
  constructor(private readonly prisma: PrismaClientLike = getPrismaClient()) {}

  async getOrCreatePortfolio(actorUserId: string): Promise<CompanyCapitalPortfolio> {
    const existing = await this.prisma.companyCapitalPortfolio.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
    });
    if (existing) return this.mapPortfolio(existing);

    const created = await this.prisma.companyCapitalPortfolio.create({
      data: {
        name: "FPF Company Capital Portfolio",
        openingBalanceCents: 1000000,
        availableCapitalCents: 1000000,
        createdBy: actorUserId,
      },
    });
    return this.mapPortfolio(created);
  }

  async dashboardData() {
    const [portfolio, allocations, stakes, settlements, riskEvents, reports, auditTrail] = await Promise.all([
      this.prisma.companyCapitalPortfolio.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } }),
      this.prisma.companyCapitalAllocation.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      this.prisma.companyCapitalStake.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      this.prisma.companyCapitalSettlement.findMany({ orderBy: { settledAt: "desc" }, take: 100 }),
      this.prisma.companyCapitalRiskEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      this.prisma.companyCapitalReport.findMany({ orderBy: { generatedAt: "desc" }, take: 50 }),
      this.prisma.companyCapitalAuditRecord.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
    ]);
    return {
      portfolio: portfolio ? this.mapPortfolio(portfolio) : null,
      allocations: allocations.map((allocation) => this.mapAllocation(allocation)),
      stakes: stakes.map((stake) => this.mapStake(stake)),
      settlements: settlements.map((settlement) => this.mapSettlement(settlement)),
      riskEvents: riskEvents.map((event) => this.mapRiskEvent(event)),
      reports: reports.map((report) => this.mapReport(report)),
      auditTrail: auditTrail.map((record) => this.mapAudit(record)),
    };
  }

  async createAllocation(actorUserId: string, input: CreateCapitalAllocationInput & { portfolioId: string }) {
    const allocation = await this.prisma.companyCapitalAllocation.create({
      data: {
        portfolioId: input.portfolioId,
        candidateId: input.candidateId ?? null,
        fixtureId: input.fixtureId ?? null,
        matchLabel: input.matchLabel,
        market: input.market,
        selection: input.selection,
        recommendedStakeCents: input.recommendedStakeCents,
        maxStakeCents: input.maxStakeCents,
        odds: input.odds,
        riskGrade: input.riskGrade,
        status: "PENDING_APPROVAL",
        approvalStatus: "PENDING",
        analystApprovalStatus: input.analystApprovalStatus ?? "PENDING",
        intelligenceStatus: input.intelligenceStatus ?? "PENDING_REVIEW",
        rationale: input.rationale ?? null,
        createdBy: actorUserId,
      },
    });
    return this.mapAllocation(allocation);
  }

  async getAllocation(id: string) {
    const allocation = await this.prisma.companyCapitalAllocation.findUnique({ where: { id } });
    return allocation ? this.mapAllocation(allocation) : null;
  }

  async updateAllocation(allocation: CompanyCapitalAllocation) {
    const updated = await this.prisma.companyCapitalAllocation.update({
      where: { id: allocation.id },
      data: {
        approvedStakeCents: allocation.approvedStakeCents,
        exposureCents: allocation.exposureCents,
        status: allocation.status,
        approvalStatus: allocation.approvalStatus,
        analystApprovalStatus: allocation.analystApprovalStatus,
        intelligenceStatus: allocation.intelligenceStatus,
        rationale: allocation.rationale,
        approvedBy: allocation.approvedBy,
        approvedAt: allocation.approvedAt ? new Date(allocation.approvedAt) : null,
        rejectedBy: allocation.rejectedBy,
        rejectedAt: allocation.rejectedAt ? new Date(allocation.rejectedAt) : null,
      },
    });
    return this.mapAllocation(updated);
  }

  async createStake(actorUserId: string, input: PlaceStakeInput & { allocationId: string }) {
    const stake = await this.prisma.companyCapitalStake.create({
      data: {
        allocationId: input.allocationId,
        stakeCents: input.stakeCents,
        odds: input.odds,
        bookmaker: input.bookmaker,
        reference: input.reference ?? null,
        status: "PLACED",
        placedBy: actorUserId,
        placedAt: new Date(),
        notes: input.notes ?? null,
      },
    });
    return this.mapStake(stake);
  }

  async getStake(id: string) {
    const stake = await this.prisma.companyCapitalStake.findUnique({ where: { id } });
    return stake ? this.mapStake(stake) : null;
  }

  async updateStake(stake: CompanyCapitalStake) {
    const updated = await this.prisma.companyCapitalStake.update({
      where: { id: stake.id },
      data: {
        status: stake.status,
        notes: stake.notes,
      },
    });
    return this.mapStake(updated);
  }

  async createSettlement(_actorUserId: string, input: CompanyCapitalSettlement) {
    const settlement = await this.prisma.companyCapitalSettlement.create({
      data: {
        id: input.id,
        allocationId: input.allocationId,
        stakeId: input.stakeId,
        outcome: input.outcome,
        grossReturnCents: input.grossReturnCents,
        profitCents: input.profitCents,
        lossCents: input.lossCents,
        netResultCents: input.netResultCents,
        settlementStatus: input.settlementStatus,
        settledBy: input.settledBy,
        settledAt: new Date(input.settledAt),
        notes: input.notes,
      },
    });
    return this.mapSettlement(settlement);
  }

  async updatePortfolio(portfolio: CompanyCapitalPortfolio) {
    const updated = await this.prisma.companyCapitalPortfolio.update({
      where: { id: portfolio.id },
      data: {
        availableCapitalCents: portfolio.availableCapitalCents,
        allocatedCapitalCents: portfolio.allocatedCapitalCents,
        exposureCents: portfolio.exposureCents,
        settledProfitCents: portfolio.settledProfitCents,
        settledLossCents: portfolio.settledLossCents,
        status: portfolio.status,
      },
    });
    return this.mapPortfolio(updated);
  }

  async createRiskEvent(input: Omit<CompanyCapitalRiskEvent, "id" | "createdAt" | "resolvedAt" | "status">) {
    const event = await this.prisma.companyCapitalRiskEvent.create({
      data: {
        allocationId: input.allocationId,
        severity: input.severity,
        message: input.message,
        createdBy: input.createdBy,
      },
    });
    return this.mapRiskEvent(event);
  }

  async createReport(input: Omit<CompanyCapitalReport, "id" | "generatedAt">) {
    const report = await this.prisma.companyCapitalReport.create({
      data: {
        periodType: input.periodType,
        periodLabel: input.periodLabel,
        summary: input.summary,
        metrics: input.metrics as Prisma.InputJsonValue,
        generatedBy: input.generatedBy,
      },
    });
    return this.mapReport(report);
  }

  async audit(input: Omit<CompanyCapitalAuditRecord, "id" | "createdAt">) {
    const record = await this.prisma.companyCapitalAuditRecord.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeState: input.beforeState === undefined ? undefined : input.beforeState as Prisma.InputJsonValue,
        afterState: input.afterState === undefined ? undefined : input.afterState as Prisma.InputJsonValue,
        notes: input.notes,
      },
    });
    return this.mapAudit(record);
  }

  private mapPortfolio(row: { id: string; name: string; baseCurrency: string; openingBalanceCents: number; availableCapitalCents: number; allocatedCapitalCents: number; exposureCents: number; settledProfitCents: number; settledLossCents: number; status: string; createdBy: string; createdAt: Date; updatedAt: Date }): CompanyCapitalPortfolio {
    return {
      id: row.id,
      name: row.name,
      baseCurrency: row.baseCurrency,
      openingBalanceCents: row.openingBalanceCents,
      availableCapitalCents: row.availableCapitalCents,
      allocatedCapitalCents: row.allocatedCapitalCents,
      exposureCents: row.exposureCents,
      settledProfitCents: row.settledProfitCents,
      settledLossCents: row.settledLossCents,
      status: row.status as CompanyCapitalPortfolio["status"],
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapAllocation(row: { id: string; portfolioId: string; candidateId: string | null; fixtureId: string | null; matchLabel: string; market: string; selection: string; recommendedStakeCents: number; approvedStakeCents: number; maxStakeCents: number; odds: number; riskGrade: string; exposureCents: number; status: string; approvalStatus: string; analystApprovalStatus: string; intelligenceStatus: string; rationale: string | null; createdBy: string; approvedBy: string | null; approvedAt: Date | null; rejectedBy: string | null; rejectedAt: Date | null; createdAt: Date; updatedAt: Date }): CompanyCapitalAllocation {
    return {
      id: row.id,
      portfolioId: row.portfolioId,
      candidateId: row.candidateId,
      fixtureId: row.fixtureId,
      matchLabel: row.matchLabel,
      market: row.market,
      selection: row.selection,
      recommendedStakeCents: row.recommendedStakeCents,
      approvedStakeCents: row.approvedStakeCents,
      maxStakeCents: row.maxStakeCents,
      odds: row.odds,
      riskGrade: row.riskGrade as CapitalRiskGrade,
      exposureCents: row.exposureCents,
      status: row.status as CapitalAllocationStatus,
      approvalStatus: row.approvalStatus as CapitalApprovalStatus,
      analystApprovalStatus: row.analystApprovalStatus as CapitalApprovalStatus,
      intelligenceStatus: row.intelligenceStatus,
      rationale: row.rationale,
      createdBy: row.createdBy,
      approvedBy: row.approvedBy,
      approvedAt: row.approvedAt?.toISOString() ?? null,
      rejectedBy: row.rejectedBy,
      rejectedAt: row.rejectedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapStake(row: { id: string; allocationId: string; stakeCents: number; odds: number; bookmaker: string; reference: string | null; status: string; placedBy: string | null; placedAt: Date | null; notes: string | null; createdAt: Date; updatedAt: Date }): CompanyCapitalStake {
    return {
      id: row.id,
      allocationId: row.allocationId,
      stakeCents: row.stakeCents,
      odds: row.odds,
      bookmaker: row.bookmaker,
      reference: row.reference,
      status: row.status as CapitalStakeStatus,
      placedBy: row.placedBy,
      placedAt: row.placedAt?.toISOString() ?? null,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapSettlement(row: { id: string; allocationId: string; stakeId: string | null; outcome: string; grossReturnCents: number; profitCents: number; lossCents: number; netResultCents: number; settlementStatus: string; settledBy: string; settledAt: Date; notes: string | null }): CompanyCapitalSettlement {
    return {
      id: row.id,
      allocationId: row.allocationId,
      stakeId: row.stakeId,
      outcome: row.outcome as CapitalSettlementOutcome,
      grossReturnCents: row.grossReturnCents,
      profitCents: row.profitCents,
      lossCents: row.lossCents,
      netResultCents: row.netResultCents,
      settlementStatus: row.settlementStatus as CompanyCapitalSettlement["settlementStatus"],
      settledBy: row.settledBy,
      settledAt: row.settledAt.toISOString(),
      notes: row.notes,
    };
  }

  private mapRiskEvent(row: { id: string; allocationId: string | null; severity: string; status: string; message: string; createdBy: string; createdAt: Date; resolvedAt: Date | null }): CompanyCapitalRiskEvent {
    return {
      id: row.id,
      allocationId: row.allocationId,
      severity: row.severity as CompanyCapitalRiskEvent["severity"],
      status: row.status as CompanyCapitalRiskEvent["status"],
      message: row.message,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    };
  }

  private mapReport(row: { id: string; periodType: string; periodLabel: string; summary: string; metrics: unknown; generatedBy: string; generatedAt: Date }): CompanyCapitalReport {
    return {
      id: row.id,
      periodType: row.periodType as CompanyCapitalReport["periodType"],
      periodLabel: row.periodLabel,
      summary: row.summary,
      metrics: asRecord(row.metrics),
      generatedBy: row.generatedBy,
      generatedAt: row.generatedAt.toISOString(),
    };
  }

  private mapAudit(row: { id: string; actorUserId: string | null; action: string; entityType: string; entityId: string | null; beforeState: unknown; afterState: unknown; notes: string | null; createdAt: Date }): CompanyCapitalAuditRecord {
    return {
      id: row.id,
      actorUserId: row.actorUserId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      beforeState: row.beforeState,
      afterState: row.afterState,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
