export type FootballConfig = {
  apiFootballBaseUrl: string;
  apiFootballKey?: string;
  apiFootballHost?: string;
  apiFootballAuthMode: "api-sports" | "rapidapi";
  oddsApiBaseUrl: string;
  oddsApiKey?: string;
  oddsApiSport: string;
  oddsApiRegions: string;
  oddsApiMarkets: string;
  oddsApiBookmakers?: string;
  season: number;
  leagueIds: number[];
  jobsEnabled: boolean;
  syncIntervalMinutes: number;
  providerTimeoutMs: number;
  apiFootballDailyLimit: number | null;
  quotaWarningThresholds: number[];
  cacheWindows: {
    catalogMs: number;
    teamsMs: number;
    fixturesMs: number;
    liveMs: number;
    standingsMs: number;
    injuriesMs: number;
    finishedMs: number;
  };
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
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const apiFootballBaseUrl = process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";
  const configuredAuthMode = process.env.API_FOOTBALL_AUTH_MODE;
  const apiFootballAuthMode = configuredAuthMode === "rapidapi" || configuredAuthMode === "api-sports"
    ? configuredAuthMode
    : apiFootballBaseUrl.includes("rapidapi.com")
      ? "rapidapi"
      : "api-sports";
  return {
    apiFootballBaseUrl,
    apiFootballKey: process.env.API_FOOTBALL_KEY,
    apiFootballHost: process.env.API_FOOTBALL_HOST,
    apiFootballAuthMode,
    oddsApiBaseUrl: process.env.ODDS_API_BASE_URL ?? "https://api.the-odds-api.com",
    oddsApiKey: process.env.ODDS_API_KEY,
    oddsApiSport: process.env.ODDS_API_SPORT ?? "soccer_epl",
    oddsApiRegions: process.env.ODDS_API_REGIONS ?? "us,uk,eu",
    oddsApiMarkets: process.env.ODDS_API_MARKETS ?? "h2h,totals,btts",
    oddsApiBookmakers: process.env.ODDS_API_BOOKMAKERS,
    season: Number(process.env.FOOTBALL_SEASON ?? new Date().getFullYear()),
    leagueIds: numberList(process.env.API_FOOTBALL_LEAGUE_IDS, [39]),
    jobsEnabled: process.env.ENABLE_FOOTBALL_JOBS === "true",
    syncIntervalMinutes: Number(process.env.FOOTBALL_SYNC_INTERVAL_MINUTES ?? 15),
    providerTimeoutMs: Number(process.env.API_FOOTBALL_TIMEOUT_MS ?? 8000),
    apiFootballDailyLimit: process.env.API_FOOTBALL_DAILY_LIMIT ? Number(process.env.API_FOOTBALL_DAILY_LIMIT) : null,
    quotaWarningThresholds: numberList(process.env.API_FOOTBALL_QUOTA_WARNING_THRESHOLDS, [70, 85, 95]),
    cacheWindows: {
      catalogMs: Number(process.env.API_FOOTBALL_CATALOG_CACHE_MINUTES ?? 1440) * minute,
      teamsMs: Number(process.env.API_FOOTBALL_TEAM_CACHE_MINUTES ?? 1440) * minute,
      fixturesMs: Number(process.env.API_FOOTBALL_FIXTURE_CACHE_MINUTES ?? 180) * minute,
      liveMs: Number(process.env.API_FOOTBALL_LIVE_CACHE_SECONDS ?? 60) * 1000,
      standingsMs: Number(process.env.API_FOOTBALL_STANDINGS_CACHE_MINUTES ?? 180) * minute,
      injuriesMs: Number(process.env.API_FOOTBALL_INJURY_CACHE_MINUTES ?? 360) * minute,
      finishedMs: Number(process.env.API_FOOTBALL_FINISHED_CACHE_HOURS ?? 168) * hour,
    },
  };
}
