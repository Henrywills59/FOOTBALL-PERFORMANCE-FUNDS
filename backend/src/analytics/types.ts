export type AnalyticsTrendPoint = {
  label: string;
  value: number;
};

export type AnalyticsKpi = {
  label: string;
  value: number | string;
  changePercent: number;
  status: "UP" | "DOWN" | "FLAT";
};

export type AnalystAnalytics = {
  analystId: string;
  analystName: string;
  totalPicks: number;
  winningPicks: number;
  losingPicks: number;
  voidPicks: number;
  winRate: number;
  roi: number;
  profitGeneratedCents: number;
  capitalUsedCents: number;
  capitalEfficiency: number;
  averageOdds: number;
  leaguePerformance: Array<{ league: string; roi: number; accuracy: number; profitCents: number }>;
  competitionPerformance: Array<{ competition: string; roi: number; accuracy: number; profitCents: number }>;
  homePerformance: number;
  awayPerformance: number;
  monthlyTrend: AnalyticsTrendPoint[];
  dailyTrend: AnalyticsTrendPoint[];
  confidenceAccuracy: number;
  drawdown: number;
  currentRank: string;
  historicalRank: string[];
  reliabilityIndex: number;
  disciplineScore: number;
};

export type LeagueAnalytics = {
  league: string;
  matchesPlayed: number;
  profitCents: number;
  roi: number;
  accuracy: number;
  risk: number;
  averageOdds: number;
  averageConfidence: number;
  rank: number;
};

export type MarketAnalytics = {
  market: string;
  roi: number;
  accuracy: number;
  averageOdds: number;
  averageRisk: number;
  profitGeneratedCents: number;
  capitalAllocationCents: number;
  rank: number;
};

export type SubscriberAnalytics = {
  activeSubscribers: number;
  freeUsers: number;
  paidUsers: number;
  premiumUsers: number;
  enterpriseUsers: number;
  conversionRate: number;
  churnRate: number;
  averageSubscriptionValueCents: number;
  lifetimeValueCents: number;
  retention: number;
  countryDistribution: Array<{ country: string; count: number }>;
  deviceDistribution: Array<{ device: string; count: number }>;
};

export type InvestorAnalytics = {
  totalInvestors: number;
  activeInvestors: number;
  lockedCapitalCents: number;
  distributionPaidCents: number;
  averageInvestmentCents: number;
  averageRoi: number;
  averageHoldingPeriodDays: number;
  reinvestmentRate: number;
  withdrawalsCents: number;
  pendingDistributionsCents: number;
  capitalGrowth: AnalyticsTrendPoint[];
};

export type TreasuryAnalytics = {
  openingBalanceCents: number;
  closingBalanceCents: number;
  netProfitCents: number;
  netLossCents: number;
  capitalAllocationCents: number;
  capitalReturnedCents: number;
  dailyCashFlow: AnalyticsTrendPoint[];
  weeklyCashFlow: AnalyticsTrendPoint[];
  monthlyCashFlow: AnalyticsTrendPoint[];
};

export type AiBusinessInsight = {
  id: string;
  category: "PERFORMANCE" | "RISK" | "REVENUE" | "CAPITAL" | "ANOMALY";
  title: string;
  recommendation: string;
  confidence: number;
  severity: "INFO" | "WATCH" | "ACTION";
};

export type PredictiveForecast = {
  metric: string;
  expectedValueCents: number;
  confidence: number;
  trend: "UP" | "DOWN" | "FLAT";
  explanation: string;
};

export type ExportCenterItem = {
  id: string;
  reportType: "PDF" | "EXCEL" | "CSV";
  title: string;
  cadence: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL" | "ON_DEMAND";
  providerStatus: "PLACEHOLDER_READY";
};

export type ExecutiveAnalyticsDashboard = {
  generatedAt: string;
  executiveKpis: AnalyticsKpi[];
  analystLeaderboard: AnalystAnalytics[];
  leagueIntelligence: LeagueAnalytics[];
  marketIntelligence: MarketAnalytics[];
  subscriberAnalytics: SubscriberAnalytics;
  investorAnalytics: InvestorAnalytics;
  treasuryAnalytics: TreasuryAnalytics;
  aiInsights: AiBusinessInsight[];
  forecasts: PredictiveForecast[];
  exportCenter: ExportCenterItem[];
  visualizations: {
    revenueTimeline: AnalyticsTrendPoint[];
    profitTimeline: AnalyticsTrendPoint[];
    capitalAllocation: Array<{ label: string; value: number }>;
    riskHeatMap: Array<{ label: string; risk: number; exposureCents: number }>;
  };
};

export type AnalystPrivateAnalytics = {
  analyst: AnalystAnalytics;
  aiRecommendations: AiBusinessInsight[];
  exportCenter: ExportCenterItem[];
};
