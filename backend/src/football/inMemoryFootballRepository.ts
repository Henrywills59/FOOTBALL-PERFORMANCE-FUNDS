import type { FootballFixtureDetail, FootballFixtureSummary, FootballSyncStatus } from "@fpf/shared";
import type {
  FootballFreshness,
  FixtureUpsert,
  FootballRepository,
  InjuryUpsert,
  NormalizedLeague,
  NormalizedTeam,
  OddUpsert,
  StandingUpsert,
} from "./types.js";

export class InMemoryFootballRepository implements FootballRepository {
  fixtures = new Map<string, FootballFixtureDetail>();
  leagues = new Map<string, NormalizedLeague>();
  teams = new Map<string, NormalizedTeam>();
  teamStatistics = new Map<string, unknown>();
  syncRuns: Array<{ id: string; status: "SUCCESS" | "FAILED" | "RUNNING"; startedAt: string }> = [];

  async upsertFixture(input: FixtureUpsert): Promise<void> {
    const id = String(input.apiFootballFixtureId);
    this.leagues.set(String(input.league.apiFootballLeagueId), {
      id: String(input.league.apiFootballLeagueId),
      apiFootballLeagueId: input.league.apiFootballLeagueId,
      name: input.league.name,
      country: input.league.country ?? null,
      logoUrl: input.league.logoUrl ?? null,
      season: input.league.season,
    });
    this.teams.set(String(input.homeTeam.apiFootballTeamId), {
      id: String(input.homeTeam.apiFootballTeamId),
      apiFootballTeamId: input.homeTeam.apiFootballTeamId,
      name: input.homeTeam.name,
      country: null,
      logoUrl: input.homeTeam.logoUrl ?? null,
    });
    this.teams.set(String(input.awayTeam.apiFootballTeamId), {
      id: String(input.awayTeam.apiFootballTeamId),
      apiFootballTeamId: input.awayTeam.apiFootballTeamId,
      name: input.awayTeam.name,
      country: null,
      logoUrl: input.awayTeam.logoUrl ?? null,
    });
    this.fixtures.set(id, {
      id,
      apiFootballFixtureId: input.apiFootballFixtureId,
      leagueName: input.league.name,
      leagueCountry: input.league.country ?? null,
      homeTeamName: input.homeTeam.name,
      awayTeamName: input.awayTeam.name,
      kickoffAt: input.kickoffAt.toISOString(),
      status: input.status,
      homeScore: input.homeScore ?? null,
      awayScore: input.awayScore ?? null,
      venue: input.venue ?? null,
      season: input.season,
      round: input.round ?? null,
      referee: input.referee ?? null,
      standings: [],
      injuries: [],
      odds: [],
      headToHeadRecords: [],
    });
  }

  async upsertStanding(input: StandingUpsert): Promise<void> {
    for (const fixture of this.fixtures.values()) {
      if (fixture.season === input.season) {
        fixture.standings.push({
          teamName: input.teamName,
          rank: input.rank,
          points: input.points,
          played: input.played,
          won: input.won,
          drawn: input.drawn,
          lost: input.lost,
        });
      }
    }
  }

  async upsertTeamStatistic(input: { leagueApiId: number; teamApiId: number; season: number; raw: unknown }): Promise<void> {
    this.teamStatistics.set(String(input.teamApiId), input.raw);
  }

  async upsertInjury(input: InjuryUpsert): Promise<void> {
    if (!input.fixtureApiId) return;
    const fixture = this.fixtures.get(String(input.fixtureApiId));
    if (fixture) {
      fixture.injuries = fixture.injuries.filter((injury) => injury.playerName !== input.playerName);
    }
    fixture?.injuries.push({
      playerName: input.playerName,
      teamName: input.teamName,
      reason: input.reason ?? null,
    });
  }

  async upsertHeadToHead(): Promise<void> {}

  async upsertOdd(input: OddUpsert): Promise<void> {
    if (!input.fixtureApiId) return;
    const fixture = this.fixtures.get(String(input.fixtureApiId));
    const existing = fixture?.odds.find((odd) => odd.bookmaker === input.bookmaker && odd.market === input.market && odd.outcome === input.outcome);
    if (fixture) {
      fixture.odds = fixture.odds.filter((odd) => !(odd.bookmaker === input.bookmaker && odd.market === input.market && odd.outcome === input.outcome));
    }
      fixture?.odds.push({
        id: `${input.fixtureApiId}-${input.bookmaker}-${input.market}-${input.outcome}`,
        bookmaker: input.bookmaker,
        market: input.market,
        outcome: input.outcome,
        price: input.price,
        updatedAt: (input.retrievedAt ?? new Date()).toISOString(),
      });
  }

  async startSyncRun(): Promise<string> {
    const id = String(this.syncRuns.length + 1);
    this.syncRuns.push({ id, status: "RUNNING", startedAt: new Date().toISOString() });
    return id;
  }

  async finishSyncRun(id: string, input: { status: "SUCCESS" | "FAILED" }): Promise<void> {
    const run = this.syncRuns.find((item) => item.id === id);
    if (run) run.status = input.status;
  }

  async listFixtures(input: {
    live?: boolean;
    limit?: number;
    search?: string;
    league?: string;
    date?: string;
  }): Promise<FootballFixtureSummary[]> {
    const fixtures = Array.from(this.fixtures.values())
      .filter((fixture) => (input.live ? fixture.status === "LIVE" : true))
      .filter((fixture) => (input.league ? fixture.leagueName.toLowerCase().includes(input.league.toLowerCase()) : true))
      .filter((fixture) =>
        input.search
          ? `${fixture.homeTeamName} ${fixture.awayTeamName} ${fixture.leagueName}`
              .toLowerCase()
              .includes(input.search.toLowerCase())
          : true,
      )
      .filter((fixture) => (input.date ? fixture.kickoffAt.startsWith(input.date) : true))
      .slice(0, input.limit ?? 25);

    return fixtures.map(({ standings, injuries, odds, headToHeadRecords, season, round, referee, ...fixture }) => fixture);
  }

  async getFixture(id: string): Promise<FootballFixtureDetail | null> {
    return this.fixtures.get(id) ?? null;
  }

  async listLeagues(): Promise<NormalizedLeague[]> {
    return Array.from(this.leagues.values());
  }

  async listStandings(): Promise<{ data: FootballFixtureDetail["standings"]; freshness: FootballFreshness }> {
    return {
      data: Array.from(this.fixtures.values()).flatMap((fixture) => fixture.standings),
      freshness: this.freshness(),
    };
  }

  async getTeam(id: string): Promise<{ data: NormalizedTeam | null; freshness: FootballFreshness }> {
    return { data: this.teams.get(id) ?? null, freshness: this.freshness() };
  }

  async getTeamStatistics(id: string): Promise<{ data: unknown | null; freshness: FootballFreshness }> {
    return { data: this.teamStatistics.get(id) ?? null, freshness: this.freshness() };
  }

  async getFixtureEvents(): Promise<{ data: unknown[]; freshness: FootballFreshness }> {
    return { data: [], freshness: this.freshness() };
  }

  async getFixtureStatistics(): Promise<{ data: unknown[]; freshness: FootballFreshness }> {
    return { data: [], freshness: this.freshness() };
  }

  async getFixtureLineups(): Promise<{ data: unknown[]; freshness: FootballFreshness }> {
    return { data: [], freshness: this.freshness() };
  }

  async getFixtureInjuries(id: string): Promise<{ data: FootballFixtureDetail["injuries"]; freshness: FootballFreshness }> {
    return { data: this.fixtures.get(id)?.injuries ?? [], freshness: this.freshness() };
  }

  async getHeadToHead(id: string): Promise<{ data: FootballFixtureDetail["headToHeadRecords"]; freshness: FootballFreshness }> {
    return { data: this.fixtures.get(id)?.headToHeadRecords ?? [], freshness: this.freshness() };
  }

  async getSyncStatus(jobsEnabled: boolean, jobsStarted: boolean): Promise<FootballSyncStatus> {
    const lastRun = this.syncRuns.at(-1);
    return {
      jobsEnabled,
      jobsStarted,
      lastRunAt: lastRun?.startedAt ?? null,
      lastRunStatus: lastRun?.status ?? null,
      nextRunHint: jobsStarted ? "Automatic football sync is scheduled." : "Automatic football sync is not running.",
    };
  }

  private freshness(): FootballFreshness {
    const lastRun = this.syncRuns.at(-1);
    return {
      provider: "API-Football",
      lastSynchronizedAt: lastRun?.startedAt ?? null,
      freshnessState: lastRun ? lastRun.status === "FAILED" ? "PROVIDER_ERROR" : "FRESH" : "PROVIDER_PENDING",
      stale: !lastRun,
      nextScheduledRefresh: null,
      providerAvailability: lastRun?.status === "FAILED" ? "DEGRADED" : "AVAILABLE",
    };
  }
}
