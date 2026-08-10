import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("root Vercel frontend deployment config", () => {
  const rootConfig = JSON.parse(readFileSync(resolve(fileURLToPath(new URL("../../..", import.meta.url)), "vercel.json"), "utf8")) as {
    builds?: unknown;
    routes?: unknown;
    outputDirectory?: string;
    rewrites?: Array<{ source: string; destination: string }>;
  };

  it("serves the Vite frontend instead of routing public paths into backend serverless functions", () => {
    expect(rootConfig.builds).toBeUndefined();
    expect(rootConfig.routes).toBeUndefined();
    expect(rootConfig.outputDirectory).toBe("frontend/dist");
    expect(rootConfig.rewrites).toContainEqual({
      source: "/(.*)",
      destination: "/index.html",
    });
  });

  it("does not create backend-domain API rewrites that can self-loop in production", () => {
    expect(rootConfig.rewrites).not.toContainEqual({
      source: "/api/(.*)",
      destination: "https://football-performance-funds-backend.vercel.app/api/$1",
    });
    expect(rootConfig.rewrites).toContainEqual({
      source: "/health",
      destination: "/api/health.ts",
    });
    expect(rootConfig.rewrites).toContainEqual({
      source: "/health/db",
      destination: "/api/health/db.ts",
    });
  });
});
