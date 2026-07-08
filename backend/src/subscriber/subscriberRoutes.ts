import { Router } from "express";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import type { SubscriberService } from "./subscriberService.js";

export function createSubscriberRouter(input: {
  authService: AuthService;
  subscriberService: SubscriberService;
}) {
  const router = Router();
  const signedIn = requireAuth(input.authService);
  const subscriberAccess = [signedIn, requireRole(["SUBSCRIBER", "ADMIN"])];

  router.get("/subscriber/command-center", ...subscriberAccess, async (request, response, next) => {
    try {
      response.status(200).json(await input.subscriberService.commandCenter(request.user!));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
