import type {
  AdminInvestorDetail,
  AdminInvestorManagement,
  AdminInvestorSummary,
  InvestmentPlan,
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

function nextFridayIso(from = new Date()) {
  const date = new Date(from);
  const day = date.getUTCDay();
  const daysUntilFriday = (5 - day + 7) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilFriday);
  date.setUTCHours(17, 0, 0, 0);
  return date.toISOString();
}

export class InMemoryInvestorRepository implements InvestorRepository {
  plansData: InvestmentPlan[] = [
    {
      id: "starter",
      name: "Flexible Investor Program",
      description: "Placeholder investor package for any approved capital amount above the minimum.",
      minimumInvestmentCents: 10000,
      maximumInvestmentCents: 1000000000,
      historicalPerformanceNote: "Historical weekly performance has varied by market conditions.",
      riskDisclosure: "All investments carry risk. Historical results do not guarantee future performance.",
    },
  ];
  investmentsData: InvestorInvestment[] = [];
  reportsData: InvestorReport[] = [];
  withdrawalsData: WithdrawalRequest[] = [];
  accounts = new Map<string, InvestorAccount>();
  balances = new Map<string, InvestorBalance>();
  distributionsData: InvestorDistribution[] = [];
  batchesData: InvestorDistributionBatch[] = [];
  portalReportsData: InvestorPortalReport[] = [];
  auditLogsData: InvestorAuditLog[] = [];
  notesData: InvestorNote[] = [];

  private accountFor(userId: string) {
    const current = this.accounts.get(userId);
    if (current) return current;
    const now = new Date().toISOString();
    const account: InvestorAccount = {
      id: `account-${userId}`,
      userId,
      name: "Investor User",
      email: `${userId}@example.com`,
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
    this.accounts.set(userId, account);
    return account;
  }

  private balanceFor(account: InvestorAccount) {
    const totalCapitalCents = this.investmentsData.reduce((total, item) => total + item.amountCents, 0);
    const activeInvestmentBalanceCents = this.investmentsData
      .filter((item) => item.status === "ACTIVE")
      .reduce((total, item) => total + item.currentValueCents, 0);
    const paidDistributionCents = this.distributionsData
      .filter((item) => item.investorAccountId === account.id && item.status === "PAID")
      .reduce((total, item) => total + item.netDistributionCents, 0);
    const pendingDistributionCents = this.distributionsData
      .filter((item) => item.investorAccountId === account.id && ["CALCULATED", "PENDING_APPROVAL", "APPROVED"].includes(item.status))
      .reduce((total, item) => total + item.netDistributionCents, 0);
    const balance: InvestorBalance = {
      totalCapitalCents,
      activeInvestmentBalanceCents,
      weeklyEarningsCents: this.distributionsData.find((item) => item.investorAccountId === account.id)?.netDistributionCents ?? 0,
      totalEarningsCents: paidDistributionCents + pendingDistributionCents,
      pendingDistributionCents,
      paidDistributionCents,
      updatedAt: new Date().toISOString(),
    };
    this.balances.set(account.id, balance);
    account.investmentAmountCents = totalCapitalCents;
    account.startDate = this.investmentsData[0]?.createdAt ?? account.startDate;
    return balance;
  }

  private audit(input: Partial<InvestorAuditLog> & { action: string; entityType: string }) {
    this.auditLogsData.unshift({
      id: String(this.auditLogsData.length + 1),
      investorAccountId: input.investorAccountId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      details: input.details ?? null,
      createdAt: new Date().toISOString(),
    });
  }

  async dashboard(userId: string) {
    const account = this.accountFor(userId);
    const balance = this.balanceFor(account);
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
      account,
      balance,
      nextDistributionDate: nextFridayIso(),
      distributionStatus: this.distributionsData[0]?.status ?? "PENDING_CALCULATION",
      weeklyEarningsCents: balance.weeklyEarningsCents,
      totalEarningsCents: balance.totalEarningsCents,
      investorTier: account.tier,
      accountStatus: account.accountStatus,
      riskNotice,
      performanceChart: [
        { label: "Capital", valueCents: totalInvestmentCents },
        { label: "Portfolio", valueCents: currentPortfolioValueCents },
        { label: "Earnings", valueCents: balance.totalEarningsCents },
      ],
      recentDistributions: this.distributionsData.slice(0, 5),
      transparencyNote: "Distribution values are placeholders pending real payment and settlement integrations.",
    };
  }

  async profile(userId: string): Promise<InvestorProfile> {
    const account = this.accountFor(userId);
    return { account, balance: this.balanceFor(account), activeInvestments: await this.investments(userId) };
  }

  async plans() {
    return this.plansData;
  }

  async createInvestment(input: { userId: string; planId: string; amountCents: number }) {
    const plan = this.plansData.find((item) => item.id === input.planId);
    if (!plan || input.amountCents < 10000) {
      throw new Error("Minimum investment is $100");
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
    this.audit({ investorAccountId: this.accountFor(input.userId).id, actorUserId: input.userId, action: "INVESTMENT_UPDATED", entityType: "INVESTMENT", entityId: investment.id });
    return investment;
  }

  async investments(_userId?: string) {
    return this.investmentsData;
  }

  async reports(_userId?: string) {
    return this.reportsData;
  }

  async portalReports(userId: string) {
    const account = this.accountFor(userId);
    if (!this.portalReportsData.length) {
      const balance = this.balanceFor(account);
      this.portalReportsData.push({
        id: "report-1",
        investorAccountId: account.id,
        periodType: "WEEKLY",
        title: "Weekly Investor Report",
        summary: "Placeholder report generated from internal FPF records.",
        earningsCents: balance.weeklyEarningsCents,
        capitalCents: balance.totalCapitalCents,
        roiPercent: balance.totalCapitalCents ? (balance.weeklyEarningsCents / balance.totalCapitalCents) * 100 : 0,
        downloadUrl: null,
        generatedAt: new Date().toISOString(),
      });
    }
    return this.portalReportsData;
  }

  async distributions(userId: string) {
    const account = this.accountFor(userId);
    return this.distributionsData.filter((item) => item.investorAccountId === account.id);
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

  async adminManagement(): Promise<AdminInvestorManagement> {
    const investors = Array.from(this.accounts.values()).map((account) => this.summary(account));
    return {
      investors,
      distributionQueue: this.distributionsData,
      latestBatch: this.batchesData[0] ?? null,
      auditTrail: this.auditLogsData,
    };
  }

  async adminInvestorDetail(investorAccountId: string): Promise<AdminInvestorDetail | null> {
    const account = Array.from(this.accounts.values()).find((item) => item.id === investorAccountId);
    if (!account) return null;
    return {
      investor: this.summary(account),
      profile: await this.profile(account.userId),
      distributions: this.distributionsData.filter((item) => item.investorAccountId === account.id),
      reports: await this.portalReports(account.userId),
      auditLogs: this.auditLogsData.filter((item) => item.investorAccountId === account.id),
      notes: this.notesData.filter((item) => item.investorAccountId === account.id),
    };
  }

  async calculateWeeklyDistributions(actorUserId: string) {
    const weekEnd = new Date();
    const weekStart = new Date(weekEnd);
    weekStart.setUTCDate(weekEnd.getUTCDate() - 7);
    const accounts = Array.from(this.accounts.values());
    const distributions = accounts.map((account) => {
      const balance = this.balanceFor(account);
      const grossReturnCents = Math.round(balance.activeInvestmentBalanceCents * 0.0125);
      const platformFeeCents = Math.round(grossReturnCents * 0.1);
      const distribution: InvestorDistribution = {
        id: `distribution-${this.distributionsData.length + 1}`,
        investorAccountId: account.id,
        investorName: account.name,
        investorEmail: account.email,
        batchId: null,
        periodStart: weekStart.toISOString(),
        periodEnd: weekEnd.toISOString(),
        capitalBaseCents: balance.activeInvestmentBalanceCents,
        returnRatePercent: 1.25,
        grossReturnCents,
        platformFeeCents,
        netDistributionCents: grossReturnCents - platformFeeCents,
        status: "PENDING_APPROVAL",
        adminNotes: "Placeholder weekly calculation. Admin approval required before payout.",
        calculatedAt: new Date().toISOString(),
        approvedAt: null,
        paidAt: null,
        failedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return distribution;
    });
    const batch: InvestorDistributionBatch = {
      id: `batch-${this.batchesData.length + 1}`,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      status: "PENDING_APPROVAL",
      totalCapitalCents: distributions.reduce((total, item) => total + item.capitalBaseCents, 0),
      totalGrossReturnCents: distributions.reduce((total, item) => total + item.grossReturnCents, 0),
      totalNetDistributionCents: distributions.reduce((total, item) => total + item.netDistributionCents, 0),
      investorCount: distributions.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    distributions.forEach((item) => (item.batchId = batch.id));
    this.distributionsData.unshift(...distributions);
    this.batchesData.unshift(batch);
    this.audit({ actorUserId, action: "DISTRIBUTION_CALCULATED", entityType: "INVESTOR_DISTRIBUTION_BATCH", entityId: batch.id });
    return { batch, distributions };
  }

  async updateDistributionStatus(input: { actorUserId: string; distributionId: string; status: "APPROVED" | "FAILED" | "PAID" | "CANCELLED"; adminNotes?: string | null }) {
    const distribution = this.distributionsData.find((item) => item.id === input.distributionId);
    if (!distribution) return null;
    distribution.status = input.status;
    distribution.adminNotes = input.adminNotes ?? distribution.adminNotes;
    distribution.updatedAt = new Date().toISOString();
    if (input.status === "APPROVED") distribution.approvedAt = distribution.updatedAt;
    if (input.status === "PAID") distribution.paidAt = distribution.updatedAt;
    if (input.status === "FAILED") distribution.failedAt = distribution.updatedAt;
    this.audit({ actorUserId: input.actorUserId, investorAccountId: distribution.investorAccountId, action: `DISTRIBUTION_${input.status}`, entityType: "INVESTOR_DISTRIBUTION", entityId: distribution.id });
    return distribution;
  }

  async addInvestorNote(input: { actorUserId: string; investorAccountId: string; note: string }) {
    const note: InvestorNote = {
      id: String(this.notesData.length + 1),
      investorAccountId: input.investorAccountId,
      authorUserId: input.actorUserId,
      note: input.note,
      createdAt: new Date().toISOString(),
    };
    this.notesData.unshift(note);
    this.audit({ actorUserId: input.actorUserId, investorAccountId: input.investorAccountId, action: "NOTE_ADDED", entityType: "INVESTOR_NOTE", entityId: note.id });
    return this.adminInvestorDetail(input.investorAccountId);
  }

  private summary(account: InvestorAccount): AdminInvestorSummary {
    const balance = this.balanceFor(account);
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
}
