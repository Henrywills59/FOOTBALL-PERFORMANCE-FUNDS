import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { UserRole } from "@fpf/shared";
import { createApp } from "../app.js";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryAnalystRepository } from "../analyst/inMemoryAnalystRepository.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";

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

function testApp() {
  const users = new InMemoryUserRepository();
  const app = createApp({
    userRepository: users,
    adminRepository: new InMemoryAdminRepository(),
    analystRepository: new InMemoryAnalystRepository(),
    footballRepository: new InMemoryFootballRepository(),
    investorRepository: new InMemoryInvestorRepository(),
    predictionRepository: new InMemoryPredictionRepository([]),
    walletRepository: new InMemoryWalletRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });
  return {
    app,
    adminToken: tokenFor(users, "ADMIN", "admin-user"),
    analystToken: tokenFor(users, "ANALYST", "analyst-placeholder"),
    subscriberToken: tokenFor(users, "SUBSCRIBER", "subscriber-user"),
    investorToken: tokenFor(users, "INVESTOR", "investor-user"),
  };
}

describe("analytics routes", () => {
  it("returns the executive dashboard for admins", async () => {
    const { app, adminToken } = testApp();

    const response = await request(app)
      .get("/api/analytics/executive")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.executiveKpis.length).toBeGreaterThan(20);
    expect(response.body.analystLeaderboard.length).toBeGreaterThan(0);
    expect(response.body.aiInsights.length).toBeGreaterThan(0);
    expect(response.body.exportCenter[0].providerStatus).toBe("PLACEHOLDER_READY");
  });

  it("protects executive analytics from non-admin roles", async () => {
    const { app, analystToken, subscriberToken, investorToken } = testApp();

    await request(app).get("/api/analytics/executive").expect(401);
    await request(app).get("/api/analytics/executive").set("Authorization", `Bearer ${analystToken}`).expect(403);
    await request(app).get("/api/analytics/executive").set("Authorization", `Bearer ${subscriberToken}`).expect(403);
    await request(app).get("/api/analytics/executive").set("Authorization", `Bearer ${investorToken}`).expect(403);
  });

  it("allows analysts to view only private analytics", async () => {
    const { app, analystToken } = testApp();

    const response = await request(app)
      .get("/api/analytics/analyst/me")
      .set("Authorization", `Bearer ${analystToken}`)
      .expect(200);

    expect(response.body.analyst.analystId).toBe("analyst-placeholder");
    expect(response.body.aiRecommendations.length).toBeGreaterThan(0);
    expect(response.body).not.toHaveProperty("subscriberAnalytics");
    expect(response.body).not.toHaveProperty("investorAnalytics");
  });
});
