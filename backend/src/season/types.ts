import type {
  FinancialConstitutionAllocation,
  FpfSeason,
  ParticipationPlanCode,
  ParticipationRenewalResult,
  PerformancePartnerParticipation,
} from "@fpf/shared";

export type CreateParticipationInput = {
  userId: string;
  seasonId?: string;
  planCode: ParticipationPlanCode;
  participationAmountCents: number;
  startsAt: string;
  expiresAt: string;
  remainingWeeks: number;
  remainingDistributions: number;
};

export type SeasonRepository = {
  currentSeason(): Promise<FpfSeason | null>;
  financialConstitution(seasonId: string): Promise<FinancialConstitutionAllocation[]>;
  listParticipations(userId: string): Promise<PerformancePartnerParticipation[]>;
  createParticipation(input: CreateParticipationInput): Promise<PerformancePartnerParticipation>;
  completeParticipation(input: { actorUserId: string; participationId: string }): Promise<PerformancePartnerParticipation | null>;
  openRenewal(input: { actorUserId: string; participationId: string }): Promise<ParticipationRenewalResult | null>;
};
