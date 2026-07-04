export type FootballConfig = {
  apiFootballBaseUrl: string;
  apiFootballKey?: string;
  apiFootballHost?: string;
  oddsApiBaseUrl: string;
  oddsApiKey?: string;
  oddsApiSport: string;
  season: number;
  leagueIds: number[];
  jobsEnabled: boolean;
  syncIntervalMinutes: number;
};

function numberList(value: string | undefined, fallback: number[]) {
  if (!value) {
    return fallback;
  }

  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

export function getFootballConfig(): FootballConfig {
  return {
    apiFootballBaseUrl: process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io",
    apiFootballKey: process.env.API_FOOTBALL_KEY,
    apiFootballHost: process.env.API_FOOTBALL_HOST,
    oddsApiBaseUrl: process.env.ODDS_API_BASE_URL ?? "https://api.the-odds-api.com",
    oddsApiKey: process.env.ODDS_API_KEY,
    oddsApiSport: process.env.ODDS_API_SPORT ?? "soccer_epl",
    season: Number(process.env.FOOTBALL_SEASON ?? new Date().getFullYear()),
    leagueIds: numberList(process.env.API_FOOTBALL_LEAGUE_IDS, [39]),
    jobsEnabled: process.env.ENABLE_FOOTBALL_JOBS === "true",
    syncIntervalMinutes: Number(process.env.FOOTBALL_SYNC_INTERVAL_MINUTES ?? 15),
  };
}
