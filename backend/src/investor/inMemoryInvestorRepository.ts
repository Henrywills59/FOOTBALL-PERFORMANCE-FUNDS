import type { InvestmentPlan, InvestorInvestment, InvestorReport, WithdrawalRequest } from "@fpf/shared";
import type { InvestorRepository } from "./types.js";

export class InMemoryInvestorRepository implements InvestorRepository {
  plansData: InvestmentPlan[] = [
    {
      id: "starter",
      name: "Starter Portfolio",
      description: "Entry package for cautious exposure.",
      minimumInvestmentCents: 50000,
      maximumInvestmentCents: 250000,
      historicalPerformanceNote: "Historical weekly performance has varied by market conditions.",
      riskDisclosure: "All investments carry risk. Historical results do not guarantee future performance.",
    },
  ];
  investmentsData: InvestorInvestment[] = [];
  reportsData: InvestorReport[] = [];
  withdrawalsData: WithdrawalRequest[] = [];

  async dashboard(userId: string) {
    const investmentHistory = await this.investments(userId);
    const totalInvestmentCents = investmentHistory.reduce((total, item) => total + item.amountCents, 0);
    const currentPortfolioValueCents = investmentHistory.reduce((total, item) => total + item.currentValueCents, 0);
    return {
      totalInvestmentCents,
      currentPortfolioValueCents,
      weeklyRoiPercent: investmentHistory[0]?.weeklyRoiPercent ?? 0,
      lifetimeRoiPercent: investmentHistory[0]?.lifetimeRoiPercent ?? 0,
      currentStatus: investmentHistory.length ? "Active" : "No active investments",
      investmentHistory,
    };
  }

  async plans() {
    return this.plansData;
  }

  async createInvestment(input: { userId: string; planId: string; amountCents: number }) {
    const plan = this.plansData.find((item) => item.id === input.planId);
    if (!plan || input.amountCents < plan.minimumInvestmentCents || input.amountCents > plan.maximumInvestmentCents) {
      throw new Error("Investment amount is outside the selected plan range");
    }
    const investment: InvestorInvestment = {
      id: String(this.investmentsData.length + 1),
      planName: plan.name,
      amountCents: input.amountCents,
      currentValueCents: input.amountCents,
      weeklyRoiPercent: 0,
      lifetimeRoiPercent: 0,
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    };
    this.investmentsData.push(investment);
    return investment;
  }

  async investments(_userId?: string) {
    return this.investmentsData;
  }

  async reports(_userId?: string) {
    return this.reportsData;
  }

  async createWithdrawal(input: { amountCents: number }) {
    const request: WithdrawalRequest = {
      id: String(this.withdrawalsData.length + 1),
      amountCents: input.amountCents,
      status: "PENDING",
      requestedAt: new Date().toISOString(),
      reviewedAt: null,
      adminNotes: null,
    };
    this.withdrawalsData.push(request);
    return request;
  }

  async withdrawals(_userId?: string) {
    return this.withdrawalsData;
  }

  async reviewWithdrawal(input: { id: string; status: "APPROVED" | "REJECTED"; adminNotes?: string | null }) {
    const request = this.withdrawalsData.find((item) => item.id === input.id);
    if (!request) return null;
    request.status = input.status;
    request.adminNotes = input.adminNotes ?? null;
    request.reviewedAt = new Date().toISOString();
    return request;
  }
}
