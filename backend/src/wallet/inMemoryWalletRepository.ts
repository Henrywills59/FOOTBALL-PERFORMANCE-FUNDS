import type { InvestorWallet, WalletTransaction } from "@fpf/shared";
import type { WalletRepository } from "./types.js";

export class InMemoryWalletRepository implements WalletRepository {
  wallets = new Map<string, InvestorWallet>();

  async getWallet(userId: string) {
    const wallet = this.wallets.get(userId) ?? {
      availableBalanceCents: 0,
      pendingBalanceCents: 0,
      investmentBalanceCents: 0,
      withdrawalBalanceCents: 0,
      transactions: [],
    };
    this.wallets.set(userId, wallet);
    return wallet;
  }

  async seedAvailableBalanceForTest(userId: string, amountCents: number) {
    const wallet = await this.getWallet(userId);
    wallet.availableBalanceCents += amountCents;
    const transaction: WalletTransaction = {
      id: String(wallet.transactions.length + 1),
      type: "ADJUSTMENT",
      status: "CONFIRMED",
      amountCents,
      currency: "USD",
      externalPaymentId: null,
      invoiceUrl: null,
      createdAt: new Date().toISOString(),
    };
    wallet.transactions.unshift(transaction);
  }

  async createWithdrawal(input: { userId: string; amountCents: number }) {
    const wallet = await this.getWallet(input.userId);
    if (input.amountCents > wallet.availableBalanceCents) {
      throw new Error("Insufficient wallet balance");
    }
    wallet.availableBalanceCents -= input.amountCents;
    wallet.withdrawalBalanceCents += input.amountCents;
    const transaction: WalletTransaction = {
      id: String(wallet.transactions.length + 1),
      type: "WITHDRAWAL",
      status: "PENDING",
      amountCents: input.amountCents,
      currency: "USD",
      externalPaymentId: null,
      invoiceUrl: null,
      createdAt: new Date().toISOString(),
    };
    wallet.transactions.unshift(transaction);
    return transaction;
  }

  async reviewWithdrawal(input: { transactionId: string; status: "APPROVED" | "REJECTED" }) {
    for (const wallet of this.wallets.values()) {
      const transaction = wallet.transactions.find((item) => item.id === input.transactionId && item.type === "WITHDRAWAL");
      if (!transaction || transaction.status !== "PENDING") continue;
      transaction.status = input.status;
      wallet.withdrawalBalanceCents = Math.max(0, wallet.withdrawalBalanceCents - transaction.amountCents);
      if (input.status === "REJECTED") wallet.availableBalanceCents += transaction.amountCents;
      return transaction;
    }
    return null;
  }
}
