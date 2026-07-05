import type { DepositInvoice, InvestorWallet, WalletTransaction } from "@fpf/shared";

export type WalletRepository = {
  getWallet(userId: string): Promise<InvestorWallet>;
  createDeposit(input: {
    userId: string;
    amountCents: number;
    externalPaymentId: string;
    invoiceUrl: string;
  }): Promise<DepositInvoice>;
  confirmDeposit(input: { externalPaymentId: string; amountCents: number }): Promise<WalletTransaction | null>;
  createWithdrawal(input: { userId: string; amountCents: number }): Promise<WalletTransaction>;
  reviewWithdrawal(input: { transactionId: string; status: "APPROVED" | "REJECTED" }): Promise<WalletTransaction | null>;
};
