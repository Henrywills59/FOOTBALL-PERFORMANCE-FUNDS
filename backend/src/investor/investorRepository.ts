import { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../database/prismaClient.js";
import type {
  AdminInvestorDetail,
  AdminInvestorSummary,
  InvestmentPlan,
  InvestorDashboard,
  InvestorAccount,
  InvestorAuditLog,
  InvestorBalance,
  InvestorDistribution,
  InvestorDistributionBatch,
  InvestorInvestment,
  InvestorNote,
  InvestorPortalReport,
  InvestorProfile,
  InvestorReport,
  WithdrawalRequest,
} from "@fpf/shared";
import type { InvestorRepository } from "./types.js";

const riskNotice = "Capital is at risk. Historical performance is not a guarantee of future results.";

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

function nextFridayIso(from = new Date()) {
  const date = new Date(from);
  const day = date.getUTCDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilFriday);
  date.setUTCHours(17, 0, 0, 0);
  return date.toISOString();
}

function safeDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function accountRow(row: {
  id: string;
  userId: string;
  tier: string;
  kycStatus: string;
  agreementStatus: string;
  paymentMethod: string;
  withdrawalMethod: string;
  riskNotice: string;
  startDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: { name: string; email: string; status: "ACTIVE" | "DISABLED" };
}): InvestorAccount {
  return {
    id: row.id,
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    tier: row.tier,
    accountStatus: row.user.status,
    kycStatus: row.kycStatus,
    agreementStatus: row.agreementStatus,
    paymentMethod: row.paymentMethod,
    withdrawalMethod: row.withdrawalMethod,
    investmentAmountCents: 0,
    startDate: safeDate(row.startDate),
    riskNotice: row.riskNotice,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function distributionRow(row: {
  id: string;
  investorAccountId: string;
  batchId: string | null;
  periodStart: Date;
  periodEnd: Date;
  capitalBaseCents: number;
  returnRatePercent: number;
  grossReturnCents: number;
  platformFeeCents: number;
  netDistributionCents: number;
  status: string;
  adminNotes: string | null;
  calculatedAt: Date | null;
  approvedAt: Date | null;
  paidAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  investorAccount: { user: { name: string; email: string } };
}): InvestorDistribution {
  return {
    id: row.id,
    investorAccountId: row.investorAccountId,
    investorName: row.investorAccount.user.name,
    investorEmail: row.investorAccount.user.email,
    batchId: row.batchId,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    capitalBaseCents: row.capitalBaseCents,
    returnRatePercent: row.returnRatePercent,
    grossReturnCents: row.grossReturnCents,
    platformFeeCents: row.platformFeeCents,
    netDistributionCents: row.netDistributionCents,
    status: row.status as InvestorDistribution["status"],
    adminNotes: row.adminNotes,
    calculatedAt: safeDate(row.calculatedAt),
    approvedAt: safeDate(row.approvedAt),
    paidAt: safeDate(row.paidAt),
    failedAt: safeDate(row.failedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaInvestorRepository implements InvestorRepository {
  constructor(private readonly prismaClient?: PrismaClient) {}

  private get prisma() {
    return this.prismaClient ?? getPrismaClient();
  }

  private async safe<T>(label: string, fallback: T, fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (error) {
      console.warn("INVESTOR_REPOSITORY_FALLBACK", {
        label,
        message: error instanceof Error ? error.message : "Unknown investor repository failure",
      });
      return fallback;
    }
  }

  private emptyAccount(userId: string): InvestorAccount {
    const now = new Date().toISOString();
    return {
      id: `placeholder-${userId}`,
      userId,
      name: "Investor",
      email: "investor@footballperformancefund.com",
      tier: "Founding Investor",
      accountStatus: "ACTIVE",
      kycStatus: "PENDING_REVIEW",
      agreementStatus: "PENDING_SIGNATURE",
      paymentMethod: "Placeholder - not connected",
      withdrawalMethod: "Placeholder - admin review required",
      investmentAmountCents: 0,
      startDate: null,
      riskNotice,
      createdAt: now,
      updatedAt: now,
    };
  }

  private emptyBalance(): InvestorBalance {
    return {
      totalCapitalCents: 0,
      activeInvestmentBalanceCents: 0,
      weeklyEarningsCents: 0,
      totalEarningsCents: 0,
      pendingDistributionCents: 0,
      paidDistributionCents: 0,
      updatedAt: null,
    };
  }

  private async ensureAccount(userId: string) {
    return this.prisma.investorAccount.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        tier: "Founding Investor",
        kycStatus: "PENDING_REVIEW",
        agreementStatus: "PENDING_SIGNATURE",
        paymentMethod: "Placeholder - not connected",
        withdrawalMethod: "Placeholder - admin review required",
        riskNotice,
      },
      include: { user: true },
    });
  }

  private async balanceFor(accountId: string, userId: string): Promise<InvestorBalance> {
    const investments = await this.investments(userId);
    const totalCapitalCents = investments.reduce((total, item) => total + item.amountCents, 0);
    const activeInvestmentBalanceCents = investments
      .filter((item) => item.status === "ACTIVE")
      .reduce((total, item) => total + item.currentValueCents, 0);
    const distributions = await this.distributions(userId);
    const pendingDistributionCents = distributions
      .filter((item) => ["CALCULATED", "PENDING_APPROVAL", "APPROVED"].includes(item.status))
      .reduce((total, item) => total + item.netDistributionCents, 0);
    const paidDistributionCents = distributions
      .filter((item) => item.status === "PAID")
      .reduce((total, item) => total + item.netDistributionCents, 0);
    const weeklyEarningsCents = distributions[0]?.netDistributionCents ?? 0;
    const balance = {
      totalCapitalCents,
      activeInvestmentBalanceCents,
      weeklyEarningsCents,
      totalEarningsCents: pendingDistributionCents + paidDistributionCents,
      pendingDistributionCents,
      paidDistributionCents,
      updatedAt: new Date().toISOString(),
    };

    await this.prisma.investorBalance.upsert({
      where: { investorAccountId: accountId },
      update: balance,
      create: { investorAccountId: accountId, ...balance },
    });

    return balance;
  }

  async dashboard(userId: string) {
    return this.safe("dashboard", this.dashboardFallback(userId), async () => {
      const account = accountRow(await this.ensureAccount(userId));
      const investments = await this.investments(userId);
      const balance = await this.balanceFor(account.id, userId);
      account.investmentAmountCents = balance.totalCapitalCents;
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
        account,
        balance,
        nextDistributionDate: nextFridayIso(),
        distributionStatus: (await this.distributions(userId))[0]?.status ?? "PENDING_CALCULATION",
        weeklyEarningsCents: balance.weeklyEarningsCents,
        totalEarningsCents: balance.totalEarningsCents,
        investorTier: account.tier,
        accountStatus: account.accountStatus,
        riskNotice: account.riskNotice,
        performanceChart: [
          { label: "Capital", valueCents: totalInvestmentCents },
          { label: "Portfolio", valueCents: currentPortfolioValueCents },
          { label: "Earnings", valueCents: balance.totalEarningsCents },
        ],
        recentDistributions: (await this.distributions(userId)).slice(0, 5),
        transparencyNote: "Distribution values use safe placeholder logic until payment and settlement integrations are enabled.",
      };
    });
  }

  private dashboardFallback(userId: string): InvestorDashboard {
    const account = this.emptyAccount(userId);
    const balance = this.emptyBalance();
    return {
      totalInvestmentCents: 0,
      currentPortfolioValueCents: 0,
      weeklyRoiPercent: 0,
      lifetimeRoiPercent: 0,
      currentStatus: "No active investments",
      investmentHistory: [],
      account,
      balance,
      nextDistributionDate: nextFridayIso(),
      distributionStatus: "PENDING_CALCULATION" as const,
      weeklyEarningsCents: 0,
      totalEarningsCents: 0,
      investorTier: account.tier,
      accountStatus: account.accountStatus,
      riskNotice,
      performanceChart: [],
      recentDistributions: [],
      transparencyNote: "Distribution values use safe placeholder logic until payment and settlement integrations are enabled.",
    };
  }

  async profile(userId: string): Promise<InvestorProfile> {
    return this.safe("profile", { account: this.emptyAccount(userId), balance: this.emptyBalance(), activeInvestments: [] }, async () => {
      const account = accountRow(await this.ensureAccount(userId));
      const balance = await this.balanceFor(account.id, userId);
      account.investmentAmountCents = balance.totalCapitalCents;
      return {
        account,
        balance,
        activeInvestments: (await this.investments(userId)).filter((item) => item.status === "ACTIVE"),
      };
    });
  }

  async plans() {
    return this.safe("plans", [], async () => {
      const plans = await this.prisma.investmentPlan.findMany({
        where: { active: true },
        orderBy: { minimumInvestmentCents: "asc" },
      });
      return plans.map(planRow);
    });
  }

  async createInvestment(input: { userId: string; planId: string; amountCents: number }) {
    const plan = await this.prisma.investmentPlan.findUnique({ where: { id: input.planId } });
    if (!plan || input.amountCents < plan.minimumInvestmentCents || input.amountCents > plan.maximumInvestmentCents) {
      throw new Error("Investment amount is outside the selected plan range");
    }
    const account = await this.ensureAccount(input.userId);
    const investment = await this.prisma.investment.create({
      data: {
        userId: input.userId,
        planId: input.planId,
        amountCents: input.amountCents,
        currentValueCents: input.amountCents,
      },
      include: { plan: true },
    });
    await this.audit({
      investorAccountId: account.id,
      actorUserId: input.userId,
      action: "INVESTMENT_UPDATED",
      entityType: "INVESTMENT",
      entityId: investment.id,
      details: { amountCents: input.amountCents },
    });
    return investmentRow(investment);
  }

  async investments(userId: string) {
    return this.safe("investments", [], async () => {
      const investments = await this.prisma.investment.findMany({
        where: { userId },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      });
      return investments.map(investmentRow);
    });
  }

  async reports(userId: string) {
    return this.safe("legacyReports", [], async () => {
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
    });
  }

  async portalReports(userId: string): Promise<InvestorPortalReport[]> {
    return this.safe("portalReports", [], async () => {
      const account = await this.ensureAccount(userId);
      const existing = await this.prisma.investorPortalReport.findMany({
        where: { investorAccountId: account.id },
        orderBy: { generatedAt: "desc" },
      });
      if (existing.length) return existing.map((report) => ({
        id: report.id,
        investorAccountId: report.investorAccountId,
        periodType: report.periodType as "WEEKLY" | "MONTHLY",
        title: report.title,
        summary: report.summary,
        earningsCents: report.earningsCents,
        capitalCents: report.capitalCents,
        roiPercent: report.roiPercent,
        downloadUrl: report.downloadUrl,
        generatedAt: report.generatedAt.toISOString(),
      }));
      const balance = await this.balanceFor(account.id, userId);
      const report = await this.prisma.investorPortalReport.create({
        data: {
          investorAccountId: account.id,
          periodType: "WEEKLY",
          title: "Weekly Investor Report",
          summary: "Placeholder report generated from FPF internal records. Download will be enabled later.",
          earningsCents: balance.weeklyEarningsCents,
          capitalCents: balance.totalCapitalCents,
          roiPercent: balance.totalCapitalCents ? (balance.weeklyEarningsCents / balance.totalCapitalCents) * 100 : 0,
        },
      });
      await this.audit({
        investorAccountId: account.id,
        action: "REPORT_GENERATED",
        entityType: "INVESTOR_REPORT",
        entityId: report.id,
      });
      return [{
        id: report.id,
        investorAccountId: report.investorAccountId,
        periodType: report.periodType as "WEEKLY" | "MONTHLY",
        title: report.title,
        summary: report.summary,
        earningsCents: report.earningsCents,
        capitalCents: report.capitalCents,
        roiPercent: report.roiPercent,
        downloadUrl: report.downloadUrl,
        generatedAt: report.generatedAt.toISOString(),
      }];
    });
  }

  async distributions(userId: string): Promise<InvestorDistribution[]> {
    return this.safe("distributions", [], async () => {
      const account = await this.ensureAccount(userId);
      const rows = await this.prisma.investorDistribution.findMany({
        where: { investorAccountId: account.id },
        include: { investorAccount: { include: { user: true } } },
        orderBy: { periodEnd: "desc" },
      });
      return rows.map(distributionRow);
    });
  }

  async createWithdrawal(input: { userId: string; amountCents: number }) {
    const request = await this.prisma.withdrawalRequest.create({
      data: { userId: input.userId, amountCents: input.amountCents },
    });
    return withdrawalRow(request);
  }

  async withdrawals(userId: string) {
    return this.safe("withdrawals", [], async () => {
      const requests = await this.prisma.withdrawalRequest.findMany({
        where: { userId },
        orderBy: { requestedAt: "desc" },
      });
      return requests.map(withdrawalRow);
    });
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

  async adminManagement() {
    return this.safe("adminManagement", { investors: [], distributionQueue: [], latestBatch: null, auditTrail: [] }, async () => {
      const accounts = await this.prisma.investorAccount.findMany({
        include: { user: true },
        orderBy: { createdAt: "desc" },
      });
      const investors = await Promise.all(accounts.map((account) => this.summary(accountRow(account))));
      const distributionRows = await this.prisma.investorDistribution.findMany({
        include: { investorAccount: { include: { user: true } } },
        orderBy: [{ status: "asc" }, { periodEnd: "desc" }],
        take: 100,
      });
      const latestBatch = await this.prisma.investorDistributionBatch.findFirst({ orderBy: { createdAt: "desc" } });
      return {
        investors,
        distributionQueue: distributionRows.map(distributionRow),
        latestBatch: latestBatch
          ? {
              id: latestBatch.id,
              weekStart: latestBatch.weekStart.toISOString(),
              weekEnd: latestBatch.weekEnd.toISOString(),
              status: latestBatch.status as InvestorDistributionBatch["status"],
              totalCapitalCents: latestBatch.totalCapitalCents,
              totalGrossReturnCents: latestBatch.totalGrossReturnCents,
              totalNetDistributionCents: latestBatch.totalNetDistributionCents,
              investorCount: latestBatch.investorCount,
              createdAt: latestBatch.createdAt.toISOString(),
              updatedAt: latestBatch.updatedAt.toISOString(),
            }
          : null,
        auditTrail: await this.auditLogs(),
      };
    });
  }

  async adminInvestorDetail(investorAccountId: string): Promise<AdminInvestorDetail | null> {
    const account = await this.prisma.investorAccount.findUnique({
      where: { id: investorAccountId },
      include: { user: true },
    });
    if (!account) return null;
    const normalized = accountRow(account);
    return {
      investor: await this.summary(normalized),
      profile: await this.profile(account.userId),
      distributions: await this.distributions(account.userId),
      reports: await this.portalReports(account.userId),
      auditLogs: (await this.auditLogs()).filter((item) => item.investorAccountId === account.id),
      notes: await this.notes(account.id),
    };
  }

  async calculateWeeklyDistributions(actorUserId: string) {
    return this.safe("calculateWeeklyDistributions", this.emptyBatch(), async () => {
    const accounts = await this.prisma.investorAccount.findMany({ include: { user: true } });
    const weekEnd = new Date();
    const weekStart = new Date(weekEnd);
    weekStart.setUTCDate(weekEnd.getUTCDate() - 7);
    const prepared = [];
    for (const account of accounts) {
      const balance = await this.balanceFor(account.id, account.userId);
      const grossReturnCents = Math.round(balance.activeInvestmentBalanceCents * 0.0125);
      const platformFeeCents = Math.round(grossReturnCents * 0.1);
      prepared.push({
        account,
        capitalBaseCents: balance.activeInvestmentBalanceCents,
        returnRatePercent: 1.25,
        grossReturnCents,
        platformFeeCents,
        netDistributionCents: grossReturnCents - platformFeeCents,
      });
    }
    const batch = await this.prisma.investorDistributionBatch.create({
      data: {
        weekStart,
        weekEnd,
        status: "PENDING_APPROVAL",
        totalCapitalCents: prepared.reduce((total, item) => total + item.capitalBaseCents, 0),
        totalGrossReturnCents: prepared.reduce((total, item) => total + item.grossReturnCents, 0),
        totalNetDistributionCents: prepared.reduce((total, item) => total + item.netDistributionCents, 0),
        investorCount: prepared.length,
      },
    });
    const rows = [];
    for (const item of prepared) {
      rows.push(await this.prisma.investorDistribution.create({
        data: {
          investorAccountId: item.account.id,
          batchId: batch.id,
          periodStart: weekStart,
          periodEnd: weekEnd,
          capitalBaseCents: item.capitalBaseCents,
          returnRatePercent: item.returnRatePercent,
          grossReturnCents: item.grossReturnCents,
          platformFeeCents: item.platformFeeCents,
          netDistributionCents: item.netDistributionCents,
          status: "PENDING_APPROVAL",
          adminNotes: "Placeholder weekly calculation. Admin approval required before payout.",
          calculatedAt: new Date(),
        },
        include: { investorAccount: { include: { user: true } } },
      }));
    }
    await this.audit({
      actorUserId,
      action: "DISTRIBUTION_CALCULATED",
      entityType: "INVESTOR_DISTRIBUTION_BATCH",
      entityId: batch.id,
      details: { investorCount: rows.length },
    });
    return {
      batch: {
        id: batch.id,
        weekStart: batch.weekStart.toISOString(),
        weekEnd: batch.weekEnd.toISOString(),
        status: batch.status as InvestorDistributionBatch["status"],
        totalCapitalCents: batch.totalCapitalCents,
        totalGrossReturnCents: batch.totalGrossReturnCents,
        totalNetDistributionCents: batch.totalNetDistributionCents,
        investorCount: batch.investorCount,
        createdAt: batch.createdAt.toISOString(),
        updatedAt: batch.updatedAt.toISOString(),
      },
      distributions: rows.map(distributionRow),
    };
    });
  }

  async updateDistributionStatus(input: { actorUserId: string; distributionId: string; status: "APPROVED" | "FAILED" | "PAID" | "CANCELLED"; adminNotes?: string | null }) {
    const now = new Date();
    const row = await this.prisma.investorDistribution.update({
      where: { id: input.distributionId },
      data: {
        status: input.status,
        adminNotes: input.adminNotes,
        approvedAt: input.status === "APPROVED" ? now : undefined,
        paidAt: input.status === "PAID" ? now : undefined,
        failedAt: input.status === "FAILED" ? now : undefined,
      },
      include: { investorAccount: { include: { user: true } } },
    });
    await this.audit({
      actorUserId: input.actorUserId,
      investorAccountId: row.investorAccountId,
      action: `DISTRIBUTION_${input.status}`,
      entityType: "INVESTOR_DISTRIBUTION",
      entityId: row.id,
      details: { adminNotes: input.adminNotes ?? null },
    });
    return distributionRow(row);
  }

  async addInvestorNote(input: { actorUserId: string; investorAccountId: string; note: string }) {
    const note = await this.prisma.investorNote.create({
      data: {
        investorAccountId: input.investorAccountId,
        authorUserId: input.actorUserId,
        note: input.note,
      },
    });
    await this.audit({
      actorUserId: input.actorUserId,
      investorAccountId: input.investorAccountId,
      action: "NOTE_ADDED",
      entityType: "INVESTOR_NOTE",
      entityId: note.id,
    });
    return this.adminInvestorDetail(input.investorAccountId);
  }

  private async audit(input: {
    investorAccountId?: string | null;
    actorUserId?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    details?: unknown;
  }) {
    await this.prisma.investorAuditLog.create({
      data: {
        investorAccountId: input.investorAccountId ?? null,
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        details: input.details === undefined ? undefined : JSON.parse(JSON.stringify(input.details)),
      },
    });
  }

  private async auditLogs(): Promise<InvestorAuditLog[]> {
    const rows = await this.prisma.investorAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return rows.map((row) => ({
      id: row.id,
      investorAccountId: row.investorAccountId,
      actorUserId: row.actorUserId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      details: row.details,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async notes(investorAccountId: string): Promise<InvestorNote[]> {
    const rows = await this.prisma.investorNote.findMany({ where: { investorAccountId }, orderBy: { createdAt: "desc" } });
    return rows.map((row) => ({
      id: row.id,
      investorAccountId: row.investorAccountId,
      authorUserId: row.authorUserId,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async summary(account: InvestorAccount): Promise<AdminInvestorSummary> {
    const balance = await this.balanceFor(account.id, account.userId);
    return {
      id: account.id,
      userId: account.userId,
      name: account.name,
      email: account.email,
      tier: account.tier,
      accountStatus: account.accountStatus,
      kycStatus: account.kycStatus,
      agreementStatus: account.agreementStatus,
      totalCapitalCents: balance.totalCapitalCents,
      activeInvestmentBalanceCents: balance.activeInvestmentBalanceCents,
      pendingDistributionCents: balance.pendingDistributionCents,
      paidDistributionCents: balance.paidDistributionCents,
      createdAt: account.createdAt,
    };
  }

  private emptyBatch(): { batch: InvestorDistributionBatch; distributions: InvestorDistribution[] } {
    const now = new Date().toISOString();
    return {
      batch: {
        id: "placeholder-batch",
        weekStart: now,
        weekEnd: now,
        status: "PENDING_CALCULATION" as const,
        totalCapitalCents: 0,
        totalGrossReturnCents: 0,
        totalNetDistributionCents: 0,
        investorCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      distributions: [],
    };
  }
}
