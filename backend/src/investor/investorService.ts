import type { AdminService } from "../admin/adminService.js";
import type { InvestorRepository } from "./types.js";

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
}
