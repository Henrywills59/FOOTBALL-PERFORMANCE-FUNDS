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
import { OpenAiProvider } from "./openAiProvider.js";
import { NotificationDeliveryService } from "./notificationProviders.js";

function adminApp() {
  const users = new InMemoryUserRepository();
  users.seedUser({
    id: "admin-integrations",
    name: "Admin",
    email: "admin-integrations@example.com",
    passwordHash: "unused",
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });
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
  const token = jwt.sign({ role: "ADMIN", email: "admin-integrations@example.com" }, "test-secret", {
    subject: "admin-integrations",
    expiresIn: "1d",
  });
  return { app, token };
}

describe("production integration providers", () => {
  it("returns safe OpenAI fallback when the API key is absent", async () => {
    delete process.env.OPENAI_API_KEY;
    const provider = new OpenAiProvider();
    const insight = await provider.generateInsight({
      task: "CONTRADICTION_DETECTION",
      prompt: "Check contradictions",
      context: { confidence: 80, risk: "HIGH" },
    });

    expect(provider.status().configured).toBe(false);
    expect(insight.mode).toBe("SAFE_FALLBACK");
    expect(insight.text).toContain("Safe fallback");
  });

  it("reports notification provider configuration without exposing secrets", () => {
    const delivery = new NotificationDeliveryService();
    const status = delivery.status();

    expect(status.email).toHaveProperty("configured");
    expect(status.sms).toHaveProperty("missingVariables");
    expect(JSON.stringify(status)).not.toContain("secret");
  });

  it("exposes admin-only integration diagnostics and readiness status", async () => {
    const { app, token } = adminApp();

    await request(app)
      .get("/api/intelligence/ai/status")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    await request(app)
      .get("/api/admin/notifications/providers")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    await request(app)
      .post("/api/football/odds/diagnostics")
      .set("Authorization", `Bearer ${token}`)
      .expect(503);

    const readiness = await request(app)
      .get("/api/production/readiness")
      .expect(503);
    expect(readiness.body.status).toBe("ACTION_REQUIRED");
    expect(readiness.body.providers.openAi.configured).toBe(false);
  });
});
