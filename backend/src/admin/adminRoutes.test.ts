import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryAdminRepository } from "./inMemoryAdminRepository.js";

function seedAdmin(users: InMemoryUserRepository) {
  users.seedUser({
    id: "admin-user",
    name: "Admin User",
    email: "admin@example.com",
    passwordHash: "not-used",
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });
  return jwt.sign({ role: "ADMIN", email: "admin@example.com" }, "test-secret", {
    subject: "admin-user",
    expiresIn: "1d",
  });
}

function testApp() {
  const users = new InMemoryUserRepository();
  const adminRepository = new InMemoryAdminRepository([
    {
      id: "user-1",
      name: "Subscriber User",
      email: "subscriber@example.com",
      role: "SUBSCRIBER",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
      subscriptionPlan: "Subscriber Preview",
    },
  ]);
  const app = createApp({
    userRepository: users,
    footballRepository: new InMemoryFootballRepository(),
    predictionRepository: new InMemoryPredictionRepository([]),
    adminRepository,
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });
  return { app, adminRepository, token: seedAdmin(users) };
}

describe("admin routes", () => {
  it("requires admin access", async () => {
    await request(testApp().app).get("/api/admin/overview").expect(401);
  });

  it("returns dashboard metrics and users", async () => {
    const { app, token } = testApp();

    const overview = await request(app)
      .get("/api/admin/overview")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(overview.body.totalUsers).toBe(1);

    const users = await request(app)
      .get("/api/admin/users?search=subscriber")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    expect(users.body.users).toHaveLength(1);
  });

  it("audits user actions and settings updates", async () => {
    const { app, adminRepository, token } = testApp();

    await request(app)
      .post("/api/admin/users/user-1/suspend")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    await request(app)
      .patch("/api/admin/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ maintenanceMode: true, maximumSelections: 5 })
      .expect(200);

    expect(adminRepository.logs.map((log) => log.action)).toEqual([
      "USER_SUSPENDED",
      "SETTINGS_UPDATED",
    ]);
  });
});
