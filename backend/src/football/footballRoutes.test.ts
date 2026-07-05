import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { ApiFootballClient } from "./apiFootballClient.js";
import { FootballJobScheduler } from "./footballJobs.js";
import { FootballSyncService } from "./footballSyncService.js";
import { InMemoryFootballRepository } from "./inMemoryFootballRepository.js";
import { OddsApiClient } from "./oddsApiClient.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";

async function signedInApp(role: "SUBSCRIBER" | "ANALYST" = "SUBSCRIBER") {
  const footballRepository = new InMemoryFootballRepository();
  await footballRepository.upsertFixture({
    apiFootballFixtureId: 1001,
    league: { apiFootballLeagueId: 39, name: "Premier League", season: 2026 },
    homeTeam: { apiFootballTeamId: 1, name: "Home FC" },
    awayTeam: { apiFootballTeamId: 2, name: "Away FC" },
    season: 2026,
    kickoffAt: new Date("2026-08-01T18:00:00.000Z"),
    status: "LIVE",
    homeScore: 1,
    awayScore: 0,
    raw: {},
  });

  const app = createApp({
    userRepository: new InMemoryUserRepository(),
    footballRepository,
    predictionRepository: new InMemoryPredictionRepository([]),
    adminRepository: new InMemoryAdminRepository(),
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository: new InMemoryWalletRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });

  const login = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Analyst User",
      email: `${role.toLowerCase()}@example.com`,
      password: "Password123",
      role,
    })
    .expect(201);

  return { app, token: login.body.token };
}

describe("football routes", () => {
  it("lists live fixtures for authenticated users", async () => {
    const { app, token } = await signedInApp();

    const response = await request(app)
      .get("/api/football/fixtures?live=true")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.fixtures).toHaveLength(1);
    expect(response.body.fixtures[0].homeTeamName).toBe("Home FC");
  });

  it("filters fixtures by search, league, and date", async () => {
    const { app, token } = await signedInApp();

    const response = await request(app)
      .get("/api/football/fixtures?search=Home&league=Premier&date=2026-08-01")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.fixtures).toHaveLength(1);
  });

  it("returns match details", async () => {
    const { app, token } = await signedInApp();

    const response = await request(app)
      .get("/api/football/fixtures/1001")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.fixture.leagueName).toBe("Premier League");
  });

  it("protects manual sync for analysts and admins", async () => {
    const subscriber = await signedInApp("SUBSCRIBER");
    await request(subscriber.app)
      .post("/api/football/sync")
      .set("Authorization", `Bearer ${subscriber.token}`)
      .expect(403);

    const analyst = await signedInApp("ANALYST");
    await request(analyst.app)
      .post("/api/football/sync")
      .set("Authorization", `Bearer ${analyst.token}`)
      .expect(202);
  });

  it("starts scheduled football jobs when enabled", async () => {
    const repository = new InMemoryFootballRepository();
    const config = {
      apiFootballBaseUrl: "https://example.com",
      oddsApiBaseUrl: "https://example.com",
      oddsApiSport: "soccer_epl",
      season: 2026,
      leagueIds: [39],
      jobsEnabled: true,
      syncIntervalMinutes: 5,
    };
    const syncService = new FootballSyncService(
      repository,
      new ApiFootballClient(config),
      new OddsApiClient(config),
      config,
    );
    const scheduler = new FootballJobScheduler(syncService, config);

    expect(scheduler.start()).toBe(true);
    expect(scheduler.isStarted()).toBe(true);
  });
});
