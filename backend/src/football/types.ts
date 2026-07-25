import type { FootballFixtureDetail, FootballFixtureSummary, FootballSyncStatus } from "@fpf/shared";

export type FreshnessState = "FRESH" | "STALE" | "REFRESHING" | "PROVIDER_PENDING" | "PROVIDER_ERROR";

export type FootballFreshness = {
  provider: "API-Football";
  lastSynchronizedAt: string | null;
  freshnessState: FreshnessState;
  stale: boolean;
  nextScheduledRefresh: string | null;
  providerAvailability: "AVAILABLE" | "MISSING_CONFIGURATION" | "DEGRADED";
};

export type NormalizedLeague = {
  id: string;
  apiFootballLeagueId: number;
  name: string;
  country: string | null;
  logoUrl: string | null;
  season: number;
};

export type NormalizedTeam = {
  id: string;
  apiFootballTeamId: number;
  name: string;
  country: string | null;
  logoUrl: string | null;
};

export type FootballReadModel<T> = {
  data: T;
  freshness: FootballFreshness;
};

export type FixtureUpsert = {
  apiFootballFixtureId: number;
  league: {
    apiFootballLeagueId: number;
    name: string;
    country?: string | null;
    logoUrl?: string | null;
    season: number;
  };
  homeTeam: {
    apiFootballTeamId: number;
    name: string;
    logoUrl?: string | null;
  };
  awayTeam: {
    apiFootballTeamId: number;
    name: string;
    logoUrl?: string | null;
  };
  season: number;
  round?: string | null;
  kickoffAt: Date;
  status: "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";
  statusShort?: string | null;
  elapsed?: number | null;
  venue?: string | null;
  referee?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  raw: unknown;
};

export type StandingUpsert = {
  leagueApiId: number;
  season: number;
  teamApiId: number;
  teamName: string;
  rank: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  raw: unknown;
};

export type InjuryUpsert = {
  fixtureApiId?: number | null;
  teamApiId: number;
  teamName: string;
  playerName: string;
  reason?: string | null;
  raw: unknown;
};

export type OddUpsert = {
  fixtureApiId?: number | null;
  bookmaker: string;
  market: string;
  outcome: string;
  price: number;
  retrievedAt?: Date;
  providerSport?: string;
  quota?: Record<string, string | null | undefined>;
  raw: unknown;
};

export type FootballRepository = {
  upsertFixture(input: FixtureUpsert): Promise<void>;
  upsertStanding(input: StandingUpsert): Promise<void>;
  upsertTeamStatistic(input: { leagueApiId: number; teamApiId: number; season: number; raw: unknown }): Promise<void>;
  upsertInjury(input: InjuryUpsert): Promise<void>;
  upsertHeadToHead(input: { fixtureApiId: number; raw: unknown }): Promise<void>;
  upsertOdd(input: OddUpsert): Promise<void>;
  startSyncRun(input: { provider: string; jobName: string }): Promise<string>;
  finishSyncRun(id: string, input: { status: "SUCCESS" | "FAILED"; message?: string; recordsRead?: number; recordsSaved?: number }): Promise<void>;
  listFixtures(input: {
    live?: boolean;
    limit?: number;
    search?: string;
    league?: string;
    date?: string;
  }): Promise<FootballFixtureSummary[]>;
  getFixture(id: string): Promise<FootballFixtureDetail | null>;
  listLeagues(): Promise<NormalizedLeague[]>;
  listStandings(input: { leagueId?: string; season?: number }): Promise<FootballReadModel<FootballFixtureDetail["standings"]>>;
  getTeam(id: string): Promise<FootballReadModel<NormalizedTeam | null>>;
  getTeamStatistics(id: string): Promise<FootballReadModel<unknown | null>>;
  getFixtureEvents(id: string): Promise<FootballReadModel<unknown[]>>;
  getFixtureStatistics(id: string): Promise<FootballReadModel<unknown[]>>;
  getFixtureLineups(id: string): Promise<FootballReadModel<unknown[]>>;
  getFixtureInjuries(id: string): Promise<FootballReadModel<FootballFixtureDetail["injuries"]>>;
  getHeadToHead(id: string): Promise<FootballReadModel<FootballFixtureDetail["headToHeadRecords"]>>;
  getSyncStatus(jobsEnabled: boolean, jobsStarted: boolean): Promise<FootballSyncStatus>;
};
