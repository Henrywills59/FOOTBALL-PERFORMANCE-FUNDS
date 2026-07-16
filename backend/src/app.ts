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
import { createAnalyticsRouter } from "./analytics/analyticsRoutes.js";
import { AnalyticsService } from "./analytics/analyticsService.js";
import { createAuthRouter, errorHandler } from "./auth/authRoutes.js";
import { CompanyCapitalService } from "./companyCapital/companyCapitalService.js";
import { InMemoryCompanyCapitalRepository } from "./companyCapital/inMemoryCompanyCapitalRepository.js";
import { PrismaCompanyCapitalRepository } from "./companyCapital/companyCapitalRepository.js";
import { createCompanyCapitalRouter } from "./companyCapital/companyCapitalRoutes.js";
import type { CompanyCapitalRepository } from "./companyCapital/types.js";
import { createCommercialRouter } from "./commercial/routes.js";
import { CommercialService } from "./commercial/service.js";
import { PrismaUserRepository } from "./auth/prismaUserRepository.js";
import type { UserRepository } from "./auth/types.js";
import { checkPrismaConnection, isDatabaseUrlConfigured } from "./database/prismaClient.js";
import { FinancialEngineService } from "./financial/financialEngineService.js";
import { InMemoryFinancialRepository } from "./financial/inMemoryFinancialRepository.js";
import { PrismaFinancialRepository } from "./financial/financialRepository.js";
import { createFinancialRouter } from "./financial/financialRoutes.js";
import type { FinancialRepository } from "./financial/types.js";
import { ApiFootballClient } from "./football/apiFootballClient.js";
import { getFootballConfig } from "./football/config.js";
import { FootballJobScheduler } from "./football/footballJobs.js";
import { PrismaFootballRepository } from "./football/footballRepository.js";
import { createFootballRouter } from "./football/footballRoutes.js";
import { FootballSyncService } from "./football/footballSyncService.js";
import { OddsApiClient } from "./football/oddsApiClient.js";
import type { FootballRepository } from "./football/types.js";
import { GlobalizationRepository } from "./globalization/repository.js";
import { createGlobalizationRouter } from "./globalization/routes.js";
import { GlobalizationService } from "./globalization/service.js";
import { createInfrastructureRouter } from "./infrastructure/infrastructureRoutes.js";
import { InfrastructureService } from "./infrastructure/infrastructureService.js";
import { OpenAiProvider } from "./integrations/openAiProvider.js";
import { NotificationDeliveryService } from "./integrations/notificationProviders.js";
import { createAiIntelligenceRouter } from "./intelligence/aiRoutes.js";
import { MemoryCacheStore } from "./intelligence/cache.js";
import { DecisionEngineService } from "./intelligence/decision/decisionService.js";
import { IntelligenceRepositoryAdapter } from "./intelligence/repository.js";
import { createIntelligenceRouter } from "./intelligence/routes.js";
import { IntelligenceService } from "./intelligence/service.js";
import { IntelligenceWorkflowService } from "./intelligence/workflowService.js";
import { PrismaInvestorRepository } from "./investor/investorRepository.js";
import { createInvestorRouter } from "./investor/investorRoutes.js";
import { InvestorService } from "./investor/investorService.js";
import type { InvestorRepository } from "./investor/types.js";
import { InMemoryOperationsRepository, PrismaOperationsRepository } from "./operations/repository.js";
import { createOperationsRouter } from "./operations/routes.js";
import { OperationsService } from "./operations/service.js";
import type { OperationsRepository } from "./operations/types.js";
import { InMemoryMediaRepository, PrismaMediaRepository } from "./media/repository.js";
import { createMediaRouter } from "./media/routes.js";
import { MediaService } from "./media/service.js";
import type { MediaRepository } from "./media/types.js";
import { getNowPaymentsRuntimeConfig, safeNowPaymentsConfigStatus } from "./payments/config.js";
import { NowPaymentsApiProvider } from "./payments/nowPaymentsProvider.js";
import { PrismaPaymentRepository } from "./payments/paymentRepository.js";
import { createPaymentRouter } from "./payments/paymentRoutes.js";
import { PaymentService } from "./payments/paymentService.js";
import type { NowPaymentsProvider, PaymentRepository } from "./payments/types.js";
import { PrismaPredictionRepository } from "./predictions/predictionRepository.js";
import { createPredictionRouter } from "./predictions/predictionRoutes.js";
import { PredictionService } from "./predictions/predictionService.js";
import type { PredictionRepository } from "./predictions/types.js";
import { PlaceholderPredictionNotificationService } from "./predictionWorkflow/notificationService.js";
import { PrismaPredictionWorkflowRepository } from "./predictionWorkflow/predictionWorkflowRepository.js";
import { createPredictionWorkflowRouter } from "./predictionWorkflow/predictionWorkflowRoutes.js";
import { PredictionWorkflowService } from "./predictionWorkflow/predictionWorkflowService.js";
import type { PredictionWorkflowRepository } from "./predictionWorkflow/types.js";
import { createPreviewSeedRouter } from "./preview/previewSeedRoutes.js";
import { createPublicExperienceRouter } from "./public/publicExperienceRoutes.js";
import { PublicExperienceService } from "./public/publicExperienceService.js";
import { createSeasonRouter } from "./season/seasonRoutes.js";
import { InMemorySeasonRepository } from "./season/inMemorySeasonRepository.js";
import { PrismaSeasonRepository } from "./season/seasonRepository.js";
import { SeasonService } from "./season/seasonService.js";
import type { SeasonRepository } from "./season/types.js";
import { createSubscriberRouter } from "./subscriber/subscriberRoutes.js";
import { SubscriberService } from "./subscriber/subscriberService.js";
import { createTreasuryRouter } from "./treasury/treasuryRoutes.js";
import { TreasuryService } from "./treasury/treasuryService.js";
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
  const requiredEnvironment = {
    databaseUrl: Boolean(process.env.DATABASE_URL?.trim()),
    jwtSecret: Boolean(process.env.JWT_SECRET?.trim()),
  };

  return {
    status: "ok",
    service: "football-performance-fund-api",
    version: serviceVersion,
    nodeEnv: process.env.NODE_ENV ?? "development",
    databaseUrlConfigured: requiredEnvironment.databaseUrl,
    jwtSecretConfigured: requiredEnvironment.jwtSecret,
    nowPaymentsApiKeyConfigured: Boolean(process.env.NOWPAYMENTS_API_KEY?.trim()),
    nowPaymentsIpnSecretConfigured: Boolean(process.env.NOWPAYMENTS_IPN_SECRET?.trim()),
    nowPayments: safeNowPaymentsConfigStatus(),
    frontendUrlConfigured: Boolean(process.env.FRONTEND_URL?.trim()),
    allowedOriginsConfigured: Boolean(process.env.ALLOWED_ORIGINS?.trim()),
    allowedOrigins: Array.from(getAllowedFrontendOrigins()),
    vercelPreviewOriginsAllowed: true,
    requiredEnvironment,
    auth: {
      loginEndpoint: "/api/auth/login",
      registerEndpoint: "/api/auth/register",
      passwordResetEndpoint: "/api/auth/reset-password",
    },
  };
}

function getProductionProviderValidation() {
  const variables = {
    infobipApiKey: Boolean(process.env.INFOBIP_API_KEY?.trim()),
    infobipBaseUrl: Boolean(process.env.INFOBIP_BASE_URL?.trim()),
    openAiApiKey: Boolean(process.env.OPENAI_API_KEY?.trim()),
    openAiModel: Boolean(process.env.OPENAI_MODEL?.trim()),
    oddsApiKey: Boolean(process.env.ODDS_API_KEY?.trim()),
    oddsApiBaseUrl: Boolean(process.env.ODDS_API_BASE_URL?.trim()),
  };
  const missingVariables = [
    !variables.infobipApiKey ? "INFOBIP_API_KEY" : null,
    !variables.infobipBaseUrl ? "INFOBIP_BASE_URL" : null,
    !variables.openAiApiKey ? "OPENAI_API_KEY" : null,
    !variables.openAiModel ? "OPENAI_MODEL" : null,
    !variables.oddsApiKey ? "ODDS_API_KEY" : null,
    !variables.oddsApiBaseUrl ? "ODDS_API_BASE_URL" : null,
  ].filter((item): item is string => Boolean(item));
  return {
    configured: missingVariables.length === 0,
    variables,
    missingVariables,
  };
}

function logStartupProviderValidation() {
  const validation = getProductionProviderValidation();
  if (validation.configured) {
    console.info("PROVIDER_STARTUP_VALIDATION", { status: "READY" });
    return;
  }
  console.warn("PROVIDER_STARTUP_VALIDATION", {
    status: "ACTION_REQUIRED",
    missingVariables: validation.missingVariables,
  });
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

function isLoginDiagnosticPath(path: string) {
  return ["/api/auth/login", "/api/debug/login", "/auth/login", "/debug/login"].includes(path);
}

export function createApp(options?: {
  userRepository?: UserRepository;
  footballRepository?: FootballRepository;
  predictionRepository?: PredictionRepository;
  predictionWorkflowRepository?: PredictionWorkflowRepository;
  adminRepository?: AdminRepository;
  investorRepository?: InvestorRepository;
  walletRepository?: WalletRepository;
  analystRepository?: AnalystRepository;
  operationsRepository?: OperationsRepository;
  mediaRepository?: MediaRepository;
  seasonRepository?: SeasonRepository;
  financialRepository?: FinancialRepository;
  companyCapitalRepository?: CompanyCapitalRepository;
  paymentRepository?: PaymentRepository;
  nowPaymentsProvider?: NowPaymentsProvider;
  jwtSecret?: string;
  startFootballJobs?: boolean;
}) {
  const app = express();
  app.set("trust proxy", 1);
  logStartupProviderValidation();
  const footballConfig = getFootballConfig();
  const openAiProvider = new OpenAiProvider();
  const notificationDeliveryService = new NotificationDeliveryService();
  const authService = new AuthService(
    options?.userRepository ?? new PrismaUserRepository(),
    options?.jwtSecret ?? getJwtSecret(),
    notificationDeliveryService,
  );
  const footballRepository = options?.footballRepository ?? new PrismaFootballRepository();
  const predictionRepository = options?.predictionRepository ?? new PrismaPredictionRepository();
  const analystRepository = options?.analystRepository ?? new PrismaAnalystRepository();
  const footballSyncService = new FootballSyncService(
    footballRepository,
    new ApiFootballClient(footballConfig),
    new OddsApiClient(footballConfig),
    footballConfig,
  );
  const footballScheduler = new FootballJobScheduler(footballSyncService, footballConfig);
  const predictionService = new PredictionService(predictionRepository);
  const adminService = new AdminService(options?.adminRepository ?? new PrismaAdminRepository());
  const commercialService = new CommercialService(adminService);
  const globalizationService = new GlobalizationService(new GlobalizationRepository(), adminService);
  const paymentService = new PaymentService(
    options?.paymentRepository ?? new PrismaPaymentRepository(),
    options?.nowPaymentsProvider ?? new NowPaymentsApiProvider(getNowPaymentsRuntimeConfig()),
    adminService,
  );
  const investorService = new InvestorService(
    options?.investorRepository ?? new PrismaInvestorRepository(),
    adminService,
  );
  const walletService = new WalletService(
    options?.walletRepository ?? new PrismaWalletRepository(),
    new NowPaymentsClient(getNowPaymentsConfig()),
    adminService,
  );
  const subscriberService = new SubscriberService(
    footballRepository,
    predictionRepository,
    analystRepository,
  );
  const intelligenceService = new IntelligenceService(
    new IntelligenceRepositoryAdapter(footballRepository, predictionRepository, analystRepository),
    new MemoryCacheStore(),
  );
  const decisionEngineService = new DecisionEngineService(intelligenceService);
  const predictionWorkflowService = new PredictionWorkflowService(
    options?.predictionWorkflowRepository ?? new PrismaPredictionWorkflowRepository(),
    decisionEngineService,
    new PlaceholderPredictionNotificationService(),
  );
  const analystService = new AnalystService(
    analystRepository,
    footballRepository,
    adminService,
    predictionWorkflowService,
    openAiProvider,
  );
  const intelligenceWorkflowService = new IntelligenceWorkflowService(
    footballRepository,
    decisionEngineService,
    predictionWorkflowService,
  );
  const operationsRepository = options?.operationsRepository ?? (
    process.env.NODE_ENV === "test" && !isDatabaseUrlConfigured()
      ? new InMemoryOperationsRepository()
      : new PrismaOperationsRepository()
  );
  const operationsService = new OperationsService(operationsRepository, notificationDeliveryService);
  const mediaRepository = options?.mediaRepository ?? (
    process.env.NODE_ENV === "test" && !isDatabaseUrlConfigured()
      ? new InMemoryMediaRepository()
      : new PrismaMediaRepository()
  );
  const mediaService = new MediaService(mediaRepository);
  const treasuryService = new TreasuryService();
  const analyticsService = new AnalyticsService();
  const infrastructureService = new InfrastructureService();
  const publicExperienceService = new PublicExperienceService();
  const seasonRepository = options?.seasonRepository ?? (
    process.env.NODE_ENV === "test" && !isDatabaseUrlConfigured()
      ? new InMemorySeasonRepository()
      : new PrismaSeasonRepository()
  );
  const seasonService = new SeasonService(seasonRepository);
  const financialRepository = options?.financialRepository ?? (
    process.env.NODE_ENV === "test" && !isDatabaseUrlConfigured()
      ? new InMemoryFinancialRepository()
      : new PrismaFinancialRepository()
  );
  const financialEngineService = new FinancialEngineService(financialRepository);
  const companyCapitalRepository = options?.companyCapitalRepository ?? (
    process.env.NODE_ENV === "test" && !isDatabaseUrlConfigured()
      ? new InMemoryCompanyCapitalRepository()
      : new PrismaCompanyCapitalRepository()
  );
  const companyCapitalService = new CompanyCapitalService(companyCapitalRepository, predictionWorkflowService);

  if (options?.startFootballJobs ?? true) {
    footballScheduler.start();
  }

  app.use(helmet());
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const id = request.header("x-request-id") ?? requestId();
    response.setHeader("x-request-id", id);
    if (isLoginDiagnosticPath(request.path)) {
      console.info("AUTH_LOGIN_MIDDLEWARE_STAGE", {
        stage: "requestId",
        status: "SUCCESS",
        requestId: id,
        path: request.path,
        method: request.method,
      });
    }
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
      if (isLoginDiagnosticPath(request.path)) {
        console.error("AUTH_LOGIN_MIDDLEWARE_STAGE", {
          stage: "originValidation",
          status: "FAILURE",
          requestId: response.getHeader("x-request-id"),
          origin,
        });
      }
      response.status(403).json({ error: "Invalid request origin" });
      return;
    }
    if (isLoginDiagnosticPath(request.path)) {
      console.info("AUTH_LOGIN_MIDDLEWARE_STAGE", {
        stage: "originValidation",
        status: "SUCCESS",
        requestId: response.getHeader("x-request-id"),
        origin,
      });
    }
    next();
  });
  app.use("/api", apiLimiter);
  app.use("/api", (request, response, next) => {
    if (isLoginDiagnosticPath(request.path)) {
      console.info("AUTH_LOGIN_MIDDLEWARE_STAGE", {
        stage: "globalRateLimiter",
        status: "SUCCESS",
        requestId: response.getHeader("x-request-id"),
      });
    }
    next();
  });
  app.use(express.json({
    limit: "1mb",
    verify(request, _response, buffer) {
      (request as express.Request).rawBody = Buffer.from(buffer);
    },
  }));

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

  app.get("/api/production/readiness", async (_request, response) => {
    const database = await checkPrismaConnection();
    const config = getSafeConfigStatus();
    const providers = {
      apiFootball: footballSyncService.providerStatus(),
      odds: footballSyncService.oddsProviderStatus(),
      openAi: openAiProvider.status(),
      notifications: notificationDeliveryService.status(),
      nowPayments: safeNowPaymentsConfigStatus(),
      productionProviderValidation: getProductionProviderValidation(),
    };
    const required = [
      config.requiredEnvironment.databaseUrl,
      config.requiredEnvironment.jwtSecret,
      database.ok,
      providers.nowPayments.configured,
      providers.productionProviderValidation.configured,
    ];
    response.status(required.every(Boolean) ? 200 : 503).json({
      status: required.every(Boolean) ? "READY" : "ACTION_REQUIRED",
      service: "football-performance-fund-api",
      database,
      config,
      providers,
      deployment: {
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      },
    });
  });

  app.use(
    "/api",
    createPublicExperienceRouter({
      publicExperienceService,
    }),
  );
  app.use("/api", createAuthRouter(authService));
  app.use(
    "/api",
    createPreviewSeedRouter({
      authService,
    }),
  );
  app.use(
    "/api",
    createOperationsRouter({
      authService,
      operationsService,
      adminService,
    }),
  );
  app.use(
    "/api",
    createInfrastructureRouter({
      authService,
      infrastructureService,
      adminService,
    }),
  );
  app.use(
    "/api",
    createCommercialRouter({
      authService,
      commercialService,
    }),
  );
  app.use(
    "/api",
    createSeasonRouter({
      authService,
      seasonService,
    }),
  );
  app.use(
    "/api",
    createFinancialRouter({
      authService,
      financialEngineService,
    }),
  );
  app.use(
    "/api",
    createCompanyCapitalRouter({
      authService,
      companyCapitalService,
    }),
  );
  app.use(
    "/api",
    createPaymentRouter({
      authService,
      paymentService,
    }),
  );
  app.use(
    "/api",
    createMediaRouter({
      authService,
      mediaService,
      adminService,
    }),
  );
  app.use(
    "/api",
    createGlobalizationRouter({
      authService,
      globalizationService,
    }),
  );
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
    createPredictionWorkflowRouter({
      authService,
      predictionWorkflowService,
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
  app.use(
    "/api",
    createIntelligenceRouter({
      authService,
      intelligenceService,
      decisionEngineService,
      intelligenceWorkflowService,
    }),
  );
  app.use(
    "/api",
    createAiIntelligenceRouter({
      authService,
      openAiProvider,
      intelligenceService,
    }),
  );
  app.use(
    "/api",
    createSubscriberRouter({
      authService,
      subscriberService,
    }),
  );
  app.use(
    "/api",
    createTreasuryRouter({
      authService,
      treasuryService,
    }),
  );
  app.use(
    "/api",
    createAnalyticsRouter({
      authService,
      analyticsService,
    }),
  );
  app.use(errorHandler);

  return app;
}
