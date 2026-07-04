import type { FootballConfig } from "./config.js";
import { fetchWithRetry } from "./http.js";

export class OddsApiClient {
  constructor(private readonly config: FootballConfig) {}

  isConfigured() {
    return Boolean(this.config.oddsApiKey);
  }

  async odds() {
    if (!this.config.oddsApiKey) {
      throw new Error("ODDS_API_KEY is not configured");
    }

    const url = new URL(`/v4/sports/${this.config.oddsApiSport}/odds`, this.config.oddsApiBaseUrl);
    url.searchParams.set("apiKey", this.config.oddsApiKey);
    url.searchParams.set("regions", "us");
    url.searchParams.set("markets", "h2h");
    url.searchParams.set("oddsFormat", "decimal");

    return fetchWithRetry<unknown[]>(url.toString(), {});
  }
}
