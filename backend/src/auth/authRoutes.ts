import type { ErrorRequestHandler } from "express";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthError, AuthService } from "./authService.js";
import { requireAuth, requireRole } from "./authMiddleware.js";
import {
  forgotPasswordSchema,
  changePasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./validation.js";

type RegisterInput = Parameters<AuthService["register"]>[0];
type LoginInput = Parameters<AuthService["login"]>[0];
type ResetPasswordInput = Parameters<AuthService["resetPassword"]>[0];

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

function isPrismaOrDatabaseError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const errorName = error.constructor.name;
  const errorCode = "code" in error ? String(error.code) : "";
  return (
    errorName.startsWith("PrismaClient") ||
    errorCode.startsWith("P") ||
    error.message.includes("DATABASE_URL") ||
    error.message.includes("database") ||
    error.message.includes("Can't reach database server")
  );
}

function publicDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Database connection failed.";
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("authentication failed") || lowerMessage.includes("p1000")) {
    return "Database authentication failed. Check DATABASE_URL username, password, and Supabase pooler host.";
  }

  if (lowerMessage.includes("can't reach database server") || lowerMessage.includes("p1001")) {
    return "Database server is unreachable. Check DATABASE_URL host, port, SSL mode, and Supabase pooler settings.";
  }

  if (lowerMessage.includes("environment variable not found") || lowerMessage.includes("database_url")) {
    return "DATABASE_URL is not configured for the backend deployment.";
  }

  if (lowerMessage.includes("does not exist") || lowerMessage.includes("table")) {
    return "Database schema is not initialized. Run the Prisma deployment command against Supabase.";
  }

  return "Database connection unavailable. Check backend DATABASE_URL and Prisma deployment.";
}

function maskEmail(email?: string) {
  if (!email) return undefined;
  const [localPart = "", domain = ""] = email.split("@");
  const visiblePrefix = localPart.slice(0, 2);
  return domain ? `${visiblePrefix}***@${domain}` : `${visiblePrefix}***`;
}

function safeErrorDetails(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: "Unknown error" };
  }

  return {
    name: error.constructor.name,
    message: error.message,
    code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
  };
}

export function createAuthRouter(authService: AuthService) {
  const router = Router();
  const requireSignedIn = requireAuth(authService);

  router.post("/auth/register", authLimiter, async (request, response, next) => {
    try {
      const input = registerSchema.parse(request.body) as RegisterInput;
      response.status(201).json(await authService.register(input));
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/login", authLimiter, (request, response, next) => {
    console.info("AUTH_LOGIN_MIDDLEWARE_STAGE", {
      stage: "authRateLimiter",
      status: "SUCCESS",
      requestId: response.getHeader("x-request-id"),
    });
    next();
  }, async (request, response, next) => {
    const requestId = response.getHeader("x-request-id");
    try {
      const input = loginSchema.parse(request.body) as LoginInput;
      console.info("Auth login route accepted request", {
        requestId,
        email: maskEmail(input.email),
        rememberMe: input.rememberMe,
        databaseUrlConfigured: Boolean(process.env.DATABASE_URL?.trim()),
        jwtSecretConfigured: Boolean(process.env.JWT_SECRET?.trim()),
      });
      response.status(200).json(await authService.login(input));
    } catch (error) {
      console.error("Auth login route failed", {
        requestId,
        email: maskEmail(typeof request.body?.email === "string" ? request.body.email : undefined),
        error: safeErrorDetails(error),
      });
      next(error);
    }
  });

  router.post("/debug/login", async (request, response, next) => {
    const requestId = response.getHeader("x-request-id");
    try {
      const input = loginSchema.parse(request.body) as LoginInput;
      console.info("Debug login route accepted request", {
        requestId,
        email: maskEmail(input.email),
        rememberMe: input.rememberMe,
      });

      const diagnostic = await authService.debugLogin(input);
      response.status(diagnostic.ok ? 200 : 500).json({
        requestId,
        ...diagnostic,
      });
    } catch (error) {
      console.error("Debug login route failed", {
        requestId,
        email: maskEmail(typeof request.body?.email === "string" ? request.body.email : undefined),
        error: safeErrorDetails(error),
      });
      next(error);
    }
  });

  router.post(
    "/auth/forgot-password",
    passwordResetLimiter,
    async (request, response, next) => {
      try {
        const input = forgotPasswordSchema.parse(request.body);
        response.status(200).json(await authService.requestPasswordReset(input.email));
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/auth/reset-password", passwordResetLimiter, async (request, response, next) => {
    try {
      const input = resetPasswordSchema.parse(request.body) as ResetPasswordInput;
      response.status(200).json(await authService.resetPassword(input));
    } catch (error) {
      next(error);
    }
  });

  router.get("/users/me", requireSignedIn, (request, response) => {
    response.status(200).json({ user: request.user });
  });

  router.post("/users/me/password", requireSignedIn, async (request, response, next) => {
    try {
      const input = changePasswordSchema.parse(request.body);
      response.status(200).json(
        await authService.changePassword({
          userId: request.user!.id,
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
        }),
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/dashboards/me", requireSignedIn, (request, response) => {
    response.status(200).json(authService.getDashboardForRole(request.user!.role));
  });

  router.get(
    "/dashboards/subscriber",
    requireSignedIn,
    requireRole(["SUBSCRIBER", "ADMIN"]),
    (_request, response) => {
      response.status(200).json({ title: "Subscriber Dashboard" });
    },
  );

  router.get(
    "/dashboards/investor",
    requireSignedIn,
    requireRole(["INVESTOR", "ADMIN"]),
    (_request, response) => {
      response.status(200).json({ title: "Investor Dashboard" });
    },
  );

  router.get(
    "/dashboards/analyst",
    requireSignedIn,
    requireRole(["ANALYST", "ADMIN"]),
    (_request, response) => {
      response.status(200).json({ title: "Analyst Dashboard" });
    },
  );

  router.get(
    "/dashboards/admin",
    requireSignedIn,
    requireRole(["ADMIN"]),
    (_request, response) => {
      response.status(200).json({ title: "Admin Dashboard" });
    },
  );

  return router;
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const requestId = response.getHeader("x-request-id");
  if (error instanceof AuthError) {
    response.status(error.statusCode).json({ error: error.message, requestId });
    return;
  }

  if (typeof error === "object" && error !== null && "issues" in error) {
    response.status(400).json({ error: "Invalid request", requestId });
    return;
  }

  if (isPrismaOrDatabaseError(error)) {
    const publicMessage = publicDatabaseError(error);
    console.error("Database request error", {
      method: request.method,
      path: request.path,
      requestId,
      message: error instanceof Error ? error.message : "Unknown database error",
      code: typeof error === "object" && error !== null && "code" in error ? error.code : undefined,
    });
    response.status(503).json({ error: publicMessage, requestId });
    return;
  }

  console.error("Unhandled request error", {
    method: request.method,
    path: request.path,
    requestId,
    message: error instanceof Error ? error.message : "Unknown error",
  });
  response.status(500).json({ error: "Internal server error", requestId });
};
