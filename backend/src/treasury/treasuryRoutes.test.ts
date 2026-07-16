import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryAnalystRepository } from "../analyst/inMemoryAnalystRepository.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";
import type { UserRole } from "@fpf/shared";

function tokenFor(users: InMemoryUserRepository, role: UserRole, id: string) {
  users.seedUser({
    id,
    name: `${role} User`,
    email: `${id}@example.com`,
    passwordHash: "not-used",
    role,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });

  return jwt.sign({ role, email: `${id}@example.com` }, "test-secret", {
    subject: id,
    expiresIn: "1d",
  });
}

function testApp() {
  const users = new InMemoryUserRepository();
  const app = createApp({
    userRepository: users,
    adminRepository: new InMemoryAdminRepository(),
    analystRepository: new InMemoryAnalystRepository(),
    footballRepository: new InMemoryFootballRepository(),
    investorRepository: new InMemoryInvestorRepository(),
    predictionRepository: new InMemoryPredictionRepository([]),
    walletRepository: new InMemoryWalletRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });

  return {
    app,
    adminToken: tokenFor(users, "ADMIN", "admin-user"),
    analystToken: tokenFor(users, "ANALYST", "analyst-placeholder"),
    subscriberToken: tokenFor(users, "SUBSCRIBER", "subscriber-user"),
  };
}

describe("treasury routes", () => {
  it("requires admin access for treasury center", async () => {
    const { app, subscriberToken } = testApp();

    await request(app).get("/api/treasury").expect(401);
    await request(app).get("/api/treasury").set("Authorization", `Bearer ${subscriberToken}`).expect(403);
  });

  it("returns safe treasury defaults and 50/20/30 policy", async () => {
    const { app, adminToken } = testApp();

    const response = await request(app).get("/api/treasury").set("Authorization", `Bearer ${adminToken}`).expect(200);

    expect(response.body.policy.companySharePercent).toBe(50);
    expect(response.body.policy.analystRewardPercent).toBe(20);
    expect(response.body.policy.investorDistributionPercent).toBe(30);
    expect(response.body.accounts.investorCapitalBalanceCents).toBeGreaterThan(0);
  });

  it("requires a reason when manual execution stake or odds differ", async () => {
    const { app, adminToken } = testApp();
    const dashboard = await request(app).get("/api/treasury").set("Authorization", `Bearer ${adminToken}`);
    const allocationId = dashboard.body.capitalAllocations[0].id;

    await request(app)
      .post("/api/treasury/executions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ allocationId, actualStakeCents: 26000, actualOdds: 1.8, recommendedOdds: 1.8 })
      .expect(400);
  });

  it("creates execution, settlement, reconciliation and blocks duplicate settlement", async () => {
    const { app, adminToken } = testApp();
    const dashboard = await request(app).get("/api/treasury").set("Authorization", `Bearer ${adminToken}`);
    const allocationId = dashboard.body.capitalAllocations[0].id;

    const execution = await request(app)
      .post("/api/treasury/executions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ allocationId, actualStakeCents: 25000, actualOdds: 1.8, recommendedOdds: 1.8, bookmaker: "Manual Desk", betReference: "BET-1" })
      .expect(201);

    const settlement = await request(app)
      .post(`/api/treasury/executions/${execution.body.execution.id}/settle`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ outcome: "WIN", verificationStatus: "VERIFIED" })
      .expect(201);

    await request(app)
      .post(`/api/treasury/executions/${execution.body.execution.id}/settle`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ outcome: "WIN" })
      .expect(400);

    await request(app)
      .post(`/api/treasury/settlements/${settlement.body.settlement.id}/reconcile`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amountDepositedBackCents: settlement.body.settlement.grossReturnCents })
      .expect(201);
  });

  it("validates policy totals and restricts analyst executive access", async () => {
    const { app, adminToken, analystToken } = testApp();

    await request(app)
      .post("/api/treasury/policy")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ companySharePercent: 60, analystRewardPercent: 20, investorDistributionPercent: 30 })
      .expect(400);

    await request(app)
      .get("/api/treasury/executive-situation-room")
      .set("Authorization", `Bearer ${analystToken}`)
      .expect(403);

    await request(app)
      .get("/api/treasury/analyst/me")
      .set("Authorization", `Bearer ${analystToken}`)
      .expect(200);
  });

  it("closes daily and weekly periods after reconciliation", async () => {
    const { app, adminToken } = testApp();
    const dashboard = await request(app).get("/api/treasury").set("Authorization", `Bearer ${adminToken}`);
    const allocationId = dashboard.body.capitalAllocations[0].id;
    const execution = await request(app)
      .post("/api/treasury/executions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ allocationId, actualStakeCents: 25000, actualOdds: 1.8, recommendedOdds: 1.8, bookmaker: "Manual Desk", betReference: "BET-2" });
    const settlement = await request(app)
      .post(`/api/treasury/executions/${execution.body.execution.id}/settle`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ outcome: "WIN", verificationStatus: "VERIFIED" });
    await request(app)
      .post(`/api/treasury/settlements/${settlement.body.settlement.id}/reconcile`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amountDepositedBackCents: settlement.body.settlement.grossReturnCents });

    await request(app).post("/api/treasury/daily/close").set("Authorization", `Bearer ${adminToken}`).send({}).expect(200);
    const weekly = await request(app)
      .post("/api/treasury/weekly/close")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ executiveApproval: true })
      .expect(200);

    expect(weekly.body.closure.analystRewards.length).toBeGreaterThan(0);
    expect(weekly.body.closure.investorDistributions.length).toBeGreaterThan(0);
  });

  it("creates the fixed treasury ledger accounts and keeps pending transactions from changing balances", async () => {
    const { app, adminToken } = testApp();

    const overview = await request(app).get("/api/treasury/ledger").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(overview.body.accounts.map((account: { code: string }) => account.code)).toEqual([
      "PERFORMANCE_PARTNER_CAPITAL",
      "COMPANY_TRADING_CAPITAL",
      "PERFORMANCE_PARTNER_DISTRIBUTIONS",
      "ANALYST_PERFORMANCE_POOL",
      "RISK_STABILITY_RESERVE",
      "COMPANY_GROWTH_OPERATIONS",
      "SUBSCRIBER_REVENUE",
    ]);

    const pending = await request(app)
      .post("/api/treasury/ledger/transactions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        sourceAccount: "COMPANY_TRADING_CAPITAL",
        destinationAccount: "SUBSCRIBER_REVENUE",
        amount: "49.99",
        currency: "USD",
        purpose: "SUBSCRIBER_REVENUE",
        referenceType: "SUBSCRIPTION",
        referenceId: "sub_001",
      })
      .expect(201);

    expect(pending.body.transaction.approvalStatus).toBe("PENDING_APPROVAL");
    expect(pending.body.transaction.lines).toHaveLength(0);
    const afterPending = await request(app).get("/api/treasury/ledger").set("Authorization", `Bearer ${adminToken}`);
    const subscriberRevenue = afterPending.body.accounts.find((account: { code: string }) => account.code === "SUBSCRIBER_REVENUE");
    expect(subscriberRevenue.currencyBalances).toEqual({});
  });

  it("approves immutable double-entry ledger transactions with balanced debits and credits", async () => {
    const { app, adminToken } = testApp();

    const created = await request(app)
      .post("/api/treasury/ledger/transactions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        sourceAccount: "COMPANY_TRADING_CAPITAL",
        destinationAccount: "SUBSCRIBER_REVENUE",
        amount: "49.99",
        currency: "USD",
        purpose: "SUBSCRIBER_REVENUE",
        externalTransactionReference: "stripe-placeholder-001",
      })
      .expect(201);

    const approved = await request(app)
      .post(`/api/treasury/ledger/transactions/${created.body.transaction.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const debit = approved.body.transaction.lines
      .filter((line: { direction: string }) => line.direction === "DEBIT")
      .reduce((total: bigint, line: { amount: { minorUnits: string } }) => total + BigInt(line.amount.minorUnits), 0n);
    const credit = approved.body.transaction.lines
      .filter((line: { direction: string }) => line.direction === "CREDIT")
      .reduce((total: bigint, line: { amount: { minorUnits: string } }) => total + BigInt(line.amount.minorUnits), 0n);

    expect(debit).toBe(credit);
    expect(approved.body.transaction.lines[0].resultingBalance.currency).toBe("USD");

    const overview = await request(app).get("/api/treasury/ledger").set("Authorization", `Bearer ${adminToken}`);
    expect(overview.body.invariant.balanced).toBe(true);
  });

  it("blocks subscriber revenue from entering Performance Partner Capital", async () => {
    const { app, adminToken } = testApp();

    await request(app)
      .post("/api/treasury/ledger/transactions")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        sourceAccount: "SUBSCRIBER_REVENUE",
        destinationAccount: "PERFORMANCE_PARTNER_CAPITAL",
        amount: "19.00",
        currency: "USD",
        purpose: "SUBSCRIBER_REVENUE",
      })
      .expect(400);
  });

  it("allocates only verified eligible profit using the 35/15/15/35 policy", async () => {
    const { app, adminToken } = testApp();

    const allocated = await request(app)
      .post("/api/treasury/ledger/eligible-profit/allocate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: "1000.00", currency: "USD", referenceId: "verified-profit-week-1" })
      .expect(201);

    expect(allocated.body.transactions).toHaveLength(4);
    const byDestination = Object.fromEntries(
      allocated.body.transactions.map((transaction: { destinationAccount: string; amount: { minorUnits: string } }) => [
        transaction.destinationAccount,
        transaction.amount.minorUnits,
      ]),
    );
    expect(byDestination.PERFORMANCE_PARTNER_DISTRIBUTIONS).toBe("35000");
    expect(byDestination.ANALYST_PERFORMANCE_POOL).toBe("15000");
    expect(byDestination.RISK_STABILITY_RESERVE).toBe("15000");
    expect(byDestination.COMPANY_GROWTH_OPERATIONS).toBe("35000");
    expect(allocated.body.transactions.every((transaction: { metadata: { eligibleProfitOnly: boolean } }) => transaction.metadata.eligibleProfitOnly)).toBe(true);
  });
});
