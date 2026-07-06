import request from "supertest";
import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { InMemoryUserRepository } from "./inMemoryUserRepository.js";
import { defaultDemoUserPassword, demoUsers } from "./demoUsers.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";
import { defaultAdminSeed } from "./adminSeed.js";
import { InMemoryAnalystRepository } from "../analyst/inMemoryAnalystRepository.js";
import type { UserRepository } from "./types.js";

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

async function testAppWithDemoUsers() {
  const userRepository = new InMemoryUserRepository();
  const passwordHash = await bcrypt.hash(defaultDemoUserPassword, 12);
  for (const [index, user] of demoUsers.entries()) {
    userRepository.seedUser({
      id: `demo-${index}`,
      name: user.name,
      email: user.email,
      role: user.role,
      status: "ACTIVE",
      passwordHash,
      createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    });
  }

  return createApp({
    userRepository,
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

const validRegistration = {
  name: "Taylor Williams",
  email: "taylor@example.com",
  password: "Password123",
  role: "SUBSCRIBER",
};

describe("auth routes", () => {
  it("registers a public user role and returns a JWT session", async () => {
    const response = await request(testApp())
      .post("/api/auth/register")
      .send(validRegistration)
      .expect(201);

    expect(response.body.user.email).toBe("taylor@example.com");
    expect(response.body.user.role).toBe("SUBSCRIBER");
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it("does not allow Admin registration from the public form", async () => {
    const response = await request(testApp())
      .post("/api/auth/register")
      .send({ ...validRegistration, role: "ADMIN" })
      .expect(400);

    expect(response.body.error).toBe("Invalid request");
  });

  it("logs in with email and password", async () => {
    const app = testApp();
    await request(app).post("/api/auth/register").send(validRegistration).expect(201);

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: validRegistration.email,
        password: validRegistration.password,
        rememberMe: true,
      })
      .expect(200);

    expect(response.body.expiresIn).toBe("30d");
    expect(response.body.user.email).toBe(validRegistration.email);
  });

  it("logs in demo users and returns their role dashboards", async () => {
    const app = await testAppWithDemoUsers();
    const expectedDashboardPaths = {
      ADMIN: "/dashboard/admin",
      INVESTOR: "/dashboard/investor",
      SUBSCRIBER: "/dashboard/subscriber",
    };

    for (const user of demoUsers) {
      const login = await request(app)
        .post("/api/auth/login")
        .send({
          email: user.email,
          password: defaultDemoUserPassword,
          rememberMe: false,
        })
        .expect(200);

      expect(login.body.user.role).toBe(user.role);

      const dashboard = await request(app)
        .get("/api/dashboards/me")
        .set("Authorization", `Bearer ${login.body.token}`)
        .expect(200);

      expect(dashboard.body.path).toBe(expectedDashboardPaths[user.role]);
    }
  });

  it("keeps default admin seed credentials available for production seeding", () => {
    expect(defaultAdminSeed.email).toBe("admin@footballperformancefund.com");
    expect(defaultAdminSeed.name).toBe("FPF Admin");
    expect(defaultAdminSeed.password).toBe("ChooseAStrongPassword123!");
  });

  it("reports database connection failures as clear JSON errors", async () => {
    const databaseError = Object.assign(new Error("Authentication failed against database server"), {
      code: "P1000",
    });
    const failingUsers: UserRepository = {
      createUser: async () => {
        throw databaseError;
      },
      findUserByEmail: async () => {
        throw databaseError;
      },
      findUserById: async () => {
        throw databaseError;
      },
      createPasswordResetToken: async () => {
        throw databaseError;
      },
      findPasswordResetToken: async () => {
        throw databaseError;
      },
      markPasswordResetTokenUsed: async () => {
        throw databaseError;
      },
      updatePassword: async () => {
        throw databaseError;
      },
      recordLogin: async () => {
        throw databaseError;
      },
    };

    const app = createApp({
      userRepository: failingUsers,
      footballRepository: new InMemoryFootballRepository(),
      predictionRepository: new InMemoryPredictionRepository([]),
      adminRepository: new InMemoryAdminRepository(),
      investorRepository: new InMemoryInvestorRepository(),
      walletRepository: new InMemoryWalletRepository(),
      analystRepository: new InMemoryAnalystRepository(),
      jwtSecret: "test-secret",
      startFootballJobs: false,
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@footballperformancefund.com", password: "ChooseAStrongPassword123!", rememberMe: false })
      .expect(503);

    expect(response.body.error).toContain("Database authentication failed");
    expect(response.body.requestId).toEqual(expect.any(String));
  });

  it("does not fail a valid login when login audit storage is unavailable", async () => {
    const userRepository = new InMemoryUserRepository();
    const passwordHash = await bcrypt.hash("ChooseAStrongPassword123!", 12);
    userRepository.seedUser({
      id: "admin-user",
      name: "FPF Admin",
      email: "admin@footballperformancefund.com",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
      createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    });
    userRepository.recordLogin = async () => {
      throw Object.assign(new Error("The table public.LoginHistory does not exist"), {
        code: "P2021",
      });
    };

    const app = createApp({
      userRepository,
      footballRepository: new InMemoryFootballRepository(),
      predictionRepository: new InMemoryPredictionRepository([]),
      adminRepository: new InMemoryAdminRepository(),
      investorRepository: new InMemoryInvestorRepository(),
      walletRepository: new InMemoryWalletRepository(),
      analystRepository: new InMemoryAnalystRepository(),
      jwtSecret: "test-secret",
      startFootballJobs: false,
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "admin@footballperformancefund.com",
        password: "ChooseAStrongPassword123!",
        rememberMe: false,
      })
      .expect(200);

    expect(response.body.user.email).toBe("admin@footballperformancefund.com");
    expect(response.body.user.role).toBe("ADMIN");
    expect(response.body.token).toEqual(expect.any(String));
  });

  it("reports the exact failing login stage through the debug endpoint", async () => {
    const userRepository = new InMemoryUserRepository();
    const passwordHash = await bcrypt.hash("ChooseAStrongPassword123!", 12);
    userRepository.seedUser({
      id: "admin-user",
      name: "FPF Admin",
      email: "admin@footballperformancefund.com",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash,
      createdAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    });
    userRepository.recordLogin = async () => {
      throw Object.assign(new Error("The table public.LoginHistory does not exist"), {
        code: "P2021",
      });
    };

    const app = createApp({
      userRepository,
      footballRepository: new InMemoryFootballRepository(),
      predictionRepository: new InMemoryPredictionRepository([]),
      adminRepository: new InMemoryAdminRepository(),
      investorRepository: new InMemoryInvestorRepository(),
      walletRepository: new InMemoryWalletRepository(),
      analystRepository: new InMemoryAnalystRepository(),
      jwtSecret: "test-secret",
      startFootballJobs: false,
    });

    const response = await request(app)
      .post("/api/debug/login")
      .send({
        email: "admin@footballperformancefund.com",
        password: "ChooseAStrongPassword123!",
        rememberMe: false,
      })
      .expect(500);

    expect(response.body.failedStage).toBe("auditHistoryWrite");
    expect(response.body.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "adminUserLookup", status: "SUCCESS" }),
        expect.objectContaining({ stage: "passwordHashVerification", status: "SUCCESS" }),
        expect.objectContaining({ stage: "jwtSigning", status: "SUCCESS" }),
        expect.objectContaining({ stage: "auditHistoryWrite", status: "FAILURE" }),
      ]),
    );
  });

  it("accepts auth requests from the configured frontend origin", async () => {
    const app = testApp();

    await request(app)
      .post("/api/auth/register")
      .set("Origin", "http://localhost:5173")
      .send(validRegistration)
      .expect(201);

    await request(app)
      .post("/api/auth/login")
      .set("Origin", "http://localhost:5173")
      .send({
        email: validRegistration.email,
        password: validRegistration.password,
        rememberMe: false,
      })
      .expect(200);
  });

  it("accepts Vercel forwarded login requests without rate-limit proxy errors", async () => {
    const app = testApp();

    await request(app).post("/api/auth/register").send(validRegistration).expect(201);

    const response = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "203.0.113.10")
      .set("X-Forwarded-Proto", "https")
      .send({
        email: validRegistration.email,
        password: validRegistration.password,
        rememberMe: false,
      })
      .expect(200);

    expect(response.body.user.email).toBe(validRegistration.email);
    expect(response.body.token).toEqual(expect.any(String));
  });

  it("accepts auth requests from comma-separated allowed origins", async () => {
    const previousAllowedOrigins = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS =
      "https://football-performance-fund.vercel.app, https://football-performance-fund-git-main.vercel.app/";

    try {
      const app = testApp();

      await request(app)
        .post("/api/auth/register")
        .set("Origin", "https://football-performance-fund.vercel.app")
        .send(validRegistration)
        .expect(201);

      await request(app)
        .post("/api/auth/login")
        .set("Origin", "https://football-performance-fund-git-main.vercel.app")
        .send({
          email: validRegistration.email,
          password: validRegistration.password,
          rememberMe: false,
        })
        .expect(200);
    } finally {
      if (previousAllowedOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
      else process.env.ALLOWED_ORIGINS = previousAllowedOrigins;
    }
  });

  it("accepts auth preflight requests from production and preview frontend domains by default", async () => {
    const productionOrigins = [
      "https://football-performance-fund-frontend.vercel.app",
      "https://football-performance-funds-frontend.vercel.app",
      "https://we-are-starting-football-performanc.vercel.app",
      "https://football-performance-fund-frontend-git-main-example.vercel.app",
    ];
    const app = testApp();

    for (const origin of productionOrigins) {
      const response = await request(app)
        .options("/api/auth/login")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "content-type")
        .expect(204);

      expect(response.headers["access-control-allow-origin"]).toBe(origin);
    }
  });

  it("blocks auth requests from unconfigured browser origins", async () => {
    await request(testApp())
      .post("/api/auth/register")
      .set("Origin", "https://not-the-frontend.example")
      .send(validRegistration)
      .expect(403);
  });

  it("routes users to the correct role dashboard", async () => {
    const app = testApp();
    const login = await request(app)
      .post("/api/auth/register")
      .send({ ...validRegistration, role: "INVESTOR" })
      .expect(201);

    const response = await request(app)
      .get("/api/dashboards/me")
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(200);

    expect(response.body.path).toBe("/dashboard/investor");
    expect(response.body.title).toBe("Investor Dashboard");
  });

  it("protects profile and dashboard routes", async () => {
    await request(testApp()).get("/api/users/me").expect(401);

    const app = testApp();
    const login = await request(app).post("/api/auth/register").send(validRegistration).expect(201);

    await request(app)
      .get("/api/dashboards/investor")
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(403);

    await request(app)
      .get("/api/dashboards/subscriber")
      .set("Authorization", `Bearer ${login.body.token}`)
      .expect(200);
  });

  it("creates and consumes a password reset token", async () => {
    const app = testApp();
    await request(app).post("/api/auth/register").send(validRegistration).expect(201);

    const reset = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: validRegistration.email })
      .expect(200);

    expect(reset.body.resetToken).toEqual(expect.any(String));

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token: reset.body.resetToken, password: "NewPassword123" })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({
        email: validRegistration.email,
        password: "NewPassword123",
        rememberMe: false,
      })
      .expect(200);
  });

  it("changes password for the signed-in user", async () => {
    const app = testApp();
    const registered = await request(app).post("/api/auth/register").send(validRegistration).expect(201);

    await request(app)
      .post("/api/users/me/password")
      .set("Authorization", `Bearer ${registered.body.token}`)
      .send({
        currentPassword: validRegistration.password,
        newPassword: "ChangedPassword123",
      })
      .expect(200);

    await request(app)
      .post("/api/auth/login")
      .send({
        email: validRegistration.email,
        password: "ChangedPassword123",
        rememberMe: false,
      })
      .expect(200);
  });
});
