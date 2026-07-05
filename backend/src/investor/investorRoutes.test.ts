import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryInvestorRepository } from "./inMemoryInvestorRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";

function seedUser(users: InMemoryUserRepository, role: "INVESTOR" | "SUBSCRIBER" | "ADMIN") {
  const id = `${role.toLowerCase()}-user`;
  users.seedUser({
    id,
    name: `${role} User`,
    email: `${role.toLowerCase()}@example.com`,
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

function testApp() {
  const users = new InMemoryUserRepository();
  const adminRepository = new InMemoryAdminRepository();
  const investorRepository = new InMemoryInvestorRepository();
  const app = createApp({
    userRepository: users,
    footballRepository: new InMemoryFootballRepository(),
    predictionRepository: new InMemoryPredictionRepository([]),
    adminRepository,
    investorRepository,
    walletRepository: new InMemoryWalletRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });
  return { app, adminRepository, investorRepository, users };
}

describe("investor routes", () => {
  it("restricts investor routes to investors", async () => {
    const { app, users } = testApp();
    const subscriberToken = seedUser(users, "SUBSCRIBER");

    await request(app)
      .get("/api/investor/dashboard")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(403);
  });

  it("creates investments only after risk disclosure acceptance", async () => {
    const { app, adminRepository, users } = testApp();
    const investorToken = seedUser(users, "INVESTOR");

    await request(app)
      .post("/api/investor/investments")
      .set("Authorization", `Bearer ${investorToken}`)
      .send({ planId: "starter", amountCents: 100000, riskAccepted: false })
      .expect(400);

    const response = await request(app)
      .post("/api/investor/investments")
      .set("Authorization", `Bearer ${investorToken}`)
      .send({ planId: "starter", amountCents: 100000, riskAccepted: true })
      .expect(201);

    expect(response.body.investment.status).toBe("ACTIVE");
    expect(adminRepository.logs.map((log) => log.action)).toContain("INVESTMENT_CREATED");
  });

  it("creates withdrawal requests pending admin approval", async () => {
    const { app, adminRepository, users } = testApp();
    const investorToken = seedUser(users, "INVESTOR");
    const adminToken = seedUser(users, "ADMIN");

    const requestResponse = await request(app)
      .post("/api/investor/withdrawals")
      .set("Authorization", `Bearer ${investorToken}`)
      .send({ amountCents: 50000 })
      .expect(201);

    expect(requestResponse.body.withdrawal.status).toBe("PENDING");

    await request(app)
      .post(`/api/admin/withdrawals/${requestResponse.body.withdrawal.id}/review`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "APPROVED", adminNotes: "Approved for processing." })
      .expect(200);

    expect(adminRepository.logs.map((log) => log.action)).toContain("WITHDRAWAL_APPROVED");
  });
});
