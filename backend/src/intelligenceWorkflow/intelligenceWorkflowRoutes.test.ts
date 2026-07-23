import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";
import { InMemoryIntelligenceWorkflowRepository } from "./inMemoryIntelligenceWorkflowRepository.js";

const jwtSecret = "test-secret";

function seedUser(users: InMemoryUserRepository, role: "ADMIN" | "ANALYST" | "SUBSCRIBER" | "INVESTOR") {
  const id = `${role.toLowerCase()}-user`;
  users.seedUser({
    id,
    name: `${role} User`,
    email: `${role.toLowerCase()}@example.com`,
    passwordHash: "not-used",
    role,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });
  return jwt.sign({ role, email: `${role.toLowerCase()}@example.com` }, jwtSecret, {
    subject: id,
    expiresIn: "1d",
  });
}

function buildApp() {
  const users = new InMemoryUserRepository();
  const adminRepository = new InMemoryAdminRepository();
  const intelligenceWorkflowRepository = new InMemoryIntelligenceWorkflowRepository();
  const app = createApp({
    userRepository: users,
    footballRepository: new InMemoryFootballRepository(),
    predictionRepository: new InMemoryPredictionRepository([]),
    intelligenceWorkflowRepository,
    adminRepository,
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository: new InMemoryWalletRepository(),
    jwtSecret,
    startFootballJobs: false,
  });
  return {
    app,
    adminRepository,
    intelligenceWorkflowRepository,
    adminToken: seedUser(users, "ADMIN"),
    analystToken: seedUser(users, "ANALYST"),
    subscriberToken: seedUser(users, "SUBSCRIBER"),
    investorToken: seedUser(users, "INVESTOR"),
  };
}

async function seedIntelligence(repository: InMemoryIntelligenceWorkflowRepository) {
  return repository.createIntelligence({
    fixtureId: "fixture-1",
    matchLabel: "Liverpool vs Wolves",
    leagueName: "Premier League",
    kickoffAt: new Date().toISOString(),
    recommendedMarket: "Home Win",
    predictedOutcome: "Liverpool",
    confidenceScore: 84,
    riskScore: 28,
    valueScore: 71,
    opportunityScore: 82,
    reasoningSummary: "Strong home form with controlled risk.",
    supportingMetrics: { form: "strong" },
    riskFactors: ["Lineups pending"],
    alternativeMarkets: ["Over 1.5 Goals"],
    dataQualityStatus: "READY",
  });
}

describe("AI intelligence workflow routes", () => {
  it("protects operational endpoints and allows subscriber-safe published intelligence only", async () => {
    const { app, intelligenceWorkflowRepository, adminToken, subscriberToken, investorToken } = buildApp();
    const item = await seedIntelligence(intelligenceWorkflowRepository);

    await request(app).get("/api/admin/intelligence").expect(401);
    await request(app).get("/api/admin/intelligence").set("Authorization", `Bearer ${investorToken}`).expect(403);

    await request(app)
      .post(`/api/admin/intelligence/${item.id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "APPROVE_SUBSCRIBER", notes: "Subscriber-safe." })
      .expect(200);

    const draft = await request(app)
      .post(`/api/admin/intelligence/${item.id}/subscriber-publication`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Liverpool Intelligence", summary: "Subscriber-safe summary." })
      .expect(201);

    await request(app)
      .post(`/api/admin/subscriber-publications/${draft.body.publication.id}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const subscriberView = await request(app)
      .get("/api/subscriber/intelligence")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(200);

    expect(subscriberView.body.intelligence).toHaveLength(1);
    expect(subscriberView.body.intelligence[0]).not.toHaveProperty("operationsNotes");
    expect(subscriberView.body.intelligence[0]).not.toHaveProperty("supportingMetrics");
  }, 15000);

  it("runs company bet and betting ledger lifecycle with auditable integer-cent settlement", async () => {
    const { app, intelligenceWorkflowRepository, adminRepository, adminToken } = buildApp();
    const item = await seedIntelligence(intelligenceWorkflowRepository);

    await request(app)
      .post(`/api/admin/intelligence/${item.id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "APPROVE_COMPANY", notes: "Internal execution candidate." })
      .expect(200);

    const companyBet = await request(app)
      .post(`/api/admin/intelligence/${item.id}/company-bet`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedStakeCents: 2500, targetOdds: 1.8, bookmaker: "Manual Desk" })
      .expect(201);

    await request(app)
      .patch(`/api/admin/company-bets/${companyBet.body.companyBet.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ approvedStakeCents: 2500, finalOdds: 1.8 })
      .expect(200);

    await request(app)
      .post(`/api/admin/company-bets/${companyBet.body.companyBet.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    await request(app)
      .post(`/api/admin/company-bets/${companyBet.body.companyBet.id}/mark-placed`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const ledger = await request(app)
      .post(`/api/admin/company-bets/${companyBet.body.companyBet.id}/ledger`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ odds: 1.8, stakeCents: 2500 })
      .expect(201);

    expect(ledger.body.ledger.potentialReturnCents).toBe(4500);

    const settled = await request(app)
      .post(`/api/admin/betting-ledger/${ledger.body.ledger.id}/settle`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ result: "WON", settledReturnCents: 4500 })
      .expect(200);

    expect(settled.body.ledger.profitLossCents).toBe(2000);
    expect(adminRepository.logs.map((log) => log.action)).toEqual(
      expect.arrayContaining([
        "AI_INTELLIGENCE_REVIEWED",
        "COMPANY_BET_CREATED",
        "COMPANY_BET_APPROVED",
        "COMPANY_BET_PLACED",
        "BETTING_LEDGER_CREATED",
        "BETTING_LEDGER_SETTLED",
      ]),
    );
  }, 15000);

  it("returns safe executive defaults and validates malformed actions", async () => {
    const { app, adminToken } = buildApp();
    const summary = await request(app)
      .get("/api/admin/intelligence/executive-summary")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(summary.body.summary).toMatchObject({
      scanned: 0,
      reviewQueue: 0,
      exposureCents: 0,
      profitLossCents: 0,
    });

    await request(app)
      .post("/api/admin/intelligence/missing/review")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ decision: "BAD_DECISION" })
      .expect(400);
  }, 15000);
});
