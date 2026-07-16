import type { FootballConfig } from "./config.js";
import { fetchWithRetry } from "./http.js";

export class OddsApiClient {
  private lastSuccessfulRequest: Date | null = null;
  private lastFailedRequest: Date | null = null;

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
    url.searchParams.set("regions", this.config.oddsApiRegions);
    url.searchParams.set("markets", this.config.oddsApiMarkets);
    url.searchParams.set("oddsFormat", "decimal");
    if (this.config.oddsApiBookmakers) url.searchParams.set("bookmakers", this.config.oddsApiBookmakers);

    try {
      const result = await fetchWithRetry<unknown[]>(url.toString(), {});
      this.lastSuccessfulRequest = new Date();
      return result;
    } catch (error) {
      this.lastFailedRequest = new Date();
      throw error;
    }
  }

  status() {
    const missingVariables = [!this.config.oddsApiKey ? "ODDS_API_KEY" : null].filter((item): item is string => Boolean(item));
    return {
      provider: "The Odds API",
      configured: missingVariables.length === 0,
      sport: this.config.oddsApiSport,
      regions: this.config.oddsApiRegions,
      markets: this.config.oddsApiMarkets,
      bookmakersConfigured: Boolean(this.config.oddsApiBookmakers),
      lastSuccessfulRequest: this.lastSuccessfulRequest?.toISOString() ?? null,
      lastFailedRequest: this.lastFailedRequest?.toISOString() ?? null,
      missingVariables,
    };
  }
}
