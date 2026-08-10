import { describe, expect, it, vi, beforeEach } from "vitest";

let activeAdminCount = 0;
let createdUsers: unknown[] = [];

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    user = {
      count: vi.fn(async () => activeAdminCount),
      create: vi.fn(async (input: unknown) => {
        createdUsers.push(input);
        return {
          id: "created-admin",
          email: "admin@footballperformancefund.com",
          role: "ADMIN",
          status: "ACTIVE",
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        };
      }),
    };
    $executeRawUnsafe = vi.fn(async () => undefined);
    $disconnect = vi.fn(async () => undefined);
  },
}));

const { default: handler } = await import("./seed-default-admin.js");

function response() {
  const result = {
    statusCode: 0,
    body: undefined as unknown,
    headers: new Map<string, string>(),
  };
  return {
    result,
    res: {
      setHeader(name: string, value: string) {
        result.headers.set(name, value);
      },
      status(code: number) {
        result.statusCode = code;
        return {
          json(body: unknown) {
            result.body = body;
          },
        };
      },
    },
  };
}

describe("seed default admin serverless handler", () => {
  beforeEach(() => {
    activeAdminCount = 0;
    createdUsers = [];
    process.env.DATABASE_URL = "postgresql://test";
    process.env.ADMIN_SEED_TOKEN = "seed-token";
    process.env.DEFAULT_ADMIN_EMAIL = "admin@footballperformancefund.com";
  });

  it("does not reveal the bootstrap endpoint without the deployment token", async () => {
    const { res, result } = response();

    await handler({ method: "POST", headers: {}, body: {} }, res);

    expect(result.statusCode).toBe(404);
    expect(createdUsers).toHaveLength(0);
  });

  it("rejects unauthorized bootstrap email addresses", async () => {
    const { res, result } = response();

    await handler({
      method: "POST",
      headers: { "x-admin-seed-token": "seed-token" },
      body: { email: "attacker@example.com", password: "ChangeMe12345!" },
    }, res);

    expect(result.statusCode).toBe(403);
    expect(createdUsers).toHaveLength(0);
  });

  it("closes bootstrap once an active administrator exists", async () => {
    activeAdminCount = 1;
    const { res, result } = response();

    await handler({
      method: "POST",
      headers: { "x-admin-seed-token": "seed-token" },
      body: { email: "admin@footballperformancefund.com", password: "ChangeMe12345!" },
    }, res);

    expect(result.statusCode).toBe(409);
    expect(createdUsers).toHaveLength(0);
  });
});
