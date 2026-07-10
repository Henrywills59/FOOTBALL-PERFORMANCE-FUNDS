import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryAnalystRepository } from "../analyst/inMemoryAnalystRepository.js";
import { createApp } from "../app.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryOperationsRepository } from "./repository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";

function seedUser(users: InMemoryUserRepository, role: "ADMIN" | "SUBSCRIBER" | "INVESTOR" | "ANALYST") {
  const id = `${role.toLowerCase()}-operations-user`;
  users.seedUser({
    id,
    name: `${role} User`,
    email: `${role.toLowerCase()}-operations@example.com`,
    passwordHash: "not-used",
    role,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });
  return jwt.sign({ role }, "test-secret", { subject: id, expiresIn: "1d" });
}

function testApp() {
  const users = new InMemoryUserRepository();
  const operationsRepository = new InMemoryOperationsRepository();
  const app = createApp({
    userRepository: users,
    footballRepository: new InMemoryFootballRepository(),
    predictionRepository: new InMemoryPredictionRepository([]),
    adminRepository: new InMemoryAdminRepository(),
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository: new InMemoryWalletRepository(),
    analystRepository: new InMemoryAnalystRepository(),
    operationsRepository,
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });
  return { app, users };
}

describe("operations routes", () => {
  it("generates reports and scopes them to the authenticated user", async () => {
    const { app, users } = testApp();
    const subscriberToken = seedUser(users, "SUBSCRIBER");
    const investorToken = seedUser(users, "INVESTOR");

    const generated = await request(app)
      .post("/api/reports/generate")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .send({ type: "SUBSCRIBER", filters: { league: "Premier League" } })
      .expect(201);

    expect(generated.body.report.status).toBe("READY");

    const subscriberReports = await request(app)
      .get("/api/reports")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(200);
    expect(subscriberReports.body.reports).toHaveLength(1);

    const investorReports = await request(app)
      .get("/api/reports")
      .set("Authorization", `Bearer ${investorToken}`)
      .expect(200);
    expect(investorReports.body.reports).toHaveLength(0);
  });

  it("protects monitoring and lets admins create and update incidents", async () => {
    const { app, users } = testApp();
    const subscriberToken = seedUser(users, "SUBSCRIBER");
    const adminToken = seedUser(users, "ADMIN");

    await request(app)
      .get("/api/admin/monitoring/overview")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(403);

    await request(app)
      .get("/api/admin/monitoring/overview")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);

    const created = await request(app)
      .post("/api/admin/monitoring/incidents")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Provider latency", severity: "MEDIUM", affectedModules: ["Notifications"] })
      .expect(201);

    const updated = await request(app)
      .patch(`/api/admin/monitoring/incidents/${created.body.incident.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "RESOLVED", note: "Placeholder provider recovered." })
      .expect(200);

    expect(updated.body.incident.status).toBe("RESOLVED");
  });

  it("supports notification read state, preferences, and admin announcements", async () => {
    const { app, users } = testApp();
    const subscriberToken = seedUser(users, "SUBSCRIBER");
    const adminToken = seedUser(users, "ADMIN");

    const notifications = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(200);

    expect(notifications.body.notifications[0].status).toBe("UNREAD");

    await request(app)
      .patch(`/api/notifications/${notifications.body.notifications[0].id}/read`)
      .set("Authorization", `Bearer ${subscriberToken}`)
      .expect(200);

    const preferences = await request(app)
      .put("/api/notifications/preferences")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .send({
        inAppEnabled: true,
        emailPlaceholderEnabled: true,
        smsPlaceholderEnabled: false,
        whatsappPlaceholderEnabled: false,
        pushPlaceholderEnabled: false,
        marketingEnabled: false,
        financialEnabled: true,
        predictionEnabled: true,
      })
      .expect(200);

    expect(preferences.body.securityEnabled).toBe(true);
    expect(preferences.body.marketingEnabled).toBe(false);

    const announcement = await request(app)
      .post("/api/admin/announcements")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ title: "Maintenance window", message: "Placeholder scheduling only.", status: "DRAFT", targetRoles: ["ALL"] })
      .expect(201);

    expect(announcement.body.announcement.title).toBe("Maintenance window");
  });
});
