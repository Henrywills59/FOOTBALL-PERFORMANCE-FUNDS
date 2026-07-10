import type { FootballConfig } from "./config.js";
import { fetchWithRetry, ProviderRequestError } from "./http.js";

type ApiFootballEnvelope<T> = {
  response: T;
  errors?: unknown;
};

type ProviderStatus = {
  configured: boolean;
  provider: "API-Football";
  connectionStatus: "CONFIGURED" | "MISSING_CONFIGURATION" | "OPERATIONAL" | "ERROR" | "RATE_LIMITED";
  lastSuccessfulRequest: string | null;
  lastFailedRequest: string | null;
  remainingDailyQuota: number | null;
  requestsUsed: number | null;
  dailyLimit: number | null;
  averageResponseTimeMs: number | null;
  cacheHitRate: number;
  missingVariables: string[];
};

export class ApiFootballClient {
  private lastSuccessfulRequest: Date | null = null;
  private lastFailedRequest: Date | null = null;
  private remainingDailyQuota: number | null = null;
  private requestsUsed: number | null = null;
  private dailyLimit: number | null = null;
  private totalResponseTimeMs = 0;
  private providerCalls = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private lastErrorStatus: "ERROR" | "RATE_LIMITED" | null = null;
  private cache = new Map<string, { expiresAt: number; value: unknown }>();

  constructor(private readonly config: FootballConfig) {}

  isConfigured() {
    return Boolean(this.config.apiFootballKey && this.config.apiFootballBaseUrl);
  }

  countries() {
    return this.get<unknown[]>("/countries", {}, this.config.cacheWindows.catalogMs);
  }

  leagues(params: Record<string, string | number | boolean> = {}) {
    return this.get<unknown[]>("/leagues", params, this.config.cacheWindows.catalogMs);
  }

  teams(params: Record<string, string | number | boolean>) {
    return this.get<unknown[]>("/teams", params, this.config.cacheWindows.teamsMs);
  }

  players(params: Record<string, string | number | boolean>) {
    return this.get<unknown[]>("/players", params, this.config.cacheWindows.teamsMs);
  }

  venues(params: Record<string, string | number | boolean>) {
    return this.get<unknown[]>("/venues", params, this.config.cacheWindows.catalogMs);
  }

  timezones() {
    return this.get<string[]>("/timezone", {}, this.config.cacheWindows.catalogMs);
  }

  async fixtures(params: Record<string, string | number | boolean>) {
    return this.get<unknown[]>("/fixtures", params, this.config.cacheWindows.fixturesMs);
  }

  async liveFixtures() {
    return this.get<unknown[]>("/fixtures", { live: "all" }, this.config.cacheWindows.liveMs);
  }

  async fixtureEvents(fixture: number) {
    return this.get<unknown[]>("/fixtures/events", { fixture }, this.config.cacheWindows.liveMs);
  }

  async fixtureStatistics(fixture: number) {
    return this.get<unknown[]>("/fixtures/statistics", { fixture }, this.config.cacheWindows.liveMs);
  }

  async fixtureLineups(fixture: number) {
    return this.get<unknown[]>("/fixtures/lineups", { fixture }, this.config.cacheWindows.liveMs);
  }

  async standings(league: number, season: number) {
    return this.get<unknown[]>("/standings", { league, season }, this.config.cacheWindows.standingsMs);
  }

  async teamStatistics(league: number, season: number, team: number) {
    return this.get<unknown>("/teams/statistics", { league, season, team }, this.config.cacheWindows.standingsMs);
  }

  async injuries(params: Record<string, string | number>) {
    return this.get<unknown[]>("/injuries", params, this.config.cacheWindows.injuriesMs);
  }

  async headToHead(homeTeamApiId: number, awayTeamApiId: number) {
    return this.get<unknown[]>("/fixtures/headtohead", {
      h2h: `${homeTeamApiId}-${awayTeamApiId}`,
    }, this.config.cacheWindows.finishedMs);
  }

  getStatus(): ProviderStatus {
    const missingVariables = [
      !this.config.apiFootballKey ? "API_FOOTBALL_KEY" : null,
      !this.config.apiFootballBaseUrl ? "API_FOOTBALL_BASE_URL" : null,
    ].filter((value): value is string => Boolean(value));
    const configured = missingVariables.length === 0;
    const totalCache = this.cacheHits + this.cacheMisses;
    return {
      configured,
      provider: "API-Football",
      connectionStatus: !configured
        ? "MISSING_CONFIGURATION"
        : this.lastErrorStatus ?? (this.lastSuccessfulRequest ? "OPERATIONAL" : "CONFIGURED"),
      lastSuccessfulRequest: this.lastSuccessfulRequest?.toISOString() ?? null,
      lastFailedRequest: this.lastFailedRequest?.toISOString() ?? null,
      remainingDailyQuota: this.remainingDailyQuota,
      requestsUsed: this.requestsUsed,
      dailyLimit: this.dailyLimit ?? this.config.apiFootballDailyLimit,
      averageResponseTimeMs: this.providerCalls ? Math.round(this.totalResponseTimeMs / this.providerCalls) : null,
      cacheHitRate: totalCache ? Math.round((this.cacheHits / totalCache) * 100) : 0,
      missingVariables,
    };
  }

  private async get<T>(
    path: string,
    params: Record<string, string | number | boolean>,
    cacheTtlMs = 0,
  ) {
    if (!this.config.apiFootballKey) {
      throw new Error("API_FOOTBALL_KEY is not configured");
    }

    const url = new URL(path, this.config.apiFootballBaseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
    const cacheKey = url.toString();
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.cacheHits += 1;
      return cached.value as { response: T; quota: { remaining?: string | null; used?: string | null; limit?: string | null } | undefined };
    }
    this.cacheMisses += 1;

    const headers: Record<string, string> = {
      "x-apisports-key": this.config.apiFootballKey,
    };

    if (this.config.apiFootballHost) {
      headers["x-rapidapi-host"] = this.config.apiFootballHost;
    }

    try {
      console.info("API_FOOTBALL_REQUEST", { path, params, cached: false });
      const result = await fetchWithRetry<ApiFootballEnvelope<T>>(url.toString(), {
        headers,
      }, 3, this.config.providerTimeoutMs);
      this.lastSuccessfulRequest = new Date();
      this.lastErrorStatus = null;
      this.providerCalls += 1;
      this.totalResponseTimeMs += result.responseTimeMs;
      this.remainingDailyQuota = toNumberOrNull(result.quota?.remaining);
      this.requestsUsed = toNumberOrNull(result.quota?.used);
      this.dailyLimit = toNumberOrNull(result.quota?.limit) ?? this.config.apiFootballDailyLimit;
      const providerError = summarizeEnvelopeErrors(result.data.errors);
      if (providerError) {
        this.lastFailedRequest = new Date();
        this.lastErrorStatus = "ERROR";
        console.warn("API_FOOTBALL_PROVIDER_ENVELOPE_ERROR", {
          path,
          message: providerError,
        });
        throw new Error(providerError);
      }
      const value = {
        response: result.data.response,
        quota: result.quota,
      };
      if (cacheTtlMs > 0) {
        this.cache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs, value });
      }
      return value;
    } catch (error) {
      this.lastFailedRequest = new Date();
      this.lastErrorStatus = error instanceof ProviderRequestError && error.rateLimited ? "RATE_LIMITED" : "ERROR";
      console.warn("API_FOOTBALL_PROVIDER_FAILURE", {
        path,
        statusCode: error instanceof ProviderRequestError ? error.statusCode : undefined,
        rateLimited: error instanceof ProviderRequestError ? error.rateLimited : false,
        message: sanitizeProviderError(error),
      });
      throw new Error(sanitizeProviderError(error));
    }
  }
}

function toNumberOrNull(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeProviderError(error: unknown) {
  if (error instanceof ProviderRequestError) {
    if (error.rateLimited) return "API-Football rate limit reached";
    return error.statusCode ? `API-Football request failed with HTTP ${error.statusCode}` : "API-Football request failed";
  }
  if (error instanceof Error && error.message.startsWith("API-Football returned provider")) return error.message;
  if (error instanceof Error && error.name === "AbortError") return "API-Football request timed out";
  return "API-Football provider unavailable";
}

function summarizeEnvelopeErrors(errors: unknown) {
  if (!errors) return null;
  if (Array.isArray(errors)) {
    return errors.length ? `API-Football returned provider errors: ${errors.map(String).join("; ")}` : null;
  }
  if (typeof errors === "string") {
    return errors.trim() ? `API-Football returned provider error: ${errors}` : null;
  }
  if (typeof errors === "object") {
    const entries = Object.entries(errors as Record<string, unknown>);
    if (!entries.length) return null;
    return `API-Football returned provider errors: ${entries
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join("; ")}`;
  }
  return `API-Football returned provider error: ${String(errors)}`;
}
