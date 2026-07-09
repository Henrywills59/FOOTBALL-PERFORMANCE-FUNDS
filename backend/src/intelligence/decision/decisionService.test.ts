import { describe, expect, it } from "vitest";
import { InMemoryAnalystRepository } from "../../analyst/inMemoryAnalystRepository.js";
import { InMemoryFootballRepository } from "../../football/inMemoryFootballRepository.js";
import { InMemoryPredictionRepository } from "../../predictions/inMemoryPredictionRepository.js";
import { MemoryCacheStore } from "../cache.js";
import { IntelligenceRepositoryAdapter } from "../repository.js";
import { IntelligenceService } from "../service.js";
import { DecisionEngineService } from "./decisionService.js";
import { attackStrengthScore, confidenceScore, opportunityScore, riskScore } from "./scoreModules.js";

async function buildService() {
  const footballRepository = new InMemoryFootballRepository();
  const intelligenceService = new IntelligenceService(
    new IntelligenceRepositoryAdapter(
      footballRepository,
      new InMemoryPredictionRepository([]),
      new InMemoryAnalystRepository(),
    ),
    new MemoryCacheStore(),
  );

  return {
    decisionEngineService: new DecisionEngineService(intelligenceService),
    footballRepository,
    intelligenceService,
  };
}

describe("decision engine service", () => {
  it("returns a safe rejected fallback when match data is missing", async () => {
    const { decisionEngineService } = await buildService();

    const decision = await decisionEngineService.evaluateMatch("missing");

    expect(decision.status).toBe("REJECTED");
    expect(decision.dataQualityStatus).toBe("INSUFFICIENT_DATA");
    expect(decision.warnings.some((warning) => warning.includes("Low data confidence"))).toBe(true);
  });

  it("evaluates normalized match data into scored explainable output", async () => {
    const { decisionEngineService, footballRepository } = await buildService();
    await footballRepository.upsertFixture({
      apiFootballFixtureId: 9101,
      league: { apiFootballLeagueId: 39, name: "Premier League", country: "England", season: 2026 },
      homeTeam: { apiFootballTeamId: 1, name: "Home FC" },
      awayTeam: { apiFootballTeamId: 2, name: "Away FC" },
      season: 2026,
      kickoffAt: new Date(`${new Date().toISOString().slice(0, 10)}T18:00:00.000Z`),
      status: "LIVE",
      homeScore: 1,
      awayScore: 0,
      raw: {},
    });
    await footballRepository.upsertStanding({
      leagueApiId: 39,
      season: 2026,
      teamApiId: 1,
      teamName: "Home FC",
      rank: 2,
      points: 54,
      played: 24,
      won: 16,
      drawn: 6,
      lost: 2,
      goalsFor: 50,
      goalsAgainst: 20,
      raw: {},
    });
    await footballRepository.upsertOdd({
      fixtureApiId: 9101,
      bookmaker: "Book",
      market: "Match Result",
      outcome: "Home FC",
      price: 1.91,
      raw: {},
    });

    const decision = await decisionEngineService.evaluateMatch("9101");

    expect(decision.match).toBe("Home FC vs Away FC");
    expect(decision.scores.confidenceScore).toBeGreaterThan(0);
    expect(decision.reasoning.length).toBeGreaterThan(0);
    expect(["APPROVED_CANDIDATE", "NEEDS_REVIEW", "REJECTED"]).toContain(decision.status);
  });

  it("keeps individual score modules bounded", async () => {
    const { intelligenceService } = await buildService();
    const match = await intelligenceService.getMatchIntelligence("missing");

    expect(attackStrengthScore(match)).toBe(0);
    expect(riskScore(match, { injuryImpact: 0, marketValue: 0, volatility: 100 })).toBe(100);
    expect(confidenceScore({ teamForm: 100, attackStrength: 100, defenceStrength: 100, homeAwayAdvantage: 100, marketValue: 100, liveMomentum: 100, risk: 0 })).toBe(100);
    expect(opportunityScore({ confidence: 100, liveMomentum: 100, marketValue: 100, risk: 0 })).toBe(100);
  });
});

