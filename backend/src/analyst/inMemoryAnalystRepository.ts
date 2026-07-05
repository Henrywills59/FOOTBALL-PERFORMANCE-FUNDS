import { randomUUID } from "node:crypto";
import type {
  AnalystAssignment,
  AnalystDashboard,
  AnalystIntelligenceSubmission,
  IntelligenceSubmissionStatus,
  PublishedIntelligence,
} from "@fpf/shared";
import type { AnalystRepository, CreateAssignmentInput, CreateSubmissionInput } from "./types.js";

export class InMemoryAnalystRepository implements AnalystRepository {
  assignments: Array<AnalystAssignment & { analystId: string }> = [];
  submissions: Array<AnalystIntelligenceSubmission & { analystId: string }> = [];

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
