import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
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
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

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
    expect(insight.structured.riskWarnings[0]).toContain("cannot approve selections");
  });

  it("reports Infobip notification provider configuration without exposing secrets", () => {
    process.env.INFOBIP_API_KEY = "test-infobip-key";
    process.env.INFOBIP_BASE_URL = "https://example.infobip.com";
    delete process.env.EMAIL_PROVIDER;
    delete process.env.SMS_PROVIDER;

    const delivery = new NotificationDeliveryService();
    const status = delivery.status();

    expect(status.email.provider).toBe("INFOBIP");
    expect(status.sms.provider).toBe("INFOBIP");
    expect(status.email.configured).toBe(true);
    expect(status.sms.configured).toBe(true);
    expect(JSON.stringify(status)).not.toContain("test-infobip-key");
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

    await request(app)
      .get("/api/football/odds/markets")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const competitions = await request(app)
      .get("/api/football/odds/competitions")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(competitions.body.ok).toBe(false);

    const readiness = await request(app)
      .get("/api/production/readiness")
      .expect(503);
    expect(readiness.body.status).toBe("ACTION_REQUIRED");
    expect(readiness.body.providers.openAi.configured).toBe(false);
  });
});
