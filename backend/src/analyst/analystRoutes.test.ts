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
import { InMemoryAnalystRepository } from "./inMemoryAnalystRepository.js";

function seedUser(users: InMemoryUserRepository, role: "ANALYST" | "ADMIN" | "SUBSCRIBER") {
  const id = `${role.toLowerCase()}-intelligence-user`;
  users.seedUser({
    id,
    name: `${role} User`,
    email: `${role.toLowerCase()}-intelligence@example.com`,
    passwordHash: "not-used",
    role,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });
  return jwt.sign({ role, email: `${role.toLowerCase()}@example.com` }, "test-secret", {
    subject: id,
    expiresIn: "1d",
  });
}

async function testApp() {
  const users = new InMemoryUserRepository();
  const footballRepository = new InMemoryFootballRepository();
  const adminRepository = new InMemoryAdminRepository();
  const analystRepository = new InMemoryAnalystRepository();
  await footballRepository.upsertFixture({
    apiFootballFixtureId: 9001,
    league: { apiFootballLeagueId: 39, name: "Premier League", season: 2026 },
    homeTeam: { apiFootballTeamId: 1, name: "North FC" },
    awayTeam: { apiFootballTeamId: 2, name: "South FC" },
    season: 2026,
    kickoffAt: new Date("2026-08-01T15:00:00.000Z"),
    status: "SCHEDULED",
    raw: {},
  });
  await footballRepository.upsertStanding({
    leagueApiId: 39,
    season: 2026,
    teamApiId: 1,
    teamName: "North FC",
    rank: 2,
    points: 24,
    played: 10,
    won: 7,
    drawn: 3,
    lost: 0,
    goalsFor: 20,
    goalsAgainst: 7,
    raw: {},
  });
  await footballRepository.upsertOdd({
    fixtureApiId: 9001,
    bookmaker: "Book",
    market: "Match Winner",
    outcome: "North FC",
    price: 1.9,
    raw: {},
  });
  const app = createApp({
    userRepository: users,
    footballRepository,
    predictionRepository: new InMemoryPredictionRepository([]),
    adminRepository,
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository: new InMemoryWalletRepository(),
    analystRepository,
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });
  return { adminRepository, analystRepository, app, users };
}

const submissionBody = {
  fixtureId: "9001",
  leagueName: "Premier League",
  market: "Match Winner",
  prediction: "North FC",
  confidence: 68,
  riskLevel: "Medium",
  detailedReasoning: "North FC has stronger league position and recent underlying data.",
  supportingStatistics: "North FC: 24 points from 10 matches.",
  sourceNotes: "API-Football standings and synchronized odds.",
  briefExplanation: "FPF sees a measured edge on North FC.",
  recommendedStake: "1 unit",
  status: "PENDING_REVIEW",
};

describe("analyst intelligence routes", () => {
  it("requires analysts to be assigned before submitting intelligence", async () => {
    const { app, users } = await testApp();
    const analystToken = seedUser(users, "ANALYST");

    await request(app)
      .post("/api/analyst/intelligence")
      .set("Authorization", `Bearer ${analystToken}`)
      .send(submissionBody)
      .expect(403);
  });

  it("publishes only sanitized FPF intelligence to subscribers", async () => {
    const { adminRepository, app, users } = await testApp();
    const adminToken = seedUser(users, "ADMIN");
    const analystToken = seedUser(users, "ANALYST");
    const subscriberToken = seedUser(users, "SUBSCRIBER");

    await request(app)
      .post("/api/admin/intelligence/assign")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        analystId: "analyst-intelligence-user",
        fixtureId: "9001",
        leagueName: "Premier League",
        adminNotes: "Internal focus: verify injury status before kickoff.",
      })
      .expect(201);

    const created = await request(app)
      .post("/api/analyst/intelligence")
      .set("Authorization", `Bearer ${analystToken}`)
      .send(submissionBody)
      .expect(201);

    await request(app)
      .post(`/api/admin/intelligence/${created.body.submission.id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    await request(app)
      .post(`/api/admin/intelligence/${created.body.submission.id}/publish`)
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const published = await request(app)
      .get("/api/intelligence/published")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(200);

    expect(published.body.intelligence[0]).toMatchObject({
      market: "Match Winner",
      prediction: "North FC",
      riskRating: "Medium",
      recommendedStake: "1 unit",
    });
    expect(published.body.intelligence[0]).not.toHaveProperty("adminNotes");
    expect(published.body.intelligence[0]).not.toHaveProperty("sourceNotes");
    expect(published.body.intelligence[0]).not.toHaveProperty("detailedReasoning");
    expect(published.body.intelligence[0]).not.toHaveProperty("analystName");
    expect(adminRepository.logs.map((log) => log.action)).toContain("INTELLIGENCE_PUBLISHED");
  });

  it("provides assistance from synchronized football data", async () => {
    const { app, users } = await testApp();
    const analystToken = seedUser(users, "ANALYST");

    const assistance = await request(app)
      .get("/api/analyst/fixtures/9001/assistance")
      .set("Authorization", `Bearer ${analystToken}`)
      .expect(200);

    expect(assistance.body.teamFormSummary).toContain("North FC");
    expect(assistance.body.oddsMovement).toContain("Match Winner");
  });

  it("supports internal analyst academy workflow and blocks subscribers from analyst data", async () => {
    const { app, users } = await testApp();
    const adminToken = seedUser(users, "ADMIN");
    const analystToken = seedUser(users, "ANALYST");
    const subscriberToken = seedUser(users, "SUBSCRIBER");

    const application = await request(app)
      .post("/api/analyst-applications")
      .send({
        fullName: "Internal Candidate",
        email: "candidate@example.com",
        country: "Uganda",
        footballExperience: "Ten years studying European and African football markets.",
        preferredLeagues: ["Premier League", "La Liga"],
        yearsOfExperience: 10,
        countriesCovered: ["Uganda", "England", "Spain"],
        predictionStyle: "Risk-managed market analysis",
        motivationStatement: "I want to contribute disciplined internal intelligence to the FPF platform.",
      })
      .expect(201);

    await request(app)
      .patch(`/api/admin/analyst-applications/${application.body.application.id}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "APPROVED_FOR_ACADEMY", adminNotes: "Approved for academy." })
      .expect(200);

    await request(app)
      .post("/api/analyst/predictions")
      .set("Authorization", `Bearer ${analystToken}`)
      .send({
        matchName: "North FC vs South FC",
        leagueName: "Premier League",
        market: "MATCH_WINNER",
        prediction: "North FC",
        confidence: 66,
        riskLevel: "MEDIUM",
        explanation: "North FC has stronger form and better defensive stability.",
        supportingNotes: "Demo prediction for academy evaluation only.",
      })
      .expect(201);

    const performance = await request(app)
      .get("/api/analyst/performance")
      .set("Authorization", `Bearer ${analystToken}`)
      .expect(200);

    expect(performance.body.reliability.analystReliabilityIndex).toBeGreaterThanOrEqual(0);
    expect(performance.body.demoPredictions[0].market).toBe("MATCH_WINNER");

    await request(app)
      .post("/api/admin/analyst/promote")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ analystId: "analyst-intelligence-user", adminNotes: "Promoted from academy test." })
      .expect(200);

    const rewards = await request(app)
      .post("/api/admin/analyst/reward-calculate")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(rewards.body.rewardPoolPercent).toBe(20);
    expect(rewards.body.analysts.length).toBeGreaterThan(0);

    await request(app)
      .get("/api/analysts")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(403);
  });

  it("keeps the Intelligence War Room private to admins and analysts", async () => {
    const { app, users } = await testApp();
    const adminToken = seedUser(users, "ADMIN");
    const analystToken = seedUser(users, "ANALYST");
    const subscriberToken = seedUser(users, "SUBSCRIBER");

    const adminWarRoom = await request(app)
      .get("/api/war-room")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(adminWarRoom.body.rulebook.minimumOdds).toBe(1.6);
    expect(adminWarRoom.body.rulebook.maximumOdds).toBe(2);
    expect(adminWarRoom.body.alerts.length).toBeGreaterThan(0);

    await request(app)
      .get("/api/war-room")
      .set("Authorization", `Bearer ${analystToken}`)
      .expect(200);

    await request(app)
      .get("/api/war-room")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(403);
  });
});
