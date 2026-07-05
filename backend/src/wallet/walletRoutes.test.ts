import { createHmac } from "node:crypto";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryWalletRepository } from "./inMemoryWalletRepository.js";

function seedUser(users: InMemoryUserRepository, role: "INVESTOR" | "ADMIN") {
  const id = `${role.toLowerCase()}-wallet-user`;
  users.seedUser({
    id,
    name: `${role} User`,
    email: `${role.toLowerCase()}-wallet@example.com`,
    passwordHash: "not-used",
    role,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });
  return jwt.sign({ role, email: `${role.toLowerCase()}@example.com` }, "test-secret", {
    subject: id,
    expiresIn: "1d",
  });
}

function testApp(walletRepository = new InMemoryWalletRepository()) {
  process.env.NOWPAYMENTS_IPN_SECRET = "test-ipn-secret";
  const users = new InMemoryUserRepository();
  const adminRepository = new InMemoryAdminRepository();
  const app = createApp({
    userRepository: users,
    footballRepository: new InMemoryFootballRepository(),
    predictionRepository: new InMemoryPredictionRepository([]),
    adminRepository,
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository,
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });
  return { adminRepository, app, users, walletRepository };
}

function signature(payload: object) {
  return createHmac("sha512", "test-ipn-secret").update(JSON.stringify(payload)).digest("hex");
}

describe("wallet routes", () => {
  it("does not allow withdrawals that would create a negative balance", async () => {
    const { app, users } = testApp();
    const investorToken = seedUser(users, "INVESTOR");

    await request(app)
      .post("/api/wallet/withdrawals")
      .set("Authorization", `Bearer ${investorToken}`)
      .send({ amountCents: 1000 })
      .expect(400);
  });

  it("credits wallet only after verified confirmed IPN and prevents duplicate deposits", async () => {
    const walletRepository = new InMemoryWalletRepository();
    const { app, users } = testApp(walletRepository);
    seedUser(users, "INVESTOR");
    await walletRepository.createDeposit({
      userId: "investor-wallet-user",
      amountCents: 10000,
      externalPaymentId: "pay-1",
      invoiceUrl: "https://invoice.example",
    });

    const payload = { payment_id: "pay-1", payment_status: "finished", price_amount: 100 };
    await request(app)
      .post("/api/nowpayments/ipn")
      .set("x-nowpayments-sig", signature(payload))
      .send(payload)
      .expect(200);
    await request(app)
      .post("/api/nowpayments/ipn")
      .set("x-nowpayments-sig", signature(payload))
      .send(payload)
      .expect(200);

    const wallet = await walletRepository.getWallet("investor-wallet-user");
    expect(wallet.availableBalanceCents).toBe(10000);
  });

  it("requires admin approval for wallet withdrawal payout", async () => {
    const walletRepository = new InMemoryWalletRepository();
    const { adminRepository, app, users } = testApp(walletRepository);
    const investorToken = seedUser(users, "INVESTOR");
    const adminToken = seedUser(users, "ADMIN");
    const wallet = await walletRepository.getWallet("investor-wallet-user");
    wallet.availableBalanceCents = 20000;

    const withdrawal = await request(app)
      .post("/api/wallet/withdrawals")
      .set("Authorization", `Bearer ${investorToken}`)
      .send({ amountCents: 5000 })
      .expect(201);

    await request(app)
      .post(`/api/admin/wallet/withdrawals/${withdrawal.body.transaction.id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "APPROVED" })
      .expect(200);

    expect(adminRepository.logs.map((log) => log.action)).toContain("WALLET_WITHDRAWAL_APPROVED");
  });
});
