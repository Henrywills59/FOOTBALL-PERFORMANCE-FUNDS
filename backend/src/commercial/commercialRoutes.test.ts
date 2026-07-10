import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { createApp } from "../app.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";

function seedUser(users: InMemoryUserRepository, role: "ADMIN" | "SUBSCRIBER") {
  const id = `${role.toLowerCase()}-commercial-user`;
  users.seedUser({
    id,
    name: `${role} User`,
    email: `${role.toLowerCase()}-commercial@example.com`,
    passwordHash: "not-used",
    role,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });
  return jwt.sign({ role }, "test-secret", { subject: id, expiresIn: "1d" });
}

function testApp() {
  const users = new InMemoryUserRepository();
  const app = createApp({
    userRepository: users,
    footballRepository: new InMemoryFootballRepository(),
    predictionRepository: new InMemoryPredictionRepository([]),
    adminRepository: new InMemoryAdminRepository(),
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository: new InMemoryWalletRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });
  return { app, users };
}

describe("commercial routes", () => {
  it("returns subscription plans, investor levels, and lock periods", async () => {
    const { app } = testApp();
    const response = await request(app).get("/api/commercial/structure").expect(200);

    expect(response.body.subscriberPlans.map((plan: { code: string }) => plan.code)).toEqual(["STARTER", "PRO", "ELITE"]);
    expect(response.body.minimumInvestmentCents).toBe(10000);
    expect(response.body.investorLevels.map((level: { name: string }) => level.name)).toContain("Diamond");
    expect(response.body.lockPeriods).toHaveLength(2);
  });

  it("restricts commercial settings to admins", async () => {
    const { app, users } = testApp();
    const subscriberToken = seedUser(users, "SUBSCRIBER");
    const adminToken = seedUser(users, "ADMIN");

    await request(app)
      .post("/api/admin/commercial/settings")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .send({ minimumInvestmentCents: 10000 })
      .expect(403);

    const response = await request(app)
      .post("/api/admin/commercial/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        minimumInvestmentCents: 25000,
        enabledLockPeriods: ["SIX_MONTHS"],
        defaultSimulationWeeklyReturnPercent: 1,
        defaultPlatformFeePercent: 8,
      })
      .expect(200);

    expect(response.body.minimumInvestmentCents).toBe(25000);
    expect(response.body.enabledLockPeriods).toEqual(["SIX_MONTHS"]);
  });
});
