import type { FootballConfig } from "./config.js";
import { fetchWithRetry, ProviderRequestError, type ProviderResponse } from "./http.js";

type CachedProviderResponse = ProviderResponse<unknown[]>;
type OddsRequestOptions = {
  sport?: string;
  regions?: string;
  markets?: string;
  bookmakers?: string;
  cacheMs?: number;
};

const featuredOddsMarkets = ["h2h", "spreads", "totals"] as const;
const fallbackRegions = ["us", "uk", "eu", "au"];

function splitCsv(value: string | undefined) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function providerErrorBody(error: unknown) {
  return error instanceof ProviderRequestError ? error.responseBody : undefined;
}

export class OddsApiClient {
  private lastSuccessfulRequest: Date | null = null;
  private lastFailedRequest: Date | null = null;
  private lastQuota: ProviderResponse<unknown>["quota"] | null = null;
  private readonly cache = new Map<string, { expiresAt: number; value: CachedProviderResponse }>();

  constructor(private readonly config: FootballConfig) {}

  isConfigured() {
    return Boolean(this.config.oddsApiKey);
  }

  async odds(options: OddsRequestOptions = {}) {
    if (!this.config.oddsApiKey) {
      throw new Error("ODDS_API_KEY is not configured");
    }

    const sport = options.sport ?? this.config.oddsApiSport;
    const regions = this.supportedRegions(options.regions ?? this.config.oddsApiRegions).join(",");
    const markets = this.supportedMarkets(options.markets ?? this.config.oddsApiMarkets).join(",");
    const bookmakers = options.bookmakers ?? this.config.oddsApiBookmakers;
    const cacheKey = [
      "odds",
      sport,
      regions,
      markets,
      bookmakers ?? "",
    ].join("|");
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const url = new URL(`/v4/sports/${sport}/odds`, this.config.oddsApiBaseUrl);
    url.searchParams.set("apiKey", this.config.oddsApiKey);
    if (bookmakers) {
      url.searchParams.set("bookmakers", bookmakers);
    } else {
      url.searchParams.set("regions", regions);
    }
    url.searchParams.set("markets", markets);
    url.searchParams.set("oddsFormat", "decimal");

    try {
      const result = await fetchWithRetry<unknown[]>(url.toString(), {});
      this.recordSuccess(result);
      this.cache.set(cacheKey, { expiresAt: Date.now() + (options.cacheMs ?? 60_000), value: result });
      return result;
    } catch (error) {
      this.lastFailedRequest = new Date();
      console.error("ODDS_API_PROVIDER_FAILURE", {
        request: {
          sport,
          regions: bookmakers ? undefined : regions,
          bookmakersConfigured: Boolean(bookmakers),
          markets,
          oddsFormat: "decimal",
        },
        message: error instanceof Error ? error.message : "Unknown Odds API failure",
        providerStatusCode: error instanceof ProviderRequestError ? error.statusCode : undefined,
        providerResponse: providerErrorBody(error),
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

  supportedMarkets(value = this.config.oddsApiMarkets) {
    const configured = splitCsv(value).map((market) => market.toLowerCase());
    const supported = configured.filter((market): market is typeof featuredOddsMarkets[number] =>
      featuredOddsMarkets.includes(market as typeof featuredOddsMarkets[number]),
    );
    return supported.length ? supported : ["h2h"];
  }

  ignoredMarkets(value = this.config.oddsApiMarkets) {
    const supported = new Set(this.supportedMarkets(value));
    return splitCsv(value)
      .map((market) => market.toLowerCase())
      .filter((market) => !supported.has(market));
  }

  supportedRegions(value = this.config.oddsApiRegions) {
    const regions = splitCsv(value).map((region) => region.toLowerCase());
    const supported = regions.filter((region) => fallbackRegions.includes(region));
    return supported.length ? supported : ["us"];
  }

  async diagnosticOdds() {
    const competitions = await this.soccerCompetitions();
    const activeSoccerCompetitions = competitions.data
      .filter((item) => typeof item === "object" && item !== null)
      .map((item) => item as Record<string, unknown>)
      .filter((item) => item.active !== false);
    const configuredSport = activeSoccerCompetitions.find((item) => item.key === this.config.oddsApiSport);
    const selectedSport = String((configuredSport ?? activeSoccerCompetitions[0])?.key ?? this.config.oddsApiSport);
    const selectedRegion = this.supportedRegions(this.config.oddsApiRegions)[0] ?? "us";
    const selectedMarket = this.supportedMarkets(this.config.oddsApiMarkets)[0] ?? "h2h";
    const odds = await this.odds({
      sport: selectedSport,
      regions: selectedRegion,
      markets: selectedMarket,
      bookmakers: undefined,
      cacheMs: 60_000,
    });
    return {
      competitions,
      odds,
      request: {
        sport: selectedSport,
        regions: selectedRegion,
        markets: selectedMarket,
        oddsFormat: "decimal",
        bookmakersIgnoredForDiagnostic: Boolean(this.config.oddsApiBookmakers),
        ignoredConfiguredMarkets: this.ignoredMarkets(this.config.oddsApiMarkets),
      },
    };
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
      ignoredMarkets: this.ignoredMarkets(),
      supportedRegions: this.supportedRegions(),
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
