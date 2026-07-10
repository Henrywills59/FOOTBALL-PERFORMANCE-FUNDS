import type { AnalystAssistance } from "@fpf/shared";
import { AuthError } from "../auth/authService.js";
import type { FootballRepository } from "../football/types.js";
import type { AdminService } from "../admin/adminService.js";
import type {
  AnalystRepository,
  CreateAcademyPredictionInput,
  CreateAnalystApplicationInput,
  CreateAssignmentInput,
  CreateSubmissionInput,
} from "./types.js";

export class AnalystService {
  constructor(
    private readonly repository: AnalystRepository,
    private readonly footballRepository: FootballRepository,
    private readonly adminService?: AdminService,
  ) {}

  dashboard(analystId: string) {
    return this.repository.dashboard(analystId);
  }

  performanceDashboard(analystId: string) {
    return this.repository.performanceDashboard(analystId);
  }

  createApplication(input: CreateAnalystApplicationInput) {
    return this.repository.createApplication(input);
  }

  listApplications() {
    return this.repository.listApplications();
  }

  async updateApplicationStatus(adminUserId: string, id: string, status: Parameters<AnalystRepository["updateApplicationStatus"]>[1], adminNotes?: string | null) {
    const application = await this.repository.updateApplicationStatus(id, status, adminNotes);
    if (!application) throw new AuthError("Analyst application not found", 404);
    await this.adminService?.audit(adminUserId, `ANALYST_APPLICATION_${status}`, "ANALYST_APPLICATION", id);
    return application;
  }

  adminControlCenter() {
    return this.repository.adminControlCenter();
  }

  async promoteAnalyst(adminUserId: string, analystId: string, adminNotes?: string | null) {
    const profile = await this.repository.promoteAnalyst(analystId, adminNotes);
    await this.adminService?.audit(adminUserId, "ANALYST_PROMOTED", "ANALYST_PROFILE", analystId);
    return profile;
  }

  async suspendAnalyst(adminUserId: string, analystId: string, adminNotes?: string | null) {
    const profile = await this.repository.suspendAnalyst(analystId, adminNotes);
    await this.adminService?.audit(adminUserId, "ANALYST_SUSPENDED", "ANALYST_PROFILE", analystId);
    return profile;
  }

  async calculateRewards(adminUserId: string) {
    const center = await this.repository.calculateRewards(adminUserId);
    await this.adminService?.audit(adminUserId, "ANALYST_REWARDS_CALCULATED", "ANALYST_REWARD_POOL");
    return center;
  }

  listAssignments(analystId: string) {
    return this.repository.listAssignments(analystId);
  }

  async createAssignment(adminUserId: string, input: CreateAssignmentInput) {
    const fixture = await this.footballRepository.getFixture(input.fixtureId);
    if (!fixture) throw new AuthError("Fixture not found", 404);
    const assignment = await this.repository.createAssignment({
      ...input,
      leagueName: input.leagueName || fixture.leagueName,
    });
    await this.adminService?.audit(adminUserId, "ANALYST_MATCH_ASSIGNED", "ANALYST_ASSIGNMENT", assignment.id);
    return assignment;
  }

  async createSubmission(input: CreateSubmissionInput) {
    await this.requireAssignedMatch(input.analystId, input.fixtureId);
    return this.repository.createSubmission(input);
  }

  createAcademyPrediction(input: CreateAcademyPredictionInput) {
    return this.repository.createAcademyPrediction(input);
  }

  async updateSubmission(id: string, analystId: string, input: Partial<Omit<CreateSubmissionInput, "analystId">>) {
    const submission = await this.repository.updateSubmission(id, analystId, input);
    if (!submission) throw new AuthError("Submission cannot be updated", 404);
    return submission;
  }

  async submitForReview(id: string, analystId: string) {
    const submission = await this.repository.submitForReview(id, analystId);
    if (!submission) throw new AuthError("Submission cannot be submitted", 404);
    return submission;
  }

  listAnalystSubmissions(analystId: string) {
    return this.repository.listAnalystSubmissions(analystId);
  }

  listAdminSubmissions() {
    return this.repository.listAdminSubmissions();
  }

  async approve(adminUserId: string, id: string) {
    const submission = await this.repository.updateStatus(id, "APPROVED");
    if (!submission) throw new AuthError("Submission not found", 404);
    await this.adminService?.audit(adminUserId, "INTELLIGENCE_APPROVED", "ANALYST_INTELLIGENCE", id);
    return submission;
  }

  async reject(adminUserId: string, id: string, adminNotes?: string) {
    const submission = await this.repository.updateStatus(id, "REJECTED", adminNotes);
    if (!submission) throw new AuthError("Submission not found", 404);
    await this.adminService?.audit(adminUserId, "INTELLIGENCE_REJECTED", "ANALYST_INTELLIGENCE", id);
    return submission;
  }

  async requestRevision(adminUserId: string, id: string, adminNotes: string) {
    const submission = await this.repository.updateStatus(id, "DRAFT", adminNotes);
    if (!submission) throw new AuthError("Submission not found", 404);
    await this.adminService?.audit(adminUserId, "INTELLIGENCE_REVISION_REQUESTED", "ANALYST_INTELLIGENCE", id);
    return submission;
  }

  async publish(adminUserId: string, id: string) {
    const submission = await this.repository.updateStatus(id, "PUBLISHED");
    if (!submission) throw new AuthError("Submission not found", 404);
    await this.adminService?.audit(adminUserId, "INTELLIGENCE_PUBLISHED", "ANALYST_INTELLIGENCE", id);
    return submission;
  }

  async withdraw(adminUserId: string, id: string) {
    const submission = await this.repository.updateStatus(id, "APPROVED");
    if (!submission) throw new AuthError("Submission not found", 404);
    await this.adminService?.audit(adminUserId, "INTELLIGENCE_WITHDRAWN", "ANALYST_INTELLIGENCE", id);
    return submission;
  }

  async updateAdminNotes(adminUserId: string, id: string, adminNotes: string) {
    const submission = await this.repository.updateAdminNotes(id, adminNotes);
    if (!submission) throw new AuthError("Submission not found", 404);
    await this.adminService?.audit(adminUserId, "INTELLIGENCE_ADMIN_NOTES_UPDATED", "ANALYST_INTELLIGENCE", id);
    return submission;
  }

  listPublished() {
    return this.repository.listPublished();
  }

  async assistance(fixtureId: string): Promise<AnalystAssistance> {
    const fixture = await this.footballRepository.getFixture(fixtureId);
    if (!fixture) throw new AuthError("Fixture not found", 404);
    const standings = fixture.standings
      .slice(0, 4)
      .map((standing) => `${standing.teamName}: ${standing.points} pts from ${standing.played}`)
      .join("; ");
    const injuries = fixture.injuries
      .map((injury) => `${injury.playerName}${injury.reason ? ` (${injury.reason})` : ""}`)
      .join("; ");
    const odds = fixture.odds
      .slice(0, 4)
      .map((odd) => `${odd.bookmaker} ${odd.market} ${odd.outcome} ${odd.price}`)
      .join("; ");
    return {
      teamFormSummary: standings || "No league standing or form data is available for this fixture yet.",
      headToHeadSummary: fixture.headToHeadRecords.length
        ? `${fixture.headToHeadRecords.length} head-to-head record(s) are available for analyst review.`
        : "No head-to-head history is available for this fixture yet.",
      injurySummary: injuries || "No injury data is available for this fixture yet.",
      oddsMovement: odds || "No odds data is available for this fixture yet.",
      riskWarnings: [
        fixture.injuries.length ? "Check whether injuries materially affect the selected market." : "Injury data is limited.",
        fixture.odds.length ? "Confirm odds freshness before submission." : "Odds data is missing.",
      ],
      valueOpportunityNotes: fixture.odds.length
        ? "Compare the analyst probability estimate against the latest available bookmaker price."
        : "Value assessment should wait until odds are synchronized.",
    };
  }

  private async requireAssignedMatch(analystId: string, fixtureId: string) {
    const assignments = await this.repository.listAssignments(analystId);
    if (!assignments.some((assignment) => assignment.fixtureId === fixtureId && assignment.status === "ASSIGNED")) {
      throw new AuthError("Analyst is not assigned to this match", 403);
    }
  }
}
