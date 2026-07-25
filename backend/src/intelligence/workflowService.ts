import crypto from "node:crypto";
import type {
  DecisionEngineOutput,
  FootballFixtureSummary,
  IntelligenceScanCandidate,
  IntelligenceWorkflowRun,
  PredictionQueueItem,
} from "@fpf/shared";
import type { FootballRepository } from "../football/types.js";
import type { PredictionWorkflowService } from "../predictionWorkflow/predictionWorkflowService.js";
import type { DecisionEngineService } from "./decision/decisionService.js";
import { intelligenceLogger } from "./logger.js";

type MockFixtureSeed = {
  apiFootballFixtureId: number;
  leagueName: string;
  country: string;
  homeTeamName: string;
  awayTeamName: string;
  kickoffOffsetHours: number;
};

const mockSeeds: MockFixtureSeed[] = [
  {
    apiFootballFixtureId: 970001,
    leagueName: "FPF Mock Premier Intelligence",
    country: "England",
    homeTeamName: "Northbridge FC",
    awayTeamName: "Harbour Athletic",
    kickoffOffsetHours: 4,
  },
  {
    apiFootballFixtureId: 970002,
    leagueName: "FPF Mock Continental Cup",
    country: "Spain",
    homeTeamName: "Valencia Norte",
    awayTeamName: "Lisbon Union",
    kickoffOffsetHours: 7,
  },
  {
    apiFootballFixtureId: 970003,
    leagueName: "FPF Mock Elite League",
    country: "Germany",
    homeTeamName: "Berlin Capital",
    awayTeamName: "Rhine City",
    kickoffOffsetHours: 22,
  },
];

function queueItemForFixture(queue: PredictionQueueItem[], fixtureId: string) {
  return queue.find((item) => item.fixtureId === fixtureId);
}

function analystReviewStatus(item?: PredictionQueueItem): IntelligenceScanCandidate["analystReviewStatus"] {
  if (!item) return "PENDING";
  if (item.status === "UNDER_REVIEW" || item.status === "SENIOR_REVIEW") return "IN_REVIEW";
  if (item.status === "APPROVED") return "APPROVED";
  if (item.status === "REJECTED") return "REJECTED";
  if (item.status === "PUBLISHED") return "PUBLISHED";
  return "PENDING";
}

function toCandidate(decision: DecisionEngineOutput, item?: PredictionQueueItem): IntelligenceScanCandidate {
  const queueStatus = item?.status ?? (decision.status === "REJECTED" ? "REJECTED" : "PENDING_REVIEW");
  const verifiedSelectionReady = ["APPROVED", "PUBLISHED"].includes(queueStatus);
  return {
    fixtureId: decision.fixtureId,
    match: decision.match,
    league: decision.league,
    kickoffTime: decision.kickoffTime,
    confidenceScore: decision.scores.confidenceScore,
    riskScore: decision.scores.riskScore,
    valueScore: decision.scores.valueScore,
    opportunityScore: decision.scores.opportunityScore,
    recommendationStatus: decision.status,
    queueStatus,
    analystReviewStatus: analystReviewStatus(item),
    verifiedSelectionReady,
    companyCapitalEligible: verifiedSelectionReady && decision.scores.riskScore < 65,
    financialEngineEligible: queueStatus === "PUBLISHED",
    auditTrail: [
      "Fixture normalized through Intelligence Core.",
      "Decision Engine scoring completed using safe placeholder modules.",
      item ? `Candidate queue status: ${item.status}.` : "Candidate queued for analyst review.",
    ],
  };
}

export class IntelligenceWorkflowService {
  constructor(
    private readonly footballRepository: FootballRepository,
    private readonly decisionEngineService: DecisionEngineService,
    private readonly predictionWorkflowService: PredictionWorkflowService,
  ) {}

  async ingestMockFixtures(limit = 3) {
    const syncRunId = await this.footballRepository.startSyncRun({
      provider: "FPF Mock Provider",
      jobName: "intelligence_mock_fixture_ingestion",
    });
    const selectedSeeds = mockSeeds.slice(0, Math.max(1, Math.min(limit, mockSeeds.length)));
    try {
      await Promise.all(selectedSeeds.map((seed, index) => this.upsertMockFixture(seed, index)));
      await this.footballRepository.finishSyncRun(syncRunId, {
        status: "SUCCESS",
        message: "Mock provider fixture ingestion completed for Intelligence Engine workflow.",
        recordsRead: selectedSeeds.length,
        recordsSaved: selectedSeeds.length,
      });
      return selectedSeeds.length;
    } catch (error) {
      intelligenceLogger.apiFailure("intelligenceWorkflow.ingestMockFixtures", error);
      await this.footballRepository.finishSyncRun(syncRunId, {
        status: "FAILED",
        message: error instanceof Error ? error.message : "Mock fixture ingestion failed.",
      });
      return 0;
    }
  }

  async runScan(input: { ingestMockFixtures?: boolean; limit?: number } = {}): Promise<IntelligenceWorkflowRun> {
    const startedAt = Date.now();
    const limit = Math.max(1, Math.min(input.limit ?? 20, 50));
    const fixturesIngested = input.ingestMockFixtures ? await this.ingestMockFixtures(Math.min(limit, 3)) : 0;
    const fixtures = await this.footballRepository.listFixtures({ limit });
    const decisions = await Promise.all(fixtures.map((fixture) => this.decisionEngineService.evaluateMatch(fixture.id)));
    await Promise.all(decisions.map((decision) => this.predictionWorkflowService.createCandidate(decision)));
    const queue = await this.predictionWorkflowService.listQueue({ sort: "priority" });
    const candidates = decisions.map((decision) => toCandidate(decision, queueItemForFixture(queue.items, decision.fixtureId)));

    intelligenceLogger.responseTime("intelligenceWorkflow.runScan", startedAt, {
      fixturesIngested,
      matchesScanned: fixtures.length,
      candidatesScored: decisions.length,
    });

    return {
      id: `intelligence_workflow_${crypto.randomUUID()}`,
      mode: "MOCK_PROVIDER",
      stages: [
        "FIXTURE_INGESTION",
        "MATCH_SCANNING",
        "CANDIDATE_SCORING",
        "CANDIDATE_QUEUE",
        "ANALYST_REVIEW",
        "PUBLICATION_PIPELINE",
      ],
      summary: {
        fixturesIngested,
        matchesScanned: fixtures.length,
        candidatesScored: decisions.length,
        queuedCandidates: queue.items.length,
        verifiedSelectionsReady: candidates.filter((candidate) => candidate.verifiedSelectionReady).length,
        companyCapitalEligible: candidates.filter((candidate) => candidate.companyCapitalEligible).length,
        generatedAt: new Date().toISOString(),
      },
      candidates,
      warnings: fixtures.length
        ? ["Live football, odds, AI, and payment providers are intentionally not connected in this phase."]
        : ["No fixtures available. Run mock fixture ingestion or connect live providers in a later phase."],
    };
  }

  async candidateQueue(limit = 30) {
    await this.predictionWorkflowService.refreshFromDecisionEngine(limit);
    const queue = await this.predictionWorkflowService.listQueue({ sort: "priority" });
    return {
      ...queue,
      verifiedSelections: queue.items.filter((item) => ["APPROVED", "PUBLISHED"].includes(item.status)),
      companyCapitalEligible: queue.items.filter((item) => ["APPROVED", "PUBLISHED"].includes(item.status) && item.riskScore < 65),
      financialEngineEligible: queue.items.filter((item) => item.status === "PUBLISHED"),
    };
  }

  private async upsertMockFixture(seed: MockFixtureSeed, index: number) {
    const kickoffAt = new Date(Date.now() + seed.kickoffOffsetHours * 60 * 60 * 1000);
    await this.footballRepository.upsertFixture({
      apiFootballFixtureId: seed.apiFootballFixtureId,
      league: {
        apiFootballLeagueId: 8800 + index,
        name: seed.leagueName,
        country: seed.country,
        season: kickoffAt.getUTCFullYear(),
      },
      homeTeam: {
        apiFootballTeamId: 9900 + index * 2,
        name: seed.homeTeamName,
      },
      awayTeam: {
        apiFootballTeamId: 9901 + index * 2,
        name: seed.awayTeamName,
      },
      season: kickoffAt.getUTCFullYear(),
      kickoffAt,
      status: index === 0 ? "SCHEDULED" : "SCHEDULED",
      venue: "FPF Mock Data Stadium",
      raw: { source: "FPF Mock Provider", seed },
    });
    await this.footballRepository.upsertStanding({
      leagueApiId: 8800 + index,
      season: kickoffAt.getUTCFullYear(),
      teamApiId: 9900 + index * 2,
      teamName: seed.homeTeamName,
      rank: 2 + index,
      points: 34 - index * 2,
      played: 16,
      won: 10 - index,
      drawn: 4,
      lost: 2 + index,
      goalsFor: 28,
      goalsAgainst: 15,
      raw: { source: "FPF Mock Provider" },
    });
    await this.footballRepository.upsertOdd({
      fixtureApiId: seed.apiFootballFixtureId,
      bookmaker: "FPF Mock Odds",
      market: "Match Result",
      outcome: seed.homeTeamName,
      price: 1.78 + index * 0.04,
      raw: { source: "FPF Mock Provider" },
    });
  }
}
