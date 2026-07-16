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

function seedUser(users: InMemoryUserRepository, role: "INVESTOR" | "SUBSCRIBER" | "ADMIN") {
  const id = `${role.toLowerCase()}-season-user`;
  users.seedUser({
    id,
    name: `${role} User`,
    email: `${role.toLowerCase()}-season@example.com`,
    passwordHash: "not-used",
    role,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });
  return jwt.sign({ role, email: `${role.toLowerCase()}-season@example.com` }, "test-secret", {
    subject: id,
    expiresIn: "1d",
  });
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

describe("season operating model routes", () => {
  it("returns the FPF OS season operating model to authenticated users", async () => {
    const { app, users } = testApp();
    const token = seedUser(users, "SUBSCRIBER");

    const response = await request(app)
      .get("/api/seasons/operating-model")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.platform).toBe("FPF OS");
    expect(response.body.currentSeason.status).toBe("REGISTRATION");
    expect(response.body.financialConstitution).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "PERFORMANCE_PARTNER_DISTRIBUTION_POOL", percent: 35 }),
        expect.objectContaining({ type: "RISK_STABILITY_RESERVE", percent: 15, distributable: false }),
      ]),
    );
  });

  it("protects Performance Partner participation routes from subscribers", async () => {
    const { app, users } = testApp();
    const token = seedUser(users, "SUBSCRIBER");

    await request(app)
      .get("/api/performance-partner/participation-model")
      .set("Authorization", `Bearer ${token}`)
      .expect(403);
  });

  it("simulates remaining-season participation without retroactive distributions", async () => {
    const { app, users } = testApp();
    const token = seedUser(users, "INVESTOR");

    const response = await request(app)
      .post("/api/performance-partner/participation-simulator")
      .set("Authorization", `Bearer ${token}`)
      .send({
        participationAmountCents: 100000,
        planCode: "REMAINING_SEASON",
        remainingWeeks: 12,
      })
      .expect(200);

    expect(response.body.simulation.remainingWeeks).toBe(12);
    expect(response.body.simulation.remainingDistributions).toBe(12);
    expect(response.body.simulation.notices.noRetroactiveDistribution).toContain("No retroactive distributions");
  });
});
