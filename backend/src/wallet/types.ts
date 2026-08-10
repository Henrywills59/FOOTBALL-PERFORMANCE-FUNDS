import type { InvestorWallet, WalletTransaction } from "@fpf/shared";

export type WalletRepository = {
  getWallet(userId: string): Promise<InvestorWallet>;
  createWithdrawal(input: { userId: string; amountCents: number }): Promise<WalletTransaction>;
  reviewWithdrawal(input: { transactionId: string; status: "APPROVED" | "REJECTED" }): Promise<WalletTransaction | null>;
};
