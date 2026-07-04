import type { FootballFixtureDetail, FootballFixtureSummary, FootballSyncStatus } from "@fpf/shared";

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
  listFixtures(input: { live?: boolean; limit?: number }): Promise<FootballFixtureSummary[]>;
  getFixture(id: string): Promise<FootballFixtureDetail | null>;
  getSyncStatus(jobsEnabled: boolean, jobsStarted: boolean): Promise<FootballSyncStatus>;
};
