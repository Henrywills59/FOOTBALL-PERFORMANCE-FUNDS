import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { PredictionQueueItem, UserRole } from "@fpf/shared";
import { createApp } from "../app.js";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryAnalystRepository } from "../analyst/inMemoryAnalystRepository.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryPredictionWorkflowRepository } from "../predictionWorkflow/inMemoryPredictionWorkflowRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";
import { InMemoryCompanyCapitalRepository } from "./inMemoryCompanyCapitalRepository.js";

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

function approvedCandidate(): PredictionQueueItem {
  return {
    id: "decision:fixture-100",
    fixtureId: "fixture-100",
    match: "FPF United vs Capital City",
    league: "Internal Test League",
    kickoffTime: new Date().toISOString(),
    recommendedMarket: "Over/Under 2.5",
    predictedOutcome: "Over 2.5",
    confidenceScore: 78,
    riskScore: 32,
    opportunityScore: 74,
    valueScore: 68,
    priority: 80,
    status: "APPROVED",
    predictionType: "AI_DECISION",
    explanation: "Approved analyst intelligence candidate.",
    reasoning: ["Strong momentum", "Analyst approved"],
    warnings: [],
    analystNotes: "Approved for internal capital review.",
    flags: [],
    featured: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: null,
    archivedAt: null,
  };
}

function testApp() {
  const users = new InMemoryUserRepository();
  const predictionWorkflowRepository = new InMemoryPredictionWorkflowRepository();
  predictionWorkflowRepository.items.set("decision:fixture-100", approvedCandidate());

  const app = createApp({
    userRepository: users,
    adminRepository: new InMemoryAdminRepository(),
    analystRepository: new InMemoryAnalystRepository(),
    footballRepository: new InMemoryFootballRepository(),
    investorRepository: new InMemoryInvestorRepository(),
    predictionRepository: new InMemoryPredictionRepository([]),
    predictionWorkflowRepository,
    walletRepository: new InMemoryWalletRepository(),
    companyCapitalRepository: new InMemoryCompanyCapitalRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });

  return {
    app,
    ceoToken: tokenFor(users, "CEO", "ceo-user"),
    financeToken: tokenFor(users, "FINANCE", "finance-user"),
    subscriberToken: tokenFor(users, "SUBSCRIBER", "subscriber-user"),
  };
}

describe("company capital routes", () => {
  it("keeps the Company Capital Desk private to internal capital roles", async () => {
    const { app, ceoToken, subscriberToken } = testApp();

    await request(app).get("/api/internal/company-capital").expect(401);
    await request(app).get("/api/internal/company-capital").set("Authorization", `Bearer ${subscriberToken}`).expect(403);

    const response = await request(app).get("/api/internal/company-capital").set("Authorization", `Bearer ${ceoToken}`).expect(200);
    expect(response.body.privateNotice).toContain("never exposed");
    expect(response.body.portfolio.name).toBe("FPF Company Capital Portfolio");
  });

  it("imports approved intelligence candidates into capital allocation workflow", async () => {
    const { app, ceoToken } = testApp();

    const candidates = await request(app).get("/api/internal/company-capital/candidates").set("Authorization", `Bearer ${ceoToken}`).expect(200);
    expect(candidates.body.candidates).toHaveLength(1);

    const allocation = await request(app)
      .post("/api/internal/company-capital/allocations/from-candidate")
      .set("Authorization", `Bearer ${ceoToken}`)
      .send({ candidateId: "decision:fixture-100" })
      .expect(201);

    expect(allocation.body.allocation.analystApprovalStatus).toBe("APPROVED");
    expect(allocation.body.allocation.candidateId).toBe("decision:fixture-100");
  });

  it("enforces approval controls, records stakes, settlements, reports and audit trail", async () => {
    const { app, financeToken } = testApp();
    const created = await request(app)
      .post("/api/internal/company-capital/allocations/from-candidate")
      .set("Authorization", `Bearer ${financeToken}`)
      .send({ candidateId: "decision:fixture-100" })
      .expect(201);
    const allocationId = created.body.allocation.id;

    const approved = await request(app)
      .post(`/api/internal/company-capital/allocations/${allocationId}/approve`)
      .set("Authorization", `Bearer ${financeToken}`)
      .send({ approvedStakeCents: 15000, notes: "Approved inside risk limits." })
      .expect(200);
    expect(approved.body.allocation.approvalStatus).toBe("APPROVED");

    await request(app)
      .post(`/api/internal/company-capital/allocations/${allocationId}/stakes`)
      .set("Authorization", `Bearer ${financeToken}`)
      .send({ stakeCents: 16000, odds: 1.8, bookmaker: "Manual Desk" })
      .expect(400);

    const stake = await request(app)
      .post(`/api/internal/company-capital/allocations/${allocationId}/stakes`)
      .set("Authorization", `Bearer ${financeToken}`)
      .send({ stakeCents: 15000, odds: 1.8, bookmaker: "Manual Desk", reference: "MANUAL-1" })
      .expect(201);

    const settlement = await request(app)
      .post(`/api/internal/company-capital/allocations/${allocationId}/settlements`)
      .set("Authorization", `Bearer ${financeToken}`)
      .send({ stakeId: stake.body.stake.id, outcome: "WIN" })
      .expect(201);
    expect(settlement.body.settlement.profitCents).toBe(12000);

    const report = await request(app)
      .post("/api/internal/company-capital/reports")
      .set("Authorization", `Bearer ${financeToken}`)
      .send({ periodType: "WEEKLY", periodLabel: "2026-W33" })
      .expect(201);
    expect(report.body.report.metrics.settlements).toBe(1);

    const dashboard = await request(app).get("/api/internal/company-capital").set("Authorization", `Bearer ${financeToken}`).expect(200);
    expect(dashboard.body.portfolio.settledProfitCents).toBe(12000);
    expect(dashboard.body.auditTrail.map((record: { action: string }) => record.action)).toEqual(
      expect.arrayContaining([
        "COMPANY_CAPITAL_ALLOCATION_APPROVED",
        "COMPANY_CAPITAL_STAKE_PLACED",
        "COMPANY_CAPITAL_SETTLEMENT_RECORDED",
        "COMPANY_CAPITAL_REPORT_GENERATED",
      ]),
    );
  });

  it("blocks capital approval when analyst/intelligence approval is missing", async () => {
    const { app, ceoToken } = testApp();
    const created = await request(app)
      .post("/api/internal/company-capital/allocations")
      .set("Authorization", `Bearer ${ceoToken}`)
      .send({
        matchLabel: "Manual Match",
        market: "Home Win",
        selection: "Home",
        recommendedStakeCents: 10000,
        maxStakeCents: 12000,
        odds: 1.7,
        riskGrade: "MEDIUM",
      })
      .expect(201);

    await request(app)
      .post(`/api/internal/company-capital/allocations/${created.body.allocation.id}/approve`)
      .set("Authorization", `Bearer ${ceoToken}`)
      .send({ approvedStakeCents: 10000 })
      .expect(400);
  });
});
