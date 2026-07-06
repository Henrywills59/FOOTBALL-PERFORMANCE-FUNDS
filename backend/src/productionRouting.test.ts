import request from "supertest";
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
    const app = testApp();

    const root = await request(app).get("/").expect(200);
    expect(root.body.status).toBe("ok");

    const health = await request(app).get("/health").expect(200);
    expect(health.body.status).toBe("ok");

    const apiHealth = await request(app).get("/api/health").expect(200);
    expect(apiHealth.body.status).toBe("ok");
  });

  it("serves safe production debug config", async () => {
    const response = await request(testApp()).get("/api/debug/config").expect(200);

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
