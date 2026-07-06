import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
  setHeader?: (name: string, value: string) => void;
};

type Stage = {
  stage:
    | "environment"
    | "prismaClient"
    | "databaseConnection"
    | "adminUserLookup"
    | "passwordHashVerification"
    | "jwtSigning"
    | "auditHistoryWrite";
  status: "SUCCESS" | "FAILURE";
  detail?: Record<string, unknown>;
  error?: Record<string, unknown>;
};

const prisma = new PrismaClient({
  log: ["error"],
});

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

function stage(
  stages: Stage[],
  name: Stage["stage"],
  status: Stage["status"],
  detail?: Record<string, unknown>,
  error?: unknown,
) {
  stages.push({
    stage: name,
    status,
    ...(detail ? { detail } : {}),
    ...(error ? { error: safeError(error) } : {}),
  });
}

function parseBody(body: unknown) {
  if (typeof body === "string") {
    return JSON.parse(body) as Record<string, unknown>;
  }

  if (typeof body === "object" && body !== null) {
    return body as Record<string, unknown>;
  }

  return {};
}

function maskEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  return domain ? `${localPart.slice(0, 2)}***@${domain}` : `${localPart.slice(0, 2)}***`;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader?.("access-control-allow-origin", "*");
  response.setHeader?.("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader?.("access-control-allow-headers", "content-type,authorization");

  if (request.method === "OPTIONS") {
    response.status(200).json({ ok: true });
    return;
  }

  const stages: Stage[] = [];
  let failedStage: Stage["stage"] | undefined;

  try {
    const body = parseBody(request.body);
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "admin@footballperformancefund.com";
    const password = typeof body.password === "string" ? body.password : "";
    const rememberMe = body.rememberMe === true;
    const maskedEmail = maskEmail(email);
    const jwtSecret = process.env.JWT_SECRET;

    stage(stages, "environment", process.env.DATABASE_URL && jwtSecret ? "SUCCESS" : "FAILURE", {
      databaseUrlConfigured: Boolean(process.env.DATABASE_URL?.trim()),
      jwtSecretConfigured: Boolean(jwtSecret?.trim()),
      nodeEnv: process.env.NODE_ENV ?? "development",
    });

    try {
      void prisma;
      stage(stages, "prismaClient", "SUCCESS");
    } catch (error) {
      failedStage = "prismaClient";
      stage(stages, failedStage, "FAILURE", undefined, error);
      response.status(200).json({ ok: false, failedStage, stages });
      return;
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
      stage(stages, "databaseConnection", "SUCCESS");
    } catch (error) {
      failedStage = "databaseConnection";
      stage(stages, failedStage, "FAILURE", undefined, error);
      response.status(200).json({ ok: false, failedStage, stages });
      return;
    }

    let user:
      | {
          id: string;
          name: string;
          email: string;
          passwordHash: string;
          role: string;
          status: string;
          createdAt: Date;
        }
      | null = null;

    try {
      user = await prisma.user.findUnique({ where: { email } });
      stage(stages, "adminUserLookup", "SUCCESS", {
        email: maskedEmail,
        userFound: Boolean(user),
        userId: user?.id,
        role: user?.role,
        status: user?.status,
        passwordHashPresent: Boolean(user?.passwordHash),
        passwordHashLength: user?.passwordHash?.length ?? 0,
      });
    } catch (error) {
      failedStage = "adminUserLookup";
      stage(stages, failedStage, "FAILURE", { email: maskedEmail }, error);
      response.status(200).json({ ok: false, failedStage, stages });
      return;
    }

    if (!user || user.status !== "ACTIVE") {
      response.status(200).json({
        ok: false,
        failedStage: "adminUserLookup",
        authResult: "Invalid email or password",
        stages,
      });
      return;
    }

    let passwordMatches = false;
    try {
      passwordMatches = await bcrypt.compare(password, user.passwordHash);
      stage(stages, "passwordHashVerification", "SUCCESS", {
        email: maskedEmail,
        userId: user.id,
        passwordMatches,
      });
    } catch (error) {
      failedStage = "passwordHashVerification";
      stage(stages, failedStage, "FAILURE", { email: maskedEmail, userId: user.id }, error);
      response.status(200).json({ ok: false, failedStage, stages });
      return;
    }

    if (!passwordMatches) {
      response.status(200).json({
        ok: false,
        failedStage: "passwordHashVerification",
        authResult: "Invalid email or password",
        stages,
      });
      return;
    }

    try {
      jwt.sign({ role: user.role, email: user.email }, jwtSecret ?? "", {
        subject: user.id,
        expiresIn: rememberMe ? "30d" : "1d",
      });
      stage(stages, "jwtSigning", "SUCCESS", {
        userId: user.id,
        role: user.role,
        jwtSecretConfigured: Boolean(jwtSecret?.trim()),
      });
    } catch (error) {
      failedStage = "jwtSigning";
      stage(stages, failedStage, "FAILURE", { userId: user.id, role: user.role }, error);
      response.status(200).json({ ok: false, failedStage, stages });
      return;
    }

    try {
      await prisma.loginHistory.create({
        data: { userId: user.id, email: user.email, success: true },
      });
      stage(stages, "auditHistoryWrite", "SUCCESS", { userId: user.id, email: maskedEmail });
    } catch (error) {
      failedStage = "auditHistoryWrite";
      stage(stages, failedStage, "FAILURE", { userId: user.id, email: maskedEmail }, error);
      response.status(200).json({ ok: false, failedStage, stages });
      return;
    }

    response.status(200).json({
      ok: true,
      stages,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    response.status(200).json({
      ok: false,
      failedStage: failedStage ?? "environment",
      stages,
      error: safeError(error),
    });
  }
}
