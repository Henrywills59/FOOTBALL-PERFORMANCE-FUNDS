import type { FootballFixtureDetail, FootballFixtureSummary, FootballSyncStatus } from "@fpf/shared";
import type {
  FixtureUpsert,
  FootballRepository,
  InjuryUpsert,
  OddUpsert,
  StandingUpsert,
} from "./types.js";

export class InMemoryFootballRepository implements FootballRepository {
  fixtures = new Map<string, FootballFixtureDetail>();
  syncRuns: Array<{ id: string; status: "SUCCESS" | "FAILED" | "RUNNING"; startedAt: string }> = [];

  async upsertFixture(input: FixtureUpsert): Promise<void> {
    const id = String(input.apiFootballFixtureId);
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

  async upsertTeamStatistic(): Promise<void> {}

  async upsertInjury(input: InjuryUpsert): Promise<void> {
    if (!input.fixtureApiId) return;
    const fixture = this.fixtures.get(String(input.fixtureApiId));
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
      fixture?.odds.push({
        id: `${input.fixtureApiId}-${input.bookmaker}-${input.market}-${input.outcome}`,
        bookmaker: input.bookmaker,
        market: input.market,
        outcome: input.outcome,
        price: input.price,
        updatedAt: new Date().toISOString(),
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
}
