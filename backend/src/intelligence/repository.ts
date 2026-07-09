import type { FootballFixtureSummary, PredictionResult, PublishedIntelligence, SubscriberOpportunity } from "@fpf/shared";
import type { AnalystRepository } from "../analyst/types.js";
import type { FootballRepository } from "../football/types.js";
import type { PredictionRepository } from "../predictions/types.js";
import type { IntelligenceRepository } from "./types.js";
import { intelligenceLogger } from "./logger.js";

function riskGrade(scoreOrLabel: number | string): SubscriberOpportunity["riskGrade"] {
  if (typeof scoreOrLabel === "string") {
    const normalized = scoreOrLabel.toLowerCase();
    if (normalized.includes("high")) return "High";
    if (normalized.includes("medium")) return "Medium";
    return "Low";
  }

  if (scoreOrLabel >= 70) return "High";
  if (scoreOrLabel >= 45) return "Medium";
  return "Low";
}

function opportunityStatus(fixture?: FootballFixtureSummary): SubscriberOpportunity["status"] {
  if (!fixture) return "Published";
  if (fixture.status === "LIVE") return "Live";
  if (fixture.status === "SCHEDULED") return "Upcoming";
  return "Monitoring";
}

function expectedValue(prediction: Pick<PredictionResult, "edge" | "valueRating">) {
  if (prediction.edge && prediction.edge > 0) return `+${(prediction.edge * 100).toFixed(1)}%`;
  if (prediction.valueRating !== "NONE") return prediction.valueRating;
  return "Neutral";
}

function matchName(fixture?: FootballFixtureSummary) {
  return fixture ? `${fixture.homeTeamName} vs ${fixture.awayTeamName}` : "Fixture context pending";
}

function predictionOpportunity(
  prediction: PredictionResult,
  fixtures: FootballFixtureSummary[],
): SubscriberOpportunity {
  const fixture = fixtures.find((item) => item.id === prediction.fixtureId);
  return {
    id: `prediction:${prediction.id ?? prediction.fixtureId}`,
    fixtureId: prediction.fixtureId,
    match: matchName(fixture),
    league: fixture?.leagueName ?? "League pending",
    kickoffTime: fixture?.kickoffAt ?? null,
    market: prediction.recommendedMarket,
    prediction: prediction.predictedOutcome,
    aiConfidence: prediction.confidenceScore,
    riskGrade: riskGrade(prediction.riskScore),
    expectedValue: expectedValue(prediction),
    status: opportunityStatus(fixture),
    explanation: prediction.explanation,
    source: "AI Prediction",
  };
}

function intelligenceOpportunity(item: PublishedIntelligence): SubscriberOpportunity {
  return {
    id: `intelligence:${item.id}`,
    fixtureId: item.fixtureId,
    match: item.match,
    league: item.leagueName,
    kickoffTime: item.publishedAt,
    market: item.market,
    prediction: item.prediction,
    aiConfidence: item.confidence,
    riskGrade: riskGrade(item.riskRating),
    expectedValue: item.confidence >= 70 ? "High" : item.confidence >= 55 ? "Medium" : "Watch",
    status: "Published",
    explanation: item.briefExplanation,
    source: "FPF Intelligence",
  };
}

export class IntelligenceRepositoryAdapter implements IntelligenceRepository {
  constructor(
    private readonly footballRepository: FootballRepository,
    private readonly predictionRepository: PredictionRepository,
    private readonly analystRepository: AnalystRepository,
  ) {}

  async listFixtures(input: {
    live?: boolean;
    limit?: number;
    search?: string;
    league?: string;
    date?: string;
  }) {
    try {
      return await this.footballRepository.listFixtures(input);
    } catch (error) {
      intelligenceLogger.apiFailure("repository.listFixtures", error, { input });
      return [];
    }
  }

  async getFixture(id: string) {
    try {
      return await this.footballRepository.getFixture(id);
    } catch (error) {
      intelligenceLogger.apiFailure("repository.getFixture", error, { id });
      return null;
    }
  }

  async listApprovedOpportunities(fixtures: FootballFixtureSummary[]) {
    try {
      const predictions = await this.predictionRepository.listPredictions({ approvalStatus: "APPROVED" });
      return predictions.map((prediction) => predictionOpportunity(prediction, fixtures));
    } catch (error) {
      intelligenceLogger.apiFailure("repository.listApprovedOpportunities", error);
      return [];
    }
  }

  async listPublishedOpportunities() {
    try {
      const published = await this.analystRepository.listPublished();
      return published.map(intelligenceOpportunity);
    } catch (error) {
      intelligenceLogger.apiFailure("repository.listPublishedOpportunities", error);
      return [];
    }
  }
}

