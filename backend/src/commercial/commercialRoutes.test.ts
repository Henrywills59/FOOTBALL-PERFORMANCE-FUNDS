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

function seedUser(users: InMemoryUserRepository, role: "ADMIN" | "SUBSCRIBER" | "INVESTOR") {
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

    expect(response.body.subscriberPlans.map((plan: { code: string }) => plan.code)).toContain("FREE_TRIAL");
    expect(response.body.subscriberPlans.map((plan: { code: string }) => plan.code)).toContain("ENTERPRISE");
    expect(response.body.minimumInvestmentCents).toBe(10000);
    expect(response.body.investorLevels.map((level: { name: string }) => level.name)).toContain("Diamond");
    expect(response.body.lockPeriods).toHaveLength(2);
    expect(response.body.investorPackages.map((item: { name: string }) => item.name)).toContain("Bronze");
    expect(response.body.pricingRules.length).toBeGreaterThan(0);
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

  it("supports subscription lifecycle placeholders for authenticated users", async () => {
    const { app, users } = testApp();
    const subscriberToken = seedUser(users, "SUBSCRIBER");

    const current = await request(app)
      .get("/api/subscriptions/me")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(200);

    expect(current.body.subscription.status).toBe("TRIAL");

    const changed = await request(app)
      .post("/api/subscriptions/change")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .send({ planCode: "PROFESSIONAL", billingCycle: "ANNUAL", action: "UPGRADE" })
      .expect(200);

    expect(changed.body.subscription.planCode).toBe("PROFESSIONAL");
    expect(changed.body.subscription.status).toBe("ACTIVE");
  });

  it("exposes investor packages and lock periods to investors", async () => {
    const { app, users } = testApp();
    const investorToken = seedUser(users, "INVESTOR");

    const packages = await request(app)
      .get("/api/investor/packages")
      .set("Authorization", `Bearer ${investorToken}`)
      .expect(200);
    expect(packages.body.packages).toHaveLength(5);

    const lockPeriods = await request(app)
      .get("/api/investor/lock-periods")
      .set("Authorization", `Bearer ${investorToken}`)
      .expect(200);
    expect(lockPeriods.body.lockPeriods.map((period: { code: string }) => period.code)).toEqual(["SIX_MONTHS", "TWELVE_MONTHS"]);
  });

  it("protects business controls and lets admins manage pricing, providers, and procurement placeholders", async () => {
    const { app, users } = testApp();
    const subscriberToken = seedUser(users, "SUBSCRIBER");
    const adminToken = seedUser(users, "ADMIN");

    await request(app)
      .get("/api/admin/commercial/control")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(403);

    const control = await request(app)
      .get("/api/admin/commercial/control")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
    expect(control.body.businessDashboard.systemHealth).toBe("READY");
    expect(control.body.infrastructureProviders.length).toBeGreaterThan(0);

    const updatedPackage = await request(app)
      .patch("/api/admin/commercial/investor-packages/pkg_bronze")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ visible: false, status: "PAUSED" })
      .expect(200);
    expect(updatedPackage.body.package.visible).toBe(false);

    await request(app)
      .post("/api/admin/commercial/pricing-rules")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Referral placeholder", currency: "USD", discountPercent: 5, promotionType: "REFERRAL" })
      .expect(201);

    await request(app)
      .post("/api/admin/infrastructure/providers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ providerName: "Analytics Placeholder", purpose: "Future analytics", category: "Analytics" })
      .expect(201);

    await request(app)
      .post("/api/admin/procurement")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ vendor: "Domain Vendor", plan: "Domain renewal", status: "RENEWAL_PENDING" })
      .expect(201);
  });
});
