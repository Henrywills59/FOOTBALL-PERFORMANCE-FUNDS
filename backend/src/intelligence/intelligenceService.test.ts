import { describe, expect, it } from "vitest";
import { InMemoryAnalystRepository } from "../analyst/inMemoryAnalystRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { MemoryCacheStore } from "./cache.js";
import { calculateIntelligenceScores } from "./intelligenceEngine.js";
import { IntelligenceRepositoryAdapter } from "./repository.js";
import { IntelligenceService } from "./service.js";

function buildService() {
  const footballRepository = new InMemoryFootballRepository();
  const predictionRepository = new InMemoryPredictionRepository([]);
  const analystRepository = new InMemoryAnalystRepository();
  const service = new IntelligenceService(
    new IntelligenceRepositoryAdapter(footballRepository, predictionRepository, analystRepository),
    new MemoryCacheStore(),
  );

  return { analystRepository, footballRepository, predictionRepository, service };
}

describe("intelligence service", () => {
  it("returns safe dashboard defaults when the football database is empty", async () => {
    const { service } = buildService();

    const dashboard = await service.getDashboard({
      id: "subscriber-1",
      name: "Subscriber User",
      email: "subscriber@example.com",
      role: "SUBSCRIBER",
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    });

    expect(dashboard.executiveOverview.subscriptionStatus).toBe("Active");
    expect(dashboard.opportunities).toEqual([]);
    expect(dashboard.liveIntelligenceFeed.length).toBeGreaterThan(0);
    expect(dashboard.providerStatus.map((provider) => provider.name)).toContain("API-Football");
  });

  it("builds an opportunity feed from approved predictions and published intelligence", async () => {
    const { analystRepository, footballRepository, predictionRepository, service } = buildService();
    await footballRepository.upsertFixture({
      apiFootballFixtureId: 7001,
      league: { apiFootballLeagueId: 39, name: "Premier League", country: "England", season: 2026 },
      homeTeam: { apiFootballTeamId: 1, name: "Arsenal" },
      awayTeam: { apiFootballTeamId: 2, name: "Chelsea" },
      season: 2026,
      kickoffAt: new Date("2026-07-08T20:00:00.000Z"),
      status: "SCHEDULED",
      raw: {},
    });
    await predictionRepository.createPrediction({
      oddId: "odd-1",
      fixtureId: "7001",
      recommendedMarket: "Match Winner",
      predictedOutcome: "Arsenal",
      confidenceScore: 78,
      riskScore: 35,
      valueRating: "HIGH",
      explanation: "Strong model edge.",
      dataQualityStatus: "READY",
      approvalStatus: "APPROVED",
      edge: 0.09,
      impliedProbability: 0.51,
      modelProbability: 0.6,
      staleOdds: false,
      riskyMarket: false,
    });
    const submission = await analystRepository.createSubmission({
      analystId: "analyst-1",
      fixtureId: "7001",
      leagueName: "Premier League",
      market: "Total Goals",
      prediction: "Over 2.5",
      confidence: 66,
      riskLevel: "Medium",
      detailedReasoning: "Tempo supports goals.",
      supportingStatistics: "Shot volume",
      sourceNotes: "Internal",
      briefExplanation: "Constructive goal environment.",
      recommendedStake: "1 unit",
      status: "PENDING_REVIEW",
    });
    await analystRepository.updateStatus(submission.id, "PUBLISHED");

    const feed = await service.getOpportunityFeed();

    expect(feed).toHaveLength(2);
    expect(feed[0]).toEqual(expect.objectContaining({ aiConfidence: 78, match: "Arsenal vs Chelsea" }));
  });

  it("marks missing match intelligence as insufficient data instead of throwing", async () => {
    const { service } = buildService();

    const intelligence = await service.getMatchIntelligence("missing-fixture");

    expect(intelligence.fixture).toBeNull();
    expect(intelligence.scores.dataQualityStatus).toBe("INSUFFICIENT_DATA");
    expect(intelligence.explanation).toContain("Insufficient data");
  });

  it("keeps score calculators modular and bounded", () => {
    const scores = calculateIntelligenceScores(null);

    expect(scores.aiConfidence).toBe(0);
    expect(scores.riskScore).toBe(100);
    expect(scores.dataQualityStatus).toBe("INSUFFICIENT_DATA");
  });
});

