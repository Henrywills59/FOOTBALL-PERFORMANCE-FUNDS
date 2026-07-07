import { PrismaClient } from "@prisma/client";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { getPrismaClient } from "../database/prismaClient.js";
import { isPrismaOptionalDataError, logOptionalDataFallback } from "../database/prismaErrors.js";
import type { FootballFixtureDetail, FootballFixtureSummary } from "@fpf/shared";
import type {
  FixtureUpsert,
  FootballRepository,
  InjuryUpsert,
  OddUpsert,
  StandingUpsert,
} from "./types.js";

const prismaJson = (value: unknown) => value as InputJsonValue;

function fixtureStatus(short?: string | null): FixtureUpsert["status"] {
  if (["1H", "2H", "HT", "ET", "BT", "P", "LIVE"].includes(short ?? "")) return "LIVE";
  if (["FT", "AET", "PEN"].includes(short ?? "")) return "FINISHED";
  if (["PST"].includes(short ?? "")) return "POSTPONED";
  if (["CANC", "ABD", "AWD", "WO"].includes(short ?? "")) return "CANCELLED";
  return "SCHEDULED";
}

export { fixtureStatus };

export class PrismaFootballRepository implements FootballRepository {
  constructor(private readonly prismaClient?: PrismaClient) {}

  private get prisma() {
    return this.prismaClient ?? getPrismaClient();
  }

  async upsertFixture(input: FixtureUpsert): Promise<void> {
    const league = await this.prisma.footballLeague.upsert({
      where: { apiFootballLeagueId: input.league.apiFootballLeagueId },
      update: {
        name: input.league.name,
        country: input.league.country,
        logoUrl: input.league.logoUrl,
        season: input.league.season,
      },
      create: {
        apiFootballLeagueId: input.league.apiFootballLeagueId,
        name: input.league.name,
        country: input.league.country,
        logoUrl: input.league.logoUrl,
        season: input.league.season,
      },
    });
    const homeTeam = await this.upsertTeam(input.homeTeam);
    const awayTeam = await this.upsertTeam(input.awayTeam);

    await this.prisma.footballFixture.upsert({
      where: { apiFootballFixtureId: input.apiFootballFixtureId },
      update: {
        leagueId: league.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        season: input.season,
        round: input.round,
        kickoffAt: input.kickoffAt,
        status: input.status,
        statusShort: input.statusShort,
        elapsed: input.elapsed,
        venue: input.venue,
        referee: input.referee,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        raw: prismaJson(input.raw),
      },
      create: {
        apiFootballFixtureId: input.apiFootballFixtureId,
        leagueId: league.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        season: input.season,
        round: input.round,
        kickoffAt: input.kickoffAt,
        status: input.status,
        statusShort: input.statusShort,
        elapsed: input.elapsed,
        venue: input.venue,
        referee: input.referee,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        raw: prismaJson(input.raw),
      },
    });
  }

  async upsertStanding(input: StandingUpsert): Promise<void> {
    const league = await this.findLeague(input.leagueApiId);
    const team = await this.upsertTeam({ apiFootballTeamId: input.teamApiId, name: input.teamName });
    if (!league) return;

    await this.prisma.leagueStanding.upsert({
      where: { leagueId_teamId_season: { leagueId: league.id, teamId: team.id, season: input.season } },
      update: {
        rank: input.rank,
        points: input.points,
        played: input.played,
        won: input.won,
        drawn: input.drawn,
        lost: input.lost,
        goalsFor: input.goalsFor,
        goalsAgainst: input.goalsAgainst,
        raw: prismaJson(input.raw),
      },
      create: {
        leagueId: league.id,
        teamId: team.id,
        season: input.season,
        rank: input.rank,
        points: input.points,
        played: input.played,
        won: input.won,
        drawn: input.drawn,
        lost: input.lost,
        goalsFor: input.goalsFor,
        goalsAgainst: input.goalsAgainst,
        raw: prismaJson(input.raw),
      },
    });
  }

  async upsertTeamStatistic(input: { leagueApiId: number; teamApiId: number; season: number; raw: unknown }): Promise<void> {
    const league = await this.findLeague(input.leagueApiId);
    const team = await this.prisma.footballTeam.findUnique({ where: { apiFootballTeamId: input.teamApiId } });
    if (!league || !team) return;

    await this.prisma.teamStatistic.upsert({
      where: { leagueId_teamId_season: { leagueId: league.id, teamId: team.id, season: input.season } },
      update: { raw: prismaJson(input.raw) },
      create: { leagueId: league.id, teamId: team.id, season: input.season, raw: prismaJson(input.raw) },
    });
  }

  async upsertInjury(input: InjuryUpsert): Promise<void> {
    const team = await this.upsertTeam({ apiFootballTeamId: input.teamApiId, name: input.teamName });
    const fixture = input.fixtureApiId
      ? await this.prisma.footballFixture.findUnique({ where: { apiFootballFixtureId: input.fixtureApiId } })
      : null;

    await this.prisma.playerInjury.create({
      data: {
        fixtureId: fixture?.id,
        teamId: team.id,
        playerName: input.playerName,
        reason: input.reason,
        raw: prismaJson(input.raw),
      },
    });
  }

  async upsertHeadToHead(input: { fixtureApiId: number; raw: unknown }): Promise<void> {
    const fixture = await this.prisma.footballFixture.findUnique({ where: { apiFootballFixtureId: input.fixtureApiId } });
    if (!fixture) return;

    await this.prisma.headToHeadRecord.upsert({
      where: { fixtureId: fixture.id },
      update: { raw: prismaJson(input.raw) },
      create: { fixtureId: fixture.id, raw: prismaJson(input.raw) },
    });
  }

  async upsertOdd(input: OddUpsert): Promise<void> {
    const fixture = input.fixtureApiId
      ? await this.prisma.footballFixture.findUnique({ where: { apiFootballFixtureId: input.fixtureApiId } })
      : null;

    await this.prisma.matchOdd.create({
      data: {
        fixtureId: fixture?.id,
        fixtureApiId: input.fixtureApiId,
        bookmaker: input.bookmaker,
        market: input.market,
        outcome: input.outcome,
        price: input.price,
        raw: prismaJson(input.raw),
      },
    });
  }

  async startSyncRun(input: { provider: string; jobName: string }): Promise<string> {
    const run = await this.prisma.footballSyncRun.create({
      data: { ...input, status: "RUNNING" },
    });
    return run.id;
  }

  async finishSyncRun(id: string, input: { status: "SUCCESS" | "FAILED"; message?: string; recordsRead?: number; recordsSaved?: number }): Promise<void> {
    await this.prisma.footballSyncRun.update({
      where: { id },
      data: { ...input, finishedAt: new Date() },
    });
  }

  async listFixtures(input: {
    live?: boolean;
    limit?: number;
    search?: string;
    league?: string;
    date?: string;
  }): Promise<FootballFixtureSummary[]> {
    const dateFilter = input.date
      ? {
          gte: new Date(`${input.date}T00:00:00.000Z`),
          lt: new Date(`${input.date}T23:59:59.999Z`),
        }
      : undefined;
    let fixtures;
    try {
      fixtures = await this.prisma.footballFixture.findMany({
        where: {
          ...(input.live ? { status: "LIVE" as const } : {}),
          ...(dateFilter ? { kickoffAt: dateFilter } : {}),
          ...(input.league ? { league: { name: { contains: input.league, mode: "insensitive" as const } } } : {}),
          ...(input.search
            ? {
                OR: [
                  { homeTeam: { name: { contains: input.search, mode: "insensitive" as const } } },
                  { awayTeam: { name: { contains: input.search, mode: "insensitive" as const } } },
                  { league: { name: { contains: input.search, mode: "insensitive" as const } } },
                ],
              }
            : {}),
        },
        orderBy: { kickoffAt: "asc" },
        take: input.limit ?? 25,
        include: { league: true, homeTeam: true, awayTeam: true },
      });
    } catch (error) {
      if (!isPrismaOptionalDataError(error)) throw error;
      logOptionalDataFallback("football.fixtures", error);
      return [];
    }

    return fixtures.map((fixture) => ({
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
    }));
  }

  async getFixture(id: string): Promise<FootballFixtureDetail | null> {
    const fixture = await this.prisma.footballFixture.findUnique({
      where: { id },
      include: {
        league: { include: { standings: { include: { team: true }, orderBy: { rank: "asc" } } } },
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

  async getSyncStatus(jobsEnabled: boolean, jobsStarted: boolean) {
    let lastRun;
    try {
      lastRun = await this.prisma.footballSyncRun.findFirst({
        orderBy: { startedAt: "desc" },
      });
    } catch (error) {
      if (!isPrismaOptionalDataError(error)) throw error;
      logOptionalDataFallback("football.syncStatus", error);
      lastRun = null;
    }

    return {
      jobsEnabled,
      jobsStarted,
      lastRunAt: lastRun?.startedAt.toISOString() ?? null,
      lastRunStatus: lastRun?.status ?? null,
      nextRunHint: jobsStarted ? "Automatic football sync is scheduled." : "Automatic football sync is not running.",
    };
  }

  private async upsertTeam(input: { apiFootballTeamId: number; name: string; country?: string | null; logoUrl?: string | null }) {
    return this.prisma.footballTeam.upsert({
      where: { apiFootballTeamId: input.apiFootballTeamId },
      update: { name: input.name, country: input.country, logoUrl: input.logoUrl },
      create: input,
    });
  }

  private async findLeague(apiFootballLeagueId: number) {
    return this.prisma.footballLeague.findUnique({ where: { apiFootballLeagueId } });
  }
}
