import type { FootballFixtureDetail } from "@fpf/shared";
import type { IntelligenceScores } from "./types.js";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function statusMomentum(fixture: FootballFixtureDetail | null) {
  if (!fixture) return 35;
  if (fixture.status === "LIVE") return 68;
  if (fixture.status === "SCHEDULED") return 54;
  if (fixture.status === "FINISHED") return 42;
  return 30;
}

export function calculateAiConfidence(fixture: FootballFixtureDetail | null) {
  if (!fixture) return 0;
  const dataDepth = fixture.odds.length * 6 + fixture.standings.length * 2 + fixture.injuries.length * 3;
  return clamp(48 + dataDepth + (fixture.status === "LIVE" ? 8 : 0));
}

export function calculateOpportunityScore(fixture: FootballFixtureDetail | null) {
  if (!fixture) return 0;
  return clamp(calculateAiConfidence(fixture) + fixture.odds.length * 4 - fixture.injuries.length * 2);
}

export function calculateRiskScore(fixture: FootballFixtureDetail | null) {
  if (!fixture) return 100;
  const missingOddsPenalty = fixture.odds.length ? 0 : 18;
  const injuryPenalty = Math.min(fixture.injuries.length * 5, 22);
  const livePenalty = fixture.status === "LIVE" ? 8 : 0;
  return clamp(34 + missingOddsPenalty + injuryPenalty + livePenalty);
}

export function calculateValueScore(fixture: FootballFixtureDetail | null) {
  if (!fixture) return 0;
  return clamp(fixture.odds.length ? 52 + fixture.odds.length * 5 : 20);
}

export function calculateTeamStrength(fixture: FootballFixtureDetail | null) {
  if (!fixture || !fixture.standings.length) return fixture ? 50 : 0;
  const topHalf = fixture.standings.filter((standing) => standing.rank <= Math.ceil(fixture.standings.length / 2)).length;
  return clamp(45 + topHalf * 3);
}

export function calculateAttackRating(fixture: FootballFixtureDetail | null) {
  if (!fixture || !fixture.standings.length) return fixture ? 50 : 0;
  const goalsFor = fixture.standings.reduce((total, standing) => total + standing.won * 2 + standing.drawn, 0);
  return clamp(40 + goalsFor / Math.max(fixture.standings.length, 1));
}

export function calculateDefenceRating(fixture: FootballFixtureDetail | null) {
  if (!fixture || !fixture.standings.length) return fixture ? 50 : 0;
  const losses = fixture.standings.reduce((total, standing) => total + standing.lost, 0);
  return clamp(70 - losses / Math.max(fixture.standings.length, 1));
}

export function calculateFormRating(fixture: FootballFixtureDetail | null) {
  if (!fixture || !fixture.standings.length) return fixture ? 50 : 0;
  const points = fixture.standings.reduce((total, standing) => total + standing.points, 0);
  return clamp(points / Math.max(fixture.standings.length, 1));
}

export function calculateMomentumRating(fixture: FootballFixtureDetail | null) {
  return clamp(statusMomentum(fixture));
}

export function calculateVolatilityRating(fixture: FootballFixtureDetail | null) {
  if (!fixture) return 100;
  return clamp(42 + fixture.injuries.length * 4 + (fixture.status === "LIVE" ? 12 : 0));
}

export function calculateIntelligenceScores(fixture: FootballFixtureDetail | null): IntelligenceScores {
  return {
    aiConfidence: calculateAiConfidence(fixture),
    opportunityScore: calculateOpportunityScore(fixture),
    riskScore: calculateRiskScore(fixture),
    valueScore: calculateValueScore(fixture),
    teamStrength: calculateTeamStrength(fixture),
    attackRating: calculateAttackRating(fixture),
    defenceRating: calculateDefenceRating(fixture),
    formRating: calculateFormRating(fixture),
    momentumRating: calculateMomentumRating(fixture),
    volatilityRating: calculateVolatilityRating(fixture),
    dataQualityStatus: fixture ? "READY" : "INSUFFICIENT_DATA",
  };
}
