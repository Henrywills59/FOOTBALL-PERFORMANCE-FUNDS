import type {
  FinancialConstitutionAllocation,
  FpfSeason,
  ParticipationRenewalResult,
  PerformancePartnerParticipation,
} from "@fpf/shared";
import { defaultFinancialConstitution, defaultFpfSeason } from "./defaults.js";
import type { CreateParticipationInput, SeasonRepository } from "./types.js";

export class InMemorySeasonRepository implements SeasonRepository {
  participations: PerformancePartnerParticipation[] = [];

  async currentSeason(): Promise<FpfSeason> {
    return defaultFpfSeason;
  }

  async financialConstitution(_seasonId: string): Promise<FinancialConstitutionAllocation[]> {
    return defaultFinancialConstitution;
  }

  async listParticipations(userId: string): Promise<PerformancePartnerParticipation[]> {
    return this.participations.filter((item) => item.userId === userId);
  }

  async createParticipation(input: CreateParticipationInput): Promise<PerformancePartnerParticipation> {
    const season = await this.currentSeason();
    const participation: PerformancePartnerParticipation = {
      id: `participation-${this.participations.length + 1}`,
      userId: input.userId,
      seasonId: input.seasonId ?? season.id,
      planCode: input.planCode,
      status: "ACTIVE",
      participationAmountCents: input.participationAmountCents,
      startsAt: input.startsAt,
      expiresAt: input.expiresAt,
      remainingWeeks: input.remainingWeeks,
      remainingDistributions: input.remainingDistributions,
      contractualPayoutNotice:
        "The contractual payout represents the complete financial obligation under the participation agreement. No additional capital repayment is due after completion.",
      noRetroactiveDistribution: true,
    };
    this.participations.unshift(participation);
    return participation;
  }

  async completeParticipation(input: { participationId: string }): Promise<PerformancePartnerParticipation | null> {
    const participation = this.participations.find((item) => item.id === input.participationId);
    if (!participation) return null;
    participation.status = "COMPLETED";
    participation.remainingWeeks = 0;
    participation.remainingDistributions = 0;
    return participation;
  }

  async openRenewal(input: { actorUserId: string; participationId: string }): Promise<ParticipationRenewalResult | null> {
    const participation = this.participations.find((item) => item.id === input.participationId);
    if (!participation) return null;
    if (participation.userId !== input.actorUserId) return null;
    participation.status = "RENEWAL_OPEN";
    return {
      participation,
      renewalStatus: "READY_FOR_NEXT_SEASON_REGISTRATION",
      message: "Renewal is open for next season registration. No automatic renewal has been created.",
    };
  }
}
