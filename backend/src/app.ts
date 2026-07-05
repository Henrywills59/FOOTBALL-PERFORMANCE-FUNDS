import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { HealthStatus } from "@fpf/shared";
import { AuthService } from "./auth/authService.js";
import { PrismaAdminRepository } from "./admin/adminRepository.js";
import { createAdminRouter } from "./admin/adminRoutes.js";
import { AdminService } from "./admin/adminService.js";
import type { AdminRepository } from "./admin/types.js";
import { createAuthRouter, errorHandler } from "./auth/authRoutes.js";
import { PrismaUserRepository } from "./auth/prismaUserRepository.js";
import type { UserRepository } from "./auth/types.js";
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
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
const defaultJwtSecret = "development-only-change-me";

export function createApp(options?: {
  userRepository?: UserRepository;
  footballRepository?: FootballRepository;
  predictionRepository?: PredictionRepository;
  adminRepository?: AdminRepository;
  investorRepository?: InvestorRepository;
  walletRepository?: WalletRepository;
  jwtSecret?: string;
  startFootballJobs?: boolean;
}) {
  const app = express();
  const footballConfig = getFootballConfig();
  const authService = new AuthService(
    options?.userRepository ?? new PrismaUserRepository(),
    options?.jwtSecret ?? process.env.JWT_SECRET ?? defaultJwtSecret,
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

  if (options?.startFootballJobs ?? true) {
    footballScheduler.start();
  }

  app.use(helmet());
  app.use(
    cors({
      origin: frontendUrl,
    }),
  );
  app.use(express.json());

  app.get("/health", (_request, response) => {
    const status: HealthStatus = {
      status: "ok",
      service: "football-performance-fund-api",
      version: serviceVersion,
    };

    response.status(200).json(status);
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
  app.use(errorHandler);

  return app;
}
