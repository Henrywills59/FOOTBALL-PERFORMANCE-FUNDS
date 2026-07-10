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
});
