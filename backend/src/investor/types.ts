import type {
  InvestmentPlan,
  InvestorDashboard,
  InvestorInvestment,
  InvestorReport,
  WithdrawalRequest,
} from "@fpf/shared";

export type InvestorRepository = {
  dashboard(userId: string): Promise<InvestorDashboard>;
  plans(): Promise<InvestmentPlan[]>;
  createInvestment(input: { userId: string; planId: string; amountCents: number }): Promise<InvestorInvestment>;
  investments(userId: string): Promise<InvestorInvestment[]>;
  reports(userId: string): Promise<InvestorReport[]>;
  createWithdrawal(input: { userId: string; amountCents: number }): Promise<WithdrawalRequest>;
  withdrawals(userId: string): Promise<WithdrawalRequest[]>;
  reviewWithdrawal(input: { id: string; status: "APPROVED" | "REJECTED"; adminNotes?: string | null }): Promise<WithdrawalRequest | null>;
};
