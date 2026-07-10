import type {
  AuthUser,
  FootballFixtureSummary,
  SubscriberIntelligenceFeedItem,
  SubscriberNotification,
  SubscriberOpportunity,
  SubscriberReport,
} from "@fpf/shared";
import {
  normalizeCompetition,
  normalizeInjuries,
  normalizeLineups,
  normalizeReferee,
  normalizeStatistics,
  normalizeTeams,
  normalizeVenue,
  oddsPlaceholder,
  weatherPlaceholder,
} from "./dataEngine.js";
import { calculateIntelligenceScores } from "./intelligenceEngine.js";
import { getProviderStatus } from "./providers.js";
import type {
  CacheStore,
  IntelligenceDashboard,
  IntelligenceRepository,
  LeagueOverview,
  MatchIntelligence,
  PlayerProfile,
  TeamProfile,
} from "./types.js";

function intelligenceFeed(
  fixtures: FootballFixtureSummary[],
  opportunities: SubscriberOpportunity[],
): SubscriberIntelligenceFeedItem[] {
  const now = new Date().toISOString();
  const live = fixtures.find((fixture) => fixture.status === "LIVE");
  const upcoming = fixtures.find((fixture) => fixture.status === "SCHEDULED");
  const highValue = opportunities.find((item) => item.expectedValue === "High" || item.expectedValue.startsWith("+"));

  const items: SubscriberIntelligenceFeedItem[] = [
    ...(highValue
      ? [
          {
            id: "feed:value-opportunity",
            type: "Value Opportunity" as const,
            title: "Value window detected",
            description: `${highValue.market} on ${highValue.match} is carrying ${highValue.expectedValue} expected value.`,
            severity: "Important" as const,
            timestamp: highValue.kickoffTime ?? now,
          },
        ]
      : []),
    ...(live
      ? [
          {
            id: `feed:live:${live.id}`,
            type: "Market Movement" as const,
            title: "Live market under surveillance",
            description: `${live.homeTeamName} vs ${live.awayTeamName} is live. Momentum and odds movement are being monitored.`,
            severity: "Watch" as const,
            timestamp: now,
          },
        ]
      : []),
    ...(upcoming
      ? [
          {
            id: `feed:lineup:${upcoming.id}`,
            type: "Line-up Confirmation" as const,
            title: "Pre-match intelligence window open",
            description: `${upcoming.homeTeamName} vs ${upcoming.awayTeamName} will be checked for line-up, injury, and weather changes before kickoff.`,
            severity: "Info" as const,
            timestamp: upcoming.kickoffAt,
          },
        ]
      : []),
    {
      id: "feed:system",
      type: "System Announcement",
      title: "FPF intelligence desk online",
      description: "Approved opportunities and market alerts will appear here as data quality reaches publication standard.",
      severity: "Info",
      timestamp: now,
    },
  ];

  return items.slice(0, 8);
}

function performanceSummary(opportunities: SubscriberOpportunity[]) {
  const strong = opportunities.filter((item) => item.aiConfidence >= 65).length;
  const strikeRate = opportunities.length ? Math.round((strong / opportunities.length) * 100) : 0;
  const roi = opportunities.length
    ? Math.round(
        opportunities.reduce(
          (total, item) => total + (item.expectedValue.startsWith("+") ? Number(item.expectedValue.slice(1, -1)) : 0),
          0,
        ) / Math.max(opportunities.length, 1),
      )
    : 0;

  return {
    wins: strong,
    losses: Math.max(opportunities.length - strong, 0),
    strikeRate,
    roi,
    weeklyProfit: 0,
    monthlyProfit: 0,
    chart: [
      { label: "Mon", value: Math.max(12, strikeRate - 18) },
      { label: "Tue", value: Math.max(18, strikeRate - 10) },
      { label: "Wed", value: Math.max(20, strikeRate - 4) },
      { label: "Thu", value: Math.max(24, strikeRate) },
      { label: "Fri", value: Math.max(28, strikeRate + 3) },
      { label: "Sat", value: Math.max(30, strikeRate + 6) },
      { label: "Sun", value: Math.max(32, strikeRate + 2) },
    ],
  };
}

function reports(fixtures: FootballFixtureSummary[], opportunities: SubscriberOpportunity[]): SubscriberReport[] {
  const now = new Date().toISOString();
  const topLeague = fixtures[0]?.leagueName ?? opportunities[0]?.league ?? "Global Football";
  return [
    {
      id: "daily-briefing",
      title: "Daily Football Intelligence Briefing",
      category: "Daily Briefing",
      summary: `${opportunities.length} approved opportunities are currently available for subscriber review.`,
      publishedAt: now,
    },
    {
      id: "weekly-report",
      title: "Weekly Market Performance Report",
      category: "Weekly Report",
      summary: "Weekly performance will mature as approved opportunities settle through the FPF result workflow.",
      publishedAt: now,
    },
    {
      id: "league-analysis",
      title: `${topLeague} Market Structure`,
      category: "League Analysis",
      summary: "League-level analysis combines fixtures, team context, and approved FPF intelligence.",
      publishedAt: now,
    },
  ];
}

function notifications(opportunities: SubscriberOpportunity[]): SubscriberNotification[] {
  const now = new Date().toISOString();
  return [
    ...(opportunities[0]
      ? [
          {
            id: "notification:new-opportunity",
            type: "New Opportunity" as const,
            title: "New approved opportunity",
            message: `${opportunities[0].market} is available for ${opportunities[0].match}.`,
            createdAt: opportunities[0].kickoffTime ?? now,
          },
        ]
      : []),
    {
      id: "notification:subscription",
      type: "Subscription Update",
      title: "Membership active",
      message: "Your subscriber access is active and ready for the current intelligence cycle.",
      createdAt: now,
    },
    {
      id: "notification:system",
      type: "System Announcement",
      title: "Command Center ready",
      message: "FPF will show only approved intelligence and safe data-quality states.",
      createdAt: now,
    },
  ];
}

export class IntelligenceService {
  constructor(
    private readonly repository: IntelligenceRepository,
    private readonly cache: CacheStore,
  ) {}

  async getTodayFixtures(input: { limit?: number; search?: string; league?: string; date?: string }) {
    const date = input.date;
    const key = `fixtures:${date}:${input.limit ?? 30}:${input.search ?? ""}:${input.league ?? ""}`;
    const cached = await this.cache.get<FootballFixtureSummary[]>(key);
    if (cached) return cached;

    const fixtures = await this.repository.listFixtures({
      date,
      limit: input.limit ?? 30,
      search: input.search,
      league: input.league,
    });
    await this.cache.set(key, fixtures, 60);
    return fixtures;
  }

  async getLiveMatches(input: { limit?: number } = {}) {
    const key = `live:${input.limit ?? 20}`;
    const cached = await this.cache.get<FootballFixtureSummary[]>(key);
    if (cached) return cached;

    const fixtures = await this.repository.listFixtures({ live: true, limit: input.limit ?? 20 });
    await this.cache.set(key, fixtures, 20);
    return fixtures;
  }

  async getOpportunityFeed() {
    const fixtures = await this.repository.listFixtures({ limit: 50 });
    const opportunities = [
      ...(await this.repository.listApprovedOpportunities(fixtures)),
      ...(await this.repository.listPublishedOpportunities()),
    ];

    return opportunities.sort((a, b) => b.aiConfidence - a.aiConfidence).slice(0, 24);
  }

  async getMatchIntelligence(id: string): Promise<MatchIntelligence> {
    const fixture = await this.repository.getFixture(id);
    const scores = calculateIntelligenceScores(fixture);
    const opportunities = await this.getOpportunityFeed();
    const suggestedMarkets = opportunities.filter((item) => item.fixtureId === id).slice(0, 5);
    const injuries = normalizeInjuries(fixture);

    return {
      fixture,
      scores,
      teamForm: fixture ? "Team form pipeline is ready; live form model is not connected yet." : "Insufficient data",
      headToHead: fixture?.headToHeadRecords.length ? "Head-to-head records are available for analysis." : "Head-to-head data pending.",
      injuries,
      lineups: normalizeLineups(fixture),
      statistics: normalizeStatistics(fixture),
      referee: normalizeReferee(fixture),
      venue: normalizeVenue(fixture),
      weather: weatherPlaceholder(fixture?.id ?? id),
      odds: oddsPlaceholder(fixture),
      suggestedMarkets,
      explanation: fixture
        ? "Intelligence score combines fixture status, stored odds, standings depth, and injury availability."
        : "Insufficient data: fixture was not found in the football data layer.",
    };
  }

  async getLeagueOverview(leagueName?: string): Promise<LeagueOverview> {
    const fixtures = await this.repository.listFixtures({ league: leagueName, limit: 30 });
    const fixture = fixtures[0] ?? null;
    const fixtureDetail = fixture ? await this.repository.getFixture(fixture.id) : null;
    const opportunities = await this.getOpportunityFeed();

    return {
      competition: fixture ? normalizeCompetition(fixture) : { id: leagueName ?? "global", name: leagueName ?? "Global Football", country: null, season: null },
      standings: fixtureDetail?.standings ?? [],
      fixtures,
      opportunityCount: opportunities.filter((item) => (leagueName ? item.league === leagueName : true)).length,
      dataQualityStatus: fixture ? "READY" : "INSUFFICIENT_DATA",
    };
  }

  async getTeamProfile(id: string): Promise<TeamProfile> {
    const fixtures = await this.repository.listFixtures({ search: id, limit: 10 });
    const fixture = fixtures[0] ?? null;
    const teams = fixture ? normalizeTeams(fixture) : null;
    const detail = fixture ? await this.repository.getFixture(fixture.id) : null;
    const scores = calculateIntelligenceScores(detail);

    return {
      team: teams?.home.name.toLowerCase() === id.toLowerCase() ? teams.home : teams?.away ?? { id, name: id, country: null, logoUrl: null },
      fixtures,
      scores: {
        teamStrength: scores.teamStrength,
        attackRating: scores.attackRating,
        defenceRating: scores.defenceRating,
        formRating: scores.formRating,
      },
      dataQualityStatus: fixture ? "READY" : "INSUFFICIENT_DATA",
    };
  }

  async getPlayerProfile(id: string): Promise<PlayerProfile> {
    return {
      player: {
        id,
        name: id,
        teamId: null,
        position: null,
        status: "UNKNOWN",
      },
      injuries: [],
      dataQualityStatus: "INSUFFICIENT_DATA",
    };
  }

  async getDashboard(user: AuthUser): Promise<IntelligenceDashboard> {
    const fixtures = await this.repository.listFixtures({ limit: 40 });
    const opportunities = await this.getOpportunityFeed();
    const performance = performanceSummary(opportunities);

    return {
      generatedAt: new Date().toISOString(),
      providerStatus: getProviderStatus(),
      executiveOverview: {
        welcomeMessage: `Welcome back, ${user.name}. FPF intelligence is monitoring approved football markets for you.`,
        membershipTier: user.role === "ADMIN" ? "Institutional Admin Access" : "Subscriber Intelligence",
        aiIntelligenceScore: opportunities.length
          ? Math.round(opportunities.reduce((total, item) => total + item.aiConfidence, 0) / opportunities.length)
          : 72,
        subscriptionStatus: "Active",
        walletBalanceCents: 0,
        performanceSummary: opportunities.length
          ? `${opportunities.length} approved opportunities currently available.`
          : "No approved opportunities are live yet; monitoring remains active.",
      },
      opportunities,
      liveIntelligenceFeed: intelligenceFeed(fixtures, opportunities),
      performance,
      reports: reports(fixtures, opportunities),
      notifications: notifications(opportunities),
      referral: {
        referralCode: `FPF-${user.id.slice(0, 6).toUpperCase()}`,
        referralLink: `https://football-performance-fund-frontend.vercel.app?ref=FPF-${user.id.slice(0, 6).toUpperCase()}`,
        earningsCents: 0,
        invitedSubscribers: 0,
        rewards: ["Priority briefing access", "Referral rewards will activate with subscription billing."],
      },
    };
  }
}
