import { afterEach, describe, expect, it } from "vitest";
import { buildBackendUrl, buildFrontendUrl, getBackendBaseUrl, getFrontendBaseUrl } from "./publicUrls.js";

const trackedVariables = [
  "BACKEND_BASE_URL",
  "BACKEND_PUBLIC_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
  "FRONTEND_URL",
  "FRONTEND_BASE_URL",
  "APP_BASE_URL",
  "PUBLIC_APP_URL",
  "VERCEL_ENV",
] as const;

const previous = Object.fromEntries(trackedVariables.map((key) => [key, process.env[key]]));

function resetEnv() {
  for (const key of trackedVariables) {
    const value = previous[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function clearEnv() {
  for (const key of trackedVariables) delete process.env[key];
}

describe("public URL configuration", () => {
  afterEach(resetEnv);

  it("uses Preview backend and frontend URLs when Preview env variables are configured", () => {
    clearEnv();
    process.env.VERCEL_ENV = "preview";
    process.env.BACKEND_BASE_URL = "https://backend-preview.example.com/";
    process.env.FRONTEND_URL = "https://frontend-preview.example.com/";

    expect(getBackendBaseUrl()).toBe("https://backend-preview.example.com");
    expect(buildBackendUrl("/api/payments/nowpayments/webhook")).toBe("https://backend-preview.example.com/api/payments/nowpayments/webhook");
    expect(getFrontendBaseUrl()).toBe("https://frontend-preview.example.com");
    expect(buildFrontendUrl("/reset-password?token=abc")).toBe("https://frontend-preview.example.com/reset-password?token=abc");
  });

  it("uses Production backend and frontend URLs when Production env variables are configured", () => {
    clearEnv();
    process.env.VERCEL_ENV = "production";
    process.env.BACKEND_BASE_URL = "https://backend-production.example.com";
    process.env.FRONTEND_URL = "https://frontend-production.example.com";

    expect(buildBackendUrl("api/health")).toBe("https://backend-production.example.com/api/health");
    expect(buildFrontendUrl("verify-email?token=abc")).toBe("https://frontend-production.example.com/verify-email?token=abc");
  });

  it("normalizes Vercel hostnames when protocol is omitted", () => {
    clearEnv();
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "backend-preview.vercel.app";
    process.env.FRONTEND_BASE_URL = "frontend-preview.vercel.app";

    expect(getBackendBaseUrl()).toBe("https://backend-preview.vercel.app");
    expect(getFrontendBaseUrl()).toBe("https://frontend-preview.vercel.app");
  });

  it("does not let a legacy production backend URL override the Vercel Preview URL", () => {
    clearEnv();
    process.env.VERCEL_ENV = "preview";
    process.env.BACKEND_PUBLIC_URL = "https://backend-production.example.com";
    process.env.VERCEL_URL = "backend-preview.vercel.app";

    expect(getBackendBaseUrl()).toBe("https://backend-preview.vercel.app");
  });
});
