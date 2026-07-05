import { PrismaClient } from "@prisma/client";
import type {
  AnalystAssignment,
  AnalystDashboard,
  AnalystIntelligenceSubmission,
  IntelligenceSubmissionStatus,
  PublishedIntelligence,
} from "@fpf/shared";
import type { AnalystRepository, CreateAssignmentInput, CreateSubmissionInput } from "./types.js";

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

export class PrismaAnalystRepository implements AnalystRepository {
  constructor(private readonly prisma = new PrismaClient()) {}

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
    const assignments = await this.prisma.analystAssignment.findMany({
      where: { analystId },
      include: { fixture: { include: { homeTeam: true, awayTeam: true } } },
      orderBy: { createdAt: "desc" },
    });
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
    const submissions = await this.prisma.analystIntelligenceSubmission.findMany({
      where: { analystId },
      include: submissionInclude,
      orderBy: { createdAt: "desc" },
    });
    return submissions.map(toSubmission);
  }

  async listAdminSubmissions() {
    const submissions = await this.prisma.analystIntelligenceSubmission.findMany({
      include: submissionInclude,
      orderBy: { createdAt: "desc" },
    });
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
    const submissions = await this.prisma.analystIntelligenceSubmission.findMany({
      where: { status: "PUBLISHED" },
      include: submissionInclude,
      orderBy: { publishedAt: "desc" },
    });
    return submissions.map(toPublished);
  }
}
