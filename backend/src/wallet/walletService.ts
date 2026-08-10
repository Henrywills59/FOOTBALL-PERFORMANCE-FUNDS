import type { AdminService } from "../admin/adminService.js";
import type { WalletRepository } from "./types.js";

export class WalletService {
  constructor(
    private readonly repository: WalletRepository,
    private readonly adminService: AdminService,
  ) {}

  getWallet(userId: string) {
    return this.repository.getWallet(userId);
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
