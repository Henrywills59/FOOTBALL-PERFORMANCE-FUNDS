import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryAnalystRepository } from "../analyst/inMemoryAnalystRepository.js";
import { createApp } from "../app.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryMediaRepository } from "./repository.js";
import { InMemoryOperationsRepository } from "../operations/repository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";

function seedUser(users: InMemoryUserRepository, role: "ADMIN" | "SUBSCRIBER" | "ANALYST") {
  const id = `${role.toLowerCase()}-media-user`;
  users.seedUser({
    id,
    name: `${role} User`,
    email: `${role.toLowerCase()}-media@example.com`,
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
    analystRepository: new InMemoryAnalystRepository(),
    operationsRepository: new InMemoryOperationsRepository(),
    mediaRepository: new InMemoryMediaRepository(),
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });
  return { app, users };
}

describe("media command center routes", () => {
  it("protects admin media dashboard and exposes placeholder provider health", async () => {
    const { app, users } = testApp();
    const subscriberToken = seedUser(users, "SUBSCRIBER");
    const adminToken = seedUser(users, "ADMIN");

    await request(app)
      .get("/api/admin/media/dashboard")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(403);

    const dashboard = await request(app)
      .get("/api/admin/media/dashboard")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(dashboard.body.campaignOverview.total).toBe(0);
    expect(dashboard.body.platformHealth.length).toBeGreaterThan(0);
    expect(dashboard.body.platformHealth[0].mode).toBe("PLACEHOLDER");
  });

  it("lets analysts create drafts while admin controls campaign and publication workflow", async () => {
    const { app, users } = testApp();
    const analystToken = seedUser(users, "ANALYST");
    const adminToken = seedUser(users, "ADMIN");

    const campaign = await request(app)
      .post("/api/admin/media/campaigns")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Subscriber Education Launch",
        type: "EDUCATION",
        status: "DRAFT",
        objective: "Explain institutional football intelligence.",
        budgetCents: 0,
      })
      .expect(201);

    const post = await request(app)
      .post("/api/media/posts")
      .set("Authorization", `Bearer ${analystToken}`)
      .send({
        campaignId: campaign.body.campaign.id,
        title: "Why confidence is not certainty",
        contentType: "EDUCATIONAL_POST",
        status: "DRAFT",
        body: "FPF intelligence explains risk and confidence without promising fixed outcomes.",
        language: "en",
        audience: "Subscribers",
        platforms: ["LINKEDIN", "TELEGRAM"],
      })
      .expect(201);

    const approved = await request(app)
      .patch(`/api/admin/media/posts/${post.body.post.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "APPROVE" })
      .expect(200);

    expect(approved.body.post.status).toBe("APPROVED");

    const published = await request(app)
      .patch(`/api/admin/media/posts/${post.body.post.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "PUBLISH" })
      .expect(200);

    expect(published.body.post.status).toBe("PUBLISHED");
    expect(published.body.post.publishedAt).toBeTruthy();
  });

  it("stores media assets with safe placeholder metadata", async () => {
    const { app, users } = testApp();
    const adminToken = seedUser(users, "ADMIN");

    await request(app)
      .post("/api/admin/media/assets")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Match preview thumbnail template",
        assetType: "TEMPLATE",
        url: null,
        metadata: { provider: "placeholder" },
      })
      .expect(201);

    const assets = await request(app)
      .get("/api/admin/media/assets")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    expect(assets.body.assets.some((asset: { name: string }) => asset.name === "Match preview thumbnail template")).toBe(true);
  });
});
