import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiFootballClient } from "./apiFootballClient.js";
import type { FootballConfig } from "./config.js";

const baseConfig: FootballConfig = {
  apiFootballBaseUrl: "https://v3.football.api-sports.io",
  apiFootballKey: "test-key",
  oddsApiBaseUrl: "https://example.test",
  oddsApiSport: "soccer_epl",
  season: 2026,
  leagueIds: [39],
  jobsEnabled: false,
  syncIntervalMinutes: 15,
  providerTimeoutMs: 500,
  apiFootballDailyLimit: 100,
  quotaWarningThresholds: [70, 85, 95],
  cacheWindows: {
    catalogMs: 60_000,
    teamsMs: 60_000,
    fixturesMs: 60_000,
    liveMs: 1_000,
    standingsMs: 60_000,
    injuriesMs: 60_000,
    finishedMs: 60_000,
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ApiFootballClient", () => {
  it("reports missing configuration without exposing secrets", () => {
    const client = new ApiFootballClient({ ...baseConfig, apiFootballKey: undefined });

    expect(client.isConfigured()).toBe(false);
    expect(client.getStatus()).toMatchObject({
      configured: false,
      provider: "API-Football",
      missingVariables: ["API_FOOTBALL_KEY"],
    });
    expect(JSON.stringify(client.getStatus())).not.toContain("test-key");
  });

  it("sends the API-Football auth header and tracks quota safely", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ response: [{ league: { id: 39, name: "Premier League" } }] }), {
        status: 200,
        headers: {
          "x-ratelimit-requests-remaining": "88",
          "x-ratelimit-requests-used": "12",
          "x-ratelimit-requests-limit": "100",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiFootballClient(baseConfig);

    await client.leagues({ season: 2026 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers["x-apisports-key"]).toBe("test-key");
    expect(client.getStatus()).toMatchObject({
      configured: true,
      connectionStatus: "OPERATIONAL",
      remainingDailyQuota: 88,
      requestsUsed: 12,
      dailyLimit: 100,
    });
  });

  it("uses cache for stable requests and redacts provider failures", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ response: [{ name: "England" }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new ApiFootballClient(baseConfig);

    await client.countries();
    await client.countries();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.getStatus().cacheHitRate).toBe(50);
  });

  it("reports API-Football envelope errors instead of treating them as empty data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ response: [], errors: { plan: "Fixtures unavailable for this key" } }), {
        status: 200,
      }),
    ));
    const client = new ApiFootballClient(baseConfig);

    await expect(client.fixtures({ next: 30 })).rejects.toThrow("API-Football returned provider errors: plan: Fixtures unavailable for this key");
    expect(client.getStatus().connectionStatus).toBe("ERROR");
  });

  it("maps rate-limit responses to safe provider status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
    const client = new ApiFootballClient(baseConfig);

    await expect(client.liveFixtures()).rejects.toThrow("API-Football rate limit reached");
    expect(client.getStatus().connectionStatus).toBe("RATE_LIMITED");
  });
});
