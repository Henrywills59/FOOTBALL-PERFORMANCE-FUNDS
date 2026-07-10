import { randomUUID } from "node:crypto";
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

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
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
    adminNotes: null,
  };
}

function reliabilityFromPredictions(analystId: string, predictions: AcademyPrediction[]): AnalystReliability {
  const settled = predictions.filter((prediction) => prediction.result !== "PENDING");
  const wins = settled.filter((prediction) => prediction.result === "WON").length;
  const winRate = settled.length ? (wins / settled.length) * 100 : 0;
  const stake = settled.reduce((sum, prediction) => sum + prediction.stakeCents, 0);
  const profit = settled.reduce((sum, prediction) => sum + prediction.profitLossCents, 0);
  const roi = stake ? (profit / stake) * 100 : 0;
  const averageConfidence = predictions.length ? predictions.reduce((sum, prediction) => sum + prediction.confidence, 0) / predictions.length : 50;
  const riskPenalty = predictions.filter((prediction) => prediction.riskLevel === "HIGH").length * 3;
  const consistency = predictions.length >= 5 ? 70 : 45;
  return {
    analystId,
    predictionAccuracy: clamp(winRate),
    roi,
    winRate,
    drawdown: Math.max(0, -roi),
    riskManagement: clamp(75 - riskPenalty),
    confidenceCalibration: clamp(100 - Math.abs(averageConfidence - winRate)),
    consistency,
    predictionQuality: clamp((winRate + averageConfidence) / 2),
    marketSpecialization: predictions.length ? 60 : 40,
    discipline: clamp(85 - riskPenalty),
    analystReliabilityIndex: clamp(40 + winRate * 0.25 + Math.max(-20, roi) * 0.2 + consistency * 0.2 - riskPenalty),
    evaluatedAt: new Date().toISOString(),
  };
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

export class InMemoryAnalystRepository implements AnalystRepository {
  assignments: Array<AnalystAssignment & { analystId: string }> = [];
  submissions: Array<AnalystIntelligenceSubmission & { analystId: string }> = [];
  applications: AnalystApplication[] = [];
  academy: AnalystAcademy[] = [];
  academyPredictions: AcademyPrediction[] = [];
  profiles: AnalystProfile[] = [];
  allocations: CapitalAllocation[] = [];
  rewards: AnalystReward[] = [];
  flags: AnalystFlag[] = [];
  fraudSignals: FraudDetectionSignal[] = [];

  async createApplication(input: CreateAnalystApplicationInput) {
    const now = new Date().toISOString();
    const application: AnalystApplication = {
      id: randomUUID(),
      ...input,
      status: "SUBMITTED",
      adminNotes: null,
      createdAt: now,
      updatedAt: now,
    };
    this.applications.unshift(application);
    return application;
  }

  async listApplications() {
    return this.applications;
  }

  async updateApplicationStatus(id: string, status: AnalystApplicationStatus, adminNotes?: string | null) {
    const application = this.applications.find((item) => item.id === id);
    if (!application) return null;
    application.status = status;
    application.adminNotes = adminNotes ?? application.adminNotes;
    application.updatedAt = new Date().toISOString();
    return application;
  }

  async listAnalysts() {
    return this.profiles;
  }

  async promoteAnalyst(analystId: string, adminNotes?: string | null) {
    const reliability = reliabilityFromPredictions(analystId, this.academyPredictions.filter((item) => item.analystId === analystId));
    const allocation = allocationFromReliability(analystId, Math.max(60, reliability.analystReliabilityIndex));
    const profile = this.profiles.find((item) => item.userId === analystId) ?? fallbackProfile(analystId);
    profile.rank = reliability.analystReliabilityIndex >= 75 ? "SENIOR" : reliability.analystReliabilityIndex >= 65 ? "PROFESSIONAL" : "ASSOCIATE";
    profile.status = "ACTIVE";
    profile.reliabilityIndex = Math.max(60, reliability.analystReliabilityIndex);
    profile.capitalAllocationCents = allocation.weeklyAllocationCents;
    profile.adminNotes = adminNotes ?? profile.adminNotes;
    this.profiles = [profile, ...this.profiles.filter((item) => item.userId !== analystId)];
    this.allocations.unshift(allocation);
    return profile;
  }

  async suspendAnalyst(analystId: string, adminNotes?: string | null) {
    const profile = this.profiles.find((item) => item.userId === analystId) ?? fallbackProfile(analystId);
    profile.rank = "SUSPENDED";
    profile.status = "SUSPENDED";
    profile.capitalAllocationCents = 0;
    profile.adminNotes = adminNotes ?? profile.adminNotes;
    this.profiles = [profile, ...this.profiles.filter((item) => item.userId !== analystId)];
    return profile;
  }

  async createAcademyPrediction(input: CreateAcademyPredictionInput) {
    const prediction: AcademyPrediction = {
      id: randomUUID(),
      analystId: input.analystId,
      academyId: this.academy.find((item) => item.analystId === input.analystId)?.id ?? null,
      matchName: input.matchName,
      leagueName: input.leagueName,
      market: input.market,
      prediction: input.prediction,
      confidence: input.confidence,
      riskLevel: input.riskLevel,
      explanation: input.explanation,
      supportingNotes: input.supportingNotes,
      stakeCents: input.stakeCents ?? 1000,
      odds: input.odds ?? 1.9,
      result: "PENDING",
      profitLossCents: 0,
      createdAt: new Date().toISOString(),
      settledAt: null,
    };
    this.academyPredictions.unshift(prediction);
    return prediction;
  }

  async performanceDashboard(analystId: string): Promise<AnalystPerformanceDashboard> {
    const predictions = this.academyPredictions.filter((item) => item.analystId === analystId);
    const reliability = reliabilityFromPredictions(analystId, predictions);
    const profile = this.profiles.find((item) => item.userId === analystId) ?? {
      ...fallbackProfile(analystId),
      reliabilityIndex: reliability.analystReliabilityIndex,
    };
    return {
      profile,
      reliability,
      academy: this.academy.find((item) => item.analystId === analystId) ?? null,
      demoPredictions: predictions,
      capitalAllocations: this.allocations.filter((item) => item.analystId === analystId),
      rewards: this.rewards.filter((item) => item.analystId === analystId),
      reports: [],
      flags: this.flags.filter((item) => item.analystId === analystId),
      graduationRecommendation: reliability.analystReliabilityIndex >= 65 ? "PROMOTE" : predictions.length >= 8 ? "EXTEND_ACADEMY" : "REJECT",
      aiFeedback: ["Academy performance is evaluated internally only.", "Subscriber output remains branded as FPF Intelligence."],
    };
  }

  async calculateRewards(_adminUserId: string) {
    const analysts = this.profiles.length ? this.profiles : [fallbackProfile("analyst-placeholder")];
    const scoreTotal = analysts.reduce((sum, analyst) => sum + Math.max(1, analyst.reliabilityIndex), 0);
    this.rewards.unshift(
      ...analysts.map((analyst) => ({
        id: randomUUID(),
        analystId: analyst.userId,
        rewardPoolId: null,
        profitGeneratedCents: Math.round(500000 * (analyst.reliabilityIndex / scoreTotal)),
        rewardCents: Math.round(100000 * (analyst.reliabilityIndex / scoreTotal)),
        roi: analyst.currentForm,
        accuracy: analyst.reliabilityIndex,
        consistency: analyst.currentForm,
        capitalEfficiency: analyst.reliabilityIndex,
        reliabilityIndex: analyst.reliabilityIndex,
        riskAdjustedScore: clamp(analyst.reliabilityIndex - analyst.drawdownPercent),
        status: "CALCULATED" as const,
        createdAt: new Date().toISOString(),
      })),
    );
    return this.adminControlCenter();
  }

  async adminControlCenter(): Promise<AdminAnalystControlCenter> {
    return {
      applications: this.applications,
      analysts: this.profiles,
      academy: this.academy,
      predictions: this.academyPredictions,
      reliability: this.profiles.map((profile) => reliabilityFromPredictions(profile.userId, this.academyPredictions.filter((item) => item.analystId === profile.userId))),
      capitalAllocations: this.allocations,
      rewards: this.rewards,
      reports: [],
      flags: this.flags,
      fraudSignals: this.fraudSignals,
      rewardPoolPercent: 20,
      academyDurationDays: 14,
    };
  }

  async dashboard(analystId: string): Promise<AnalystDashboard> {
    const assignments = await this.listAssignments(analystId);
    const submissions = await this.listAnalystSubmissions(analystId);
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
    return this.assignments.filter((assignment) => assignment.analystId === analystId);
  }

  async createAssignment(input: CreateAssignmentInput) {
    const assignment: AnalystAssignment & { analystId: string } = {
      id: `${input.analystId}:${input.fixtureId}`,
      analystId: input.analystId,
      fixtureId: input.fixtureId,
      match: input.fixtureId,
      leagueName: input.leagueName,
      kickoffAt: new Date().toISOString(),
      status: "ASSIGNED",
      adminNotes: input.adminNotes ?? null,
    };
    this.assignments = this.assignments.filter((item) => item.id !== assignment.id);
    this.assignments.push(assignment);
    return assignment;
  }

  async createSubmission(input: CreateSubmissionInput) {
    const submission: AnalystIntelligenceSubmission & { analystId: string } = {
      id: randomUUID(),
      analystId: input.analystId,
      fixtureId: input.fixtureId,
      match: input.fixtureId,
      leagueName: input.leagueName,
      market: input.market,
      prediction: input.prediction,
      confidence: input.confidence,
      riskLevel: input.riskLevel,
      detailedReasoning: input.detailedReasoning,
      supportingStatistics: input.supportingStatistics,
      sourceNotes: input.sourceNotes,
      briefExplanation: input.briefExplanation,
      recommendedStake: input.recommendedStake,
      adminNotes: null,
      status: input.status,
      createdAt: new Date().toISOString(),
      publishedAt: null,
    };
    this.submissions.push(submission);
    return submission;
  }

  async updateSubmission(id: string, analystId: string, input: Partial<Omit<CreateSubmissionInput, "analystId">>) {
    const submission = this.submissions.find((item) => item.id === id && item.analystId === analystId);
    if (!submission || !["DRAFT", "REJECTED"].includes(submission.status)) return null;
    Object.assign(submission, input);
    return submission;
  }

  async submitForReview(id: string, analystId: string) {
    const submission = this.submissions.find((item) => item.id === id && item.analystId === analystId);
    if (!submission || !["DRAFT", "REJECTED"].includes(submission.status)) return null;
    submission.status = "PENDING_REVIEW";
    return submission;
  }

  async listAnalystSubmissions(analystId: string) {
    return this.submissions.filter((submission) => submission.analystId === analystId);
  }

  async listAdminSubmissions() {
    return this.submissions;
  }

  async updateStatus(id: string, status: IntelligenceSubmissionStatus, adminNotes?: string | null) {
    const submission = this.submissions.find((item) => item.id === id);
    if (!submission) return null;
    submission.status = status;
    submission.adminNotes = adminNotes ?? submission.adminNotes;
    submission.publishedAt = status === "PUBLISHED" ? new Date().toISOString() : submission.publishedAt;
    return submission;
  }

  async updateAdminNotes(id: string, adminNotes: string) {
    const submission = this.submissions.find((item) => item.id === id);
    if (!submission) return null;
    submission.adminNotes = adminNotes;
    return submission;
  }

  async listPublished(): Promise<PublishedIntelligence[]> {
    return this.submissions
      .filter((submission) => submission.status === "PUBLISHED")
      .map((submission) => ({
        id: submission.id,
        fixtureId: submission.fixtureId,
        match: submission.match,
        leagueName: submission.leagueName,
        market: submission.market,
        prediction: submission.prediction,
        confidence: submission.confidence,
        riskRating: submission.riskLevel,
        briefExplanation: submission.briefExplanation,
        recommendedStake: submission.recommendedStake,
        publishedAt: submission.publishedAt,
      }));
  }
}
