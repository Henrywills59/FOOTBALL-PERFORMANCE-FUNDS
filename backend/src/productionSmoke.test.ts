import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { InMemoryAdminRepository } from "./admin/inMemoryAdminRepository.js";
import { InMemoryAnalystRepository } from "./analyst/inMemoryAnalystRepository.js";
import { InMemoryUserRepository } from "./auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "./football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "./investor/inMemoryInvestorRepository.js";
import { InMemoryPredictionRepository } from "./predictions/inMemoryPredictionRepository.js";
import { InMemoryWalletRepository } from "./wallet/inMemoryWalletRepository.js";

describe("production smoke test", () => {
  it("serves health and protected subscriber data", async () => {
    const users = new InMemoryUserRepository();
    users.seedUser({
      id: "subscriber-smoke-user",
      name: "Subscriber Smoke",
      email: "subscriber-smoke@example.com",
      passwordHash: "not-used",
      role: "SUBSCRIBER",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    });
    const footballRepository = new InMemoryFootballRepository();
    await footballRepository.upsertFixture({
      apiFootballFixtureId: 7001,
      league: { apiFootballLeagueId: 39, name: "Premier League", country: "England", season: 2026 },
      homeTeam: { apiFootballTeamId: 10, name: "FPF Home" },
      awayTeam: { apiFootballTeamId: 11, name: "FPF Away" },
      season: 2026,
      kickoffAt: new Date("2026-08-01T18:00:00.000Z"),
      status: "SCHEDULED",
      raw: {},
    });
    const app = createApp({
      userRepository: users,
      footballRepository,
      predictionRepository: new InMemoryPredictionRepository([]),
      adminRepository: new InMemoryAdminRepository(),
      investorRepository: new InMemoryInvestorRepository(),
      walletRepository: new InMemoryWalletRepository(),
      analystRepository: new InMemoryAnalystRepository(),
      jwtSecret: "test-secret",
      startFootballJobs: false,
    });
    const token = jwt.sign({ role: "SUBSCRIBER", email: "subscriber-smoke@example.com" }, "test-secret", {
      subject: "subscriber-smoke-user",
      expiresIn: "1d",
    });

    await request(app).get("/health").expect(200);
    const previousDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    const dbHealth = await request(app).get("/health/db").expect(503);
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;

    expect(dbHealth.body).toMatchObject({
      status: "degraded",
      databaseUrlConfigured: false,
      jwtSecretConfigured: false,
      prisma: {
        ok: false,
        message: "DATABASE_URL is not configured.",
      },
    });

    const fixtures = await request(app)
      .get("/api/football/fixtures")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(fixtures.body.fixtures[0]).toMatchObject({
      leagueCountry: "England",
      homeTeamName: "FPF Home",
    });
  });
});
