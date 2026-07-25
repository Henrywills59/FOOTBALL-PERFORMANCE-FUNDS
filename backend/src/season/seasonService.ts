import type {
  ParticipationPlanCode,
  ParticipationSimulatorInput,
  ParticipationSimulatorResult,
  PerformancePartnerParticipation,
  SeasonOperatingModel,
} from "@fpf/shared";
import { defaultSeasonOperatingModel } from "./defaults.js";
import type { SeasonRepository } from "./types.js";

const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function weeksBetween(start: Date, end: Date) {
  if (end.getTime() <= start.getTime()) return 0;
  return Math.ceil((end.getTime() - start.getTime()) / millisecondsPerWeek);
}

function plannedWeeks(planCode: ParticipationPlanCode, totalWeeks: number, remainingSeasonWeeks: number) {
  if (planCode === "FULL_SEASON") return totalWeeks;
  if (planCode === "HALF_SEASON") return Math.ceil(totalWeeks / 2);
  return remainingSeasonWeeks;
}

export class SeasonService {
  constructor(private readonly repository?: SeasonRepository) {}

  async operatingModel(): Promise<SeasonOperatingModel> {
    const currentSeason = (await this.repository?.currentSeason()) ?? defaultSeasonOperatingModel.currentSeason;
    const financialConstitution =
      (await this.repository?.financialConstitution(currentSeason.id)) ?? defaultSeasonOperatingModel.financialConstitution;

    return {
      ...defaultSeasonOperatingModel,
      currentSeason,
      financialConstitution,
    };
  }

  private participationTiming(input: ParticipationSimulatorInput, model: SeasonOperatingModel, asOf = new Date()) {
    const season = model.currentSeason;
    const plan = model.participationPlans.find((item) => item.code === input.planCode) ?? model.participationPlans[0];
    const seasonEndsAt = new Date(season.seasonEndsAt);
    const seasonStartsAt = new Date(season.seasonStartsAt);
    const effectiveStart = asOf.getTime() > seasonStartsAt.getTime() ? asOf : seasonStartsAt;
    const remainingSeasonWeeks = clamp(
      input.remainingWeeks ?? weeksBetween(effectiveStart, seasonEndsAt),
      0,
      season.totalWeeks,
    );
    const remainingWeeks = clamp(plannedWeeks(plan.code, season.totalWeeks, remainingSeasonWeeks), 0, season.totalWeeks);
    return { plan, season, effectiveStart, remainingWeeks };
  }

  async simulateParticipation(input: ParticipationSimulatorInput, asOf = new Date()): Promise<ParticipationSimulatorResult> {
    const model = await this.operatingModel();
    const { plan, season, remainingWeeks } = this.participationTiming(input, model, asOf);
    const participationAmountCents = Math.max(0, Math.round(input.participationAmountCents));

    // Placeholder only: conservative 0.75% weekly planning rate for scenario modelling.
    const estimatedWeeklyDistributionCents = Math.round(participationAmountCents * 0.0075);

    return {
      input: {
        participationAmountCents,
        planCode: plan.code,
        currentSeasonId: input.currentSeasonId ?? season.id,
        remainingWeeks,
      },
      plan,
      season,
      estimatedWeeklyDistributionCents,
      estimatedTotalContractualPayoutCents: estimatedWeeklyDistributionCents * remainingWeeks,
      contractExpiry: season.settlementStartsAt,
      remainingWeeks,
      remainingDistributions: remainingWeeks,
      notices: model.notices,
    };
  }

  async listParticipations(userId: string): Promise<PerformancePartnerParticipation[]> {
    return this.repository?.listParticipations(userId) ?? [];
  }

  async createParticipation(input: {
    userId: string;
    seasonId?: string;
    planCode: ParticipationPlanCode;
    participationAmountCents: number;
  }) {
    const model = await this.operatingModel();
    const simulation = await this.simulateParticipation({
      participationAmountCents: input.participationAmountCents,
      planCode: input.planCode,
      currentSeasonId: input.seasonId ?? model.currentSeason.id,
    });
    const startsAt = new Date() > new Date(simulation.season.seasonStartsAt)
      ? new Date().toISOString()
      : simulation.season.seasonStartsAt;

    return this.repository?.createParticipation({
      userId: input.userId,
      seasonId: input.seasonId ?? simulation.season.id,
      planCode: input.planCode,
      participationAmountCents: Math.max(0, Math.round(input.participationAmountCents)),
      startsAt,
      expiresAt: simulation.contractExpiry,
      remainingWeeks: simulation.remainingWeeks,
      remainingDistributions: simulation.remainingDistributions,
    }) ?? {
      id: `transient-${Date.now()}`,
      userId: input.userId,
      seasonId: input.seasonId ?? simulation.season.id,
      planCode: input.planCode,
      status: "ACTIVE" as const,
      participationAmountCents: Math.max(0, Math.round(input.participationAmountCents)),
      startsAt,
      expiresAt: simulation.contractExpiry,
      remainingWeeks: simulation.remainingWeeks,
      remainingDistributions: simulation.remainingDistributions,
      contractualPayoutNotice: model.notices.contractualPayout,
      noRetroactiveDistribution: true,
    };
  }

  completeParticipation(actorUserId: string, participationId: string) {
    return this.repository?.completeParticipation({ actorUserId, participationId }) ?? null;
  }

  openRenewal(actorUserId: string, participationId: string) {
    return this.repository?.openRenewal({ actorUserId, participationId }) ?? null;
  }
}
