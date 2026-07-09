import type { FootballFixtureDetail, FootballFixtureSummary } from "@fpf/shared";
import type {
  NormalizedCompetition,
  NormalizedInjury,
  NormalizedLineup,
  NormalizedMatchStatistics,
  NormalizedReferee,
  NormalizedTeam,
  NormalizedVenue,
  OddsPlaceholder,
  WeatherPlaceholder,
} from "./types.js";

export function normalizeCompetition(fixture: FootballFixtureSummary | FootballFixtureDetail): NormalizedCompetition {
  return {
    id: `${fixture.leagueName}:${fixture.leagueCountry ?? "global"}`,
    name: fixture.leagueName,
    country: fixture.leagueCountry,
    season: "season" in fixture ? fixture.season : null,
  };
}

export function normalizeTeams(fixture: FootballFixtureSummary | FootballFixtureDetail): { home: NormalizedTeam; away: NormalizedTeam } {
  return {
    home: {
      id: `${fixture.apiFootballFixtureId}:home`,
      name: fixture.homeTeamName,
      country: fixture.leagueCountry,
      logoUrl: null,
    },
    away: {
      id: `${fixture.apiFootballFixtureId}:away`,
      name: fixture.awayTeamName,
      country: fixture.leagueCountry,
      logoUrl: null,
    },
  };
}

export function normalizeInjuries(fixture: FootballFixtureDetail | null): NormalizedInjury[] {
  return (
    fixture?.injuries.map((injury) => ({
      fixtureId: fixture.id,
      teamName: injury.teamName,
      playerName: injury.playerName,
      reason: injury.reason,
    })) ?? []
  );
}

export function normalizeStatistics(fixture: FootballFixtureDetail | null): NormalizedMatchStatistics {
  return {
    fixtureId: fixture?.id ?? "unknown",
    possessionHome: null,
    possessionAway: null,
    shotsHome: null,
    shotsAway: null,
    dangerousAttacksHome: null,
    dangerousAttacksAway: null,
    xgHome: null,
    xgAway: null,
    source: "PLACEHOLDER",
  };
}

export function normalizeLineups(fixture: FootballFixtureDetail | null): NormalizedLineup[] {
  if (!fixture) return [];

  return [fixture.homeTeamName, fixture.awayTeamName].map((teamName) => ({
    fixtureId: fixture.id,
    teamName,
    confirmed: false,
    players: [],
  }));
}

export function normalizeReferee(fixture: FootballFixtureDetail | null): NormalizedReferee {
  return {
    fixtureId: fixture?.id ?? "unknown",
    name: fixture?.referee ?? null,
  };
}

export function normalizeVenue(fixture: FootballFixtureDetail | null): NormalizedVenue {
  return {
    fixtureId: fixture?.id ?? "unknown",
    name: fixture?.venue ?? null,
  };
}

export function weatherPlaceholder(fixtureId: string): WeatherPlaceholder {
  return {
    fixtureId,
    status: "PENDING_PROVIDER",
    summary: "Weather intelligence provider is prepared but not connected yet.",
  };
}

export function oddsPlaceholder(fixture: FootballFixtureDetail | null): OddsPlaceholder {
  return {
    fixtureId: fixture?.id ?? "unknown",
    status: fixture?.odds.length ? "AVAILABLE" : "UNAVAILABLE",
    markets: fixture?.odds ?? [],
  };
}

