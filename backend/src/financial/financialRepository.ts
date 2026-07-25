import { Prisma } from "@prisma/client";
import { getPrismaClient } from "../database/prismaClient.js";
import type {
  EligibleParticipationSnapshot,
  FinancialAllocation,
  FinancialAnalystReward,
  FinancialAuditRecord,
  FinancialEngineRun,
  FinancialPartnerDistribution,
  FinancialReport,
  FinancialRepository,
  ReserveLedgerEntry,
} from "./types.js";

type PrismaClientLike = ReturnType<typeof getPrismaClient>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export class PrismaFinancialRepository implements FinancialRepository {
  constructor(private readonly prisma: PrismaClientLike = getPrismaClient()) {}

  async latestRun(): Promise<FinancialEngineRun | null> {
    const row = await this.prisma.financialEngineRun.findFirst({
      orderBy: { calculatedAt: "desc" },
      include: this.include(),
    });
    return row ? this.mapRun(row) : null;
  }

  async listRuns(): Promise<FinancialEngineRun[]> {
    const rows = await this.prisma.financialEngineRun.findMany({
      orderBy: { calculatedAt: "desc" },
      take: 25,
      include: this.include(),
    });
    return rows.map((row) => this.mapRun(row));
  }

  async listReports(): Promise<FinancialReport[]> {
    const rows = await this.prisma.financialReport.findMany({
      orderBy: { generatedAt: "desc" },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      runId: row.runId,
      reportType: row.reportType as FinancialReport["reportType"],
      title: row.title,
      summary: row.summary,
      metrics: asRecord(row.metrics),
      generatedBy: row.generatedBy,
      generatedAt: row.generatedAt.toISOString(),
    }));
  }

  async listAuditRecords(): Promise<FinancialAuditRecord[]> {
    const rows = await this.prisma.financialAuditRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((row) => ({
      id: row.id,
      runId: row.runId,
      actorUserId: row.actorUserId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      beforeState: row.beforeState,
      afterState: row.afterState,
      calculationRef: row.calculationRef,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async eligibleParticipations(): Promise<EligibleParticipationSnapshot[]> {
    const rows = await this.prisma.performancePartnerParticipation.findMany({
      where: {
        status: "ACTIVE",
        remainingDistributions: { gt: 0 },
      },
      select: {
        id: true,
        userId: true,
        participationAmountCents: true,
        remainingDistributions: true,
      },
    });
    return rows.map((row) => ({
      participationId: row.id,
      userId: row.userId,
      participationAmountCents: row.participationAmountCents,
      remainingDistributions: row.remainingDistributions,
    }));
  }

  async reserveBalance(): Promise<number> {
    const aggregate = await this.prisma.financialReserveLedger.aggregate({ _sum: { amountCents: true } });
    return aggregate._sum.amountCents ?? 0;
  }

  async companyGrowthBalance(): Promise<number> {
    const aggregate = await this.prisma.financialCompanyGrowthLedger.aggregate({ _sum: { amountCents: true } });
    return aggregate._sum.amountCents ?? 0;
  }

  async saveRun(run: FinancialEngineRun): Promise<FinancialEngineRun> {
    const row = await this.prisma.$transaction(async (tx) => {
      return tx.financialEngineRun.create({
        data: {
          id: run.id,
          weekLabel: run.weekLabel,
          seasonId: run.seasonId,
          grossReturnsCents: run.grossReturnsCents,
          returnedStakeCents: run.returnedStakeCents,
          totalStakeCents: run.totalStakeCents,
          totalLossesCents: run.totalLossesCents,
          operatingAdjustmentsCents: run.operatingAdjustmentsCents,
          eligibleProfitCents: run.eligibleProfitCents,
          status: run.status,
          calculationInput: run.calculationInput as Prisma.InputJsonValue,
          calculationOutput: run.calculationOutput as Prisma.InputJsonValue,
          calculatedBy: run.calculatedBy,
          calculatedAt: new Date(run.calculatedAt),
          allocations: {
            create: run.allocations.map((allocation) => ({
              id: allocation.id,
              allocationType: allocation.allocationType,
              label: allocation.label,
              percent: allocation.percent,
              amountCents: allocation.amountCents,
              distributable: allocation.distributable,
              auditExplanation: allocation.auditExplanation,
              createdAt: new Date(allocation.createdAt),
            })),
          },
          partnerDistributions: {
            create: run.partnerDistributions.map((distribution) => ({
              id: distribution.id,
              participationId: distribution.participationId,
              userId: distribution.userId,
              participationWeight: distribution.participationWeight,
              distributionCents: distribution.distributionCents,
              status: distribution.status,
              explanation: distribution.explanation,
              createdAt: new Date(distribution.createdAt),
            })),
          },
          analystRewards: {
            create: run.analystRewards.map((reward) => ({
              id: reward.id,
              analystId: reward.analystId,
              analystName: reward.analystName,
              contributionWeight: reward.contributionWeight,
              rewardCents: reward.rewardCents,
              status: reward.status,
              breakdown: reward.breakdown as Prisma.InputJsonValue,
              createdAt: new Date(reward.createdAt),
            })),
          },
          reserveLedgerEntries: {
            create: run.reserveLedgerEntries.map((entry) => this.ledgerCreate(entry)),
          },
          companyGrowthLedgerEntries: {
            create: run.companyGrowthLedgerEntries.map((entry) => this.ledgerCreate(entry)),
          },
          reports: {
            create: run.reports.map((report) => ({
              id: report.id,
              reportType: report.reportType,
              title: report.title,
              summary: report.summary,
              metrics: report.metrics as Prisma.InputJsonValue,
              generatedBy: report.generatedBy,
              generatedAt: new Date(report.generatedAt),
            })),
          },
          auditRecords: {
            create: run.auditRecords.map((record) => ({
              id: record.id,
              actorUserId: record.actorUserId,
              action: record.action,
              entityType: record.entityType,
              entityId: record.entityId,
              beforeState: record.beforeState === undefined ? undefined : record.beforeState as Prisma.InputJsonValue,
              afterState: record.afterState === undefined ? undefined : record.afterState as Prisma.InputJsonValue,
              calculationRef: record.calculationRef,
              notes: record.notes,
              createdAt: new Date(record.createdAt),
            })),
          },
        },
        include: this.include(),
      });
    });
    return this.mapRun(row);
  }

  private include() {
    return {
      allocations: true,
      partnerDistributions: true,
      analystRewards: true,
      reserveLedgerEntries: true,
      companyGrowthLedgerEntries: true,
      reports: true,
      auditRecords: true,
    } as const;
  }

  private ledgerCreate(entry: ReserveLedgerEntry) {
    return {
      id: entry.id,
      direction: entry.direction,
      amountCents: entry.amountCents,
      balanceAfterCents: entry.balanceAfterCents,
      classification: entry.classification,
      notes: entry.notes,
      createdBy: entry.createdBy,
      createdAt: new Date(entry.createdAt),
    };
  }

  private mapRun(row: Awaited<ReturnType<PrismaClientLike["financialEngineRun"]["findFirst"]>> & Record<string, unknown>): FinancialEngineRun {
    return {
      id: row.id as string,
      weekLabel: row.weekLabel as string,
      seasonId: row.seasonId as string | null,
      grossReturnsCents: row.grossReturnsCents as number,
      returnedStakeCents: row.returnedStakeCents as number,
      totalStakeCents: row.totalStakeCents as number,
      totalLossesCents: row.totalLossesCents as number,
      operatingAdjustmentsCents: row.operatingAdjustmentsCents as number,
      eligibleProfitCents: row.eligibleProfitCents as number,
      status: row.status as FinancialEngineRun["status"],
      calculationInput: asRecord(row.calculationInput) as FinancialEngineRun["calculationInput"],
      calculationOutput: asRecord(row.calculationOutput),
      calculatedBy: row.calculatedBy as string,
      calculatedAt: (row.calculatedAt as Date).toISOString(),
      allocations: ((row.allocations as Array<Record<string, unknown>> | undefined) ?? []).map((allocation) => ({
        id: allocation.id as string,
        runId: allocation.runId as string,
        allocationType: allocation.allocationType as FinancialAllocation["allocationType"],
        label: allocation.label as string,
        percent: allocation.percent as number,
        amountCents: allocation.amountCents as number,
        distributable: allocation.distributable as boolean,
        auditExplanation: allocation.auditExplanation as string,
        createdAt: (allocation.createdAt as Date).toISOString(),
      })),
      partnerDistributions: ((row.partnerDistributions as Array<Record<string, unknown>> | undefined) ?? []).map((distribution) => ({
        id: distribution.id as string,
        runId: distribution.runId as string,
        participationId: distribution.participationId as string | null,
        userId: distribution.userId as string | null,
        participationWeight: distribution.participationWeight as number,
        distributionCents: distribution.distributionCents as number,
        status: distribution.status as FinancialPartnerDistribution["status"],
        explanation: distribution.explanation as string,
        createdAt: (distribution.createdAt as Date).toISOString(),
      })),
      analystRewards: ((row.analystRewards as Array<Record<string, unknown>> | undefined) ?? []).map((reward) => ({
        id: reward.id as string,
        runId: reward.runId as string,
        analystId: reward.analystId as string,
        analystName: reward.analystName as string,
        contributionWeight: reward.contributionWeight as number,
        rewardCents: reward.rewardCents as number,
        status: reward.status as FinancialAnalystReward["status"],
        breakdown: asArray(reward.breakdown),
        createdAt: (reward.createdAt as Date).toISOString(),
      })),
      reserveLedgerEntries: ((row.reserveLedgerEntries as Array<Record<string, unknown>> | undefined) ?? []).map((entry) => this.mapLedger(entry)),
      companyGrowthLedgerEntries: ((row.companyGrowthLedgerEntries as Array<Record<string, unknown>> | undefined) ?? []).map((entry) => this.mapLedger(entry)),
      reports: ((row.reports as Array<Record<string, unknown>> | undefined) ?? []).map((report) => ({
        id: report.id as string,
        runId: report.runId as string,
        reportType: report.reportType as FinancialReport["reportType"],
        title: report.title as string,
        summary: report.summary as string,
        metrics: asRecord(report.metrics),
        generatedBy: report.generatedBy as string,
        generatedAt: (report.generatedAt as Date).toISOString(),
      })),
      auditRecords: ((row.auditRecords as Array<Record<string, unknown>> | undefined) ?? []).map((record) => ({
        id: record.id as string,
        runId: record.runId as string | null,
        actorUserId: record.actorUserId as string | null,
        action: record.action as string,
        entityType: record.entityType as string,
        entityId: record.entityId as string | null,
        beforeState: record.beforeState,
        afterState: record.afterState,
        calculationRef: record.calculationRef as string | null,
        notes: record.notes as string | null,
        createdAt: (record.createdAt as Date).toISOString(),
      })),
    };
  }

  private mapLedger(entry: Record<string, unknown>): ReserveLedgerEntry {
    return {
      id: entry.id as string,
      runId: entry.runId as string,
      direction: entry.direction as ReserveLedgerEntry["direction"],
      amountCents: entry.amountCents as number,
      balanceAfterCents: entry.balanceAfterCents as number,
      classification: entry.classification as string,
      notes: entry.notes as string,
      createdBy: entry.createdBy as string,
      createdAt: (entry.createdAt as Date).toISOString(),
    };
  }
}
