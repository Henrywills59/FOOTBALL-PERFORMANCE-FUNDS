import { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../database/prismaClient.js";
import { isPrismaOptionalDataError, logOptionalDataFallback } from "../database/prismaErrors.js";
import type { PredictionResult } from "@fpf/shared";
import type { PredictionRepository } from "./types.js";

function toPrediction(row: {
  id: string;
  fixtureId: string;
  recommendedMarket: string;
  predictedOutcome: string;
  confidenceScore: number;
  riskScore: number;
  valueRating: string;
  explanation: string;
  dataQualityStatus: PredictionResult["dataQualityStatus"];
  approvalStatus: PredictionResult["approvalStatus"];
  edge: number | null;
  impliedProbability: number | null;
  modelProbability: number | null;
  staleOdds: boolean;
  riskyMarket: boolean;
  createdAt: Date;
}): PredictionResult {
  return {
    id: row.id,
    fixtureId: row.fixtureId,
    recommendedMarket: row.recommendedMarket,
    predictedOutcome: row.predictedOutcome,
    confidenceScore: row.confidenceScore,
    riskScore: row.riskScore,
    valueRating: row.valueRating as PredictionResult["valueRating"],
    explanation: row.explanation,
    adminNotes: "adminNotes" in row ? row.adminNotes as string | null : null,
    dataQualityStatus: row.dataQualityStatus,
    approvalStatus: row.approvalStatus,
    edge: row.edge,
    impliedProbability: row.impliedProbability,
    modelProbability: row.modelProbability,
    staleOdds: row.staleOdds,
    riskyMarket: row.riskyMarket,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PrismaPredictionRepository implements PredictionRepository {
  constructor(private readonly prismaClient?: PrismaClient) {}

  private get prisma() {
    return this.prismaClient ?? getPrismaClient();
  }

  async getFixtureForPrediction(fixtureId: string) {
    const fixture = await this.prisma.footballFixture.findUnique({
      where: { id: fixtureId },
      include: {
        league: { include: { standings: { include: { team: true } } } },
        homeTeam: true,
        awayTeam: true,
        injuries: { include: { team: true } },
        odds: true,
        headToHeadRecords: true,
      },
    });

    if (!fixture) return null;

    return {
      id: fixture.id,
      apiFootballFixtureId: fixture.apiFootballFixtureId,
      leagueName: fixture.league.name,
      leagueCountry: fixture.league.country,
      homeTeamName: fixture.homeTeam.name,
      awayTeamName: fixture.awayTeam.name,
      kickoffAt: fixture.kickoffAt.toISOString(),
      status: fixture.status,
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      venue: fixture.venue,
      season: fixture.season,
      round: fixture.round,
      referee: fixture.referee,
      standings: fixture.league.standings.map((standing) => ({
        teamName: standing.team.name,
        rank: standing.rank,
        points: standing.points,
        played: standing.played,
        won: standing.won,
        drawn: standing.drawn,
        lost: standing.lost,
      })),
      injuries: fixture.injuries.map((injury) => ({
        playerName: injury.playerName,
        teamName: injury.team.name,
        reason: injury.reason,
      })),
      odds: fixture.odds.map((odd) => ({
        id: odd.id,
        bookmaker: odd.bookmaker,
        market: odd.market,
        outcome: odd.outcome,
        price: odd.price,
        updatedAt: odd.updatedAt.toISOString(),
      })),
      headToHeadRecords: fixture.headToHeadRecords.map((record) => ({
        id: record.id,
        updatedAt: record.updatedAt.toISOString(),
      })),
    };
  }

  async createPrediction(input: PredictionResult & { oddId: string }): Promise<PredictionResult> {
    const prediction = await this.prisma.matchPrediction.create({
      data: {
        fixtureId: input.fixtureId,
        oddId: input.oddId,
        recommendedMarket: input.recommendedMarket,
        predictedOutcome: input.predictedOutcome,
        confidenceScore: input.confidenceScore,
        riskScore: input.riskScore,
        valueRating: input.valueRating,
        explanation: input.explanation,
        dataQualityStatus: input.dataQualityStatus,
        approvalStatus: "PENDING",
        edge: input.edge,
        impliedProbability: input.impliedProbability,
        modelProbability: input.modelProbability,
        staleOdds: input.staleOdds,
        riskyMarket: input.riskyMarket,
      },
    });

    return toPrediction(prediction);
  }

  async listPredictions(input: { approvalStatus?: PredictionResult["approvalStatus"] }) {
    let predictions;
    try {
      predictions = await this.prisma.matchPrediction.findMany({
        where: input.approvalStatus ? { approvalStatus: input.approvalStatus } : undefined,
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      if (!isPrismaOptionalDataError(error)) throw error;
      logOptionalDataFallback("predictions.list", error);
      return [];
    }

    return predictions.map(toPrediction);
  }

  async updateApprovalStatus(id: string, approvalStatus: "APPROVED" | "REJECTED") {
    const prediction = await this.prisma.matchPrediction.update({
      where: { id },
      data: { approvalStatus },
    });

    return toPrediction(prediction);
  }

  async updateNotes(id: string, adminNotes: string) {
    const prediction = await this.prisma.matchPrediction.update({
      where: { id },
      data: { adminNotes },
    });

    return toPrediction(prediction);
  }
}
