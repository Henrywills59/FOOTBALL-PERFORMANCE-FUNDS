import { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../database/prismaClient.js";
import type { InvestmentPlan, InvestorInvestment, InvestorReport, WithdrawalRequest } from "@fpf/shared";
import type { InvestorRepository } from "./types.js";

function planRow(plan: {
  id: string;
  name: string;
  description: string;
  minimumInvestmentCents: number;
  maximumInvestmentCents: number;
  historicalPerformanceNote: string;
  riskDisclosure: string;
}): InvestmentPlan {
  return plan;
}

function investmentRow(investment: {
  id: string;
  amountCents: number;
  currentValueCents: number;
  weeklyRoiPercent: number;
  lifetimeRoiPercent: number;
  status: InvestorInvestment["status"];
  createdAt: Date;
  plan: { name: string };
}): InvestorInvestment {
  return {
    id: investment.id,
    planName: investment.plan.name,
    amountCents: investment.amountCents,
    currentValueCents: investment.currentValueCents,
    weeklyRoiPercent: investment.weeklyRoiPercent,
    lifetimeRoiPercent: investment.lifetimeRoiPercent,
    status: investment.status,
    createdAt: investment.createdAt.toISOString(),
  };
}

function withdrawalRow(row: {
  id: string;
  amountCents: number;
  status: WithdrawalRequest["status"];
  requestedAt: Date;
  reviewedAt: Date | null;
  adminNotes: string | null;
}): WithdrawalRequest {
  return {
    id: row.id,
    amountCents: row.amountCents,
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    adminNotes: row.adminNotes,
  };
}

export class PrismaInvestorRepository implements InvestorRepository {
  constructor(private readonly prismaClient?: PrismaClient) {}

  private get prisma() {
    return this.prismaClient ?? getPrismaClient();
  }

  async dashboard(userId: string) {
    const investments = await this.investments(userId);
    const totalInvestmentCents = investments.reduce((total, item) => total + item.amountCents, 0);
    const currentPortfolioValueCents = investments.reduce((total, item) => total + item.currentValueCents, 0);
    const weeklyRoiPercent = investments.length
      ? investments.reduce((total, item) => total + item.weeklyRoiPercent, 0) / investments.length
      : 0;
    const lifetimeRoiPercent = investments.length
      ? investments.reduce((total, item) => total + item.lifetimeRoiPercent, 0) / investments.length
      : 0;

    return {
      totalInvestmentCents,
      currentPortfolioValueCents,
      weeklyRoiPercent,
      lifetimeRoiPercent,
      currentStatus: investments.some((item) => item.status === "ACTIVE") ? "Active" : "No active investments",
      investmentHistory: investments,
    };
  }

  async plans() {
    const plans = await this.prisma.investmentPlan.findMany({
      where: { active: true },
      orderBy: { minimumInvestmentCents: "asc" },
    });
    return plans.map(planRow);
  }

  async createInvestment(input: { userId: string; planId: string; amountCents: number }) {
    const plan = await this.prisma.investmentPlan.findUnique({ where: { id: input.planId } });
    if (!plan || input.amountCents < plan.minimumInvestmentCents || input.amountCents > plan.maximumInvestmentCents) {
      throw new Error("Investment amount is outside the selected plan range");
    }
    const investment = await this.prisma.investment.create({
      data: {
        userId: input.userId,
        planId: input.planId,
        amountCents: input.amountCents,
        currentValueCents: input.amountCents,
      },
      include: { plan: true },
    });
    return investmentRow(investment);
  }

  async investments(userId: string) {
    const investments = await this.prisma.investment.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    return investments.map(investmentRow);
  }

  async reports(userId: string) {
    const reports = await this.prisma.performanceReport.findMany({
      where: { investment: { userId } },
      orderBy: { periodEnd: "desc" },
    });
    return reports.map((report): InvestorReport => ({
      id: report.id,
      investmentId: report.investmentId,
      periodType: report.periodType as "WEEKLY" | "MONTHLY",
      summary: report.summary,
      roiPercent: report.roiPercent,
      portfolioValueCents: report.portfolioValueCents,
      periodStart: report.periodStart.toISOString(),
      periodEnd: report.periodEnd.toISOString(),
    }));
  }

  async createWithdrawal(input: { userId: string; amountCents: number }) {
    const request = await this.prisma.withdrawalRequest.create({
      data: { userId: input.userId, amountCents: input.amountCents },
    });
    return withdrawalRow(request);
  }

  async withdrawals(userId: string) {
    const requests = await this.prisma.withdrawalRequest.findMany({
      where: { userId },
      orderBy: { requestedAt: "desc" },
    });
    return requests.map(withdrawalRow);
  }

  async reviewWithdrawal(input: { id: string; status: "APPROVED" | "REJECTED"; adminNotes?: string | null }) {
    const request = await this.prisma.withdrawalRequest.update({
      where: { id: input.id },
      data: {
        status: input.status,
        adminNotes: input.adminNotes,
        reviewedAt: new Date(),
      },
    });
    return withdrawalRow(request);
  }
}
