import type {
  AiBusinessInsight,
  AnalystAnalytics,
  AnalystPrivateAnalytics,
  AnalyticsKpi,
  AnalyticsTrendPoint,
  ExecutiveAnalyticsDashboard,
  ExportCenterItem,
  InvestorAnalytics,
  LeagueAnalytics,
  MarketAnalytics,
  PredictiveForecast,
  SubscriberAnalytics,
  TreasuryAnalytics,
} from "./types.js";

const now = () => new Date().toISOString();

function cents(value: number) {
  return Math.max(0, Math.round(value));
}

function trend(seed: number, labels: string[]): AnalyticsTrendPoint[] {
  return labels.map((label, index) => ({
    label,
    value: Math.max(0, Math.round(seed * (0.82 + index * 0.06 + (index % 2 ? 0.03 : -0.01)))),
  }));
}

function kpi(label: string, value: number | string, changePercent: number, status: AnalyticsKpi["status"] = changePercent > 0 ? "UP" : changePercent < 0 ? "DOWN" : "FLAT"): AnalyticsKpi {
  return { label, value, changePercent, status };
}

export class AnalyticsService {
  dashboard(): ExecutiveAnalyticsDashboard {
    const analysts = this.analystLeaderboard();
    const leagues = this.leagueIntelligence();
    const markets = this.marketIntelligence();
    const subscriberAnalytics = this.subscriberAnalytics();
    const investorAnalytics = this.investorAnalytics();
    const treasuryAnalytics = this.treasuryAnalytics();
    const weeklyProfit = treasuryAnalytics.netProfitCents;

    return {
      generatedAt: now(),
      executiveKpis: [
        kpi("Total Company Capital", cents(treasuryAnalytics.closingBalanceCents + investorAnalytics.lockedCapitalCents), 6.2),
        kpi("Investor Capital", investorAnalytics.lockedCapitalCents, 4.8),
        kpi("Company Working Capital", 250000, 1.4),
        kpi("Available Treasury", treasuryAnalytics.closingBalanceCents, 3.6),
        kpi("Daily Exposure", treasuryAnalytics.capitalAllocationCents, -2.1, "DOWN"),
        kpi("Weekly Exposure", 210000, 7.2),
        kpi("Monthly Exposure", 830000, 11.5),
        kpi("Today's Revenue", 12400, 3.1),
        kpi("Weekly Revenue", 88300, 8.7),
        kpi("Monthly Revenue", 361900, 12.2),
        kpi("Yearly Revenue", 4210000, 18.4),
        kpi("Today's Profit", treasuryAnalytics.netProfitCents, 2.9),
        kpi("Weekly Profit", weeklyProfit, 6.6),
        kpi("Monthly Profit", 148000, 9.8),
        kpi("Yearly Profit", 1680000, 14.7),
        kpi("Company Share", Math.round(weeklyProfit * 0.5), 6.6),
        kpi("Investor Share", Math.round(weeklyProfit * 0.3), 6.6),
        kpi("Analyst Rewards", Math.round(weeklyProfit * 0.2), 6.6),
        kpi("Active Subscribers", subscriberAnalytics.activeSubscribers, 5.4),
        kpi("Active Investors", investorAnalytics.activeInvestors, 3.8),
        kpi("Active Analysts", analysts.length, 0.8),
        kpi("Renewal Rate", `${subscriberAnalytics.retention}%`, 1.9),
        kpi("Subscriber Growth", "5.4%", 5.4),
        kpi("Investor Growth", "3.8%", 3.8),
        kpi("AI Confidence Index", "78/100", 2.4),
        kpi("Platform Health", "READY", 0, "FLAT"),
        kpi("API Health", "OK", 0, "FLAT"),
        kpi("Risk Score", "34/100", -4.2, "DOWN"),
      ],
      analystLeaderboard: analysts,
      leagueIntelligence: leagues,
      marketIntelligence: markets,
      subscriberAnalytics,
      investorAnalytics,
      treasuryAnalytics,
      aiInsights: this.aiInsights(analysts, leagues, markets),
      forecasts: this.forecasts(weeklyProfit),
      exportCenter: this.exportCenter(),
      visualizations: {
        revenueTimeline: trend(88000, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
        profitTimeline: trend(22000, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
        capitalAllocation: [
          { label: "Company Working Capital", value: 250000 },
          { label: "Investor Principal", value: investorAnalytics.lockedCapitalCents },
          { label: "Open Exposure", value: treasuryAnalytics.capitalAllocationCents },
          { label: "Available Treasury", value: treasuryAnalytics.closingBalanceCents },
        ],
        riskHeatMap: markets.map((market) => ({ label: market.market, risk: market.averageRisk, exposureCents: market.capitalAllocationCents })),
      },
    };
  }

  analystPrivate(analystId: string): AnalystPrivateAnalytics {
    const analyst = this.analystLeaderboard().find((item) => item.analystId === analystId) ?? this.analystLeaderboard()[0];
    return {
      analyst,
      aiRecommendations: this.aiInsights([analyst], this.leagueIntelligence(), this.marketIntelligence()).filter((item) => item.category !== "REVENUE"),
      exportCenter: this.exportCenter().filter((item) => item.title.includes("Analyst")),
    };
  }

  private analystLeaderboard(): AnalystAnalytics[] {
    const base = [
      ["analyst-placeholder", "Internal Analyst Placeholder", 88, 52, 24, 12, 142000, 410000, 1.83, 86, 91],
      ["analyst-ops-2", "FPF Tactical Desk", 76, 43, 25, 8, 97000, 320000, 1.77, 79, 88],
      ["analyst-ops-3", "FPF Market Desk", 69, 36, 26, 7, 71000, 280000, 1.91, 74, 84],
    ] as const;
    return base.map(([analystId, analystName, totalPicks, winningPicks, losingPicks, voidPicks, profitGeneratedCents, capitalUsedCents, averageOdds, reliabilityIndex, disciplineScore], index) => {
      const winRate = Number(((winningPicks / Math.max(1, totalPicks - voidPicks)) * 100).toFixed(1));
      const roi = Number(((profitGeneratedCents / capitalUsedCents) * 100).toFixed(1));
      return {
        analystId,
        analystName,
        totalPicks,
        winningPicks,
        losingPicks,
        voidPicks,
        winRate,
        roi,
        profitGeneratedCents,
        capitalUsedCents,
        capitalEfficiency: Number(((profitGeneratedCents / capitalUsedCents) * 100).toFixed(1)),
        averageOdds,
        leaguePerformance: [
          { league: "Premier League", roi: roi + 2, accuracy: winRate + 3, profitCents: Math.round(profitGeneratedCents * 0.38) },
          { league: "Champions League", roi: roi - 1, accuracy: winRate, profitCents: Math.round(profitGeneratedCents * 0.24) },
        ],
        competitionPerformance: [
          { competition: "Domestic League", roi, accuracy: winRate, profitCents: Math.round(profitGeneratedCents * 0.62) },
          { competition: "European Competition", roi: roi - 0.8, accuracy: winRate - 1, profitCents: Math.round(profitGeneratedCents * 0.38) },
        ],
        homePerformance: Number((winRate + 4 - index).toFixed(1)),
        awayPerformance: Number((winRate - 3 - index).toFixed(1)),
        monthlyTrend: trend(profitGeneratedCents / 4, ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]),
        dailyTrend: trend(profitGeneratedCents / 28, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
        confidenceAccuracy: Number((winRate - 2 + index).toFixed(1)),
        drawdown: Number((4.2 + index * 1.7).toFixed(1)),
        currentRank: `#${index + 1}`,
        historicalRank: [`#${index + 2}`, `#${index + 1}`, `#${index + 1}`],
        reliabilityIndex,
        disciplineScore,
      };
    });
  }

  private leagueIntelligence(): LeagueAnalytics[] {
    return [
      ["Premier League", 46, 98000, 14.2, 64.3, 28, 1.82, 78],
      ["Champions League", 28, 74000, 12.8, 61.4, 34, 1.88, 75],
      ["La Liga", 33, 51000, 8.7, 58.2, 39, 1.74, 71],
      ["Serie A", 31, 29000, 5.4, 55.9, 44, 1.79, 69],
      ["Bundesliga", 29, -12000, -2.1, 49.8, 58, 1.92, 62],
    ].map(([league, matchesPlayed, profitCents, roi, accuracy, risk, averageOdds, averageConfidence], index) => ({
      league: String(league),
      matchesPlayed: Number(matchesPlayed),
      profitCents: Number(profitCents),
      roi: Number(roi),
      accuracy: Number(accuracy),
      risk: Number(risk),
      averageOdds: Number(averageOdds),
      averageConfidence: Number(averageConfidence),
      rank: index + 1,
    }));
  }

  private marketIntelligence(): MarketAnalytics[] {
    return [
      ["Over 2.5", 15.1, 63.8, 1.86, 32, 88000, 280000],
      ["Double Chance", 9.4, 68.2, 1.62, 24, 54000, 240000],
      ["BTTS", 7.8, 59.4, 1.79, 39, 41000, 210000],
      ["Draw No Bet", 5.6, 57.2, 1.71, 35, 22000, 180000],
      ["Cards", -3.7, 46.1, 1.95, 66, -9000, 90000],
    ].map(([market, roi, accuracy, averageOdds, averageRisk, profitGeneratedCents, capitalAllocationCents], index) => ({
      market: String(market),
      roi: Number(roi),
      accuracy: Number(accuracy),
      averageOdds: Number(averageOdds),
      averageRisk: Number(averageRisk),
      profitGeneratedCents: Number(profitGeneratedCents),
      capitalAllocationCents: Number(capitalAllocationCents),
      rank: index + 1,
    }));
  }

  private subscriberAnalytics(): SubscriberAnalytics {
    return {
      activeSubscribers: 312,
      freeUsers: 118,
      paidUsers: 247,
      premiumUsers: 64,
      enterpriseUsers: 3,
      conversionRate: 18.6,
      churnRate: 3.2,
      averageSubscriptionValueCents: 4900,
      lifetimeValueCents: 41200,
      retention: 91.4,
      countryDistribution: [
        { country: "United States", count: 84 },
        { country: "United Kingdom", count: 61 },
        { country: "Uganda", count: 49 },
        { country: "Kenya", count: 38 },
      ],
      deviceDistribution: [
        { device: "Mobile", count: 196 },
        { device: "Desktop", count: 92 },
        { device: "Tablet", count: 24 },
      ],
    };
  }

  private investorAnalytics(): InvestorAnalytics {
    return {
      totalInvestors: 42,
      activeInvestors: 37,
      lockedCapitalCents: 750000,
      distributionPaidCents: 124000,
      averageInvestmentCents: 20270,
      averageRoi: 7.4,
      averageHoldingPeriodDays: 93,
      reinvestmentRate: 62,
      withdrawalsCents: 38000,
      pendingDistributionsCents: 22000,
      capitalGrowth: trend(750000, ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]),
    };
  }

  private treasuryAnalytics(): TreasuryAnalytics {
    return {
      openingBalanceCents: 1000000,
      closingBalanceCents: 1020000,
      netProfitCents: 20000,
      netLossCents: 0,
      capitalAllocationCents: 25000,
      capitalReturnedCents: 45000,
      dailyCashFlow: trend(20000, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
      weeklyCashFlow: trend(92000, ["W1", "W2", "W3", "W4"]),
      monthlyCashFlow: trend(360000, ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]),
    };
  }

  private aiInsights(analysts: AnalystAnalytics[], leagues: LeagueAnalytics[], markets: MarketAnalytics[]): AiBusinessInsight[] {
    const bestAnalyst = analysts[0];
    const bestLeague = leagues[0];
    const weakMarket = markets[markets.length - 1];
    return [
      {
        id: "insight_best_league",
        category: "PERFORMANCE",
        title: `${bestLeague.league} is the best performing league`,
        recommendation: `Maintain controlled allocation in ${bestLeague.league}; it currently combines ${bestLeague.roi}% ROI with ${bestLeague.accuracy}% accuracy.`,
        confidence: 82,
        severity: "INFO",
      },
      {
        id: "insight_best_analyst",
        category: "CAPITAL",
        title: `${bestAnalyst.analystName} leads capital efficiency`,
        recommendation: "Consider a modest placeholder allocation uplift while discipline score remains above threshold.",
        confidence: 79,
        severity: "WATCH",
      },
      {
        id: "insight_market_risk",
        category: "RISK",
        title: `${weakMarket.market} shows dangerous pattern risk`,
        recommendation: "Reduce exposure or require additional War Room review before publication.",
        confidence: 74,
        severity: "ACTION",
      },
      {
        id: "insight_revenue_trend",
        category: "REVENUE",
        title: "Subscriber revenue trend is positive",
        recommendation: "Preserve premium positioning; conversion and retention placeholders are both above alert threshold.",
        confidence: 76,
        severity: "INFO",
      },
    ];
  }

  private forecasts(weeklyProfitCents: number): PredictiveForecast[] {
    return [
      { metric: "Expected Weekly Profit", expectedValueCents: cents(weeklyProfitCents * 1.08), confidence: 72, trend: "UP", explanation: "Based on current treasury, market, and analyst trend placeholders." },
      { metric: "Expected Monthly Profit", expectedValueCents: cents(weeklyProfitCents * 4.35), confidence: 68, trend: "UP", explanation: "Compounds weekly profit trend without assuming guaranteed returns." },
      { metric: "Expected Investor Distribution", expectedValueCents: cents(weeklyProfitCents * 0.3), confidence: 70, trend: "UP", explanation: "Uses the active 30% investor share policy." },
      { metric: "Expected Analyst Rewards", expectedValueCents: cents(weeklyProfitCents * 0.2), confidence: 70, trend: "UP", explanation: "Uses the active 20% analyst reward policy." },
      { metric: "Expected Subscriber Revenue", expectedValueCents: 97000, confidence: 73, trend: "UP", explanation: "Uses current subscriber growth and retention placeholders." },
      { metric: "Expected Expenses", expectedValueCents: 28000, confidence: 65, trend: "FLAT", explanation: "Operating cost placeholder until accounting integrations are approved." },
    ];
  }

  private exportCenter(): ExportCenterItem[] {
    return [
      { id: "export_weekly_executive_pdf", reportType: "PDF", title: "Weekly Executive Report", cadence: "WEEKLY", providerStatus: "PLACEHOLDER_READY" },
      { id: "export_monthly_investor_excel", reportType: "EXCEL", title: "Monthly Investor Report", cadence: "MONTHLY", providerStatus: "PLACEHOLDER_READY" },
      { id: "export_analyst_csv", reportType: "CSV", title: "Analyst Performance Export", cadence: "ON_DEMAND", providerStatus: "PLACEHOLDER_READY" },
      { id: "export_annual_board_pdf", reportType: "PDF", title: "Annual Board Intelligence Report", cadence: "ANNUAL", providerStatus: "PLACEHOLDER_READY" },
    ];
  }
}
