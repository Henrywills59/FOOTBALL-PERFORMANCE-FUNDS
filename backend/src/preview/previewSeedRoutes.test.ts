import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "../auth/authService.js";
import { errorHandler } from "../auth/authRoutes.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { createPreviewSeedRouter } from "./previewSeedRoutes.js";

function tokenFor(role: "ADMIN" | "SUBSCRIBER", id = `${role.toLowerCase()}-preview-user`) {
  return jwt.sign({ role, email: `${role.toLowerCase()}@example.com` }, "test-secret", {
    subject: id,
    expiresIn: "1d",
  });
}

function testApp(seed = vi.fn(async () => ({ status: "ok", seeded: { users: 8 } }))) {
  const users = new InMemoryUserRepository();
  users.seedUser({
    id: "admin-preview-user",
    name: "Admin Preview",
    email: "admin@example.com",
    passwordHash: "not-used",
    role: "ADMIN",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  });
  users.seedUser({
    id: "subscriber-preview-user",
    name: "Subscriber Preview",
    email: "subscriber@example.com",
    passwordHash: "not-used",
    role: "SUBSCRIBER",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  });

  const authService = new AuthService(users, "test-secret");
  const app = express();
  app.use(express.json());
  app.use("/api", createPreviewSeedRouter({ authService, seed }));
  app.use(errorHandler);

  return { app, seed };
}

describe("preview seed routes", () => {
  afterEach(() => {
    delete process.env.FPF_ALLOW_PREVIEW_SEED;
    delete process.env.VERCEL_ENV;
  });

  it("is unavailable outside Preview even for admins", async () => {
    const { app, seed } = testApp();

    await request(app)
      .post("/api/preview/seed-operational-data")
      .set("Authorization", `Bearer ${tokenFor("ADMIN", "admin-preview-user")}`)
      .expect(404);

    expect(seed).not.toHaveBeenCalled();
  });

  it("requires admin access in Preview", async () => {
    process.env.VERCEL_ENV = "preview";
    const { app, seed } = testApp();

    await request(app)
      .post("/api/preview/seed-operational-data")
      .set("Authorization", `Bearer ${tokenFor("SUBSCRIBER", "subscriber-preview-user")}`)
      .expect(403);

    expect(seed).not.toHaveBeenCalled();
  });

  it("runs the idempotent seed for Preview admins", async () => {
    process.env.VERCEL_ENV = "preview";
    const { app, seed } = testApp();

    const response = await request(app)
      .post("/api/preview/seed-operational-data")
      .set("Authorization", `Bearer ${tokenFor("ADMIN", "admin-preview-user")}`)
      .expect(201);

    expect(response.body.status).toBe("ok");
    expect(response.body.seeded.users).toBe(8);
    expect(seed).toHaveBeenCalledWith("admin-preview-user");
  });
});
