import type {
  DecisionEngineHealth,
  DecisionEngineOutput,
  DecisionEngineScoreBreakdown,
  DecisionRecommendationStatus,
  FootballFixtureSummary,
} from "@fpf/shared";
import { getProviderStatus } from "../providers.js";
import type { IntelligenceService } from "../service.js";
import type { MatchIntelligence } from "../types.js";
import { decisionLogger } from "./decisionLogger.js";
import { buildDecisionReasoning } from "./reasoning.js";
import {
  attackStrengthScore,
  confidenceScore,
  defenceStrengthScore,
  homeAwayAdvantageScore,
  injuryImpactScore,
  liveMomentumScore,
  marketValueScore,
  oddsMovementScore,
  opportunityScore,
  riskScore,
  teamFormScore,
  volatilityScore,
} from "./scoreModules.js";

function statusFromScores(scores: DecisionEngineScoreBreakdown, match: MatchIntelligence): DecisionRecommendationStatus {
  if (!match.fixture || match.scores.dataQualityStatus === "INSUFFICIENT_DATA") return "REJECTED";
  if (scores.opportunityScore >= 70 && scores.confidenceScore >= 64 && scores.riskScore < 58) return "APPROVED_CANDIDATE";
  if (scores.confidenceScore >= 50 && scores.riskScore < 72) return "NEEDS_REVIEW";
  return "REJECTED";
}

function recommendedMarket(match: MatchIntelligence, scores: DecisionEngineScoreBreakdown) {
  if (!match.fixture) return { market: "Pending Market", outcome: "Insufficient data" };
  if (scores.attackStrengthScore >= 58 && scores.defenceStrengthScore <= 52) {
    return { market: "Total Goals", outcome: "Over 2.5 goals watchlist" };
  }
  if (scores.homeAwayAdvantageScore >= 60) {
    return { market: "Match Result", outcome: `${match.fixture.homeTeamName} draw-no-bet watchlist` };
  }
  return { market: "Match Intelligence", outcome: "Needs analyst review" };
}

function matchLabel(fixture: MatchIntelligence["fixture"]) {
  return fixture ? `${fixture.homeTeamName} vs ${fixture.awayTeamName}` : "Fixture unavailable";
}

function evaluateScores(match: MatchIntelligence): DecisionEngineScoreBreakdown {
  const teamForm = teamFormScore(match);
  const attackStrength = attackStrengthScore(match);
  const defenceStrength = defenceStrengthScore(match);
  const homeAwayAdvantage = homeAwayAdvantageScore(match.fixture);
  const injuryImpact = injuryImpactScore(match);
  const oddsMovement = oddsMovementScore(match);
  const marketValue = marketValueScore(match);
  const liveMomentum = liveMomentumScore(match);
  const volatility = volatilityScore(match);
  const risk = riskScore(match, { injuryImpact, marketValue, volatility });
  const confidence = confidenceScore({
    teamForm,
    attackStrength,
    defenceStrength,
    homeAwayAdvantage,
    marketValue,
    liveMomentum,
    risk,
  });
  const opportunity = opportunityScore({ confidence, liveMomentum, marketValue, risk });

  return {
    teamFormScore: teamForm,
    attackStrengthScore: attackStrength,
    defenceStrengthScore: defenceStrength,
    homeAwayAdvantageScore: homeAwayAdvantage,
    injuryImpactScore: injuryImpact,
    oddsMovementScore: oddsMovement,
    marketValueScore: marketValue,
    liveMomentumScore: liveMomentum,
    riskScore: risk,
    confidenceScore: confidence,
    opportunityScore: opportunity,
    valueScore: marketValue,
    momentumScore: liveMomentum,
    volatilityScore: volatility,
  };
}

export class DecisionEngineService {
  constructor(private readonly intelligenceService: IntelligenceService) {}

  async evaluateMatch(fixtureId: string): Promise<DecisionEngineOutput> {
    decisionLogger.started({ fixtureId });
    try {
      const match = await this.intelligenceService.getMatchIntelligence(fixtureId);
      if (!match.fixture) decisionLogger.fallback({ fixtureId, reason: "fixture_missing" });
      if (match.odds.status === "UNAVAILABLE") decisionLogger.providerUnavailable({ fixtureId, provider: "Odds API" });

      const scores = evaluateScores(match);
      const market = recommendedMarket(match, scores);
      const explanation = buildDecisionReasoning(match, scores);
      const output: DecisionEngineOutput = {
        id: `decision:${fixtureId}`,
        fixtureId,
        match: matchLabel(match.fixture),
        league: match.fixture?.leagueName ?? "League pending",
        kickoffTime: match.fixture?.kickoffAt ?? null,
        recommendedMarket: market.market,
        predictedOutcome: market.outcome,
        status: statusFromScores(scores, match),
        scores,
        reasoning: explanation.reasoning,
        warnings: explanation.warnings,
        dataQualityStatus: match.scores.dataQualityStatus,
        generatedAt: new Date().toISOString(),
      };

      decisionLogger.matchEvaluated({
        fixtureId,
        status: output.status,
        confidenceScore: output.scores.confidenceScore,
        riskScore: output.scores.riskScore,
        opportunityScore: output.scores.opportunityScore,
      });
      decisionLogger.completed({ fixtureId, status: output.status });
      return output;
    } catch (error) {
      decisionLogger.scoreError(error, { fixtureId });
      return this.fallbackDecision(fixtureId);
    }
  }

  async getOpportunities(limit = 20): Promise<DecisionEngineOutput[]> {
    decisionLogger.started({ job: "decision_opportunities", limit });
    const fixtures = await this.intelligenceService.getTodayFixtures({ limit });
    const decisions = await Promise.all(fixtures.map((fixture: FootballFixtureSummary) => this.evaluateMatch(fixture.id)));
    const ordered = decisions
      .sort((a, b) => b.scores.opportunityScore - a.scores.opportunityScore)
      .slice(0, limit);
    decisionLogger.completed({ job: "decision_opportunities", evaluated: ordered.length });
    return ordered;
  }

  async recalculate(fixtureIds?: string[]) {
    const targets = fixtureIds?.length ? fixtureIds : (await this.intelligenceService.getTodayFixtures({ limit: 20 })).map((fixture) => fixture.id);
    const decisions = await Promise.all(targets.map((fixtureId) => this.evaluateMatch(fixtureId)));
    return {
      recalculated: decisions.length,
      decisions,
    };
  }

  health(): DecisionEngineHealth {
    const unavailable = getProviderStatus().filter((provider) => !provider.configured);
    if (unavailable.length) {
      decisionLogger.providerUnavailable({
        providers: unavailable.map((provider) => provider.name),
        mode: "SAFE_PLACEHOLDER",
      });
    }

    return {
      status: "ok",
      service: "fpf-ai-decision-engine",
      modelMode: "SAFE_PLACEHOLDER",
      providersRequired: false,
      generatedAt: new Date().toISOString(),
    };
  }

  private fallbackDecision(fixtureId: string): DecisionEngineOutput {
    return {
      id: `decision:${fixtureId}`,
      fixtureId,
      match: "Fixture unavailable",
      league: "League pending",
      kickoffTime: null,
      recommendedMarket: "Pending Market",
      predictedOutcome: "Insufficient data",
      status: "REJECTED",
      scores: {
        teamFormScore: 0,
        attackStrengthScore: 0,
        defenceStrengthScore: 0,
        homeAwayAdvantageScore: 0,
        injuryImpactScore: 0,
        oddsMovementScore: 0,
        marketValueScore: 0,
        liveMomentumScore: 0,
        riskScore: 100,
        confidenceScore: 0,
        opportunityScore: 0,
        valueScore: 0,
        momentumScore: 0,
        volatilityScore: 100,
      },
      reasoning: ["Insufficient normalized football data to recommend a market."],
      warnings: ["Low data confidence warning: decision fallback was used."],
      dataQualityStatus: "INSUFFICIENT_DATA",
      generatedAt: new Date().toISOString(),
    };
  }
}
