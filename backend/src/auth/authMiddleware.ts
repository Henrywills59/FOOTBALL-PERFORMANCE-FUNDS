import type { NextFunction, Request, Response } from "express";
import type { AuthUser, UserRole } from "@fpf/shared";
import { AuthError, AuthService } from "./authService.js";

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
    rawBody?: Buffer;
  }
}

function getBearerToken(request: Request) {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length);
}

export function requireAuth(authService: AuthService) {
  return async (request: Request, _response: Response, next: NextFunction) => {
    try {
      const token = getBearerToken(request);
      if (!token) {
        throw new AuthError("Unauthorized", 401);
      }

      request.user = await authService.getUserFromToken(token);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireRole(roles: UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.user || !roles.includes(request.user.role)) {
      next(new AuthError("Forbidden", 403));
      return;
    }

    next();
  };
}
