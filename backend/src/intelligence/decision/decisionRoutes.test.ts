import request from "supertest";
import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { createApp } from "../../app.js";
import { InMemoryAdminRepository } from "../../admin/inMemoryAdminRepository.js";
import { InMemoryAnalystRepository } from "../../analyst/inMemoryAnalystRepository.js";
import { InMemoryUserRepository } from "../../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../../football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "../../investor/inMemoryInvestorRepository.js";
import { InMemoryPredictionRepository } from "../../predictions/inMemoryPredictionRepository.js";
import { InMemoryWalletRepository } from "../../wallet/inMemoryWalletRepository.js";

function buildApp() {
  const footballRepository = new InMemoryFootballRepository();
  const userRepository = new InMemoryUserRepository();
  const app = createApp({
    userRepository,
    footballRepository,
    predictionRepository: new InMemoryPredictionRepository([]),
    analystRepository: new InMemoryAnalystRepository(),
    adminRepository: new InMemoryAdminRepository(),
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository: new InMemoryWalletRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });

  return { app, footballRepository, userRepository };
}

async function register(app: ReturnType<typeof createApp>, role: "SUBSCRIBER" | "INVESTOR" | "ANALYST") {
  if (role === "ANALYST") {
    throw new Error("Use seedInternalUser for internal analyst test accounts.");
  }

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

function seedInternalUser(users: InMemoryUserRepository, role: "ANALYST" | "ADMIN") {
  const suffix = Math.random().toString(36).slice(2);
  const id = `${role.toLowerCase()}-${suffix}`;
  const email = `${role.toLowerCase()}-${suffix}@example.com`;
  users.seedUser({
    id,
    name: `${role} User`,
    email,
    passwordHash: "not-used",
    role,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });

  return jwt.sign({ role, email }, "test-secret", {
    subject: id,
    expiresIn: "1d",
  });
}

describe("decision engine routes", () => {
  it("protects decision routes by role", async () => {
    const { app } = buildApp();
    await request(app).get("/api/intelligence/decision/health").expect(401);
    const investorToken = await register(app, "INVESTOR");

    await request(app)
      .get("/api/intelligence/decision/opportunities")
      .set("Authorization", `Bearer ${investorToken}`)
      .expect(403);
  }, 15000);

  it("returns health and missing-data match decisions without HTTP 500", async () => {
    const { app } = buildApp();
    const token = await register(app, "SUBSCRIBER");

    const health = await request(app)
      .get("/api/intelligence/decision/health")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const decision = await request(app)
      .get("/api/intelligence/decision/match/missing")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(health.body.service).toBe("fpf-ai-decision-engine");
    expect(decision.body.decision.status).toBe("REJECTED");
    expect(decision.body.decision.dataQualityStatus).toBe("INSUFFICIENT_DATA");
  }, 15000);

  it("returns opportunities and lets analysts recalculate", async () => {
    const { app, footballRepository, userRepository } = buildApp();
    await footballRepository.upsertFixture({
      apiFootballFixtureId: 9201,
      league: { apiFootballLeagueId: 39, name: "Premier League", country: "England", season: 2026 },
      homeTeam: { apiFootballTeamId: 1, name: "Home FC" },
      awayTeam: { apiFootballTeamId: 2, name: "Away FC" },
      season: 2026,
      kickoffAt: new Date(`${new Date().toISOString().slice(0, 10)}T18:00:00.000Z`),
      status: "SCHEDULED",
      raw: {},
    });
    const subscriberToken = await register(app, "SUBSCRIBER");
    const analystToken = seedInternalUser(userRepository, "ANALYST");

    const opportunities = await request(app)
      .get("/api/intelligence/decision/opportunities?limit=5")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(200);
    const recalculated = await request(app)
      .post("/api/intelligence/decision/recalculate")
      .set("Authorization", `Bearer ${analystToken}`)
      .send({ fixtureIds: ["9201"] })
      .expect(200);

    expect(opportunities.body.decisions).toHaveLength(1);
    expect(recalculated.body.recalculated).toBe(1);
  }, 15000);
});
