import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

type VercelRequest = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
  setHeader?: (name: string, value: string) => void;
};

const prisma = new PrismaClient({ log: ["error"] });

function parseBody(body: unknown) {
  if (typeof body === "string") {
    return JSON.parse(body) as Record<string, unknown>;
  }

  if (typeof body === "object" && body !== null) {
    return body as Record<string, unknown>;
  }

  return {};
}

function getOrigin(request: VercelRequest) {
  const origin = request.headers?.origin ?? request.headers?.Origin;
  return Array.isArray(origin) ? origin[0] : origin;
}

function isAllowedOrigin(origin?: string) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    if (url.protocol === "https:" && url.hostname.endsWith(".vercel.app")) {
      return true;
    }
  } catch {
    return false;
  }

  const configured = [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://footballperformancefund.com",
    "https://www.footballperformancefund.com",
    "https://football-performance-fund-frontend.vercel.app",
    "https://football-performance-funds-frontend.vercel.app",
    "https://we-are-starting-football-performanc.vercel.app",
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URLS,
    process.env.ALLOWED_ORIGINS,
  ]
    .flatMap((value) => (value ?? "").split(","))
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return configured.includes(origin.replace(/\/+$/, ""));
}

function safeError(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: "Unknown error" };
  }

  return {
    name: error.constructor.name,
    message: error.message,
    code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
  };
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  const origin = getOrigin(request);
  if (origin && isAllowedOrigin(origin)) {
    response.setHeader?.("access-control-allow-origin", origin);
    response.setHeader?.("vary", "origin");
  }
  response.setHeader?.("access-control-allow-methods", "POST,OPTIONS");
  response.setHeader?.("access-control-allow-headers", "content-type,authorization");

  if (request.method === "OPTIONS") {
    response.status(200).json({ ok: true });
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!isAllowedOrigin(origin)) {
    response.status(403).json({ error: "Invalid request origin" });
    return;
  }

  try {
    const jwtSecret = process.env.JWT_SECRET?.trim();
    if (!process.env.DATABASE_URL?.trim() || !jwtSecret) {
      response.status(503).json({
        error: "Authentication service is not fully configured.",
        failedStage: "environment",
        databaseUrlConfigured: Boolean(process.env.DATABASE_URL?.trim()),
        jwtSecretConfigured: Boolean(jwtSecret),
      });
      return;
    }

    const body = parseBody(request.body);
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const rememberMe = body.rememberMe === true;

    if (!email || !password) {
      response.status(400).json({ error: "Invalid request" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== "ACTIVE") {
      response.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      response.status(401).json({ error: "Invalid email or password" });
      return;
    }

    await prisma.loginHistory.create({
      data: { userId: user.id, email: user.email, success: true },
    });

    const expiresIn = rememberMe ? "30d" : "1d";
    const token = jwt.sign(
      {
        role: user.role,
        email: user.email,
      },
      jwtSecret,
      {
        subject: user.id,
        expiresIn,
      },
    );

    response.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
      token,
      expiresIn,
    });
  } catch (error) {
    response.status(500).json({
      error: "Login failed",
      failedStage: "authLogin",
      details: safeError(error),
    });
  }
}
