import type { FootballConfig } from "./config.js";
import { fetchWithRetry, type ProviderResponse } from "./http.js";

type CachedProviderResponse = ProviderResponse<unknown[]>;

export class OddsApiClient {
  private lastSuccessfulRequest: Date | null = null;
  private lastFailedRequest: Date | null = null;
  private lastQuota: ProviderResponse<unknown>["quota"] | null = null;
  private readonly cache = new Map<string, { expiresAt: number; value: CachedProviderResponse }>();

  constructor(private readonly config: FootballConfig) {}

  isConfigured() {
    return Boolean(this.config.oddsApiKey);
  }

  async odds() {
    if (!this.config.oddsApiKey) {
      throw new Error("ODDS_API_KEY is not configured");
    }

    const cacheKey = [
      "odds",
      this.config.oddsApiSport,
      this.config.oddsApiRegions,
      this.config.oddsApiMarkets,
      this.config.oddsApiBookmakers ?? "",
    ].join("|");
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const url = new URL(`/v4/sports/${this.config.oddsApiSport}/odds`, this.config.oddsApiBaseUrl);
    url.searchParams.set("apiKey", this.config.oddsApiKey);
    url.searchParams.set("regions", this.config.oddsApiRegions);
    url.searchParams.set("markets", this.config.oddsApiMarkets);
    url.searchParams.set("oddsFormat", "decimal");
    if (this.config.oddsApiBookmakers) url.searchParams.set("bookmakers", this.config.oddsApiBookmakers);

    try {
      const result = await fetchWithRetry<unknown[]>(url.toString(), {});
      this.recordSuccess(result);
      this.cache.set(cacheKey, { expiresAt: Date.now() + 60_000, value: result });
      return result;
    } catch (error) {
      this.lastFailedRequest = new Date();
      console.error("ODDS_API_PROVIDER_FAILURE", {
        sport: this.config.oddsApiSport,
        markets: this.config.oddsApiMarkets,
        message: error instanceof Error ? error.message : "Unknown Odds API failure",
      });
      throw error;
    }
  }

  async sports() {
    if (!this.config.oddsApiKey) {
      throw new Error("ODDS_API_KEY is not configured");
    }

    const cached = this.cache.get("sports");
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const url = new URL("/v4/sports", this.config.oddsApiBaseUrl);
    url.searchParams.set("apiKey", this.config.oddsApiKey);
    try {
      const result = await fetchWithRetry<unknown[]>(url.toString(), {});
      this.recordSuccess(result);
      this.cache.set("sports", { expiresAt: Date.now() + 6 * 60 * 60_000, value: result });
      return result;
    } catch (error) {
      this.lastFailedRequest = new Date();
      console.error("ODDS_API_SPORTS_FAILURE", {
        message: error instanceof Error ? error.message : "Unknown Odds API sports failure",
      });
      throw error;
    }
  }

  async soccerCompetitions() {
    const result = await this.sports();
    return {
      ...result,
      data: result.data
        .filter((item) => typeof item === "object" && item !== null)
        .filter((item) => {
          const record = item as Record<string, unknown>;
          return String(record.group ?? "").toLowerCase() === "soccer" || String(record.key ?? "").startsWith("soccer_");
        }),
    };
  }

  supportedMarkets() {
    return this.config.oddsApiMarkets
      .split(",")
      .map((market) => market.trim())
      .filter(Boolean);
  }

  status() {
    const missingVariables = [!this.config.oddsApiKey ? "ODDS_API_KEY" : null].filter((item): item is string => Boolean(item));
    return {
      provider: "The Odds API",
      configured: missingVariables.length === 0,
      sport: this.config.oddsApiSport,
      regions: this.config.oddsApiRegions,
      markets: this.config.oddsApiMarkets,
      supportedMarkets: this.supportedMarkets(),
      bookmakersConfigured: Boolean(this.config.oddsApiBookmakers),
      lastSuccessfulRequest: this.lastSuccessfulRequest?.toISOString() ?? null,
      lastFailedRequest: this.lastFailedRequest?.toISOString() ?? null,
      quota: this.lastQuota ?? {},
      cacheEntries: this.cache.size,
      missingVariables,
    };
  }

  private recordSuccess(result: ProviderResponse<unknown>) {
    this.lastSuccessfulRequest = new Date();
    this.lastQuota = result.quota ?? null;
  }
}
