import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it } from "vitest";
import { AuthService } from "./authService.js";
import { InMemoryUserRepository } from "./inMemoryUserRepository.js";

const previousFrontendUrl = process.env.FRONTEND_URL;

function restoreEnv() {
  if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = previousFrontendUrl;
}

function notificationRecorder() {
  const calls: Array<{ to: string; resetUrl: string; metadata?: Record<string, unknown> }> = [];
  return {
    calls,
    service: {
      sendPasswordReset: async (to: string, resetUrl: string, metadata?: Record<string, unknown>) => {
        calls.push({ to, resetUrl, metadata });
        return { provider: "MOCK", status: "ACCEPTED" };
      },
    },
  };
}

async function serviceWithUser() {
  const users = new InMemoryUserRepository();
  users.seedUser({
    id: "user-reset-link",
    name: "Reset User",
    email: "reset@example.com",
    passwordHash: await bcrypt.hash("Password123", 4),
    role: "SUBSCRIBER",
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
  });
  const recorder = notificationRecorder();
  const service = new AuthService(users, "test-secret", recorder.service as never);
  return { service, recorder };
}

describe("auth notification links", () => {
  afterEach(restoreEnv);

  it("uses the Preview frontend URL for password reset links", async () => {
    process.env.FRONTEND_URL = "https://frontend-preview.example.com/";
    const { service, recorder } = await serviceWithUser();

    await service.requestPasswordReset("reset@example.com");

    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0]?.resetUrl).toMatch(/^https:\/\/frontend-preview\.example\.com\/reset-password\?token=/);
  });

  it("uses the Production frontend URL when Production env is configured", async () => {
    process.env.FRONTEND_URL = "https://frontend-production.example.com";
    const { service, recorder } = await serviceWithUser();

    await service.requestPasswordReset("reset@example.com");

    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0]?.resetUrl).toMatch(/^https:\/\/frontend-production\.example\.com\/reset-password\?token=/);
  });
});
