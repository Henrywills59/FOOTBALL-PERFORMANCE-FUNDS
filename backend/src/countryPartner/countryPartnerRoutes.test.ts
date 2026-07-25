import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { UserRole } from "@fpf/shared";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { AuthService } from "../auth/authService.js";
import { errorHandler } from "../auth/authRoutes.js";
import { InMemoryCountryPartnerRepository } from "./repository.js";
import { createCountryPartnerRouter } from "./routes.js";
import { CountryPartnerService } from "./service.js";

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
  const authService = new AuthService(users, "test-secret");
  const countryPartnerRepository = new InMemoryCountryPartnerRepository();
  const countryPartnerService = new CountryPartnerService(countryPartnerRepository);
  const app = express();
  app.use(express.json());
  app.use("/api", createCountryPartnerRouter({ authService, countryPartnerService }));
  app.use(errorHandler);
  return {
    app,
    users,
    countryPartnerRepository,
    countryPartnerToken: tokenFor(users, "COUNTRY_PARTNER", "country-partner-1"),
    subscriberToken: tokenFor(users, "SUBSCRIBER", "subscriber-1"),
    adminToken: tokenFor(users, "ADMIN", "admin-1"),
  };
}

describe("country partner routes", () => {
  it("protects Country Partner portal routes", async () => {
    const { app, subscriberToken } = testApp();
    await request(app).get("/api/country-partner/dashboard").expect(401);
    await request(app).get("/api/country-partner/dashboard").set("Authorization", `Bearer ${subscriberToken}`).expect(403);
  });

  it("returns a safe dashboard for an authorised Country Partner", async () => {
    const { app, countryPartnerToken } = testApp();
    const response = await request(app)
      .get("/api/country-partner/dashboard")
      .set("Authorization", `Bearer ${countryPartnerToken}`)
      .expect(200);

    expect(response.body.profile.licenceStatus).toBe("PENDING");
    expect(response.body.licence.entryFeeNotice).toContain("not an investment");
    expect(response.body.performancePartnerActivity[0].status).toContain("contributed capital excluded");
    expect(response.body.cbv.totalCents).toBe(0);
  });

  it("creates territory-scoped leads and approved placeholder marketing content", async () => {
    const { app, countryPartnerToken } = testApp();
    const lead = await request(app)
      .post("/api/country-partner/leads")
      .set("Authorization", `Bearer ${countryPartnerToken}`)
      .send({ name: "Kampala Premium Lead", email: "lead@example.com", interestType: "SUBSCRIPTION", estimatedValueCents: 4900 })
      .expect(201);
    expect(lead.body.lead.status).toBe("NEW");

    const generated = await request(app)
      .post("/api/country-partner/marketing/daily-content")
      .set("Authorization", `Bearer ${countryPartnerToken}`)
      .send({ language: "en", campaignType: "Subscriber Campaign" })
      .expect(201);
    expect(generated.body.assets).toHaveLength(8);
    expect(generated.body.assets[0].approvedByHq).toBe(true);
    expect(generated.body.assets[0].caption).toContain("Results are never guaranteed");
  });

  it("allows HQ to review and update configurable commission and level settings", async () => {
    const { app, adminToken } = testApp();
    const overview = await request(app).get("/api/admin/country-partners").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(overview.body.rules.find((rule: { ruleCode: string }) => rule.ruleCode === "NET_SUBSCRIPTION_REVENUE_30")).toBeTruthy();

    const updated = await request(app)
      .put("/api/admin/country-partners/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        rules: [
          {
            ruleCode: "APPROVED_LOCAL_SERVICE_10",
            label: "Approved local service commission",
            revenueType: "APPROVED_LOCAL_SERVICE",
            percent: 10,
            active: true,
            notes: "Placeholder configurable local service rule.",
          },
        ],
        levels: [{ level: "Gold", minimumCbvCents: 20000000, active: true }],
      })
      .expect(200);

    expect(updated.body.rules.some((rule: { ruleCode: string }) => rule.ruleCode === "APPROVED_LOCAL_SERVICE_10")).toBe(true);
    expect(updated.body.levels.find((level: { level: string }) => level.level === "Gold").minimumCbvCents).toBe(20000000);
  });

  it("keeps HQ controls away from Country Partner accounts", async () => {
    const { app, countryPartnerToken } = testApp();
    await request(app).get("/api/admin/country-partners").set("Authorization", `Bearer ${countryPartnerToken}`).expect(403);
  });
});
