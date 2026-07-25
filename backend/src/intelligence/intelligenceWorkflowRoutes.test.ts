import request from "supertest";
import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { createApp } from "../app.js";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryAnalystRepository } from "../analyst/inMemoryAnalystRepository.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryPredictionWorkflowRepository } from "../predictionWorkflow/inMemoryPredictionWorkflowRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";

function buildApp() {
  const footballRepository = new InMemoryFootballRepository();
  const analystRepository = new InMemoryAnalystRepository();
  const userRepository = new InMemoryUserRepository();
  const app = createApp({
    userRepository,
    footballRepository,
    predictionRepository: new InMemoryPredictionRepository([]),
    predictionWorkflowRepository: new InMemoryPredictionWorkflowRepository(),
    analystRepository,
    adminRepository: new InMemoryAdminRepository(),
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository: new InMemoryWalletRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });

  return { app, analystRepository, userRepository };
}

async function register(app: ReturnType<typeof createApp>, role: "SUBSCRIBER" | "INVESTOR" | "ANALYST") {
  if (role === "ANALYST") {
    throw new Error("Use seedInternalUser for internal analyst test accounts.");
  }

  const response = await request(app)
    .post("/api/auth/register")
    .send({
      name: `${role} User`,
      email: `${role.toLowerCase()}-${Date.now()}-${Math.random()}@example.com`,
      password: "Password123",
      role,
    })
    .expect(201);

  return {
    token: response.body.token as string,
    userId: response.body.user.id as string,
  };
}

function seedInternalUser(users: InMemoryUserRepository, role: "ANALYST" | "ADMIN") {
  const userId = `${role.toLowerCase()}-${Date.now()}-${Math.random()}`;
  const email = `${role.toLowerCase()}-${Date.now()}@example.com`;
  users.seedUser({
    id: userId,
    name: `${role} User`,
    email,
    passwordHash: "not-used",
    role,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });

  return {
    token: jwt.sign({ role, email }, "test-secret", {
      subject: userId,
      expiresIn: "1d",
    }),
    userId,
  };
}

describe("intelligence workflow and analyst command centre", () => {
  it("protects workflow endpoints from non-intelligence roles", async () => {
    const { app } = buildApp();
    const investor = await register(app, "INVESTOR");

    await request(app)
      .post("/api/intelligence/workflow/scan")
      .set("Authorization", `Bearer ${investor.token}`)
      .send({ ingestMockFixtures: true })
      .expect(403);
  }, 15000);

  it("ingests mock fixtures, scans matches, scores candidates, and queues them", async () => {
    const { app, userRepository } = buildApp();
    const analyst = seedInternalUser(userRepository, "ANALYST");

    const scan = await request(app)
      .post("/api/intelligence/workflow/scan")
      .set("Authorization", `Bearer ${analyst.token}`)
      .send({ ingestMockFixtures: true, limit: 3 })
      .expect(200);

    const candidates = await request(app)
      .get("/api/intelligence/workflow/candidates")
      .set("Authorization", `Bearer ${analyst.token}`)
      .expect(200);

    expect(scan.body.workflow.mode).toBe("MOCK_PROVIDER");
    expect(scan.body.workflow.summary.fixturesIngested).toBe(3);
    expect(scan.body.workflow.summary.candidatesScored).toBeGreaterThan(0);
    expect(candidates.body.items.length).toBeGreaterThan(0);
    expect(candidates.body).toHaveProperty("verifiedSelections");
    expect(candidates.body).toHaveProperty("companyCapitalEligible");
    expect(candidates.body).toHaveProperty("financialEngineEligible");
  }, 15000);

  it("returns a safe analyst command centre with evidence and integration state", async () => {
    const { app, analystRepository, userRepository } = buildApp();
    const analyst = seedInternalUser(userRepository, "ANALYST");

    await request(app)
      .post("/api/intelligence/workflow/ingest-mock-fixtures")
      .set("Authorization", `Bearer ${analyst.token}`)
      .send({ limit: 1 })
      .expect(200);

    await analystRepository.createAssignment({
      analystId: analyst.userId,
      fixtureId: "970001",
      leagueName: "FPF Mock Premier Intelligence",
      adminNotes: "Review confidence, risk, and evidence before submission.",
    });

    const command = await request(app)
      .get("/api/analyst-command-centre")
      .set("Authorization", `Bearer ${analyst.token}`)
      .expect(200);

    expect(command.body.assignmentQueue).toHaveLength(1);
    expect(command.body.evidenceCollection[0].fixtureId).toBe("970001");
    expect(command.body.integrationStatus.companyCapitalDesk).toBe("READY");
    expect(command.body.integrationStatus.financialEngine).toBe("READY");
  }, 15000);
});
