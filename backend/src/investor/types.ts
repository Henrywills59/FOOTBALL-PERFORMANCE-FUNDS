import type {
  AdminInvestorDetail,
  AdminInvestorManagement,
  InvestmentPlan,
  InvestorDashboard,
  InvestorDistribution,
  InvestorDistributionBatch,
  InvestorInvestment,
  InvestorPortalReport,
  InvestorProfile,
  InvestorReport,
  WithdrawalRequest,
} from "@fpf/shared";

export type InvestorRepository = {
  dashboard(userId: string): Promise<InvestorDashboard>;
  profile(userId: string): Promise<InvestorProfile>;
  plans(): Promise<InvestmentPlan[]>;
  createInvestment(input: { userId: string; planId: string; amountCents: number }): Promise<InvestorInvestment>;
  investments(userId: string): Promise<InvestorInvestment[]>;
  reports(userId: string): Promise<InvestorReport[]>;
  portalReports(userId: string): Promise<InvestorPortalReport[]>;
  distributions(userId: string): Promise<InvestorDistribution[]>;
  createWithdrawal(input: { userId: string; amountCents: number }): Promise<WithdrawalRequest>;
  withdrawals(userId: string): Promise<WithdrawalRequest[]>;
  reviewWithdrawal(input: { id: string; status: "APPROVED" | "REJECTED"; adminNotes?: string | null }): Promise<WithdrawalRequest | null>;
  adminManagement(): Promise<AdminInvestorManagement>;
  adminInvestorDetail(investorAccountId: string): Promise<AdminInvestorDetail | null>;
  calculateWeeklyDistributions(actorUserId: string): Promise<{ batch: InvestorDistributionBatch; distributions: InvestorDistribution[] }>;
  updateDistributionStatus(input: {
    actorUserId: string;
    distributionId: string;
    status: "APPROVED" | "FAILED" | "PAID" | "CANCELLED";
    adminNotes?: string | null;
  }): Promise<InvestorDistribution | null>;
  addInvestorNote(input: {
    actorUserId: string;
    investorAccountId: string;
    note: string;
  }): Promise<AdminInvestorDetail | null>;
};
