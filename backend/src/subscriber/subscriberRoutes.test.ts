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
import { InMemoryIntelligenceWorkflowRepository } from "../intelligenceWorkflow/inMemoryIntelligenceWorkflowRepository.js";

function buildApp() {
  const footballRepository = new InMemoryFootballRepository();
  const predictionRepository = new InMemoryPredictionRepository([]);
  const analystRepository = new InMemoryAnalystRepository();
  const intelligenceWorkflowRepository = new InMemoryIntelligenceWorkflowRepository();
  const app = createApp({
    userRepository: new InMemoryUserRepository(),
    footballRepository,
    predictionRepository,
    adminRepository: new InMemoryAdminRepository(),
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository: new InMemoryWalletRepository(),
    analystRepository,
    intelligenceWorkflowRepository,
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });

  return { analystRepository, app, footballRepository, intelligenceWorkflowRepository, predictionRepository };
}

async function register(app: ReturnType<typeof createApp>, role: "SUBSCRIBER" | "INVESTOR") {
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: `${role} User`,
      email: `${role.toLowerCase()}-${Date.now()}@example.com`,
      password: "Password123",
      role,
    })
    .expect(201);

  return response.body.token as string;
}

describe("subscriber command center", () => {
  it("returns a premium command center payload with safe defaults", async () => {
    const { app } = buildApp();
    const token = await register(app, "SUBSCRIBER");

    const response = await request(app)
      .get("/api/subscriber/command-center")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.executiveOverview.subscriptionStatus).toBe("Active");
    expect(response.body.executiveOverview.aiIntelligenceScore).toBeGreaterThan(0);
    expect(response.body.opportunities).toEqual([]);
    expect(response.body.liveIntelligenceFeed.length).toBeGreaterThan(0);
    expect(response.body.performance).toEqual(
      expect.objectContaining({
        wins: 0,
        losses: 0,
        strikeRate: 0,
      }),
    );
    expect(response.body.reports.length).toBeGreaterThan(0);
    expect(response.body.notifications.length).toBeGreaterThan(0);
    expect(response.body.referral.referralCode).toMatch(/^FPF-/);
  });

  it("includes workflow subscriber publications without exposing internal intelligence fields", async () => {
    const { app, intelligenceWorkflowRepository } = buildApp();
    const intelligence = await intelligenceWorkflowRepository.createIntelligence({
      fixtureId: "fixture-workflow",
      matchLabel: "Liverpool vs Everton",
      leagueName: "Premier League",
      kickoffAt: new Date("2026-07-23T18:00:00.000Z").toISOString(),
      recommendedMarket: "Match Result",
      predictedOutcome: "Liverpool",
      confidenceScore: 82,
      riskScore: 31,
      valueScore: 74,
      opportunityScore: 81,
      reasoningSummary: "Internal reasoning should not be exposed.",
      subscriberSummary: "Published subscriber-safe explanation.",
      supportingMetrics: { privateModel: "hidden" },
      riskFactors: ["Internal review note"],
      alternativeMarkets: ["Internal alternative"],
      dataQualityStatus: "READY",
    });
    await intelligenceWorkflowRepository.updateIntelligenceStatus({
      id: intelligence.id,
      status: "APPROVED_SUBSCRIBER",
      reviewedAt: new Date().toISOString(),
    });
    const publication = await intelligenceWorkflowRepository.createSubscriberPublication({
      intelligence: { ...intelligence, scanStatus: "APPROVED_SUBSCRIBER" },
      actorUserId: "admin-user",
      title: "Liverpool Intelligence",
      summary: "Published subscriber-safe explanation.",
    });
    await intelligenceWorkflowRepository.updateSubscriberPublication(publication.id, {
      actorUserId: "admin-user",
      status: "PUBLISHED",
    });
    const token = await register(app, "SUBSCRIBER");

    const response = await request(app)
      .get("/api/subscriber/command-center")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.opportunities[0]).toEqual(
      expect.objectContaining({
        match: "Liverpool vs Everton",
        source: "FPF Intelligence",
        explanation: "Published subscriber-safe explanation.",
      }),
    );
    expect(JSON.stringify(response.body)).not.toContain("privateModel");
    expect(JSON.stringify(response.body)).not.toContain("Internal reasoning should not be exposed");
  });

  it("composes approved predictions and published intelligence into opportunities", async () => {
    const { analystRepository, app, footballRepository, predictionRepository } = buildApp();
    await footballRepository.upsertFixture({
      apiFootballFixtureId: 9001,
      league: { apiFootballLeagueId: 39, name: "Premier League", country: "England", season: 2026 },
      homeTeam: { apiFootballTeamId: 1, name: "Arsenal" },
      awayTeam: { apiFootballTeamId: 2, name: "Chelsea" },
      season: 2026,
      kickoffAt: new Date("2026-07-08T20:00:00.000Z"),
      status: "SCHEDULED",
      raw: {},
    });
    await predictionRepository.createPrediction({
      oddId: "odd-1",
      fixtureId: "9001",
      recommendedMarket: "Asian Handicap",
      predictedOutcome: "Arsenal +0.25",
      confidenceScore: 76,
      riskScore: 34,
      valueRating: "HIGH",
      explanation: "Model edge is supported by market price and team context.",
      dataQualityStatus: "READY",
      approvalStatus: "APPROVED",
      edge: 0.08,
      impliedProbability: 0.52,
      modelProbability: 0.6,
      staleOdds: false,
      riskyMarket: false,
    });
    const submission = await analystRepository.createSubmission({
      analystId: "analyst-1",
      fixtureId: "9001",
      leagueName: "Premier League",
      market: "Total Goals",
      prediction: "Over 2.5",
      confidence: 68,
      riskLevel: "Medium",
      detailedReasoning: "Tempo and chance creation support a goals market.",
      supportingStatistics: "Shot volume trending upward.",
      sourceNotes: "Internal review",
      briefExplanation: "Goal environment is constructive.",
      recommendedStake: "1 unit",
      status: "PENDING_REVIEW",
    });
    await analystRepository.updateStatus(submission.id, "PUBLISHED");
    const token = await register(app, "SUBSCRIBER");

    const response = await request(app)
      .get("/api/subscriber/command-center")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.opportunities).toHaveLength(2);
    expect(response.body.opportunities[0]).toEqual(
      expect.objectContaining({
        match: "Arsenal vs Chelsea",
        aiConfidence: 76,
        riskGrade: "Low",
      }),
    );
    expect(response.body.liveIntelligenceFeed.some((item: { type: string }) => item.type === "Value Opportunity")).toBe(true);
  });

  it("protects subscriber command center access by role", async () => {
    const { app } = buildApp();
    await request(app).get("/api/subscriber/command-center").expect(401);
    const investorToken = await register(app, "INVESTOR");

    await request(app)
      .get("/api/subscriber/command-center")
      .set("Authorization", `Bearer ${investorToken}`)
      .expect(403);
  });
});
