import { afterEach, describe, expect, it, vi } from "vitest";
import { OddsApiClient } from "./oddsApiClient.js";
import type { FootballConfig } from "./config.js";

const baseConfig: FootballConfig = {
  apiFootballBaseUrl: "https://v3.football.api-sports.io",
  apiFootballKey: "test-key",
  apiFootballAuthMode: "api-sports",
  oddsApiBaseUrl: "https://api.the-odds-api.test",
  oddsApiKey: "odds-test-key",
  oddsApiSport: "soccer_epl",
  oddsApiRegions: "us,uk,moon",
  oddsApiMarkets: "h2h,totals,btts",
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

describe("OddsApiClient", () => {
  it("filters unsupported configured markets and regions for odds requests", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new OddsApiClient(baseConfig);

    await client.odds();

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/v4/sports/soccer_epl/odds");
    expect(url.searchParams.get("regions")).toBe("us,uk");
    expect(url.searchParams.get("markets")).toBe("h2h,totals");
    expect(url.searchParams.get("oddsFormat")).toBe("decimal");
    expect(client.ignoredMarkets()).toEqual(["btts"]);
    expect(JSON.stringify(client.status())).not.toContain("odds-test-key");
  });

  it("uses a minimal diagnostic request with one active soccer competition, one region, and h2h", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url);
      if (parsed.pathname === "/v4/sports") {
        return new Response(JSON.stringify([
          { key: "basketball_nba", group: "Basketball", active: true },
          { key: "soccer_epl", group: "Soccer", active: true },
        ]), { status: 200 });
      }
      return new Response(JSON.stringify([{ id: "event-1", bookmakers: [] }]), {
        status: 200,
        headers: { "x-requests-remaining": "499", "x-requests-used": "1" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new OddsApiClient(baseConfig);

    const diagnostic = await client.diagnosticOdds();

    expect(diagnostic.request).toMatchObject({
      sport: "soccer_epl",
      regions: "us",
      markets: "h2h",
      oddsFormat: "decimal",
      ignoredConfiguredMarkets: ["btts"],
    });
    const oddsUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(oddsUrl.searchParams.get("markets")).toBe("h2h");
    expect(oddsUrl.searchParams.get("regions")).toBe("us");
    expect(oddsUrl.searchParams.get("bookmakers")).toBeNull();
  });

  it("captures provider error response bodies without exposing API keys", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error_code: "INVALID_MARKET", message: "Unsupported market" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new OddsApiClient({ ...baseConfig, oddsApiMarkets: "btts" });

    await expect(client.odds()).rejects.toThrow("Provider request failed with 422");
    expect(client.status().lastFailedRequest).toEqual(expect.any(String));
  });
});
