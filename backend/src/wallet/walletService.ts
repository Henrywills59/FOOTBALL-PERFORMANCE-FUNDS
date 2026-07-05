import type { AdminService } from "../admin/adminService.js";
import type { NowPaymentsClient } from "./nowPaymentsClient.js";
import type { WalletRepository } from "./types.js";

export class WalletService {
  constructor(
    private readonly repository: WalletRepository,
    private readonly nowPayments: NowPaymentsClient,
    private readonly adminService: AdminService,
  ) {}

  getWallet(userId: string) {
    return this.repository.getWallet(userId);
  }

  async createDepositInvoice(userId: string, amountCents: number) {
    if (amountCents <= 0) throw new Error("Deposit amount must be positive");
    const orderId = `wallet-${userId}-${Date.now()}`;
    const invoice = await this.nowPayments.createInvoice({
      priceAmount: amountCents / 100,
      orderId,
      orderDescription: "Football Performance Fund wallet deposit",
    });
    const externalPaymentId = String(invoice.payment_id ?? invoice.id ?? orderId);
    const invoiceUrl = String(invoice.invoice_url ?? "");
    const deposit = await this.repository.createDeposit({ userId, amountCents, externalPaymentId, invoiceUrl });
    await this.adminService.audit(userId, "WALLET_DEPOSIT_INVOICE_CREATED", "WALLET_TRANSACTION", deposit.transactionId);
    return deposit;
  }

  async handleIpn(payload: Record<string, unknown>, signature: string | undefined | null) {
    if (!this.nowPayments.verifyIpn(payload, signature)) {
      throw new Error("Invalid NOWPayments IPN signature");
    }
    const status = String(payload.payment_status ?? "");
    const externalPaymentId = String(payload.payment_id ?? payload.invoice_id ?? "");
    const amountCents = Math.round(Number(payload.price_amount ?? 0) * 100);
    if (!["finished", "confirmed"].includes(status)) {
      return { credited: false };
    }
    const transaction = await this.repository.confirmDeposit({ externalPaymentId, amountCents });
    if (transaction) {
      await this.adminService.audit(null, "WALLET_DEPOSIT_CONFIRMED", "WALLET_TRANSACTION", transaction.id);
    }
    return { credited: Boolean(transaction) };
  }

  async createWithdrawal(userId: string, amountCents: number) {
    const transaction = await this.repository.createWithdrawal({ userId, amountCents });
    await this.adminService.audit(userId, "WALLET_WITHDRAWAL_REQUESTED", "WALLET_TRANSACTION", transaction.id);
    return transaction;
  }

  async reviewWithdrawal(actorUserId: string, transactionId: string, status: "APPROVED" | "REJECTED") {
    const transaction = await this.repository.reviewWithdrawal({ transactionId, status });
    if (transaction) {
      await this.adminService.audit(actorUserId, `WALLET_WITHDRAWAL_${status}`, "WALLET_TRANSACTION", transaction.id);
    }
    return transaction;
  }
}
