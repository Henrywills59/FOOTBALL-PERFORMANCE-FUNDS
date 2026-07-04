import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { HealthStatus } from "@fpf/shared";
import { AuthService } from "./auth/authService.js";
import { createAuthRouter, errorHandler } from "./auth/authRoutes.js";
import { PrismaUserRepository } from "./auth/prismaUserRepository.js";
import type { UserRepository } from "./auth/types.js";

const serviceVersion = process.env.npm_package_version ?? "0.1.0";
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
const defaultJwtSecret = "development-only-change-me";

export function createApp(options?: { userRepository?: UserRepository; jwtSecret?: string }) {
  const app = express();
  const authService = new AuthService(
    options?.userRepository ?? new PrismaUserRepository(),
    options?.jwtSecret ?? process.env.JWT_SECRET ?? defaultJwtSecret,
  );

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
  app.use(errorHandler);

  return app;
}
