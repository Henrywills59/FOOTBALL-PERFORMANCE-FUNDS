import type {
  EligibleParticipationSnapshot,
  FinancialAuditRecord,
  FinancialEngineRun,
  FinancialReport,
  FinancialRepository,
} from "./types.js";

export class InMemoryFinancialRepository implements FinancialRepository {
  private readonly runs: FinancialEngineRun[] = [];

  constructor(private readonly participations: EligibleParticipationSnapshot[] = [
    {
      participationId: "participation-placeholder-1",
      userId: "performance-partner-1",
      participationAmountCents: 500000,
      remainingDistributions: 12,
    },
    {
      participationId: "participation-placeholder-2",
      userId: "performance-partner-2",
      participationAmountCents: 250000,
      remainingDistributions: 8,
    },
  ]) {}

  async latestRun(): Promise<FinancialEngineRun | null> {
    return this.runs[0] ?? null;
  }

  async listRuns(): Promise<FinancialEngineRun[]> {
    return this.runs;
  }

  async listReports(): Promise<FinancialReport[]> {
    return this.runs.flatMap((run) => run.reports);
  }

  async listAuditRecords(): Promise<FinancialAuditRecord[]> {
    return this.runs.flatMap((run) => run.auditRecords);
  }

  async eligibleParticipations(): Promise<EligibleParticipationSnapshot[]> {
    return this.participations;
  }

  async reserveBalance(): Promise<number> {
    return this.runs.flatMap((run) => run.reserveLedgerEntries).reduce((total, item) => total + item.amountCents, 0);
  }

  async companyGrowthBalance(): Promise<number> {
    return this.runs.flatMap((run) => run.companyGrowthLedgerEntries).reduce((total, item) => total + item.amountCents, 0);
  }

  async saveRun(run: FinancialEngineRun): Promise<FinancialEngineRun> {
    this.runs.unshift(run);
    return run;
  }
}
