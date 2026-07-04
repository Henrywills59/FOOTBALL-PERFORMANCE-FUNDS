import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { HealthStatus } from "@fpf/shared";

const serviceVersion = process.env.npm_package_version ?? "0.1.0";
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

export function createApp() {
  const app = express();

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

  return app;
}
