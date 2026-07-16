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
      "SUBSCRIBER_REVENUE",
      "COMPANY_TRADING_CAPITAL",
      "PERFORMANCE_PARTNER_DISTRIBUTIONS",
      "ANALYST_PERFORMANCE_POOL",
      "RISK_STABILITY_RESERVE",
      "COMPANY_GROWTH_OPERATIONS",
      "PAYMENT_FEES_CLEARING",
      "TREASURY_SUSPENSE",
      "TREASURY_REVERSALS",
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

  it("classifies Performance Partner and subscriber payments into controlled accounts", async () => {
    const { app, adminToken } = testApp();

    const partner = await request(app)
      .post("/api/treasury/payments/classify")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        nowPaymentsPaymentId: "np-partner-1",
        orderId: "order-partner-1",
        userId: "partner-user",
        contractOrSubscriptionId: "participation-1",
        paymentPurpose: "PERFORMANCE_PARTNER_CONTRIBUTION",
        originalAmount: "100.00",
        payAmount: "100.00",
        payCurrency: "USDTTRC20",
        blockchainNetwork: "USDT_TRC20",
        payoutWalletReference: "NOWPAYMENTS_USDT_TRC20_PAYOUT_WALLET",
        transactionHash: "trc-hash-1",
        confirmationCount: 30,
      })
      .expect(201);

    const subscriber = await request(app)
      .post("/api/treasury/payments/classify")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        nowPaymentsPaymentId: "np-sub-1",
        orderId: "order-sub-1",
        userId: "subscriber-user",
        contractOrSubscriptionId: "subscription-1",
        paymentPurpose: "SUBSCRIBER_SUBSCRIPTION",
        originalAmount: "49.00",
        payAmount: "49.00",
        payCurrency: "USDTERC20",
        blockchainNetwork: "USDT_ERC20",
        payoutWalletReference: "NOWPAYMENTS_USDT_ERC20_PAYOUT_WALLET",
        transactionHash: "erc-hash-1",
      })
      .expect(201);

    expect(partner.body.paymentRecord.classification).toBe("PERFORMANCE_PARTNER_CAPITAL");
    expect(subscriber.body.paymentRecord.classification).toBe("SUBSCRIBER_REVENUE");

    const overview = await request(app).get("/api/treasury/automation").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(overview.body.paymentRecords).toHaveLength(2);
    expect(JSON.stringify(overview.body)).not.toContain("private");
  });

  it("routes unrecognised payments to suspense and resolves reconciliation through audit", async () => {
    const { app, adminToken } = testApp();

    const suspense = await request(app)
      .post("/api/treasury/payments/classify")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ paymentPurpose: "UNKNOWN", originalAmount: "10.00", payAmount: "10.00", payCurrency: "USDTTRC20", blockchainNetwork: "USDT_TRC20" })
      .expect(201);

    expect(suspense.body.paymentRecord.classification).toBe("TREASURY_SUSPENSE");
    expect(suspense.body.paymentRecord.reconciliationStatus).toBe("EXCEPTION");

    const resolved = await request(app)
      .post("/api/treasury/reconciliation/resolve")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ paymentRecordId: suspense.body.paymentRecord.id, reason: "Matched manually with compensating evidence." })
      .expect(200);

    expect(resolved.body.paymentRecord.reconciliationStatus).toBe("RESOLVED");
  });

  it("calculates Performance Partner distributions only from approved pool and eligible seasonal contracts", async () => {
    const { app, adminToken } = testApp();

    const response = await request(app)
      .post("/api/treasury/distributions/performance-partners/calculate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        approvedPoolAmount: "100.00",
        seasonId: "season-2026",
        participations: [
          { participationId: "p1", userId: "partner-1", participationAmount: "600.00", participationPlan: "FULL_SEASON", activeFrom: "2026-08-01T00:00:00.000Z" },
          { participationId: "p2", userId: "partner-2", participationAmount: "400.00", participationPlan: "REMAINING_SEASON", activeFrom: "2026-10-01T00:00:00.000Z" },
          { participationId: "p3", userId: "partner-3", participationAmount: "900.00", participationPlan: "FULL_SEASON", activeFrom: "2026-08-01T00:00:00.000Z", holdReason: "KYC hold" },
        ],
      })
      .expect(201);

    expect(response.body.distributions).toHaveLength(2);
    expect(response.body.distributions.map((item: { distributionAmount: { minorUnits: string } }) => item.distributionAmount.minorUnits)).toEqual(["6000", "4000"]);
    expect(response.body.distributions.every((item: { status: string }) => item.status === "CALCULATED")).toBe(true);

    const zero = await request(app)
      .post("/api/treasury/distributions/performance-partners/calculate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ approvedPoolAmount: "0", participations: [{ participationId: "p1", userId: "partner-1", participationAmount: "600.00", participationPlan: "FULL_SEASON", activeFrom: "2026-08-01T00:00:00.000Z" }] })
      .expect(201);
    expect(zero.body.distributions).toHaveLength(0);
  });

  it("allocates analyst pool by eligible points and prohibits equal-share fallback", async () => {
    const { app, adminToken } = testApp();

    const response = await request(app)
      .post("/api/treasury/analyst-pool/calculate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        approvedPoolAmount: "100.00",
        analysts: [
          { analystId: "analyst-1", eligiblePoints: 80 },
          { analystId: "analyst-2", eligiblePoints: 20 },
        ],
      })
      .expect(201);

    expect(response.body.allocations.map((item: { rewardAmount: { minorUnits: string } }) => item.rewardAmount.minorUnits)).toEqual(["8000", "2000"]);
  });

  it("records approval events and blocks incompatible same-actor stages", async () => {
    const { app, adminToken } = testApp();

    await request(app)
      .post("/api/treasury/approvals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ actorRole: "Finance Officer", entityType: "DISTRIBUTION_BATCH", entityId: "batch-1", previousStatus: "CALCULATED", newStatus: "UNDER_REVIEW", reason: "Finance review started." })
      .expect(201);

    await request(app)
      .post("/api/treasury/approvals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ actorRole: "Finance Officer", entityType: "DISTRIBUTION_BATCH", entityId: "batch-1", previousStatus: "UNDER_REVIEW", newStatus: "APPROVED", reason: "Same actor should not approve own stage." })
      .expect(403);
  });

  it("prepares TRC20 and ERC20 payout batches, rejects invalid addresses, and prevents duplicates", async () => {
    const { app, adminToken } = testApp();

    const trc = await request(app)
      .post("/api/treasury/payout-batches/prepare")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        network: "USDT_TRC20",
        instructions: [{ distributionId: "dist-1", recipientUserId: "partner-1", recipientAddress: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE", amount: "10.00" }],
      })
      .expect(201);
    expect(trc.body.batch.status).toBe("READY_FOR_APPROVAL");

    const erc = await request(app)
      .post("/api/treasury/payout-batches/prepare")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        network: "USDT_ERC20",
        instructions: [{ distributionId: "dist-2", recipientUserId: "partner-2", recipientAddress: "0x1111111111111111111111111111111111111111", amount: "12.00" }],
      })
      .expect(201);
    expect(erc.body.batch.status).toBe("READY_FOR_APPROVAL");

    const invalid = await request(app)
      .post("/api/treasury/payout-batches/prepare")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        network: "USDT_TRC20",
        instructions: [{ distributionId: "dist-3", recipientUserId: "partner-3", recipientAddress: "0x1111111111111111111111111111111111111111", amount: "10.00" }],
      })
      .expect(201);
    expect(invalid.body.batch.status).toBe("BLOCKED");
    expect(invalid.body.batch.instructions[0].validationErrors[0]).toContain("TRC20");

    const duplicate = await request(app)
      .post("/api/treasury/payout-batches/prepare")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        network: "USDT_TRC20",
        instructions: [{ distributionId: "dist-1", recipientUserId: "partner-1", recipientAddress: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE", amount: "10.00" }],
      })
      .expect(201);
    expect(duplicate.body.batch.status).toBe("BLOCKED");
  });

  it("creates compensating reversal entries instead of deleting history", async () => {
    const { app, adminToken } = testApp();

    const reversal = await request(app)
      .post("/api/treasury/reversals")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ originalTransactionId: "txn-original", reason: "Provider refund received.", amount: "20.00", currency: "USD" })
      .expect(201);

    expect(reversal.body.transaction.purpose).toBe("REVERSAL");
    expect(reversal.body.transaction.lines).toHaveLength(2);
  });
});
