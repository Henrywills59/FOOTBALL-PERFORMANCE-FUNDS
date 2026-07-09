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
import { InMemoryPredictionWorkflowRepository } from "./inMemoryPredictionWorkflowRepository.js";

function buildApp() {
  const footballRepository = new InMemoryFootballRepository();
  const workflowRepository = new InMemoryPredictionWorkflowRepository();
  const app = createApp({
    userRepository: new InMemoryUserRepository(),
    footballRepository,
    predictionRepository: new InMemoryPredictionRepository([]),
    predictionWorkflowRepository: workflowRepository,
    analystRepository: new InMemoryAnalystRepository(),
    adminRepository: new InMemoryAdminRepository(),
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository: new InMemoryWalletRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });

  return { app, footballRepository, workflowRepository };
}

async function register(app: ReturnType<typeof createApp>, role: "SUBSCRIBER" | "INVESTOR" | "ANALYST") {
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

describe("prediction workflow routes", () => {
  it("protects analyst workflow tools from subscribers and investors", async () => {
    const { app } = buildApp();
    await request(app).get("/api/prediction-workflow/queue").expect(401);
    const investorToken = await register(app, "INVESTOR");

    await request(app)
      .get("/api/prediction-workflow/queue")
      .set("Authorization", `Bearer ${investorToken}`)
      .expect(403);
  }, 15000);

  it("creates candidates from the Decision Engine and transitions lifecycle status", async () => {
    const { app, footballRepository } = buildApp();
    await footballRepository.upsertFixture({
      apiFootballFixtureId: 10001,
      league: { apiFootballLeagueId: 39, name: "Premier League", country: "England", season: 2026 },
      homeTeam: { apiFootballTeamId: 1, name: "Home FC" },
      awayTeam: { apiFootballTeamId: 2, name: "Away FC" },
      season: 2026,
      kickoffAt: new Date(`${new Date().toISOString().slice(0, 10)}T20:00:00.000Z`),
      status: "SCHEDULED",
      raw: {},
    });
    const analystToken = await register(app, "ANALYST");

    const queue = await request(app)
      .get("/api/prediction-workflow/queue?sort=priority")
      .set("Authorization", `Bearer ${analystToken}`)
      .expect(200);
    const itemId = queue.body.items[0].id as string;
    const approved = await request(app)
      .post(`/api/prediction-workflow/queue/${encodeURIComponent(itemId)}/actions`)
      .set("Authorization", `Bearer ${analystToken}`)
      .send({ action: "APPROVE", reason: "Confidence acceptable for review." })
      .expect(200);
    const published = await request(app)
      .post(`/api/prediction-workflow/queue/${encodeURIComponent(itemId)}/actions`)
      .set("Authorization", `Bearer ${analystToken}`)
      .send({ action: "PUBLISH", reason: "Final approval." })
      .expect(200);

    expect(queue.body.items).toHaveLength(1);
    expect(approved.body.item.status).toBe("APPROVED");
    expect(published.body.item.status).toBe("PUBLISHED");
  }, 15000);

  it("publishes workflow predictions to subscribers and never 500s on empty data", async () => {
    const { app, workflowRepository } = buildApp();
    const subscriberToken = await register(app, "SUBSCRIBER");
    workflowRepository.items.set("published-1", {
      id: "published-1",
      fixtureId: "fixture-1",
      match: "Home FC vs Away FC",
      league: "Premier League",
      kickoffTime: null,
      recommendedMarket: "Match Result",
      predictedOutcome: "Home FC watchlist",
      confidenceScore: 72,
      riskScore: 42,
      opportunityScore: 71,
      valueScore: 66,
      priority: 80,
      status: "PUBLISHED",
      predictionType: "AI_DECISION",
      explanation: "Published placeholder prediction.",
      reasoning: ["Strong home form."],
      warnings: [],
      analystNotes: null,
      flags: [],
      featured: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      archivedAt: null,
    });

    const response = await request(app)
      .get("/api/predictions/published-workflow")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(200);

    expect(response.body.predictions).toHaveLength(1);
    expect(response.body.predictions[0].status).toBe("PUBLISHED");
  }, 15000);
});
