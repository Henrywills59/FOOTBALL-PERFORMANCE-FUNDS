import type { FootballConfig } from "./config.js";
import { fetchWithRetry } from "./http.js";

type ApiFootballEnvelope<T> = {
  response: T;
  errors?: unknown;
};

export class ApiFootballClient {
  constructor(private readonly config: FootballConfig) {}

  isConfigured() {
    return Boolean(this.config.apiFootballKey);
  }

  async fixtures(params: Record<string, string | number | boolean>) {
    return this.get<unknown[]>("/fixtures", params);
  }

  async liveFixtures() {
    return this.get<unknown[]>("/fixtures", { live: "all" });
  }

  async standings(league: number, season: number) {
    return this.get<unknown[]>("/standings", { league, season });
  }

  async teamStatistics(league: number, season: number, team: number) {
    return this.get<unknown>("/teams/statistics", { league, season, team });
  }

  async injuries(params: Record<string, string | number>) {
    return this.get<unknown[]>("/injuries", params);
  }

  async headToHead(homeTeamApiId: number, awayTeamApiId: number) {
    return this.get<unknown[]>("/fixtures/headtohead", {
      h2h: `${homeTeamApiId}-${awayTeamApiId}`,
    });
  }

  private async get<T>(path: string, params: Record<string, string | number | boolean>) {
    if (!this.config.apiFootballKey) {
      throw new Error("API_FOOTBALL_KEY is not configured");
    }

    const url = new URL(path, this.config.apiFootballBaseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {
      "x-apisports-key": this.config.apiFootballKey,
    };

    if (this.config.apiFootballHost) {
      headers["x-rapidapi-host"] = this.config.apiFootballHost;
    }

    const result = await fetchWithRetry<ApiFootballEnvelope<T>>(url.toString(), {
      headers,
    });

    return {
      response: result.data.response,
      quota: result.quota,
    };
  }
}
