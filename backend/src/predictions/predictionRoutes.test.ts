import request from "supertest";
import { describe, expect, it } from "vitest";
import type { FootballFixtureDetail } from "@fpf/shared";
import jwt from "jsonwebtoken";
import { createApp } from "../app.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { PredictionEngine } from "./predictionEngine.js";
import { InMemoryPredictionRepository } from "./inMemoryPredictionRepository.js";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";

function fixture(overrides: Partial<FootballFixtureDetail> = {}): FootballFixtureDetail {
  return {
    id: "fixture-1",
    apiFootballFixtureId: 1001,
    leagueName: "Premier League",
    homeTeamName: "Home FC",
    awayTeamName: "Away FC",
    kickoffAt: "2026-08-01T18:00:00.000Z",
    status: "SCHEDULED",
    homeScore: null,
    awayScore: null,
    venue: "Main Ground",
    season: 2026,
    round: "Regular Season - 1",
    referee: null,
    standings: [
      { teamName: "Home FC", rank: 1, points: 60, played: 20, won: 18, drawn: 6, lost: 2 },
      { teamName: "Away FC", rank: 15, points: 24, played: 20, won: 5, drawn: 4, lost: 11 },
    ],
    injuries: [{ playerName: "Away Defender", teamName: "Away FC", reason: "Knock" }],
    odds: [
      {
        id: "odd-1",
        bookmaker: "Bookmaker",
        market: "h2h",
        outcome: "Home FC",
        price: 2.2,
        updatedAt: new Date().toISOString(),
      },
    ],
    headToHeadRecords: [{ id: "h2h-1", updatedAt: new Date().toISOString() }],
    ...overrides,
  };
}

async function authToken(app: ReturnType<typeof createApp>, role: "SUBSCRIBER" | "ANALYST" | "ADMIN") {
  const suffix = Math.random().toString(36).slice(2);
  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: `${role} User`,
      email: `${role.toLowerCase()}-${suffix}@example.com`,
      password: "Password123",
      role: role === "ADMIN" ? "ANALYST" : role,
    })
    .expect(201);

  return response.body.token as string;
}

function adminToken(users: InMemoryUserRepository) {
  users.seedUser({
    id: "admin-user",
    name: "Admin User",
    email: "admin@example.com",
    passwordHash: "not-used",
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });

  return jwt.sign({ role: "ADMIN", email: "admin@example.com" }, "test-secret", {
    subject: "admin-user",
    expiresIn: "1d",
  });
}

describe("prediction engine", () => {
  it("returns Insufficient data when required football data is missing", () => {
    const result = new PredictionEngine().analyzeFixture(
      fixture({ standings: [], odds: [], headToHeadRecords: [] }),
    );

    expect(result.predictedOutcome).toBe("Insufficient data");
    expect(result.dataQualityStatus).toBe("INSUFFICIENT_DATA");
    expect(result.confidenceScore).toBe(0);
  });

  it("identifies positive value when model probability beats bookmaker implied probability", () => {
    const result = new PredictionEngine().analyzeFixture(fixture());

    expect(result.dataQualityStatus).toBe("READY");
    expect(result.edge).toBeGreaterThan(0.05);
    expect(result.valueRating).not.toBe("NONE");
    expect(result.explanation).toContain("not a guarantee");
  });
});

describe("prediction routes", () => {
  it("keeps generated predictions pending until admin approval", async () => {
    const predictionRepository = new InMemoryPredictionRepository([fixture()]);
    const userRepository = new InMemoryUserRepository();
    const app = createApp({
      userRepository,
      footballRepository: new InMemoryFootballRepository(),
      predictionRepository,
      adminRepository: new InMemoryAdminRepository(),
      investorRepository: new InMemoryInvestorRepository(),
      walletRepository: new InMemoryWalletRepository(),
      jwtSecret: "test-secret",
      startFootballJobs: false,
    });
    const analystToken = await authToken(app, "ANALYST");

    const generated = await request(app)
      .post("/api/predictions/fixtures/fixture-1/generate")
      .set("Authorization", `Bearer ${analystToken}`)
      .expect(201);

    expect(generated.body.prediction.approvalStatus).toBe("PENDING");

    const subscriberToken = await authToken(app, "SUBSCRIBER");
    await request(app)
      .get("/api/predictions/approved")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.predictions).toHaveLength(0);
      });

    const adminCapableToken = await authToken(app, "ANALYST");
    await request(app)
      .post(`/api/admin/predictions/${generated.body.prediction.id}/approve`)
      .set("Authorization", `Bearer ${adminCapableToken}`)
      .expect(403);

    await request(app)
      .post(`/api/admin/predictions/${generated.body.prediction.id}/approve`)
      .set("Authorization", `Bearer ${adminToken(userRepository)}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.prediction.approvalStatus).toBe("APPROVED");
      });

    await request(app)
      .get("/api/predictions/approved")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.predictions).toHaveLength(1);
      });
  }, 15000);
});
