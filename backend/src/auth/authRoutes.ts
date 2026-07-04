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

export function createAuthRouter(authService: AuthService) {
  const router = Router();
  const requireSignedIn = requireAuth(authService);

  router.post("/auth/register", authLimiter, async (request, response, next) => {
    try {
      const input = registerSchema.parse(request.body);
      response.status(201).json(await authService.register(input));
    } catch (error) {
      next(error);
    }
  });

  router.post("/auth/login", authLimiter, async (request, response, next) => {
    try {
      const input = loginSchema.parse(request.body);
      response.status(200).json(await authService.login(input));
    } catch (error) {
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
      const input = resetPasswordSchema.parse(request.body);
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

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AuthError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (typeof error === "object" && error !== null && "issues" in error) {
    response.status(400).json({ error: "Invalid request", details: error });
    return;
  }

  response.status(500).json({ error: "Internal server error" });
};
