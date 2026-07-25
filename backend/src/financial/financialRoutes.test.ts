import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryAnalystRepository } from "../analyst/inMemoryAnalystRepository.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";
import { InMemoryFinancialRepository } from "./inMemoryFinancialRepository.js";
import type { UserRole } from "@fpf/shared";

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
    financialRepository: new InMemoryFinancialRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });

  return {
    app,
    adminToken: tokenFor(users, "ADMIN", "admin-user"),
    subscriberToken: tokenFor(users, "SUBSCRIBER", "subscriber-user"),
  };
}

describe("financial engine routes", () => {
  it("protects financial calculations from non-admin users", async () => {
    const { app, subscriberToken } = testApp();

    await request(app).get("/api/admin/financial-engine").expect(401);
    await request(app).get("/api/admin/financial-engine").set("Authorization", `Bearer ${subscriberToken}`).expect(403);
  });

  it("calculates eligible profit and allocates the 35/15/15/35 policy", async () => {
    const { app, adminToken } = testApp();

    const response = await request(app)
      .post("/api/admin/financial-engine/weekly-distributions/calculate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        weekLabel: "2026-W32",
        grossReturnsCents: 200000,
        returnedStakeCents: 100000,
        totalStakeCents: 100000,
        totalLossesCents: 10000,
        operatingAdjustmentsCents: 5000,
        analystContributions: [
          { analystId: "analyst-1", analystName: "Analyst One", contributionScore: 70 },
          { analystId: "analyst-2", analystName: "Analyst Two", contributionScore: 30 },
        ],
      })
      .expect(201);

    const run = response.body.run;
    expect(run.eligibleProfitCents).toBe(85000);
    expect(run.allocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ allocationType: "PERFORMANCE_PARTNER_POOL", percent: 35, amountCents: 29750 }),
        expect.objectContaining({ allocationType: "ANALYST_PERFORMANCE_POOL", percent: 15, amountCents: 12750 }),
        expect.objectContaining({ allocationType: "RISK_STABILITY_RESERVE", percent: 15, amountCents: 12750 }),
        expect.objectContaining({ allocationType: "COMPANY_GROWTH_OPERATIONS_FUND", percent: 35, amountCents: 29750 }),
      ]),
    );
    expect(run.partnerDistributions.length).toBeGreaterThan(0);
    expect(run.analystRewards).toHaveLength(2);
    expect(run.reserveLedgerEntries[0].amountCents).toBe(12750);
    expect(run.companyGrowthLedgerEntries[0].amountCents).toBe(29750);
    expect(run.auditRecords).toEqual(expect.arrayContaining([expect.objectContaining({ action: "ELIGIBLE_PROFIT_CALCULATED" })]));
  });

  it("exposes reports, audit records and overview after a run", async () => {
    const { app, adminToken } = testApp();

    await request(app)
      .post("/api/admin/financial-engine/weekly-distributions/calculate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ weekLabel: "2026-W33", grossReturnsCents: 150000, returnedStakeCents: 100000 })
      .expect(201);

    const overview = await request(app).get("/api/admin/financial-engine").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(overview.body.latestRun.weekLabel).toBe("2026-W33");
    expect(overview.body.totals.performancePartnerPoolCents).toBe(17500);

    const reports = await request(app).get("/api/admin/financial-engine/reports").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(reports.body.reports).toHaveLength(1);

    const audit = await request(app).get("/api/admin/financial-engine/audit-records").set("Authorization", `Bearer ${adminToken}`).expect(200);
    expect(audit.body.records.length).toBeGreaterThanOrEqual(2);
  });
});
