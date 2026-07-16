import type {
  ParticipationPlanCode,
  ParticipationSimulatorInput,
  ParticipationSimulatorResult,
  SeasonOperatingModel,
} from "@fpf/shared";
import { defaultSeasonOperatingModel } from "./defaults.js";

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
  operatingModel(): SeasonOperatingModel {
    return defaultSeasonOperatingModel;
  }

  simulateParticipation(input: ParticipationSimulatorInput, asOf = new Date()): ParticipationSimulatorResult {
    const model = this.operatingModel();
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
}
