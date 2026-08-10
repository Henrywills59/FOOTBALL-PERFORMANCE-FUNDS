import { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../database/prismaClient.js";
import type { LaunchGovernanceRepository } from "./launchGovernance.js";

export class PrismaLaunchGovernanceRepository implements LaunchGovernanceRepository {
  constructor(private readonly prismaClient?: PrismaClient) {}

  private get prisma() {
    return this.prismaClient ?? getPrismaClient();
  }

  async getAuthoritativeSeason() {
    return this.prisma.fpfSeason.findFirst({
      where: {
        status: { in: ["REGISTRATION", "ACTIVE"] },
      },
      orderBy: [
        { status: "asc" },
        { seasonStartsAt: "desc" },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        isPublic: true,
        applicationsOpen: true,
        depositsEnabled: true,
        complianceApproved: true,
        legalApproved: true,
        publicLaunchApproved: true,
        activePlanApproved: true,
        investorTermsApproved: true,
        capacityLimitCents: true,
        capacityUsedCents: true,
      },
    });
  }
}
