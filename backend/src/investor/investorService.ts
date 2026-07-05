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

  plans() {
    return this.repository.plans();
  }

  investments(userId: string) {
    return this.repository.investments(userId);
  }

  reports(userId: string) {
    return this.repository.reports(userId);
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
}
