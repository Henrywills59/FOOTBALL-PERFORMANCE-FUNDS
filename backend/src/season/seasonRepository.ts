import { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../database/prismaClient.js";
import type {
  FinancialConstitutionAllocation,
  FpfSeason,
  ParticipationRenewalResult,
  PerformancePartnerParticipation,
} from "@fpf/shared";
import { defaultFinancialConstitution, defaultFpfSeason } from "./defaults.js";
import type { CreateParticipationInput, SeasonRepository } from "./types.js";

function seasonRow(row: {
  id: string;
  name: string;
  status: FpfSeason["status"];
  registrationOpensAt: Date;
  seasonStartsAt: Date;
  seasonEndsAt: Date;
  settlementStartsAt: Date;
  closingStartsAt: Date;
  nextRegistrationOpensAt: Date | null;
  totalWeeks: number;
}): FpfSeason {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    registrationOpensAt: row.registrationOpensAt.toISOString(),
    seasonStartsAt: row.seasonStartsAt.toISOString(),
    seasonEndsAt: row.seasonEndsAt.toISOString(),
    settlementStartsAt: row.settlementStartsAt.toISOString(),
    closingStartsAt: row.closingStartsAt.toISOString(),
    nextRegistrationOpensAt: row.nextRegistrationOpensAt?.toISOString() ?? null,
    totalWeeks: row.totalWeeks,
  };
}

function participationRow(row: {
  id: string;
  userId: string;
  seasonId: string;
  planCode: PerformancePartnerParticipation["planCode"];
  status: PerformancePartnerParticipation["status"];
  participationAmountCents: number;
  startsAt: Date;
  expiresAt: Date;
  remainingWeeks: number;
  remainingDistributions: number;
  noRetroactiveDistribution: boolean;
  contractualPayoutNotice: string;
}): PerformancePartnerParticipation {
  return {
    id: row.id,
    userId: row.userId,
    seasonId: row.seasonId,
    planCode: row.planCode,
    status: row.status,
    participationAmountCents: row.participationAmountCents,
    startsAt: row.startsAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    remainingWeeks: row.remainingWeeks,
    remainingDistributions: row.remainingDistributions,
    noRetroactiveDistribution: row.noRetroactiveDistribution,
    contractualPayoutNotice: row.contractualPayoutNotice,
  };
}

function constitutionRow(row: {
  allocationType: FinancialConstitutionAllocation["type"];
  label: string;
  percent: number;
  distributable: boolean;
  purpose: string;
}): FinancialConstitutionAllocation {
  return {
    type: row.allocationType,
    label: row.label,
    percent: row.percent,
    distributable: row.distributable,
    purpose: row.purpose,
  };
}

function transientParticipation(input: CreateParticipationInput): PerformancePartnerParticipation {
  return {
    id: `transient-${Date.now()}`,
    userId: input.userId,
    seasonId: input.seasonId ?? defaultFpfSeason.id,
    planCode: input.planCode,
    status: "ACTIVE",
    participationAmountCents: input.participationAmountCents,
    startsAt: input.startsAt,
    expiresAt: input.expiresAt,
    remainingWeeks: input.remainingWeeks,
    remainingDistributions: input.remainingDistributions,
    noRetroactiveDistribution: true,
    contractualPayoutNotice:
      "The contractual payout represents the complete financial obligation under the participation agreement. No additional capital repayment is due after completion.",
  };
}

export class PrismaSeasonRepository implements SeasonRepository {
  constructor(private readonly prismaClient?: PrismaClient) {}

  private get prisma() {
    return this.prismaClient ?? getPrismaClient();
  }

  private logFallback(label: string, error: unknown) {
    console.warn("SEASON_REPOSITORY_FALLBACK", {
      label,
      message: error instanceof Error ? error.message : "Unknown season repository failure",
    });
  }

  async currentSeason(): Promise<FpfSeason | null> {
    try {
      const seeded = await this.prisma.fpfSeason.upsert({
        where: { name: defaultFpfSeason.name },
        update: {},
        create: {
          id: defaultFpfSeason.id,
          name: defaultFpfSeason.name,
          status: defaultFpfSeason.status,
          registrationOpensAt: new Date(defaultFpfSeason.registrationOpensAt),
          seasonStartsAt: new Date(defaultFpfSeason.seasonStartsAt),
          seasonEndsAt: new Date(defaultFpfSeason.seasonEndsAt),
          settlementStartsAt: new Date(defaultFpfSeason.settlementStartsAt),
          closingStartsAt: new Date(defaultFpfSeason.closingStartsAt),
          nextRegistrationOpensAt: defaultFpfSeason.nextRegistrationOpensAt
            ? new Date(defaultFpfSeason.nextRegistrationOpensAt)
            : null,
          totalWeeks: defaultFpfSeason.totalWeeks,
          notes: "Seeded FPF OS season foundation.",
        },
      });
      return seasonRow(seeded);
    } catch (error) {
      this.logFallback("currentSeason", error);
      return null;
    }
  }

  async financialConstitution(seasonId: string): Promise<FinancialConstitutionAllocation[]> {
    try {
      await Promise.all(
        defaultFinancialConstitution.map((allocation) =>
          this.prisma.seasonFinancialConstitution.upsert({
            where: {
              seasonId_allocationType: {
                seasonId,
                allocationType: allocation.type,
              },
            },
            update: {
              label: allocation.label,
              percent: allocation.percent,
              distributable: allocation.distributable,
              purpose: allocation.purpose,
            },
            create: {
              seasonId,
              allocationType: allocation.type,
              label: allocation.label,
              percent: allocation.percent,
              distributable: allocation.distributable,
              purpose: allocation.purpose,
            },
          }),
        ),
      );
      const rows = await this.prisma.seasonFinancialConstitution.findMany({
        where: { seasonId },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(constitutionRow);
    } catch (error) {
      this.logFallback("financialConstitution", error);
      return defaultFinancialConstitution;
    }
  }

  async listParticipations(userId: string): Promise<PerformancePartnerParticipation[]> {
    try {
      const rows = await this.prisma.performancePartnerParticipation.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      return rows.map(participationRow);
    } catch (error) {
      this.logFallback("listParticipations", error);
      return [];
    }
  }

  async createParticipation(input: CreateParticipationInput): Promise<PerformancePartnerParticipation> {
    try {
      const row = await this.prisma.performancePartnerParticipation.create({
        data: {
          userId: input.userId,
          seasonId: input.seasonId ?? defaultFpfSeason.id,
          planCode: input.planCode,
          status: "ACTIVE",
          participationAmountCents: input.participationAmountCents,
          startsAt: new Date(input.startsAt),
          expiresAt: new Date(input.expiresAt),
          remainingWeeks: input.remainingWeeks,
          remainingDistributions: input.remainingDistributions,
          noRetroactiveDistribution: true,
        },
      });
      return participationRow(row);
    } catch (error) {
      this.logFallback("createParticipation", error);
      return transientParticipation(input);
    }
  }

  async completeParticipation(input: { participationId: string }): Promise<PerformancePartnerParticipation | null> {
    try {
      const row = await this.prisma.performancePartnerParticipation.update({
        where: { id: input.participationId },
        data: {
          status: "COMPLETED",
          remainingWeeks: 0,
          remainingDistributions: 0,
        },
      });
      return participationRow(row);
    } catch (error) {
      this.logFallback("completeParticipation", error);
      return null;
    }
  }

  async openRenewal(input: { actorUserId: string; participationId: string }): Promise<ParticipationRenewalResult | null> {
    try {
      const existing = await this.prisma.performancePartnerParticipation.findUnique({
        where: { id: input.participationId },
      });
      if (!existing || existing.userId !== input.actorUserId) return null;

      const row = await this.prisma.performancePartnerParticipation.update({
        where: { id: input.participationId },
        data: { status: "RENEWAL_OPEN" },
      });
      return {
        participation: participationRow(row),
        renewalStatus: "READY_FOR_NEXT_SEASON_REGISTRATION",
        message: "Renewal is open for next season registration. No automatic renewal has been created.",
      };
    } catch (error) {
      this.logFallback("openRenewal", error);
      return null;
    }
  }
}
