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

function buildApp() {
  const footballRepository = new InMemoryFootballRepository();
  const app = createApp({
    userRepository: new InMemoryUserRepository(),
    footballRepository,
    predictionRepository: new InMemoryPredictionRepository([]),
    analystRepository: new InMemoryAnalystRepository(),
    adminRepository: new InMemoryAdminRepository(),
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository: new InMemoryWalletRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });

  return { app, footballRepository };
}

async function register(app: ReturnType<typeof createApp>, role: "SUBSCRIBER" | "INVESTOR" | "ANALYST" | "ADMIN") {
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: `${role} User`,
      email: `${role.toLowerCase()}-${Date.now()}@example.com`,
      password: "Password123",
      role: role === "ADMIN" ? "SUBSCRIBER" : role,
    })
    .expect(201);

  return response.body.token as string;
}

describe("intelligence routes", () => {
  it("protects intelligence endpoints by role", async () => {
    const { app } = buildApp();

    await request(app).get("/api/intelligence/dashboard").expect(401);
    const investorToken = await register(app, "INVESTOR");

    await request(app)
      .get("/api/intelligence/dashboard")
      .set("Authorization", `Bearer ${investorToken}`)
      .expect(403);
  }, 15000);

  it("returns dashboard, fixture, live, and opportunity payloads for subscribers", async () => {
    const { app, footballRepository } = buildApp();
    await footballRepository.upsertFixture({
      apiFootballFixtureId: 8001,
      league: { apiFootballLeagueId: 39, name: "Premier League", country: "England", season: 2026 },
      homeTeam: { apiFootballTeamId: 1, name: "Home FC" },
      awayTeam: { apiFootballTeamId: 2, name: "Away FC" },
      season: 2026,
      kickoffAt: new Date(`${new Date().toISOString().slice(0, 10)}T18:00:00.000Z`),
      status: "LIVE",
      homeScore: 1,
      awayScore: 0,
      raw: {},
    });
    const token = await register(app, "SUBSCRIBER");

    const dashboard = await request(app)
      .get("/api/intelligence/dashboard")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const fixtures = await request(app)
      .get("/api/intelligence/fixtures")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const live = await request(app)
      .get("/api/intelligence/live")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const opportunities = await request(app)
      .get("/api/intelligence/opportunities")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(dashboard.body.executiveOverview.subscriptionStatus).toBe("Active");
    expect(fixtures.body.fixtures).toHaveLength(1);
    expect(live.body.fixtures).toHaveLength(1);
    expect(opportunities.body.opportunities).toEqual([]);
  }, 15000);

  it("returns safe insufficient-data match intelligence for missing fixtures", async () => {
    const { app } = buildApp();
    const token = await register(app, "SUBSCRIBER");

    const response = await request(app)
      .get("/api/intelligence/match/missing")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.intelligence.fixture).toBeNull();
    expect(response.body.intelligence.scores.dataQualityStatus).toBe("INSUFFICIENT_DATA");
  }, 15000);
});
