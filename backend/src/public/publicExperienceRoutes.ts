import { Router } from "express";
import type { PublicExperienceService } from "./publicExperienceService.js";

export function createPublicExperienceRouter(input: { publicExperienceService: PublicExperienceService }) {
  const router = Router();

  router.get("/public/experience", async (_request, response, next) => {
    try {
      response.status(200).json(await input.publicExperienceService.overview());
    } catch (error) {
      next(error);
    }
  });

  return router;
}
