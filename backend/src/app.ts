import cors from "cors";
import crypto from "node:crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { HealthStatus } from "@fpf/shared";
import { AuthService } from "./auth/authService.js";
import { PrismaAdminRepository } from "./admin/adminRepository.js";
import { createAdminRouter } from "./admin/adminRoutes.js";
import { AdminService } from "./admin/adminService.js";
import type { AdminRepository } from "./admin/types.js";
import { PrismaAnalystRepository } from "./analyst/analystRepository.js";
import { createAnalystRouter } from "./analyst/analystRoutes.js";
import { AnalystService } from "./analyst/analystService.js";
import type { AnalystRepository } from "./analyst/types.js";
import { createAuthRouter, errorHandler } from "./auth/authRoutes.js";
import { PrismaUserRepository } from "./auth/prismaUserRepository.js";
import type { UserRepository } from "./auth/types.js";
import { checkPrismaConnection, isDatabaseUrlConfigured } from "./database/prismaClient.js";
import { ApiFootballClient } from "./football/apiFootballClient.js";
import { getFootballConfig } from "./football/config.js";
import { FootballJobScheduler } from "./football/footballJobs.js";
import { PrismaFootballRepository } from "./football/footballRepository.js";
import { createFootballRouter } from "./football/footballRoutes.js";
import { FootballSyncService } from "./football/footballSyncService.js";
import { OddsApiClient } from "./football/oddsApiClient.js";
import type { FootballRepository } from "./football/types.js";
import { PrismaInvestorRepository } from "./investor/investorRepository.js";
import { createInvestorRouter } from "./investor/investorRoutes.js";
import { InvestorService } from "./investor/investorService.js";
import type { InvestorRepository } from "./investor/types.js";
import { PrismaPredictionRepository } from "./predictions/predictionRepository.js";
import { createPredictionRouter } from "./predictions/predictionRoutes.js";
import { PredictionService } from "./predictions/predictionService.js";
import type { PredictionRepository } from "./predictions/types.js";
import { getNowPaymentsConfig, NowPaymentsClient } from "./wallet/nowPaymentsClient.js";
import { PrismaWalletRepository } from "./wallet/walletRepository.js";
import { createWalletRouter } from "./wallet/walletRoutes.js";
import { WalletService } from "./wallet/walletService.js";
import type { WalletRepository } from "./wallet/types.js";

const serviceVersion = process.env.npm_package_version ?? "0.1.0";
const defaultJwtSecret = "development-only-change-me";
const defaultFrontendOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://football-performance-fund-frontend.vercel.app",
  "https://football-performance-funds-frontend.vercel.app",
  "https://we-are-starting-football-performanc.vercel.app",
];
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
});

function requestId() {
  return crypto.randomUUID();
}

function normalizeOrigin(origin: string) {
  const trimmed = origin.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
}

function getAllowedFrontendOrigins() {
  const configuredOrigins = [
    ...defaultFrontendOrigins,
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URLS,
    process.env.ALLOWED_ORIGINS,
  ];

  return new Set(
    configuredOrigins
      .flatMap((value) => (value ?? "").split(","))
      .map(normalizeOrigin)
      .filter(Boolean),
  );
}

function isTrustedVercelOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && url.hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function getSafeConfigStatus() {
  return {
    status: "ok",
    service: "football-performance-fund-api",
    version: serviceVersion,
    nodeEnv: process.env.NODE_ENV ?? "development",
    databaseUrlConfigured: isDatabaseUrlConfigured(),
    jwtSecretConfigured: Boolean(process.env.JWT_SECRET?.trim()),
    nowPaymentsApiKeyConfigured: Boolean(process.env.NOWPAYMENTS_API_KEY?.trim()),
    nowPaymentsIpnSecretConfigured: Boolean(process.env.NOWPAYMENTS_IPN_SECRET?.trim()),
    frontendUrlConfigured: Boolean(process.env.FRONTEND_URL?.trim()),
    allowedOriginsConfigured: Boolean(process.env.ALLOWED_ORIGINS?.trim()),
    allowedOrigins: Array.from(getAllowedFrontendOrigins()),
    vercelPreviewOriginsAllowed: true,
  };
}

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;
  const normalizedOrigin = normalizeOrigin(origin);
  return getAllowedFrontendOrigins().has(normalizedOrigin) || isTrustedVercelOrigin(normalizedOrigin);
}

function getJwtSecret() {
  if (process.env.JWT_SECRET?.trim()) {
    return process.env.JWT_SECRET;
  }

  return defaultJwtSecret;
}

export function createApp(options?: {
  userRepository?: UserRepository;
  footballRepository?: FootballRepository;
  predictionRepository?: PredictionRepository;
  adminRepository?: AdminRepository;
  investorRepository?: InvestorRepository;
  walletRepository?: WalletRepository;
  analystRepository?: AnalystRepository;
  jwtSecret?: string;
  startFootballJobs?: boolean;
}) {
  const app = express();
  const footballConfig = getFootballConfig();
  const authService = new AuthService(
    options?.userRepository ?? new PrismaUserRepository(),
    options?.jwtSecret ?? getJwtSecret(),
  );
  const footballRepository = options?.footballRepository ?? new PrismaFootballRepository();
  const footballSyncService = new FootballSyncService(
    footballRepository,
    new ApiFootballClient(footballConfig),
    new OddsApiClient(footballConfig),
    footballConfig,
  );
  const footballScheduler = new FootballJobScheduler(footballSyncService, footballConfig);
  const predictionService = new PredictionService(
    options?.predictionRepository ?? new PrismaPredictionRepository(),
  );
  const adminService = new AdminService(options?.adminRepository ?? new PrismaAdminRepository());
  const investorService = new InvestorService(
    options?.investorRepository ?? new PrismaInvestorRepository(),
    adminService,
  );
  const walletService = new WalletService(
    options?.walletRepository ?? new PrismaWalletRepository(),
    new NowPaymentsClient(getNowPaymentsConfig()),
    adminService,
  );
  const analystService = new AnalystService(
    options?.analystRepository ?? new PrismaAnalystRepository(),
    footballRepository,
    adminService,
  );

  if (options?.startFootballJobs ?? true) {
    footballScheduler.start();
  }

  app.use(helmet());
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const id = request.header("x-request-id") ?? requestId();
    response.setHeader("x-request-id", id);
    next();
  });
  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(null, false);
      },
    }),
  );
  app.use((request, response, next) => {
    const unsafeMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
    const origin = request.header("origin");
    if (unsafeMethod && !isAllowedOrigin(origin)) {
      response.status(403).json({ error: "Invalid request origin" });
      return;
    }
    next();
  });
  app.use("/api", apiLimiter);
  app.use(express.json({ limit: "1mb" }));

  app.get(["/", "/health", "/api/health"], (_request, response) => {
    const status: HealthStatus = {
      status: "ok",
      service: "football-performance-fund-api",
      version: serviceVersion,
    };

    response.status(200).json(status);
  });

  app.get(["/health/db", "/api/health/db"], async (_request, response) => {
    const database = await checkPrismaConnection();
    const status = {
      status: database.ok ? "ok" : "degraded",
      service: "football-performance-fund-api",
      version: serviceVersion,
      databaseUrlConfigured: isDatabaseUrlConfigured(),
      jwtSecretConfigured: Boolean(process.env.JWT_SECRET?.trim()),
      prisma: database,
    };

    response.status(database.ok ? 200 : 503).json(status);
  });

  app.get("/api/debug/config", (_request, response) => {
    response.status(200).json(getSafeConfigStatus());
  });

  app.use("/api", createAuthRouter(authService));
  app.use(
    "/api",
    createFootballRouter({
      repository: footballRepository,
      syncService: footballSyncService,
      scheduler: footballScheduler,
      config: footballConfig,
      authService,
    }),
  );
  app.use(
    "/api",
    createPredictionRouter({
      authService,
      predictionService,
      adminService,
    }),
  );
  app.use(
    "/api",
    createAdminRouter({
      adminService,
      authService,
      footballRepository,
      footballScheduler,
    }),
  );
  app.use(
    "/api",
    createInvestorRouter({
      authService,
      investorService,
    }),
  );
  app.use(
    "/api",
    createWalletRouter({
      authService,
      walletService,
    }),
  );
  app.use(
    "/api",
    createAnalystRouter({
      authService,
      analystService,
    }),
  );
  app.use(errorHandler);

  return app;
}
