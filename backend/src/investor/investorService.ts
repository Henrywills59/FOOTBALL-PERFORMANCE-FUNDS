import type { AdminService } from "../admin/adminService.js";
import type { InvestorSimulatorInput, InvestorSimulatorResult } from "@fpf/shared";
import type { InvestorRepository } from "./types.js";

const simulatorRiskWarning =
  "This is a simulation only. Returns are not guaranteed, actual results depend on real platform performance, and final payout logic will be connected later through approved payment APIs.";

function shouldDistribute(week: number, totalWeeks: number, frequency: InvestorSimulatorInput["withdrawalFrequency"]) {
  if (frequency === "NONE") return false;
  if (frequency === "WEEKLY") return true;
  if (frequency === "MONTHLY") return week % 4 === 0 || week === totalWeeks;
  return week === totalWeeks;
}

export class InvestorService {
  constructor(
    private readonly repository: InvestorRepository,
    private readonly adminService: AdminService,
  ) {}

  dashboard(userId: string) {
    return this.repository.dashboard(userId);
  }

  profile(userId: string) {
    return this.repository.profile(userId);
  }

  plans() {
    return this.repository.plans();
  }

  investments(userId: string) {
    return this.repository.investments(userId);
  }

  reports(userId: string) {
    return this.repository.portalReports(userId);
  }

  legacyReports(userId: string) {
    return this.repository.reports(userId);
  }

  distributions(userId: string) {
    return this.repository.distributions(userId);
  }

  withdrawals(userId: string) {
    return this.repository.withdrawals(userId);
  }

  async createInvestment(userId: string, planId: string, amountCents: number) {
    const investment = await this.repository.createInvestment({ userId, planId, amountCents });
    await this.adminService.audit(userId, "INVESTMENT_CREATED", "INVESTMENT", investment.id);
    return investment;
  }

  async createWithdrawal(userId: string, amountCents: number) {
    const request = await this.repository.createWithdrawal({ userId, amountCents });
    await this.adminService.audit(userId, "WITHDRAWAL_REQUEST_CREATED", "WITHDRAWAL_REQUEST", request.id);
    return request;
  }

  async reviewWithdrawal(actorUserId: string, id: string, status: "APPROVED" | "REJECTED", adminNotes?: string | null) {
    const request = await this.repository.reviewWithdrawal({ id, status, adminNotes });
    await this.adminService.audit(actorUserId, `WITHDRAWAL_${status}`, "WITHDRAWAL_REQUEST", id);
    return request;
  }

  adminManagement() {
    return this.repository.adminManagement();
  }

  adminInvestorDetail(investorAccountId: string) {
    return this.repository.adminInvestorDetail(investorAccountId);
  }

  async calculateWeeklyDistributions(actorUserId: string) {
    const result = await this.repository.calculateWeeklyDistributions(actorUserId);
    await this.adminService.audit(actorUserId, "INVESTOR_DISTRIBUTIONS_CALCULATED", "INVESTOR_DISTRIBUTION_BATCH", result.batch.id);
    return result;
  }

  async approveDistribution(actorUserId: string, distributionId: string, adminNotes?: string | null) {
    const distribution = await this.repository.updateDistributionStatus({
      actorUserId,
      distributionId,
      status: "APPROVED",
      adminNotes,
    });
    await this.adminService.audit(actorUserId, "INVESTOR_DISTRIBUTION_APPROVED", "INVESTOR_DISTRIBUTION", distributionId);
    return distribution;
  }

  async rejectDistribution(actorUserId: string, distributionId: string, adminNotes?: string | null) {
    const distribution = await this.repository.updateDistributionStatus({
      actorUserId,
      distributionId,
      status: "CANCELLED",
      adminNotes,
    });
    await this.adminService.audit(actorUserId, "INVESTOR_DISTRIBUTION_REJECTED", "INVESTOR_DISTRIBUTION", distributionId);
    return distribution;
  }

  async markDistributionPaid(actorUserId: string, distributionId: string, adminNotes?: string | null) {
    const distribution = await this.repository.updateDistributionStatus({
      actorUserId,
      distributionId,
      status: "PAID",
      adminNotes,
    });
    await this.adminService.audit(actorUserId, "INVESTOR_DISTRIBUTION_MARKED_PAID", "INVESTOR_DISTRIBUTION", distributionId);
    return distribution;
  }

  addInvestorNote(actorUserId: string, investorAccountId: string, note: string) {
    return this.repository.addInvestorNote({ actorUserId, investorAccountId, note });
  }

  simulate(input: InvestorSimulatorInput): InvestorSimulatorResult {
    const normalized: InvestorSimulatorInput = {
      investmentAmountCents: Math.max(0, Math.round(input.investmentAmountCents)),
      expectedWeeklyReturnPercent: Math.max(0, Math.min(25, input.expectedWeeklyReturnPercent)),
      numberOfWeeks: Math.max(1, Math.min(260, Math.round(input.numberOfWeeks))),
      reinvest: Boolean(input.reinvest),
      withdrawalFrequency: input.withdrawalFrequency,
      platformFeePercent: Math.max(0, Math.min(50, input.platformFeePercent)),
    };

    let balanceCents = normalized.investmentAmountCents;
    let netProjectedEarningsCents = 0;
    let totalDistributionsCents = 0;
    let platformFeesCents = 0;
    const weeks = [];

    for (let week = 1; week <= normalized.numberOfWeeks; week += 1) {
      const startingBalanceCents = balanceCents;
      const grossEarningsCents = Math.round(startingBalanceCents * (normalized.expectedWeeklyReturnPercent / 100));
      const platformFeeCents = Math.round(grossEarningsCents * (normalized.platformFeePercent / 100));
      const netEarningsCents = Math.max(0, grossEarningsCents - platformFeeCents);
      const distributionCents = shouldDistribute(week, normalized.numberOfWeeks, normalized.withdrawalFrequency)
        ? netEarningsCents
        : 0;

      if (normalized.reinvest && distributionCents === 0) {
        balanceCents += netEarningsCents;
      }

      netProjectedEarningsCents += netEarningsCents;
      totalDistributionsCents += distributionCents;
      platformFeesCents += platformFeeCents;

      weeks.push({
        week,
        startingBalanceCents,
        grossEarningsCents,
        platformFeeCents,
        netEarningsCents,
        distributionCents,
        endingBalanceCents: balanceCents,
      });
    }

    return {
      input: normalized,
      netProjectedEarningsCents,
      totalProjectedBalanceCents: balanceCents,
      totalDistributionsCents,
      platformFeesCents,
      weeks,
      riskWarning: simulatorRiskWarning,
      simulationNotice: "This calculator is for planning scenarios only and does not represent a fixed return offer.",
      payoutNotice: "Final payout, withdrawal, and settlement logic will be connected later through approved payment APIs.",
    };
  }
}
