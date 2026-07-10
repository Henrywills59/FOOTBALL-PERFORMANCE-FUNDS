import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../database/prismaClient.js";
import { isPrismaRecoverableReadError, logOptionalDataFallback } from "../database/prismaErrors.js";
import type {
  AcademyPrediction,
  AdminAnalystControlCenter,
  AnalystAcademy,
  AnalystAssignment,
  AnalystApplication,
  AnalystApplicationStatus,
  AnalystDashboard,
  AnalystFlag,
  AnalystIntelligenceSubmission,
  AnalystPerformanceDashboard,
  AnalystProfile,
  AnalystReliability,
  AnalystReport,
  AnalystReward,
  CapitalAllocation,
  FraudDetectionSignal,
  IntelligenceSubmissionStatus,
  PublishedIntelligence,
} from "@fpf/shared";
import type {
  AnalystRepository,
  CreateAcademyPredictionInput,
  CreateAnalystApplicationInput,
  CreateAssignmentInput,
  CreateSubmissionInput,
} from "./types.js";

type AssignmentRow = {
  id: string;
  fixtureId: string;
  leagueName: string;
  status: "ASSIGNED" | "COMPLETED" | "CANCELLED";
  adminNotes: string | null;
  fixture: { homeTeam: { name: string }; awayTeam: { name: string }; kickoffAt: Date };
};

type SubmissionRow = {
  id: string;
  fixtureId: string;
  leagueName: string;
  market: string;
  prediction: string;
  confidence: number;
  riskLevel: string;
  detailedReasoning: string;
  supportingStatistics: string;
  sourceNotes: string;
  briefExplanation: string;
  recommendedStake: string;
  adminNotes: string | null;
  status: IntelligenceSubmissionStatus;
  createdAt: Date;
  publishedAt: Date | null;
  fixture: { homeTeam: { name: string }; awayTeam: { name: string } };
};

function matchName(row: { fixture: { homeTeam: { name: string }; awayTeam: { name: string } } }) {
  return `${row.fixture.homeTeam.name} vs ${row.fixture.awayTeam.name}`;
}

function toAssignment(row: AssignmentRow): AnalystAssignment {
  return {
    id: row.id,
    fixtureId: row.fixtureId,
    match: matchName(row),
    leagueName: row.leagueName,
    kickoffAt: row.fixture.kickoffAt.toISOString(),
    status: row.status,
    adminNotes: row.adminNotes,
  };
}

function toSubmission(row: SubmissionRow): AnalystIntelligenceSubmission {
  return {
    id: row.id,
    fixtureId: row.fixtureId,
    match: matchName(row),
    leagueName: row.leagueName,
    market: row.market,
    prediction: row.prediction,
    confidence: row.confidence,
    riskLevel: row.riskLevel,
    detailedReasoning: row.detailedReasoning,
    supportingStatistics: row.supportingStatistics,
    sourceNotes: row.sourceNotes,
    briefExplanation: row.briefExplanation,
    recommendedStake: row.recommendedStake,
    adminNotes: row.adminNotes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

function toPublished(row: SubmissionRow): PublishedIntelligence {
  return {
    id: row.id,
    fixtureId: row.fixtureId,
    match: matchName(row),
    leagueName: row.leagueName,
    market: row.market,
    prediction: row.prediction,
    confidence: row.confidence,
    riskRating: row.riskLevel,
    briefExplanation: row.briefExplanation,
    recommendedStake: row.recommendedStake,
    publishedAt: row.publishedAt?.toISOString() ?? null,
  };
}

const submissionInclude = {
  fixture: { include: { homeTeam: true, awayTeam: true } },
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function toApplication(row: any): AnalystApplication {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    country: row.country,
    footballExperience: row.footballExperience,
    preferredLeagues: asStringArray(row.preferredLeagues),
    yearsOfExperience: row.yearsOfExperience,
    countriesCovered: asStringArray(row.countriesCovered),
    predictionStyle: row.predictionStyle,
    motivationStatement: row.motivationStatement,
    status: row.status,
    adminNotes: row.adminNotes ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function toAcademy(row: any): AnalystAcademy {
  return {
    id: row.id,
    analystId: row.analystId,
    applicationId: row.applicationId ?? null,
    status: row.status,
    startedAt: new Date(row.startedAt).toISOString(),
    endsAt: new Date(row.endsAt).toISOString(),
    durationDays: row.durationDays,
    virtualWalletCents: row.virtualWalletCents,
    virtualCapitalCents: row.virtualCapitalCents,
    demoFixtures: asStringArray(row.demoFixtures),
    adminNotes: row.adminNotes ?? null,
  };
}

function toAcademyPrediction(row: any): AcademyPrediction {
  return {
    id: row.id,
    analystId: row.analystId,
    academyId: row.academyId ?? null,
    matchName: row.matchName,
    leagueName: row.leagueName,
    market: row.market,
    prediction: row.prediction,
    confidence: row.confidence,
    riskLevel: row.riskLevel,
    explanation: row.explanation,
    supportingNotes: row.supportingNotes,
    stakeCents: row.stakeCents,
    odds: row.odds,
    result: row.result,
    profitLossCents: row.profitLossCents,
    createdAt: new Date(row.createdAt).toISOString(),
    settledAt: row.settledAt ? new Date(row.settledAt).toISOString() : null,
  };
}

function toProfile(row: any): AnalystProfile {
  const user = row.user ?? { name: "FPF Analyst", email: "internal@footballperformancefund.com" };
  return {
    id: row.id,
    userId: row.userId,
    name: user.name,
    email: user.email,
    rank: row.rank,
    status: row.status,
    reliabilityIndex: Math.round(row.reliabilityIndex),
    capitalAllocationCents: row.capitalAllocationCents,
    rewardBalanceCents: row.rewardBalanceCents,
    currentForm: Math.round(row.currentForm),
    drawdownPercent: row.drawdownPercent,
    marketSpecialization: row.marketSpecialization,
    adminNotes: row.adminNotes ?? null,
  };
}

function toReliability(row: any): AnalystReliability {
  return {
    analystId: row.analystId,
    predictionAccuracy: row.predictionAccuracy,
    roi: row.roi,
    winRate: row.winRate,
    drawdown: row.drawdown,
    riskManagement: row.riskManagement,
    confidenceCalibration: row.confidenceCalibration,
    consistency: row.consistency,
    predictionQuality: row.predictionQuality,
    marketSpecialization: row.marketSpecialization,
    discipline: row.discipline,
    analystReliabilityIndex: row.analystReliabilityIndex,
    evaluatedAt: new Date(row.evaluatedAt).toISOString(),
  };
}

function toAllocation(row: any): CapitalAllocation {
  return {
    id: row.id,
    analystId: row.analystId,
    dailyAllocationCents: row.dailyAllocationCents,
    weeklyAllocationCents: row.weeklyAllocationCents,
    monthlyAllocationCents: row.monthlyAllocationCents,
    reliabilityIndex: row.reliabilityIndex,
    riskLimitPercent: row.riskLimitPercent,
    reason: row.reason,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

function toReward(row: any): AnalystReward {
  return {
    id: row.id,
    analystId: row.analystId,
    rewardPoolId: row.rewardPoolId ?? null,
    profitGeneratedCents: row.profitGeneratedCents,
    rewardCents: row.rewardCents,
    roi: row.roi,
    accuracy: row.accuracy,
    consistency: row.consistency,
    capitalEfficiency: row.capitalEfficiency,
    reliabilityIndex: row.reliabilityIndex,
    riskAdjustedScore: row.riskAdjustedScore,
    status: row.status,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

function toReport(row: any): AnalystReport {
  return {
    id: row.id,
    analystId: row.analystId,
    periodType: row.periodType,
    title: row.title,
    summary: row.summary,
    metrics: typeof row.metrics === "object" && row.metrics ? row.metrics : {},
    generatedAt: new Date(row.generatedAt).toISOString(),
  };
}

function toFlag(row: any): AnalystFlag {
  return {
    id: row.id,
    analystId: row.analystId,
    severity: row.severity,
    category: row.category,
    message: row.message,
    status: row.status,
    metadata: typeof row.metadata === "object" && row.metadata ? row.metadata : {},
    createdAt: new Date(row.createdAt).toISOString(),
    resolvedAt: row.resolvedAt ? new Date(row.resolvedAt).toISOString() : null,
  };
}

function toFraudSignal(row: any): FraudDetectionSignal {
  return {
    id: row.id,
    analystId: row.analystId ?? null,
    signal: row.signal,
    severity: row.severity,
    status: row.status,
    description: row.description,
    metadata: typeof row.metadata === "object" && row.metadata ? row.metadata : {},
    detectedAt: new Date(row.detectedAt).toISOString(),
  };
}

function reliabilityFromPredictions(analystId: string, predictions: AcademyPrediction[]): AnalystReliability {
  const settled = predictions.filter((prediction) => prediction.result !== "PENDING");
  const wins = settled.filter((prediction) => prediction.result === "WON").length;
  const totalStake = settled.reduce((sum, prediction) => sum + prediction.stakeCents, 0);
  const profit = settled.reduce((sum, prediction) => sum + prediction.profitLossCents, 0);
  const winRate = settled.length ? (wins / settled.length) * 100 : 0;
  const roi = totalStake ? (profit / totalStake) * 100 : 0;
  const averageConfidence = predictions.length
    ? predictions.reduce((sum, prediction) => sum + prediction.confidence, 0) / predictions.length
    : 50;
  const riskPenalty = predictions.filter((prediction) => prediction.riskLevel === "HIGH").length * 3;
  const consistency = predictions.length >= 5 ? 70 : 45;
  const predictionQuality = clamp((winRate + averageConfidence) / 2);
  const analystReliabilityIndex = clamp(40 + winRate * 0.25 + Math.max(-20, roi) * 0.2 + consistency * 0.2 - riskPenalty);
  return {
    analystId,
    predictionAccuracy: clamp(winRate),
    roi,
    winRate,
    drawdown: Math.max(0, -roi),
    riskManagement: clamp(75 - riskPenalty),
    confidenceCalibration: clamp(100 - Math.abs(averageConfidence - winRate)),
    consistency,
    predictionQuality,
    marketSpecialization: predictions.length ? 60 : 40,
    discipline: clamp(85 - riskPenalty),
    analystReliabilityIndex,
    evaluatedAt: new Date().toISOString(),
  };
}

function rankFromReliability(index: number): AnalystProfile["rank"] {
  if (index >= 92) return "MASTER";
  if (index >= 85) return "ELITE";
  if (index >= 75) return "SENIOR";
  if (index >= 65) return "PROFESSIONAL";
  if (index >= 55) return "ASSOCIATE";
  return "ACADEMY";
}

function allocationFromReliability(analystId: string, reliabilityIndex: number): CapitalAllocation {
  const daily = reliabilityIndex >= 55 ? Math.round(reliabilityIndex * 1500) : 0;
  return {
    id: randomUUID(),
    analystId,
    dailyAllocationCents: daily,
    weeklyAllocationCents: daily * 5,
    monthlyAllocationCents: daily * 20,
    reliabilityIndex,
    riskLimitPercent: reliabilityIndex >= 75 ? 7 : 4,
    reason: daily
      ? "Placeholder company capital allocation based on ARI, ROI, accuracy, consistency, drawdown, and risk management."
      : "No company capital allocated until analyst reliability clears the academy threshold.",
    createdAt: new Date().toISOString(),
  };
}

function fallbackProfile(analystId: string): AnalystProfile {
  return {
    id: `profile:${analystId}`,
    userId: analystId,
    name: "FPF Analyst",
    email: "internal-analyst@footballperformancefund.com",
    rank: "ACADEMY",
    status: "ACADEMY",
    reliabilityIndex: 50,
    capitalAllocationCents: 0,
    rewardBalanceCents: 0,
    currentForm: 50,
    drawdownPercent: 0,
    marketSpecialization: "General football intelligence",
    adminNotes: "Safe placeholder profile pending analyst production table migration.",
  };
}

export class PrismaAnalystRepository implements AnalystRepository {
  private fallbackApplications: AnalystApplication[] = [];
  private fallbackAcademy: AnalystAcademy[] = [];
  private fallbackPredictions: AcademyPrediction[] = [];
  private fallbackProfiles: AnalystProfile[] = [];
  private fallbackAllocations: CapitalAllocation[] = [];
  private fallbackRewards: AnalystReward[] = [];
  private fallbackFlags: AnalystFlag[] = [];
  private fallbackFraudSignals: FraudDetectionSignal[] = [];

  constructor(private readonly prismaClient?: PrismaClient) {}

  private get prisma() {
    return this.prismaClient ?? getPrismaClient();
  }

  async createApplication(input: CreateAnalystApplicationInput): Promise<AnalystApplication> {
    try {
      const application = await (this.prisma as any).analystApplication.create({
        data: input,
      });
      return toApplication(application);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.applications.create", error);
      const now = new Date().toISOString();
      const application: AnalystApplication = {
        id: randomUUID(),
        ...input,
        status: "SUBMITTED",
        adminNotes: null,
        createdAt: now,
        updatedAt: now,
      };
      this.fallbackApplications.unshift(application);
      return application;
    }
  }

  async listApplications(): Promise<AnalystApplication[]> {
    try {
      const applications = await (this.prisma as any).analystApplication.findMany({ orderBy: { createdAt: "desc" } });
      return applications.map(toApplication);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.applications", error);
      return this.fallbackApplications;
    }
  }

  async updateApplicationStatus(id: string, status: AnalystApplicationStatus, adminNotes?: string | null) {
    try {
      const application = await (this.prisma as any).analystApplication.update({
        where: { id },
        data: { status, adminNotes: adminNotes ?? undefined },
      });
      return toApplication(application);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.applications.status", error);
      const application = this.fallbackApplications.find((item) => item.id === id);
      if (!application) return null;
      application.status = status;
      application.adminNotes = adminNotes ?? application.adminNotes;
      application.updatedAt = new Date().toISOString();
      return application;
    }
  }

  async listAnalysts(): Promise<AnalystProfile[]> {
    try {
      const profiles = await (this.prisma as any).analystProfile.findMany({
        include: { user: true },
        orderBy: [{ reliabilityIndex: "desc" }, { updatedAt: "desc" }],
      });
      return profiles.map(toProfile);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.profiles", error);
      return this.fallbackProfiles;
    }
  }

  async promoteAnalyst(analystId: string, adminNotes?: string | null): Promise<AnalystProfile> {
    const reliability = await this.currentReliability(analystId);
    const rank = rankFromReliability(Math.max(60, reliability.analystReliabilityIndex));
    const allocation = allocationFromReliability(analystId, Math.max(60, reliability.analystReliabilityIndex));
    try {
      const profile = await (this.prisma as any).analystProfile.upsert({
        where: { userId: analystId },
        create: {
          userId: analystId,
          rank,
          status: "ACTIVE",
          reliabilityIndex: reliability.analystReliabilityIndex,
          capitalAllocationCents: allocation.weeklyAllocationCents,
          adminNotes,
        },
        update: {
          rank,
          status: "ACTIVE",
          reliabilityIndex: reliability.analystReliabilityIndex,
          capitalAllocationCents: allocation.weeklyAllocationCents,
          adminNotes,
        },
        include: { user: true },
      });
      await (this.prisma as any).capitalAllocation.create({ data: allocation });
      return toProfile(profile);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.promote", error);
      const existing = this.fallbackProfiles.find((item) => item.userId === analystId);
      const profile = existing ?? fallbackProfile(analystId);
      profile.rank = rank;
      profile.status = "ACTIVE";
      profile.reliabilityIndex = reliability.analystReliabilityIndex;
      profile.capitalAllocationCents = allocation.weeklyAllocationCents;
      profile.adminNotes = adminNotes ?? profile.adminNotes;
      this.fallbackProfiles = [profile, ...this.fallbackProfiles.filter((item) => item.userId !== analystId)];
      this.fallbackAllocations.unshift(allocation);
      return profile;
    }
  }

  async suspendAnalyst(analystId: string, adminNotes?: string | null): Promise<AnalystProfile> {
    try {
      const profile = await (this.prisma as any).analystProfile.upsert({
        where: { userId: analystId },
        create: { userId: analystId, rank: "SUSPENDED", status: "SUSPENDED", adminNotes },
        update: { rank: "SUSPENDED", status: "SUSPENDED", capitalAllocationCents: 0, adminNotes },
        include: { user: true },
      });
      return toProfile(profile);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.suspend", error);
      const existing = this.fallbackProfiles.find((item) => item.userId === analystId);
      const profile = existing ?? fallbackProfile(analystId);
      profile.rank = "SUSPENDED";
      profile.status = "SUSPENDED";
      profile.capitalAllocationCents = 0;
      profile.adminNotes = adminNotes ?? profile.adminNotes;
      this.fallbackProfiles = [profile, ...this.fallbackProfiles.filter((item) => item.userId !== analystId)];
      return profile;
    }
  }

  async createAcademyPrediction(input: CreateAcademyPredictionInput): Promise<AcademyPrediction> {
    const data = {
      ...input,
      stakeCents: input.stakeCents ?? 1000,
      odds: input.odds ?? 1.9,
    };
    try {
      const academy = await (this.prisma as any).analystAcademy.findFirst({
        where: { analystId: input.analystId, status: { in: ["ACTIVE", "EXTENDED"] } },
        orderBy: { startedAt: "desc" },
      });
      const prediction = await (this.prisma as any).academyPrediction.create({
        data: { ...data, academyId: academy?.id ?? null },
      });
      return toAcademyPrediction(prediction);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.academyPrediction.create", error);
      const prediction: AcademyPrediction = {
        id: randomUUID(),
        analystId: input.analystId,
        academyId: this.fallbackAcademy.find((item) => item.analystId === input.analystId)?.id ?? null,
        matchName: input.matchName,
        leagueName: input.leagueName,
        market: input.market,
        prediction: input.prediction,
        confidence: input.confidence,
        riskLevel: input.riskLevel,
        explanation: input.explanation,
        supportingNotes: input.supportingNotes,
        stakeCents: data.stakeCents,
        odds: data.odds,
        result: "PENDING",
        profitLossCents: 0,
        createdAt: new Date().toISOString(),
        settledAt: null,
      };
      this.fallbackPredictions.unshift(prediction);
      return prediction;
    }
  }

  async performanceDashboard(analystId: string): Promise<AnalystPerformanceDashboard> {
    const [academy, predictions, allocations, rewards, reports, flags] = await Promise.all([
      this.listAcademy(analystId),
      this.listAcademyPredictions(analystId),
      this.listAllocations(analystId),
      this.listRewards(analystId),
      this.listReports(analystId),
      this.listFlags(analystId),
    ]);
    const reliability = reliabilityFromPredictions(analystId, predictions);
    const profile = (await this.findProfile(analystId)) ?? {
      ...fallbackProfile(analystId),
      reliabilityIndex: reliability.analystReliabilityIndex,
      rank: rankFromReliability(reliability.analystReliabilityIndex),
    };
    return {
      profile,
      reliability,
      academy,
      demoPredictions: predictions,
      capitalAllocations: allocations.length ? allocations : [allocationFromReliability(analystId, reliability.analystReliabilityIndex)],
      rewards,
      reports,
      flags,
      graduationRecommendation: reliability.analystReliabilityIndex >= 65 ? "PROMOTE" : predictions.length >= 8 ? "EXTEND_ACADEMY" : "REJECT",
      aiFeedback: [
        reliability.analystReliabilityIndex >= 65
          ? "AI evaluation indicates this analyst is ready for admin promotion review."
          : "AI evaluation requires more academy evidence before promotion.",
        "No subscriber-facing analyst identity is exposed by this workflow.",
      ],
    };
  }

  async calculateRewards(_adminUserId: string): Promise<AdminAnalystControlCenter> {
    const analysts = await this.listAnalysts();
    const activeAnalysts = analysts.length ? analysts : [fallbackProfile("analyst-placeholder")];
    const companyNetProfitCents = 500000;
    const rewardPoolCents = Math.round(companyNetProfitCents * 0.2);
    const scoreTotal = activeAnalysts.reduce((sum, analyst) => sum + Math.max(1, analyst.reliabilityIndex), 0);
    const rewards = activeAnalysts.map((analyst) => {
      const reward: AnalystReward = {
        id: randomUUID(),
        analystId: analyst.userId,
        rewardPoolId: null,
        profitGeneratedCents: Math.round(companyNetProfitCents * (analyst.reliabilityIndex / scoreTotal)),
        rewardCents: Math.round(rewardPoolCents * (analyst.reliabilityIndex / scoreTotal)),
        roi: analyst.currentForm,
        accuracy: analyst.reliabilityIndex,
        consistency: analyst.currentForm,
        capitalEfficiency: analyst.reliabilityIndex,
        reliabilityIndex: analyst.reliabilityIndex,
        riskAdjustedScore: clamp(analyst.reliabilityIndex - analyst.drawdownPercent),
        status: "CALCULATED",
        createdAt: new Date().toISOString(),
      };
      return reward;
    });
    try {
      await Promise.all(rewards.map((reward) => (this.prisma as any).analystReward.create({ data: reward })));
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.rewards.calculate", error);
      this.fallbackRewards.unshift(...rewards);
    }
    return this.adminControlCenter();
  }

  async adminControlCenter(): Promise<AdminAnalystControlCenter> {
    const [applications, analysts, academy, predictions, allocations, rewards, flags, fraudSignals] = await Promise.all([
      this.listApplications(),
      this.listAnalysts(),
      this.listAllAcademy(),
      this.listAllAcademyPredictions(),
      this.listAllAllocations(),
      this.listAllRewards(),
      this.listAllFlags(),
      this.listFraudSignals(),
    ]);
    const reliability = await Promise.all(analysts.map((analyst) => this.currentReliability(analyst.userId)));
    return {
      applications,
      analysts,
      academy,
      predictions,
      reliability,
      capitalAllocations: allocations,
      rewards,
      reports: [],
      flags,
      fraudSignals,
      rewardPoolPercent: 20,
      academyDurationDays: 14,
    };
  }

  private async findProfile(analystId: string): Promise<AnalystProfile | null> {
    try {
      const profile = await (this.prisma as any).analystProfile.findUnique({
        where: { userId: analystId },
        include: { user: true },
      });
      return profile ? toProfile(profile) : null;
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.profile", error);
      return this.fallbackProfiles.find((item) => item.userId === analystId) ?? null;
    }
  }

  private async listAcademy(analystId: string): Promise<AnalystAcademy | null> {
    try {
      const academy = await (this.prisma as any).analystAcademy.findFirst({
        where: { analystId },
        orderBy: { startedAt: "desc" },
      });
      return academy ? toAcademy(academy) : null;
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.academy", error);
      return this.fallbackAcademy.find((item) => item.analystId === analystId) ?? null;
    }
  }

  private async listAllAcademy(): Promise<AnalystAcademy[]> {
    try {
      const academy = await (this.prisma as any).analystAcademy.findMany({ orderBy: { startedAt: "desc" } });
      return academy.map(toAcademy);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.academy.all", error);
      return this.fallbackAcademy;
    }
  }

  private async listAcademyPredictions(analystId: string): Promise<AcademyPrediction[]> {
    try {
      const predictions = await (this.prisma as any).academyPrediction.findMany({
        where: { analystId },
        orderBy: { createdAt: "desc" },
      });
      return predictions.map(toAcademyPrediction);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.academyPredictions", error);
      return this.fallbackPredictions.filter((item) => item.analystId === analystId);
    }
  }

  private async listAllAcademyPredictions(): Promise<AcademyPrediction[]> {
    try {
      const predictions = await (this.prisma as any).academyPrediction.findMany({ orderBy: { createdAt: "desc" } });
      return predictions.map(toAcademyPrediction);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.academyPredictions.all", error);
      return this.fallbackPredictions;
    }
  }

  private async listAllocations(analystId: string): Promise<CapitalAllocation[]> {
    try {
      const allocations = await (this.prisma as any).capitalAllocation.findMany({
        where: { analystId },
        orderBy: { createdAt: "desc" },
        take: 12,
      });
      return allocations.map(toAllocation);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.allocations", error);
      return this.fallbackAllocations.filter((item) => item.analystId === analystId);
    }
  }

  private async listAllAllocations(): Promise<CapitalAllocation[]> {
    try {
      const allocations = await (this.prisma as any).capitalAllocation.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return allocations.map(toAllocation);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.allocations.all", error);
      return this.fallbackAllocations;
    }
  }

  private async listRewards(analystId: string): Promise<AnalystReward[]> {
    try {
      const rewards = await (this.prisma as any).analystReward.findMany({
        where: { analystId },
        orderBy: { createdAt: "desc" },
        take: 12,
      });
      return rewards.map(toReward);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.rewards", error);
      return this.fallbackRewards.filter((item) => item.analystId === analystId);
    }
  }

  private async listAllRewards(): Promise<AnalystReward[]> {
    try {
      const rewards = await (this.prisma as any).analystReward.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
      return rewards.map(toReward);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.rewards.all", error);
      return this.fallbackRewards;
    }
  }

  private async listReports(analystId: string): Promise<AnalystReport[]> {
    try {
      const reports = await (this.prisma as any).analystReport.findMany({
        where: { analystId },
        orderBy: { generatedAt: "desc" },
        take: 12,
      });
      return reports.map(toReport);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.reports", error);
      return [];
    }
  }

  private async listFlags(analystId: string): Promise<AnalystFlag[]> {
    try {
      const flags = await (this.prisma as any).analystFlag.findMany({
        where: { analystId },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      return flags.map(toFlag);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.flags", error);
      return this.fallbackFlags.filter((item) => item.analystId === analystId);
    }
  }

  private async listAllFlags(): Promise<AnalystFlag[]> {
    try {
      const flags = await (this.prisma as any).analystFlag.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
      return flags.map(toFlag);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.flags.all", error);
      return this.fallbackFlags;
    }
  }

  private async listFraudSignals(): Promise<FraudDetectionSignal[]> {
    try {
      const signals = await (this.prisma as any).fraudDetection.findMany({ orderBy: { detectedAt: "desc" }, take: 50 });
      return signals.map(toFraudSignal);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.fraud", error);
      return this.fallbackFraudSignals;
    }
  }

  private async currentReliability(analystId: string): Promise<AnalystReliability> {
    try {
      const reliability = await (this.prisma as any).analystReliability.findFirst({
        where: { analystId },
        orderBy: { evaluatedAt: "desc" },
      });
      if (reliability) return toReliability(reliability);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.reliability", error);
    }
    return reliabilityFromPredictions(analystId, await this.listAcademyPredictions(analystId));
  }

  async dashboard(analystId: string): Promise<AnalystDashboard> {
    const [assignments, submissions] = await Promise.all([
      this.listAssignments(analystId),
      this.listAnalystSubmissions(analystId),
    ]);
    return {
      assignedMatches: assignments,
      assignedLeagues: Array.from(new Set(assignments.map((assignment) => assignment.leagueName))),
      pendingTasks: assignments.filter((assignment) => assignment.status === "ASSIGNED").length,
      submittedIntelligence: submissions.length,
      approvedIntelligence: submissions.filter((submission) =>
        ["APPROVED", "PUBLISHED"].includes(submission.status),
      ).length,
      rejectedIntelligence: submissions.filter((submission) => submission.status === "REJECTED").length,
      analystPerformanceSummary: submissions.length
        ? `${submissions.length} intelligence items submitted for FPF review.`
        : "No submitted intelligence yet.",
      adminNotes: assignments.flatMap((assignment) => (assignment.adminNotes ? [assignment.adminNotes] : [])),
    };
  }

  async listAssignments(analystId: string) {
    let assignments;
    try {
      assignments = await this.prisma.analystAssignment.findMany({
        where: { analystId },
        include: { fixture: { include: { homeTeam: true, awayTeam: true } } },
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.assignments", error);
      return [];
    }
    return assignments.map(toAssignment);
  }

  async createAssignment(input: CreateAssignmentInput) {
    const assignment = await this.prisma.analystAssignment.upsert({
      where: { analystId_fixtureId: { analystId: input.analystId, fixtureId: input.fixtureId } },
      create: input,
      update: { leagueName: input.leagueName, adminNotes: input.adminNotes ?? null, status: "ASSIGNED" },
      include: { fixture: { include: { homeTeam: true, awayTeam: true } } },
    });
    return toAssignment(assignment);
  }

  async createSubmission(input: CreateSubmissionInput) {
    const submission = await this.prisma.analystIntelligenceSubmission.create({
      data: input,
      include: submissionInclude,
    });
    return toSubmission(submission);
  }

  async updateSubmission(id: string, analystId: string, input: Partial<Omit<CreateSubmissionInput, "analystId">>) {
    const existing = await this.prisma.analystIntelligenceSubmission.findFirst({
      where: { id, analystId, status: { in: ["DRAFT", "REJECTED"] } },
    });
    if (!existing) return null;
    const submission = await this.prisma.analystIntelligenceSubmission.update({
      where: { id },
      data: input,
      include: submissionInclude,
    });
    return toSubmission(submission);
  }

  async submitForReview(id: string, analystId: string) {
    const existing = await this.prisma.analystIntelligenceSubmission.findFirst({
      where: { id, analystId, status: { in: ["DRAFT", "REJECTED"] } },
    });
    if (!existing) return null;
    const submission = await this.prisma.analystIntelligenceSubmission.update({
      where: { id },
      data: { status: "PENDING_REVIEW" },
      include: submissionInclude,
    });
    return toSubmission(submission);
  }

  async listAnalystSubmissions(analystId: string) {
    let submissions;
    try {
      submissions = await this.prisma.analystIntelligenceSubmission.findMany({
        where: { analystId },
        include: submissionInclude,
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("analyst.submissions", error);
      return [];
    }
    return submissions.map(toSubmission);
  }

  async listAdminSubmissions() {
    let submissions;
    try {
      submissions = await this.prisma.analystIntelligenceSubmission.findMany({
        include: submissionInclude,
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("admin.intelligence", error);
      return [];
    }
    return submissions.map(toSubmission);
  }

  async updateStatus(id: string, status: IntelligenceSubmissionStatus, adminNotes?: string | null) {
    const submission = await this.prisma.analystIntelligenceSubmission.update({
      where: { id },
      data: {
        status,
        adminNotes: adminNotes ?? undefined,
        publishedAt: status === "PUBLISHED" ? new Date() : status === "APPROVED" ? null : undefined,
      },
      include: submissionInclude,
    });
    return toSubmission(submission);
  }

  async updateAdminNotes(id: string, adminNotes: string) {
    const submission = await this.prisma.analystIntelligenceSubmission.update({
      where: { id },
      data: { adminNotes },
      include: submissionInclude,
    });
    return toSubmission(submission);
  }

  async listPublished() {
    let submissions;
    try {
      submissions = await this.prisma.analystIntelligenceSubmission.findMany({
        where: { status: "PUBLISHED" },
        include: submissionInclude,
        orderBy: { publishedAt: "desc" },
      });
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("intelligence.published", error);
      return [];
    }
    return submissions.map(toPublished);
  }
}
