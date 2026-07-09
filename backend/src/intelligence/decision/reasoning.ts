import type { DecisionEngineScoreBreakdown } from "@fpf/shared";
import type { MatchIntelligence } from "../types.js";

export function buildDecisionReasoning(match: MatchIntelligence, scores: DecisionEngineScoreBreakdown) {
  const reasoning: string[] = [];
  const warnings: string[] = [];

  if (!match.fixture) {
    warnings.push("Low data confidence warning: fixture data is missing.");
    warnings.push("Pending live data: decision engine cannot evaluate unavailable match context.");
    return { reasoning: ["Insufficient normalized football data to recommend a market."], warnings };
  }

  if (scores.homeAwayAdvantageScore >= 60) reasoning.push("Strong home advantage profile.");
  if (scores.attackStrengthScore >= 58) reasoning.push("Attack strength trend is constructive.");
  if (scores.defenceStrengthScore <= 45) reasoning.push("Weak defensive context increases volatility.");
  if (scores.teamFormScore >= 58) reasoning.push("Team form score is above the current baseline.");
  if (scores.marketValueScore >= 58) reasoning.push("Market value detected from available odds context.");
  if (scores.liveMomentumScore >= 65) reasoning.push("Live momentum improving.");
  if (scores.opportunityScore >= 68) reasoning.push("Opportunity score meets candidate threshold.");

  if (match.odds.status === "UNAVAILABLE") warnings.push("Odds movement placeholder active: bookmaker movement is pending provider data.");
  if (!match.lineups.some((lineup) => lineup.confirmed)) warnings.push("Line-up confirmation pending.");
  if (match.injuries.length) warnings.push("Injury risk pending review.");
  if (scores.confidenceScore < 55) warnings.push("Low data confidence warning.");
  if (scores.riskScore >= 70) warnings.push("Risk score is elevated.");

  return {
    reasoning: reasoning.length ? reasoning : ["Baseline match intelligence is available, but no strong edge has emerged yet."],
    warnings,
  };
}

