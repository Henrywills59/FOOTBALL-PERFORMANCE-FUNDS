import { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../database/prismaClient.js";
import type { InvestorWallet, WalletTransaction } from "@fpf/shared";
import type { WalletRepository } from "./types.js";

function txRow(tx: {
  id: string;
  type: WalletTransaction["type"];
  status: WalletTransaction["status"];
  amountCents: number;
  currency: string;
  externalPaymentId: string | null;
  invoiceUrl: string | null;
  createdAt: Date;
}): WalletTransaction {
  return {
    id: tx.id,
    type: tx.type,
    status: tx.status,
    amountCents: tx.amountCents,
    currency: tx.currency,
    externalPaymentId: tx.externalPaymentId,
    invoiceUrl: tx.invoiceUrl,
    createdAt: tx.createdAt.toISOString(),
  };
}

export class PrismaWalletRepository implements WalletRepository {
  constructor(private readonly prismaClient?: PrismaClient) {}

  private get prisma() {
    return this.prismaClient ?? getPrismaClient();
  }

  async getWallet(userId: string): Promise<InvestorWallet> {
    const wallet = await this.prisma.investorWallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: { transactions: { orderBy: { createdAt: "desc" } } },
    });
    return {
      availableBalanceCents: wallet.availableBalanceCents,
      pendingBalanceCents: wallet.pendingBalanceCents,
      investmentBalanceCents: wallet.investmentBalanceCents,
      withdrawalBalanceCents: wallet.withdrawalBalanceCents,
      transactions: wallet.transactions.map(txRow),
    };
  }

  async createDeposit(input: { userId: string; amountCents: number; externalPaymentId: string; invoiceUrl: string }) {
    const wallet = await this.prisma.investorWallet.upsert({
      where: { userId: input.userId },
      update: {},
      create: { userId: input.userId },
    });
    const transaction = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "DEPOSIT",
        status: "PENDING",
        amountCents: input.amountCents,
        externalPaymentId: input.externalPaymentId,
        invoiceUrl: input.invoiceUrl,
      },
    });
    await this.prisma.investorWallet.update({
      where: { id: wallet.id },
      data: { pendingBalanceCents: { increment: input.amountCents } },
    });
    return { transactionId: transaction.id, invoiceUrl: input.invoiceUrl, status: transaction.status };
  }

  async confirmDeposit(input: { externalPaymentId: string; amountCents: number }) {
    const transaction = await this.prisma.walletTransaction.findUnique({
      where: { externalPaymentId: input.externalPaymentId },
    });
    if (!transaction || transaction.status === "CONFIRMED") return null;
    const updated = await this.prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: { status: "CONFIRMED" },
    });
    await this.prisma.investorWallet.update({
      where: { id: transaction.walletId },
      data: {
        pendingBalanceCents: { decrement: transaction.amountCents },
        availableBalanceCents: { increment: transaction.amountCents },
      },
    });
    return txRow(updated);
  }

  async createWithdrawal(input: { userId: string; amountCents: number }) {
    const wallet = await this.prisma.investorWallet.upsert({
      where: { userId: input.userId },
      update: {},
      create: { userId: input.userId },
    });
    if (wallet.availableBalanceCents < input.amountCents) {
      throw new Error("Insufficient wallet balance");
    }
    await this.prisma.investorWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalanceCents: { decrement: input.amountCents },
        withdrawalBalanceCents: { increment: input.amountCents },
      },
    });
    const tx = await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "WITHDRAWAL",
        status: "PENDING",
        amountCents: input.amountCents,
      },
    });
    return txRow(tx);
  }

  async reviewWithdrawal(input: { transactionId: string; status: "APPROVED" | "REJECTED" }) {
    const tx = await this.prisma.walletTransaction.findUnique({ where: { id: input.transactionId } });
    if (!tx || tx.type !== "WITHDRAWAL" || tx.status !== "PENDING") return null;
    const updated = await this.prisma.walletTransaction.update({
      where: { id: tx.id },
      data: { status: input.status },
    });
    await this.prisma.investorWallet.update({
      where: { id: tx.walletId },
      data: {
        withdrawalBalanceCents: { decrement: tx.amountCents },
        ...(input.status === "REJECTED" ? { availableBalanceCents: { increment: tx.amountCents } } : {}),
      },
    });
    return txRow(updated);
  }
}
