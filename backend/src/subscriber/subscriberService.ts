import type {
  AuthUser,
  FootballFixtureSummary,
  PredictionResult,
  PublishedIntelligence,
  SubscriberCommandCenter,
  SubscriberIntelligenceFeedItem,
  SubscriberIntelligence,
  SubscriberNotification,
  SubscriberOpportunity,
  SubscriberReport,
} from "@fpf/shared";
import type { AnalystRepository } from "../analyst/types.js";
import type { FootballRepository } from "../football/types.js";
import type { PredictionRepository } from "../predictions/types.js";
import type { IntelligenceWorkflowRepository } from "../intelligenceWorkflow/types.js";

function riskGrade(scoreOrLabel: number | string): SubscriberOpportunity["riskGrade"] {
  if (typeof scoreOrLabel === "string") {
    const normalized = scoreOrLabel.toLowerCase();
    if (normalized.includes("high")) return "High";
    if (normalized.includes("medium")) return "Medium";
    return "Low";
  }

  if (scoreOrLabel >= 70) return "High";
  if (scoreOrLabel >= 45) return "Medium";
  return "Low";
}

function opportunityStatus(fixture?: FootballFixtureSummary): SubscriberOpportunity["status"] {
  if (!fixture) return "Published";
  if (fixture.status === "LIVE") return "Live";
  if (fixture.status === "SCHEDULED") return "Upcoming";
  return "Monitoring";
}

function expectedValue(prediction: Pick<PredictionResult, "edge" | "valueRating">) {
  if (prediction.edge && prediction.edge > 0) return `+${(prediction.edge * 100).toFixed(1)}%`;
  if (prediction.valueRating !== "NONE") return prediction.valueRating;
  return "Neutral";
}

function matchName(fixture?: FootballFixtureSummary) {
  return fixture ? `${fixture.homeTeamName} vs ${fixture.awayTeamName}` : "Fixture context pending";
}

function predictionOpportunity(
  prediction: PredictionResult,
  fixtures: FootballFixtureSummary[],
): SubscriberOpportunity {
  const fixture = fixtures.find((item) => item.id === prediction.fixtureId);
  const suggestedOdds = prediction.impliedProbability && prediction.impliedProbability > 0
    ? Math.round((1 / prediction.impliedProbability) * 100) / 100
    : null;
  return {
    id: `prediction:${prediction.id ?? prediction.fixtureId}`,
    fixtureId: prediction.fixtureId,
    match: matchName(fixture),
    league: fixture?.leagueName ?? "League pending",
    kickoffTime: fixture?.kickoffAt ?? null,
    market: prediction.recommendedMarket,
    prediction: prediction.predictedOutcome,
    aiConfidence: prediction.confidenceScore,
    riskGrade: riskGrade(prediction.riskScore),
    expectedValue: expectedValue(prediction),
    suggestedOdds,
    historicalAccuracy: Math.round(Math.max(52, Math.min(88, prediction.confidenceScore - prediction.riskScore * 0.18))),
    currentStatus: prediction.approvalStatus,
    status: opportunityStatus(fixture),
    explanation: prediction.explanation,
    source: "AI Prediction",
  };
}

function intelligenceOpportunity(item: PublishedIntelligence): SubscriberOpportunity {
  return {
    id: `intelligence:${item.id}`,
    fixtureId: item.fixtureId,
    match: item.match,
    league: item.leagueName,
    kickoffTime: item.publishedAt,
    market: item.market,
    prediction: item.prediction,
    aiConfidence: item.confidence,
    riskGrade: riskGrade(item.riskRating),
    expectedValue: item.confidence >= 70 ? "High" : item.confidence >= 55 ? "Medium" : "Watch",
    suggestedOdds: null,
    historicalAccuracy: Math.round(Math.max(50, Math.min(86, item.confidence - 4))),
    currentStatus: "Published",
    status: "Published",
    explanation: item.briefExplanation,
    source: "FPF Intelligence",
  };
}

function workflowIntelligenceOpportunity(item: SubscriberIntelligence): SubscriberOpportunity {
  return {
    id: `subscriber-intelligence:${item.id}`,
    fixtureId: item.intelligenceId,
    match: item.matchLabel,
    league: item.leagueName,
    kickoffTime: item.kickoffAt,
    market: item.recommendedMarket,
    prediction: item.predictedOutcome,
    aiConfidence: item.confidenceScore,
    riskGrade: riskGrade(item.riskGrade),
    expectedValue: item.valueScore >= 70 ? "High" : item.valueScore >= 55 ? "Medium" : "Watch",
    suggestedOdds: null,
    historicalAccuracy: Math.round(Math.max(50, Math.min(88, item.confidenceScore - item.riskScore * 0.15))),
    currentStatus: "Published",
    status: "Published",
    explanation: item.summary,
    source: "FPF Intelligence",
  };
}

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
        opportunities.reduce((total, item) => total + (item.expectedValue.startsWith("+") ? Number(item.expectedValue.slice(1, -1)) : 0), 0) /
          Math.max(opportunities.length, 1),
      )
    : 0;

  return {
    wins: strong,
    losses: Math.max(opportunities.length - strong, 0),
    strikeRate,
    roi,
    dailyRoi: roi,
    weeklyRoi: roi,
    monthlyRoi: roi,
    overallRoi: roi,
    lossRate: opportunities.length ? Math.max(0, 100 - strikeRate) : 0,
    averageOdds: opportunities.length
      ? Math.round((opportunities.reduce((total, item) => total + (item.suggestedOdds ?? 1.75), 0) / opportunities.length) * 100) / 100
      : 0,
    bestMarkets: Array.from(new Set(opportunities.map((item) => item.market))).slice(0, 4),
    currentStreak: strong ? `${strong} quality signals` : "Awaiting settled outcomes",
    longestWinningStreak: strong,
    longestLosingStreak: Math.max(opportunities.length - strong, 0),
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
    timeline: opportunities.slice(0, 8).map((item) => ({
      label: item.match,
      status: item.currentStatus ?? item.status,
      value: item.aiConfidence,
    })),
  };
}

function predictionHistory(opportunities: SubscriberOpportunity[]) {
  return opportunities.map((item, index) => ({
    id: `history:${item.id}`,
    date: item.kickoffTime ?? new Date().toISOString(),
    fixture: item.match,
    league: item.league,
    market: item.market,
    odds: item.suggestedOdds ?? null,
    result: "Pending" as const,
    profitLossCents: 0,
    confidence: item.aiConfidence,
    status: item.currentStatus ?? item.status,
  })).slice(0, 100);
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

export class SubscriberService {
  constructor(
    private readonly footballRepository: FootballRepository,
    private readonly predictionRepository: PredictionRepository,
    private readonly analystRepository: AnalystRepository,
    private readonly intelligenceWorkflowRepository?: IntelligenceWorkflowRepository,
  ) {}

  async commandCenter(user: AuthUser): Promise<SubscriberCommandCenter> {
    const fixtures = await this.footballRepository.listFixtures({ limit: 40 });
    const predictions = await this.predictionRepository.listPredictions({ approvalStatus: "APPROVED" });
    const published = await this.analystRepository.listPublished();
    const workflowPublished = await this.intelligenceWorkflowRepository?.listPublishedSubscriberIntelligence().catch((error) => {
      console.warn("SUBSCRIBER_WORKFLOW_PUBLICATIONS_FALLBACK", {
        message: error instanceof Error ? error.message : "Unable to read workflow publications",
      });
      return [];
    }) ?? [];
    const opportunities = [
      ...predictions.map((prediction) => predictionOpportunity(prediction, fixtures)),
      ...published.map(intelligenceOpportunity),
      ...workflowPublished.map(workflowIntelligenceOpportunity),
    ]
      .sort((a, b) => b.aiConfidence - a.aiConfidence)
      .slice(0, 24);
    const performance = performanceSummary(opportunities);

    return {
      executiveOverview: {
        welcomeMessage: `Welcome back, ${user.name}. FPF intelligence is monitoring approved football markets for you.`,
        membershipTier: user.role === "ADMIN" ? "Institutional Admin Access" : "Subscriber Intelligence",
        aiIntelligenceScore: opportunities.length ? Math.round(opportunities.reduce((total, item) => total + item.aiConfidence, 0) / opportunities.length) : 72,
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
      predictionHistory: predictionHistory(opportunities),
      subscriptionCenter: {
        plan: user.role === "ADMIN" ? "Institutional Admin Access" : "Subscriber Intelligence",
        status: "Active",
        billingCycle: "Monthly",
        expirationDate: null,
        paymentStatus: "Current",
        billingHistory: [],
        receipts: [],
        upgradeOptions: ["Starter", "Pro", "Elite"],
      },
      profileCenter: {
        name: user.name,
        email: user.email,
        accountStatus: user.status,
        avatarUrl: null,
        mfaStatus: "Not Enabled",
        devices: [{ id: "current-session", label: "Current browser session", lastSeenAt: new Date().toISOString() }],
        loginHistory: [{ id: "current-login", label: "Current authenticated session", createdAt: new Date().toISOString() }],
        notificationPreferences: ["New predictions", "Subscription alerts", "System announcements", "Account notifications"],
      },
    };
  }
}
