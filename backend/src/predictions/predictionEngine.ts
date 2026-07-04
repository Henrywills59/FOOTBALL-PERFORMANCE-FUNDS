import type { PredictionEngineResult, PredictionInput } from "./types.js";

const minEdge = 0.05;
const staleOddsHours = 12;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function standingFor(fixture: PredictionInput, teamName: string) {
  return fixture.standings.find((standing) => standing.teamName === teamName);
}

function winRate(team?: { won: number; played: number }) {
  if (!team || team.played < 5) {
    return null;
  }

  return team.won / team.played;
}

function injuryPenalty(fixture: PredictionInput, teamName: string) {
  return fixture.injuries.filter((injury) => injury.teamName === teamName).length * 0.015;
}

function isStale(updatedAt: string) {
  return Date.now() - new Date(updatedAt).getTime() > staleOddsHours * 60 * 60 * 1000;
}

export class PredictionEngine {
  analyzeFixture(fixture: PredictionInput): PredictionEngineResult {
    const homeStanding = standingFor(fixture, fixture.homeTeamName);
    const awayStanding = standingFor(fixture, fixture.awayTeamName);
    const homeWinRate = winRate(homeStanding);
    const awayWinRate = winRate(awayStanding);
    const bestOdd = fixture.odds.find((odd) => odd.market === "h2h" && odd.outcome === fixture.homeTeamName);
    const h2hAvailable = fixture.headToHeadRecords.length > 0;

    if (!homeStanding || !awayStanding || homeWinRate === null || awayWinRate === null || !bestOdd || !h2hAvailable) {
      return {
        fixtureId: fixture.id,
        recommendedMarket: "Insufficient data",
        predictedOutcome: "Insufficient data",
        confidenceScore: 0,
        riskScore: 100,
        valueRating: "NONE",
        explanation:
          "Insufficient data. Predictions require standings, team form, head-to-head history, and current odds.",
        dataQualityStatus: "INSUFFICIENT_DATA",
        approvalStatus: "PENDING",
        edge: null,
        impliedProbability: null,
        modelProbability: null,
        staleOdds: false,
        riskyMarket: true,
      };
    }

    const formEdge = homeWinRate - awayWinRate;
    const tableEdge = clamp((awayStanding.rank - homeStanding.rank) / 20, -0.12, 0.12);
    const injuryEdge =
      injuryPenalty(fixture, fixture.awayTeamName) - injuryPenalty(fixture, fixture.homeTeamName);
    const modelProbability = clamp(0.5 + formEdge * 0.25 + tableEdge + injuryEdge, 0.05, 0.85);
    const impliedProbability = 1 / bestOdd.price;
    const edge = modelProbability - impliedProbability;
    const staleOdds = isStale(bestOdd.updatedAt);
    const riskyMarket = fixture.status !== "SCHEDULED" || modelProbability < 0.52 || staleOdds;
    const confidenceScore = clamp(Math.round((modelProbability * 100 + fixture.headToHeadRecords.length * 2) - (riskyMarket ? 15 : 0)), 1, 95);
    const riskScore = clamp(Math.round(100 - confidenceScore + (fixture.injuries.length > 2 ? 10 : 0)), 5, 100);
    const valueRating = edge > 0.12 ? "HIGH" : edge > 0.08 ? "MEDIUM" : edge > minEdge ? "LOW" : "NONE";
    const hasPositiveValue = edge > minEdge && !staleOdds && !riskyMarket;

    const recommendedMarket = hasPositiveValue ? "h2h" : "h2h";
    const predictedOutcome = fixture.homeTeamName;

    return {
      fixtureId: fixture.id,
      oddId: bestOdd.id,
      recommendedMarket,
      predictedOutcome,
      confidenceScore,
      riskScore,
      valueRating: hasPositiveValue ? valueRating : "NONE",
      explanation: hasPositiveValue
        ? `Model probability is ${(modelProbability * 100).toFixed(1)}% versus bookmaker implied probability ${(impliedProbability * 100).toFixed(1)}%. This is not a guarantee.`
        : "No positive value edge above threshold after stale-odds and risk checks. This is not a guarantee.",
      dataQualityStatus: staleOdds ? "STALE_ODDS" : "READY",
      approvalStatus: "PENDING",
      edge,
      impliedProbability,
      modelProbability,
      staleOdds,
      riskyMarket,
    };
  }
}
