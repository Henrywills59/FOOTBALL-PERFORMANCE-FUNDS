import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { UserRole } from "@fpf/shared";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryAnalystRepository } from "../analyst/inMemoryAnalystRepository.js";
import { createApp } from "../app.js";
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
    adminToken: tokenFor(users, "ADMIN", "admin-infrastructure"),
    subscriberToken: tokenFor(users, "SUBSCRIBER", "subscriber-infrastructure"),
  };
}

describe("infrastructure control center routes", () => {
  it("returns the executive infrastructure control center for admins", async () => {
    const { app, adminToken } = testApp();

    const response = await request(app)
      .get("/api/admin/infrastructure")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.overview.totalProviders).toBeGreaterThan(0);
    expect(response.body.providers.map((provider: { name: string }) => provider.name)).toContain("Vercel");
    expect(response.body.renewals.length).toBeGreaterThan(0);
    expect(response.body.costs.monthlyRecurringCostCents).toBeGreaterThanOrEqual(0);
    expect(response.body.securityNotice).toContain("provider's official website");
  });

  it("blocks non-admin users from infrastructure controls", async () => {
    const { app, subscriberToken } = testApp();

    await request(app).get("/api/admin/infrastructure").expect(401);
    await request(app)
      .get("/api/admin/infrastructure")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(403);
  });

  it("stores provider registry records with safe external links only", async () => {
    const { app, adminToken } = testApp();

    await request(app)
      .post("/api/admin/infrastructure/providers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Unsafe Provider",
        category: "Analytics",
        servicePurpose: "Should be rejected",
        dashboardUrl: "http://unsafe.example.com",
      })
      .expect(400);

    const created = await request(app)
      .post("/api/admin/infrastructure/providers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Analytics Placeholder",
        category: "Analytics",
        servicePurpose: "Future analytics provider comparison.",
        providerWebsite: "https://analytics.example.com",
        dashboardUrl: "https://analytics.example.com/dashboard",
        billingUrl: "https://analytics.example.com/billing",
        renewalUrl: "https://analytics.example.com/renew",
        documentationUrl: "https://analytics.example.com/docs",
        monthlyCostCents: 1200,
      })
      .expect(201);

    expect(created.body.provider.name).toBe("Analytics Placeholder");
    expect(created.body.provider.dashboardUrl).toContain("https://analytics.example.com");
  });

  it("returns credential metadata without exposing raw secrets", async () => {
    const { app, adminToken } = testApp();

    const response = await request(app)
      .get("/api/admin/infrastructure/credentials")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const serialized = JSON.stringify(response.body);
    expect(response.body.credentials.length).toBeGreaterThan(0);
    expect(serialized).toContain("maskedIdentifier");
    expect(serialized).not.toContain("rawCredential");
    expect(serialized).not.toContain("apiKey");
    expect(serialized).not.toContain("password");
  });

  it("supports connection checks and procurement placeholders", async () => {
    const { app, adminToken } = testApp();

    const providerTest = await request(app)
      .post("/api/admin/infrastructure/providers/provider_vercel/test")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(providerTest.body.rawCredentialReturned).toBe(false);

    const procurement = await request(app)
      .post("/api/admin/infrastructure/procurement")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        businessNeed: "Uptime monitoring",
        requestedProvider: "Better Stack",
        alternativeProviders: ["Pingdom"],
        recommendedPlan: "Team placeholder",
        estimatedMonthlyCostCents: 3000,
      })
      .expect(201);

    expect(procurement.body.procurement.status).toBe("IDENTIFIED");
  });
});
