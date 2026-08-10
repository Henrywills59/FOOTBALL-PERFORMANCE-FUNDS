import request from "supertest";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { InMemoryAdminRepository } from "./admin/inMemoryAdminRepository.js";
import { InMemoryAnalystRepository } from "./analyst/inMemoryAnalystRepository.js";
import { InMemoryUserRepository } from "./auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "./football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "./investor/inMemoryInvestorRepository.js";
import { InMemoryPredictionRepository } from "./predictions/inMemoryPredictionRepository.js";
import { InMemoryWalletRepository } from "./wallet/inMemoryWalletRepository.js";

function testApp() {
  const users = new InMemoryUserRepository();
  users.seedUser({
    id: "admin-routing-user",
    name: "Routing Admin",
    email: "routing-admin@example.com",
    passwordHash: "not-used",
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  });
  const app = createApp({
    userRepository: users,
    footballRepository: new InMemoryFootballRepository(),
    predictionRepository: new InMemoryPredictionRepository([]),
    adminRepository: new InMemoryAdminRepository(),
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository: new InMemoryWalletRepository(),
    analystRepository: new InMemoryAnalystRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });
  const adminToken = jwt.sign({ role: "ADMIN", email: "routing-admin@example.com" }, "test-secret", {
    subject: "admin-routing-user",
    expiresIn: "1d",
  });

  return { app, adminToken };
}

function bareTestApp() {
  return createApp({
    userRepository: new InMemoryUserRepository(),
    footballRepository: new InMemoryFootballRepository(),
    predictionRepository: new InMemoryPredictionRepository([]),
    adminRepository: new InMemoryAdminRepository(),
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository: new InMemoryWalletRepository(),
    analystRepository: new InMemoryAnalystRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });
}

describe("production routing", () => {
  it("serves root and health checks through the Express app", async () => {
    const app = bareTestApp();

    const root = await request(app).get("/").expect(200);
    expect(root.body.status).toBe("ok");

    const health = await request(app).get("/health").expect(200);
    expect(health.body.status).toBe("ok");

    const apiHealth = await request(app).get("/api/health").expect(200);
    expect(apiHealth.body.status).toBe("ok");
  });

  it("serves safe production debug config", async () => {
    const { app, adminToken } = testApp();
    await request(app).get("/api/debug/config").expect(401);

    const response = await request(app)
      .get("/api/debug/config")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body.status).toBe("ok");
    expect(response.body.databaseUrlConfigured).toEqual(expect.any(Boolean));
    expect(response.body.jwtSecretConfigured).toEqual(expect.any(Boolean));
    expect(response.body.allowedOrigins).toEqual(
      expect.arrayContaining([
        "https://football-performance-fund-frontend.vercel.app",
        "https://football-performance-funds-frontend.vercel.app",
      ]),
    );
    expect(JSON.stringify(response.body)).not.toContain("DATABASE_URL");
  });
});
