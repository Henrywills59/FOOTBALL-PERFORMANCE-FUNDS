import type { ApiFootballClient } from "./apiFootballClient.js";
import type { FootballConfig } from "./config.js";
import { fixtureStatus } from "./footballRepository.js";
import type { OddsApiClient } from "./oddsApiClient.js";
import type { FootballRepository, FixtureUpsert } from "./types.js";

const asRecord = (value: unknown) => (value && typeof value === "object" ? (value as Record<string, any>) : {});

export type FootballSyncResult = {
  jobName: string;
  status: "SUCCESS" | "FAILED";
  recordsRead: number;
  recordsSaved: number;
  message?: string;
};

function mapFixture(raw: unknown): FixtureUpsert | null {
  const item = asRecord(raw);
  const fixture = asRecord(item.fixture);
  const league = asRecord(item.league);
  const teams = asRecord(item.teams);
  const goals = asRecord(item.goals);
  const status = asRecord(fixture.status);
  const venue = asRecord(fixture.venue);
  const home = asRecord(teams.home);
  const away = asRecord(teams.away);

  if (!fixture.id || !league.id || !home.id || !away.id || !fixture.date) {
    return null;
  }

  const statusShort = typeof status.short === "string" ? status.short : null;

  return {
    apiFootballFixtureId: Number(fixture.id),
    league: {
      apiFootballLeagueId: Number(league.id),
      name: String(league.name ?? "Unknown league"),
      country: league.country ? String(league.country) : null,
      logoUrl: league.logo ? String(league.logo) : null,
      season: Number(league.season ?? new Date().getFullYear()),
    },
    homeTeam: {
      apiFootballTeamId: Number(home.id),
      name: String(home.name ?? "Home"),
      logoUrl: home.logo ? String(home.logo) : null,
    },
    awayTeam: {
      apiFootballTeamId: Number(away.id),
      name: String(away.name ?? "Away"),
      logoUrl: away.logo ? String(away.logo) : null,
    },
    season: Number(league.season ?? new Date().getFullYear()),
    round: league.round ? String(league.round) : null,
    kickoffAt: new Date(String(fixture.date)),
    status: fixtureStatus(statusShort),
    statusShort,
    elapsed: status.elapsed ? Number(status.elapsed) : null,
    venue: venue.name ? String(venue.name) : null,
    referee: fixture.referee ? String(fixture.referee) : null,
    homeScore: goals.home === null || goals.home === undefined ? null : Number(goals.home),
    awayScore: goals.away === null || goals.away === undefined ? null : Number(goals.away),
    raw,
  };
}

export class FootballSyncService {
  constructor(
    private readonly repository: FootballRepository,
    private readonly apiFootball: ApiFootballClient,
    private readonly oddsApi: OddsApiClient,
    private readonly config: FootballConfig,
  ) {}

  async syncAll() {
    await this.syncFixtures();
    if (!this.shouldRunNonCriticalSync()) return;
    await this.syncStandingsAndStatistics();
    await this.syncInjuries();
    await this.syncOdds();
  }

  providerStatus() {
    const status = this.apiFootball.getStatus();
    const quotaPercentUsed = status.dailyLimit && status.requestsUsed !== null
      ? Math.round((status.requestsUsed / status.dailyLimit) * 100)
      : null;
    const warningThreshold = quotaPercentUsed === null
      ? null
      : this.config.quotaWarningThresholds.find((threshold) => quotaPercentUsed >= threshold) ?? null;
    return {
      ...status,
      quotaPercentUsed,
      warningThreshold,
      nonCriticalSyncPaused: warningThreshold !== null && warningThreshold >= 95,
    };
  }

  async probeProvider() {
    if (!this.apiFootball.isConfigured()) {
      return {
        ok: false,
        provider: "API-Football" as const,
        message: "API-Football is not configured.",
        requestsConsumed: 0,
        status: this.providerStatus(),
      };
    }
    await this.apiFootball.timezones();
    return {
      ok: true,
      provider: "API-Football" as const,
      message: "API-Football responded to a one-request timezone probe.",
      requestsConsumed: 1,
      status: this.providerStatus(),
    };
  }

  async syncFixtures(): Promise<FootballSyncResult> {
    const runId = await this.repository.startSyncRun({ provider: "api-football", jobName: "fixtures" });
    let recordsRead = 0;
    let recordsSaved = 0;

    try {
      if (!this.apiFootball.isConfigured()) {
        const message = "API-Football key not configured; skipped.";
        await this.repository.finishSyncRun(runId, { status: "SUCCESS", message });
        return { jobName: "fixtures", status: "SUCCESS", recordsRead, recordsSaved, message };
      }

      const live = await this.apiFootball.liveFixtures();
      const seenFixtureIds = new Set<number>();
      for (const leagueId of this.config.leagueIds) {
        const fixtures = [
          ...await this.fetchConfiguredLeagueFixtures(leagueId, this.config.season),
          ...await this.fetchConfiguredLeagueFixtures(leagueId, this.config.season - 1),
          ...live.response,
        ];
        recordsRead += fixtures.length;

        for (const raw of fixtures) {
          const fixture = mapFixture(raw);
          if (fixture && !seenFixtureIds.has(fixture.apiFootballFixtureId)) {
            seenFixtureIds.add(fixture.apiFootballFixtureId);
            await this.repository.upsertFixture(fixture);
            recordsSaved += 1;
          }
        }
      }

      if (recordsSaved === 0) {
        const fallbackFixtures = [
          ...await this.fetchGlobalUpcomingFixtures(),
          ...live.response,
        ];
        recordsRead += fallbackFixtures.length;
        for (const raw of fallbackFixtures) {
          const fixture = mapFixture(raw);
          if (fixture && !seenFixtureIds.has(fixture.apiFootballFixtureId)) {
            seenFixtureIds.add(fixture.apiFootballFixtureId);
            await this.repository.upsertFixture(fixture);
            recordsSaved += 1;
          }
        }
      }

      const message = recordsSaved === 0
        ? "API-Football returned no fixtures for configured leagues or the fallback upcoming window."
        : undefined;
      await this.repository.finishSyncRun(runId, { status: "SUCCESS", recordsRead, recordsSaved, message });
      return { jobName: "fixtures", status: "SUCCESS", recordsRead, recordsSaved, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fixture sync failed";
      await this.repository.finishSyncRun(runId, {
        status: "FAILED",
        message,
        recordsRead,
        recordsSaved,
      });
      return { jobName: "fixtures", status: "FAILED", recordsRead, recordsSaved, message };
    }
  }

  async syncStandingsAndStatistics() {
    const runId = await this.repository.startSyncRun({ provider: "api-football", jobName: "standings-statistics" });
    let recordsRead = 0;
    let recordsSaved = 0;

    try {
      if (!this.apiFootball.isConfigured()) {
        await this.repository.finishSyncRun(runId, { status: "SUCCESS", message: "API-Football key not configured; skipped." });
        return;
      }

      for (const leagueId of this.config.leagueIds) {
        const result = await this.apiFootball.standings(leagueId, this.config.season);
        const leagueResponse = asRecord(result.response[0]);
        const league = asRecord(leagueResponse.league);
        const groups = Array.isArray(league.standings) ? league.standings : [];
        const standings = groups.flat();
        recordsRead += standings.length;

        for (const rawStanding of standings) {
          const standing = asRecord(rawStanding);
          const team = asRecord(standing.team);
          const all = asRecord(standing.all);
          const goals = asRecord(all.goals);
          if (!team.id) continue;

          await this.repository.upsertStanding({
            leagueApiId: leagueId,
            season: this.config.season,
            teamApiId: Number(team.id),
            teamName: String(team.name ?? "Unknown team"),
            rank: Number(standing.rank ?? 0),
            points: Number(standing.points ?? 0),
            played: Number(all.played ?? 0),
            won: Number(all.win ?? 0),
            drawn: Number(all.draw ?? 0),
            lost: Number(all.lose ?? 0),
            goalsFor: Number(goals.for ?? 0),
            goalsAgainst: Number(goals.against ?? 0),
            raw: rawStanding,
          });
          await this.repository.upsertTeamStatistic({
            leagueApiId: leagueId,
            season: this.config.season,
            teamApiId: Number(team.id),
            raw: await this.safeTeamStatistics(leagueId, Number(team.id)),
          });
          recordsSaved += 1;
        }
      }

      await this.repository.finishSyncRun(runId, { status: "SUCCESS", recordsRead, recordsSaved });
    } catch (error) {
      await this.repository.finishSyncRun(runId, {
        status: "FAILED",
        message: error instanceof Error ? error.message : "Standings sync failed",
        recordsRead,
        recordsSaved,
      });
    }
  }

  async syncInjuries() {
    const runId = await this.repository.startSyncRun({ provider: "api-football", jobName: "injuries" });
    try {
      if (!this.apiFootball.isConfigured()) {
        await this.repository.finishSyncRun(runId, { status: "SUCCESS", message: "API-Football key not configured; skipped." });
        return;
      }

      let recordsRead = 0;
      let recordsSaved = 0;
      for (const leagueId of this.config.leagueIds) {
        const result = await this.apiFootball.injuries({ league: leagueId, season: this.config.season });
        recordsRead += result.response.length;
        for (const raw of result.response) {
          const item = asRecord(raw);
          const player = asRecord(item.player);
          const team = asRecord(item.team);
          const fixture = asRecord(item.fixture);
          if (!team.id || !player.name) continue;
          await this.repository.upsertInjury({
            fixtureApiId: fixture.id ? Number(fixture.id) : null,
            teamApiId: Number(team.id),
            teamName: String(team.name ?? "Unknown team"),
            playerName: String(player.name),
            reason: player.reason ? String(player.reason) : null,
            raw,
          });
          recordsSaved += 1;
        }
      }
      await this.repository.finishSyncRun(runId, { status: "SUCCESS", recordsRead, recordsSaved });
    } catch (error) {
      await this.repository.finishSyncRun(runId, { status: "FAILED", message: error instanceof Error ? error.message : "Injury sync failed" });
    }
  }

  async syncHeadToHead(homeTeamApiId: number, awayTeamApiId: number) {
    if (!this.apiFootball.isConfigured()) return;
    const result = await this.apiFootball.headToHead(homeTeamApiId, awayTeamApiId);
    for (const raw of result.response) {
      const item = asRecord(raw);
      const fixture = asRecord(item.fixture);
      if (fixture.id) {
        await this.repository.upsertHeadToHead({ fixtureApiId: Number(fixture.id), raw });
      }
    }
  }

  async syncOdds() {
    const runId = await this.repository.startSyncRun({ provider: "the-odds-api", jobName: "odds" });
    let recordsRead = 0;
    let recordsSaved = 0;

    try {
      if (!this.oddsApi.isConfigured()) {
        await this.repository.finishSyncRun(runId, { status: "SUCCESS", message: "Odds API key not configured; skipped." });
        return;
      }

      const result = await this.oddsApi.odds();
      recordsRead = result.data.length;
      for (const raw of result.data) {
        const item = asRecord(raw);
        const bookmakers = Array.isArray(item.bookmakers) ? item.bookmakers : [];
        for (const bookmakerRaw of bookmakers) {
          const bookmaker = asRecord(bookmakerRaw);
          const markets = Array.isArray(bookmaker.markets) ? bookmaker.markets : [];
          for (const marketRaw of markets) {
            const market = asRecord(marketRaw);
            const outcomes = Array.isArray(market.outcomes) ? market.outcomes : [];
            for (const outcomeRaw of outcomes) {
              const outcome = asRecord(outcomeRaw);
              if (!outcome.name || !outcome.price) continue;
              await this.repository.upsertOdd({
                fixtureApiId: item.fixture_id ? Number(item.fixture_id) : null,
                bookmaker: String(bookmaker.title ?? bookmaker.key ?? "Unknown bookmaker"),
                market: String(market.key ?? "h2h"),
                outcome: String(outcome.name),
                price: Number(outcome.price),
                raw,
              });
              recordsSaved += 1;
            }
          }
        }
      }
      await this.repository.finishSyncRun(runId, { status: "SUCCESS", recordsRead, recordsSaved });
    } catch (error) {
      await this.repository.finishSyncRun(runId, {
        status: "FAILED",
        message: error instanceof Error ? error.message : "Odds sync failed",
        recordsRead,
        recordsSaved,
      });
    }
  }

  private async safeTeamStatistics(leagueId: number, teamId: number) {
    try {
      const result = await this.apiFootball.teamStatistics(leagueId, this.config.season, teamId);
      return result.response;
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Team statistics unavailable" };
    }
  }

  private shouldRunNonCriticalSync() {
    const status = this.providerStatus();
    return !(status.nonCriticalSyncPaused || status.connectionStatus === "RATE_LIMITED");
  }

  private async fetchConfiguredLeagueFixtures(leagueId: number, season: number) {
    const dates = nextDateWindow(7);
    const responses = await Promise.allSettled([
      this.apiFootball.fixtures({ league: leagueId, season, next: 30 }),
      ...dates.map((date) => this.apiFootball.fixtures({ league: leagueId, season, date })),
    ]);
    return collectFixtureResponses(responses, `Configured league ${leagueId} season ${season}`);
  }

  private async fetchGlobalUpcomingFixtures() {
    const dates = nextDateWindow(7);
    const responses = await Promise.allSettled([
      this.apiFootball.fixtures({ next: 30 }),
      ...dates.map((date) => this.apiFootball.fixtures({ date })),
    ]);
    return collectFixtureResponses(responses, "Global upcoming fixture fallback");
  }
}

function collectFixtureResponses(
  responses: PromiseSettledResult<{ response: unknown[] }>[],
  label: string,
) {
  const fulfilled = responses.filter((result): result is PromiseFulfilledResult<{ response: unknown[] }> => result.status === "fulfilled");
  if (fulfilled.length) {
    return fulfilled.flatMap((result) => result.value.response);
  }

  const errors = responses
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
  throw new Error(`${label} failed: ${errors.join("; ")}`);
}

function nextDateWindow(days: number) {
  const dates: string[] = [];
  const start = new Date();
  for (let offset = 0; offset <= days; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}
