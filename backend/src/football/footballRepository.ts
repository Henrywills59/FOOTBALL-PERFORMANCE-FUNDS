import { PrismaClient } from "@prisma/client";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { getPrismaClient } from "../database/prismaClient.js";
import { isPrismaRecoverableReadError, logOptionalDataFallback } from "../database/prismaErrors.js";
import type { FootballFixtureDetail, FootballFixtureSummary } from "@fpf/shared";
import type {
  FixtureUpsert,
  FootballFreshness,
  FootballRepository,
  InjuryUpsert,
  NormalizedLeague,
  NormalizedTeam,
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

    await this.prisma.playerInjury.deleteMany({
      where: {
        fixtureId: fixture?.id ?? null,
        teamId: team.id,
        playerName: input.playerName,
      },
    });
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
    const existing = await this.prisma.matchOdd.findFirst({
      where: {
        fixtureId: fixture?.id ?? null,
        fixtureApiId: input.fixtureApiId,
        bookmaker: input.bookmaker,
        market: input.market,
        outcome: input.outcome,
      },
      orderBy: { updatedAt: "desc" },
    });
    const movement = existing
      ? {
          previousPrice: existing.price,
          currentPrice: input.price,
          direction: input.price > existing.price ? "UP" : input.price < existing.price ? "DOWN" : "UNCHANGED",
          changedBy: Number((input.price - existing.price).toFixed(4)),
        }
      : {
          previousPrice: null,
          currentPrice: input.price,
          direction: "NEW",
          changedBy: 0,
        };

    await this.prisma.matchOdd.deleteMany({
      where: {
        fixtureId: fixture?.id ?? null,
        fixtureApiId: input.fixtureApiId,
        bookmaker: input.bookmaker,
        market: input.market,
        outcome: input.outcome,
      },
    });
    await this.prisma.matchOdd.create({
      data: {
        fixtureId: fixture?.id,
        fixtureApiId: input.fixtureApiId,
        bookmaker: input.bookmaker,
        market: input.market,
        outcome: input.outcome,
        price: input.price,
        raw: prismaJson({
          provider: "The Odds API",
          providerSport: input.providerSport,
          retrievedAt: (input.retrievedAt ?? new Date()).toISOString(),
          quota: input.quota ?? {},
          movement,
          source: input.raw,
        }),
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
      if (!isPrismaRecoverableReadError(error)) throw error;
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

  async listLeagues(): Promise<NormalizedLeague[]> {
    try {
      const leagues = await this.prisma.footballLeague.findMany({
        orderBy: [{ country: "asc" }, { name: "asc" }],
      });
      return leagues.map((league) => ({
        id: league.id,
        apiFootballLeagueId: league.apiFootballLeagueId,
        name: league.name,
        country: league.country,
        logoUrl: league.logoUrl,
        season: league.season,
      }));
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("football.leagues", error);
      return [];
    }
  }

  async listStandings(input: { leagueId?: string; season?: number }) {
    const freshness = await this.getFreshness();
    try {
      const standings = await this.prisma.leagueStanding.findMany({
        where: {
          ...(input.leagueId ? { leagueId: input.leagueId } : {}),
          ...(input.season ? { season: input.season } : {}),
        },
        include: { team: true },
        orderBy: { rank: "asc" },
      });
      return {
        data: standings.map((standing) => ({
          teamName: standing.team.name,
          rank: standing.rank,
          points: standing.points,
          played: standing.played,
          won: standing.won,
          drawn: standing.drawn,
          lost: standing.lost,
        })),
        freshness,
      };
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("football.standings", error);
      return { data: [], freshness: { ...freshness, freshnessState: "PROVIDER_PENDING" as const, stale: true } };
    }
  }

  async getTeam(id: string) {
    const freshness = await this.getFreshness();
    try {
      const team = await this.prisma.footballTeam.findFirst({
        where: {
          OR: [
            { id },
            ...(Number.isFinite(Number(id)) ? [{ apiFootballTeamId: Number(id) }] : []),
          ],
        },
      });
      return {
        data: team ? this.mapTeam(team) : null,
        freshness,
      };
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("football.team", error);
      return { data: null, freshness: { ...freshness, freshnessState: "PROVIDER_PENDING" as const, stale: true } };
    }
  }

  async getTeamStatistics(id: string) {
    const freshness = await this.getFreshness();
    try {
      const team = await this.prisma.footballTeam.findFirst({
        where: { OR: [{ id }, ...(Number.isFinite(Number(id)) ? [{ apiFootballTeamId: Number(id) }] : [])] },
        include: { statistics: { orderBy: { updatedAt: "desc" }, take: 1 } },
      });
      return { data: team?.statistics[0]?.raw ?? null, freshness };
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("football.teamStatistics", error);
      return { data: null, freshness: { ...freshness, freshnessState: "PROVIDER_PENDING" as const, stale: true } };
    }
  }

  async getFixtureEvents(id: string) {
    return this.fixtureRawArray(id, "events");
  }

  async getFixtureStatistics(id: string) {
    return this.fixtureRawArray(id, "statistics");
  }

  async getFixtureLineups(id: string) {
    return this.fixtureRawArray(id, "lineups");
  }

  async getFixtureInjuries(id: string) {
    const fixture = await this.getFixture(id);
    return { data: fixture?.injuries ?? [], freshness: await this.getFreshness() };
  }

  async getHeadToHead(id: string) {
    const fixture = await this.getFixture(id);
    return { data: fixture?.headToHeadRecords ?? [], freshness: await this.getFreshness() };
  }

  async getSyncStatus(jobsEnabled: boolean, jobsStarted: boolean) {
    let lastRun;
    try {
      lastRun = await this.prisma.footballSyncRun.findFirst({
        orderBy: { startedAt: "desc" },
      });
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
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

  private mapTeam(team: { id: string; apiFootballTeamId: number; name: string; country: string | null; logoUrl: string | null }): NormalizedTeam {
    return {
      id: team.id,
      apiFootballTeamId: team.apiFootballTeamId,
      name: team.name,
      country: team.country,
      logoUrl: team.logoUrl,
    };
  }

  private async fixtureRawArray(id: string, key: string) {
    const freshness = await this.getFreshness();
    try {
      const fixture = await this.prisma.footballFixture.findFirst({
        where: {
          OR: [
            { id },
            ...(Number.isFinite(Number(id)) ? [{ apiFootballFixtureId: Number(id) }] : []),
          ],
        },
      });
      const raw = fixture?.raw && typeof fixture.raw === "object" ? fixture.raw as Record<string, unknown> : {};
      const value = raw[key];
      return { data: Array.isArray(value) ? value : [], freshness };
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback(`football.fixture.${key}`, error);
      return { data: [], freshness: { ...freshness, freshnessState: "PROVIDER_PENDING" as const, stale: true } };
    }
  }

  private async getFreshness(): Promise<FootballFreshness> {
    try {
      const lastRun = await this.prisma.footballSyncRun.findFirst({
        where: { provider: "api-football" },
        orderBy: { startedAt: "desc" },
      });
      const lastSynchronizedAt = lastRun?.finishedAt ?? lastRun?.startedAt ?? null;
      const stale = lastSynchronizedAt ? Date.now() - lastSynchronizedAt.getTime() > 3 * 60 * 60 * 1000 : true;
      return {
        provider: "API-Football",
        lastSynchronizedAt: lastSynchronizedAt?.toISOString() ?? null,
        freshnessState: !lastRun ? "PROVIDER_PENDING" : lastRun.status === "FAILED" ? "PROVIDER_ERROR" : stale ? "STALE" : "FRESH",
        stale,
        nextScheduledRefresh: null,
        providerAvailability: lastRun?.status === "FAILED" ? "DEGRADED" : "AVAILABLE",
      };
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("football.freshness", error);
      return {
        provider: "API-Football",
        lastSynchronizedAt: null,
        freshnessState: "PROVIDER_PENDING",
        stale: true,
        nextScheduledRefresh: null,
        providerAvailability: "DEGRADED",
      };
    }
  }
}
