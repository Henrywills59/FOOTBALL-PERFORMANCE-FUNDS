import type {
  AnalystAssistance,
  AuthUser,
  FootballFixtureSummary,
  WarRoomAssignment,
  WarRoomDashboard,
  WarRoomDecisionRoomItem,
  WarRoomFixture,
  WarRoomMatchBoardItem,
} from "@fpf/shared";
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

function predictionDeadline(kickoffAt: string | null) {
  const kickoff = kickoffAt ? new Date(kickoffAt).getTime() : Date.now() + 6 * 60 * 60 * 1000;
  return new Date(kickoff - 90 * 60 * 1000).toISOString();
}

function fixtureMatch(fixture: FootballFixtureSummary) {
  return `${fixture.homeTeamName} vs ${fixture.awayTeamName}`;
}

function riskFromAverage(averageConfidence: number): "LOW" | "MEDIUM" | "HIGH" {
  if (averageConfidence >= 72) return "LOW";
  if (averageConfidence >= 55) return "MEDIUM";
  return "HIGH";
}

function warRoomFixture(fixture: FootballFixtureSummary, assignments: WarRoomAssignment[]): WarRoomFixture {
  const fixtureAssignments = assignments.filter((assignment) => assignment.fixtureId === fixture.id);
  const submitted = fixtureAssignments.filter((assignment) => assignment.status === "SUBMITTED" || assignment.status === "COMPLETED").length;
  return {
    ...fixture,
    competition: fixture.leagueName,
    predictionDeadline: predictionDeadline(fixture.kickoffAt),
    assignedAnalysts: fixtureAssignments.map((assignment) => assignment.analystName),
    assignmentStatus: fixtureAssignments.length
      ? submitted === fixtureAssignments.length
        ? "READY_FOR_REVIEW"
        : "PENDING_SUBMISSION"
      : "UNASSIGNED",
  };
}

function matchBoardItem(
  fixture: FootballFixtureSummary,
  assignments: WarRoomAssignment[],
  submissions: Awaited<ReturnType<AnalystRepository["listAdminSubmissions"]>>,
): WarRoomMatchBoardItem {
  const fixtureAssignments = assignments.filter((assignment) => assignment.fixtureId === fixture.id);
  const fixtureSubmissions = submissions.filter((submission) => submission.fixtureId === fixture.id);
  const averageConfidence = fixtureSubmissions.length
    ? Math.round(fixtureSubmissions.reduce((sum, submission) => sum + submission.confidence, 0) / fixtureSubmissions.length)
    : 0;
  const predictionsPending = Math.max(0, fixtureAssignments.length - fixtureSubmissions.length);
  return {
    fixtureId: fixture.id,
    match: fixtureMatch(fixture),
    leagueName: fixture.leagueName,
    country: fixture.leagueCountry,
    assignedAnalysts: fixtureAssignments.map((assignment) => assignment.analystName),
    predictionsSubmitted: fixtureSubmissions.length,
    predictionsPending,
    averageConfidence,
    riskLevel: riskFromAverage(averageConfidence),
    submissionDeadline: predictionDeadline(fixture.kickoffAt),
    aiReviewStatus: fixtureSubmissions.length
      ? averageConfidence >= 60
        ? "READY_FOR_AI_REVIEW"
        : "NEEDS_ADMIN_REVIEW"
      : "PENDING_DATA",
  };
}

function decisionRoomItem(item: WarRoomMatchBoardItem): WarRoomDecisionRoomItem {
  return {
    fixtureId: item.fixtureId,
    match: item.match,
    aiCombinedScore: item.averageConfidence,
    analystAgreementLevel: item.predictionsSubmitted >= 3 ? "HIGH" : item.predictionsSubmitted >= 2 ? "MEDIUM" : "LOW",
    confidenceDistribution: [
      { label: "High", count: item.averageConfidence >= 70 ? item.predictionsSubmitted : 0 },
      { label: "Medium", count: item.averageConfidence >= 50 && item.averageConfidence < 70 ? item.predictionsSubmitted : 0 },
      { label: "Low", count: item.averageConfidence < 50 ? item.predictionsSubmitted : 0 },
    ],
    riskDistribution: [
      { label: item.riskLevel, count: item.predictionsSubmitted },
    ],
    recommendationStatus: item.predictionsSubmitted
      ? item.averageConfidence >= 60
        ? "READY_FOR_ADMIN_APPROVAL"
        : "NEEDS_REVIEW"
      : "PENDING_SUBMISSIONS",
    adminApprovalRequired: true,
  };
}

function warRoomAlerts(board: WarRoomMatchBoardItem[]) {
  const now = new Date().toISOString();
  const alerts = board.flatMap((item) => {
    const output = [];
    if (item.predictionsPending > 0) {
      output.push({
        id: `missing:${item.fixtureId}`,
        type: "MISSING_SUBMISSION" as const,
        severity: "WATCH" as const,
        title: "Missing analyst submission",
        message: `${item.match} has ${item.predictionsPending} pending submission(s).`,
        fixtureId: item.fixtureId,
        createdAt: now,
      });
    }
    if (new Date(item.submissionDeadline).getTime() - Date.now() < 2 * 60 * 60 * 1000) {
      output.push({
        id: `deadline:${item.fixtureId}`,
        type: "PREDICTION_DEADLINE" as const,
        severity: "URGENT" as const,
        title: "Prediction deadline approaching",
        message: `${item.match} intelligence deadline is approaching.`,
        fixtureId: item.fixtureId,
        createdAt: now,
      });
    }
    return output;
  });
  return alerts.length
    ? alerts
    : [{
        id: "system:war-room-ready",
        type: "SYSTEM_ALERT" as const,
        severity: "INFO" as const,
        title: "War Room ready",
        message: "No urgent internal football intelligence alerts.",
        fixtureId: null,
        createdAt: now,
      }];
}

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

  async warRoom(user: AuthUser): Promise<WarRoomDashboard> {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [todayFixtures, tomorrowFixtures, controlCenter, submissions] = await Promise.all([
      this.footballRepository.listFixtures({ date: today, limit: 30 }),
      this.footballRepository.listFixtures({ date: tomorrowDate, limit: 30 }),
      this.repository.adminControlCenter(),
      this.repository.listAdminSubmissions(),
    ]);
    const allFixtures = [...todayFixtures, ...tomorrowFixtures];
    const rawAssignments = await Promise.all(
      controlCenter.analysts.map(async (analyst) => ({
        analyst,
        assignments: await this.repository.listAssignments(analyst.userId),
      })),
    );
    const assignments: WarRoomAssignment[] = rawAssignments.flatMap(({ analyst, assignments: analystAssignments }) =>
      analystAssignments.map((assignment) => ({
        id: assignment.id,
        analystId: analyst.userId,
        analystName: analyst.name,
        scopeType: "MATCH",
        scopeValue: assignment.match,
        fixtureId: assignment.fixtureId,
        match: assignment.match,
        leagueName: assignment.leagueName,
        country: allFixtures.find((fixture) => fixture.id === assignment.fixtureId)?.leagueCountry ?? null,
        status: assignment.status === "COMPLETED" ? "COMPLETED" : submissions.some((submission) => submission.fixtureId === assignment.fixtureId) ? "SUBMITTED" : "ASSIGNED",
        deadline: predictionDeadline(assignment.kickoffAt),
        adminNotes: assignment.adminNotes,
      })),
    );
    const visibleAssignments = user.role === "ANALYST"
      ? assignments.filter((assignment) => assignment.analystId === user.id)
      : assignments;
    const visibleFixtures = user.role === "ANALYST"
      ? allFixtures.filter((fixture) => visibleAssignments.some((assignment) => assignment.fixtureId === fixture.id))
      : allFixtures;
    const board = visibleFixtures.map((fixture) => matchBoardItem(fixture, visibleAssignments, submissions));
    const discussions = board.slice(0, 6).map((item) => ({
      id: `discussion:${item.fixtureId}`,
      fixtureId: item.fixtureId,
      category: item.riskLevel === "HIGH" ? "RISK_ALERTS" as const : "TACTICAL_ANALYSIS" as const,
      title: `${item.match} intelligence room`,
      messages: [
        {
          id: `message:${item.fixtureId}:1`,
          authorLabel: "FPF Intelligence Desk",
          body: "Provider-ready discussion room. Add tactical notes, team news, market movement, and AI observations before final review.",
          mentions: item.assignedAnalysts,
          createdAt: new Date().toISOString(),
          replies: [],
        },
      ],
      pinnedNotes: [
        "Minimum odds 1.60, maximum odds 2.00.",
        "Subscribers must only see final FPF Intelligence after admin approval.",
      ],
      attachmentsPlaceholder: "Attachments placeholder: scouting files, lineup screenshots, and market snapshots will connect later.",
      authorizedAnalystIds: visibleAssignments
        .filter((assignment) => assignment.fixtureId === item.fixtureId)
        .map((assignment) => assignment.analystId),
    }));

    return {
      todayFixtures: todayFixtures.filter((fixture) => visibleFixtures.some((item) => item.id === fixture.id)).map((fixture) => warRoomFixture(fixture, visibleAssignments)),
      tomorrowFixtures: tomorrowFixtures.filter((fixture) => visibleFixtures.some((item) => item.id === fixture.id)).map((fixture) => warRoomFixture(fixture, visibleAssignments)),
      assignments: visibleAssignments,
      discussions,
      aiAssistantPanel: {
        fixtureId: board[0]?.fixtureId ?? null,
        historicalMatchSummary: "Historical match summary placeholder. Provider interface is ready for future football data enrichment.",
        teamForm: "Team form placeholder based on synchronized fixture context and future provider statistics.",
        headToHeadSummary: "Head-to-head placeholder will summarize previous meetings once live providers are connected.",
        confidenceIndicators: ["Assignment coverage", "Submission confidence", "Market policy compliance"],
        riskIndicators: ["Missing submissions", "High-risk markets", "Late injury/team news"],
        recommendedResearchTopics: ["Lineup confirmation", "Injury status", "Odds movement", "Motivation and schedule congestion"],
        providerStatus: "PLACEHOLDER_READY",
      },
      matchIntelligenceBoard: board,
      decisionRoom: board.map(decisionRoomItem),
      alerts: warRoomAlerts(board),
      leaderboard: controlCenter.analysts
        .slice()
        .sort((left, right) => right.reliabilityIndex - left.reliabilityIndex)
        .slice(0, 20),
      rulebook: {
        currentOddsPolicy: "FPF internal odds policy allows disciplined opportunities only.",
        minimumOdds: 1.6,
        maximumOdds: 2.0,
        predictionRules: ["Never guarantee outcomes.", "Never publish without admin approval.", "Use evidence-backed reasoning."],
        submissionRules: ["Submit before prediction deadline.", "Include confidence, risk, and supporting notes.", "Flag missing data clearly."],
        disciplineRules: ["Avoid duplicate predictions.", "Escalate suspicious market movement.", "Respect capital allocation limits."],
        confidentialityReminder: "War Room intelligence is confidential and never visible to Subscribers, Investors, or the public.",
      },
      searchIndex: [
        ...visibleFixtures.map((fixture) => ({ category: "Fixtures", title: `${fixture.homeTeamName} vs ${fixture.awayTeamName}`, description: fixture.leagueName })),
        ...visibleAssignments.map((assignment) => ({ category: "Assignments", title: assignment.scopeValue, description: assignment.status })),
        ...discussions.map((discussion) => ({ category: "Discussions", title: discussion.title, description: discussion.category })),
      ],
    };
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
