import type { FootballFixtureDetail } from "@fpf/shared";
import type { MatchIntelligence } from "../types.js";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function teamFormScore(match: MatchIntelligence) {
  return clamp(match.scores.formRating || (match.fixture ? 50 : 0));
}

export function attackStrengthScore(match: MatchIntelligence) {
  return clamp(match.scores.attackRating || (match.fixture ? 50 : 0));
}

export function defenceStrengthScore(match: MatchIntelligence) {
  return clamp(match.scores.defenceRating || (match.fixture ? 50 : 0));
}

export function homeAwayAdvantageScore(fixture: FootballFixtureDetail | null) {
  if (!fixture) return 0;
  const homeStanding = fixture.standings.find((standing) => standing.teamName === fixture.homeTeamName);
  const awayStanding = fixture.standings.find((standing) => standing.teamName === fixture.awayTeamName);
  if (!homeStanding || !awayStanding) return 54;
  return clamp(55 + (awayStanding.rank - homeStanding.rank) * 2);
}

export function injuryImpactScore(match: MatchIntelligence) {
  if (!match.fixture) return 0;
  return clamp(74 - match.injuries.length * 8);
}

export function oddsMovementScore(match: MatchIntelligence) {
  if (!match.fixture) return 0;
  if (match.odds.status === "UNAVAILABLE") return 45;
  return clamp(50 + match.odds.markets.length * 5);
}

export function marketValueScore(match: MatchIntelligence) {
  if (!match.fixture) return 0;
  if (!match.odds.markets.length) return 38;
  return clamp(match.scores.valueScore || 50);
}

export function liveMomentumScore(match: MatchIntelligence) {
  if (!match.fixture) return 0;
  return clamp(match.fixture.status === "LIVE" ? match.scores.momentumRating + 8 : match.scores.momentumRating);
}

export function volatilityScore(match: MatchIntelligence) {
  return clamp(match.scores.volatilityRating);
}

export function riskScore(match: MatchIntelligence, inputs: { injuryImpact: number; volatility: number; marketValue: number }) {
  if (!match.fixture) return 100;
  return clamp(match.scores.riskScore + (100 - inputs.injuryImpact) * 0.18 + inputs.volatility * 0.16 - inputs.marketValue * 0.12);
}

export function confidenceScore(inputs: {
  teamForm: number;
  attackStrength: number;
  defenceStrength: number;
  homeAwayAdvantage: number;
  marketValue: number;
  liveMomentum: number;
  risk: number;
}) {
  return clamp(
    inputs.teamForm * 0.16 +
      inputs.attackStrength * 0.15 +
      inputs.defenceStrength * 0.14 +
      inputs.homeAwayAdvantage * 0.12 +
      inputs.marketValue * 0.18 +
      inputs.liveMomentum * 0.1 +
      (100 - inputs.risk) * 0.15,
  );
}

export function opportunityScore(inputs: { confidence: number; marketValue: number; risk: number; liveMomentum: number }) {
  return clamp(inputs.confidence * 0.42 + inputs.marketValue * 0.26 + (100 - inputs.risk) * 0.22 + inputs.liveMomentum * 0.1);
}

