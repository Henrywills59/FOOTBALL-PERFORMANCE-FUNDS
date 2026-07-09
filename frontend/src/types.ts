export const PUBLIC_USER_ROLES = ["SUBSCRIBER", "INVESTOR", "ANALYST"] as const;

export type UserRole = "SUBSCRIBER" | "INVESTOR" | "ANALYST" | "ADMIN";
export type PublicUserRole = (typeof PUBLIC_USER_ROLES)[number];
export type AccountStatus = "ACTIVE" | "DISABLED";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
};

export type AuthResponse = {
  user: AuthUser;
  token: string;
  expiresIn: string;
};

export type FootballFixtureStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";

export type FootballFixtureSummary = {
  id: string;
  apiFootballFixtureId: number;
  leagueName: string;
  leagueCountry: string | null;
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: string;
  status: FootballFixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  venue: string | null;
};

export type FootballFixtureDetail = FootballFixtureSummary & {
  season: number;
  round: string | null;
  referee: string | null;
  standings: Array<{
    teamName: string;
    rank: number;
    points: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
  }>;
  injuries: Array<{
    playerName: string;
    teamName: string;
    reason: string | null;
  }>;
  odds: Array<{
    id: string;
    bookmaker: string;
    market: string;
    outcome: string;
    price: number;
    updatedAt: string;
  }>;
  headToHeadRecords: Array<{
    id: string;
    updatedAt: string;
  }>;
};

export type PredictionApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type PredictionDataQualityStatus = "READY" | "INSUFFICIENT_DATA" | "STALE_ODDS";

export type PredictionResult = {
  id?: string;
  fixtureId: string;
  recommendedMarket: string;
  predictedOutcome: string;
  confidenceScore: number;
  riskScore: number;
  valueRating: "NONE" | "LOW" | "MEDIUM" | "HIGH";
  explanation: string;
  adminNotes?: string | null;
  dataQualityStatus: PredictionDataQualityStatus;
  approvalStatus: PredictionApprovalStatus;
  edge: number | null;
  impliedProbability: number | null;
  modelProbability: number | null;
  staleOdds: boolean;
  riskyMarket: boolean;
  createdAt?: string;
};

export type AdminOverview = {
  totalUsers: number;
  activeSubscribers: number;
  activeInvestors: number;
  todaysFixtures: number;
  pendingPredictions: number;
  approvedPredictions: number;
  systemHealth: "OK" | "DEGRADED";
};

export type AdminUser = AuthUser & {
  subscriptionPlan: string;
};

export type AuditLogEntry = {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
};

export type AdminSettings = {
  predictionConfidenceThreshold: number;
  riskThreshold: number;
  maximumSelections: number;
  scheduledSyncEnabled: boolean;
  maintenanceMode: boolean;
};

export type AdminReports = {
  subscribers: {
    total: number;
    active: number;
    disabled: number;
  };
  investors: {
    total: number;
    active: number;
  };
  revenue: {
    trackedWalletDepositsCents: number;
    note: string;
  };
  withdrawals: {
    pendingCount: number;
    approvedCount: number;
    pendingAmountCents: number;
    approvedAmountCents: number;
  };
  analystPerformance: {
    submitted: number;
    approved: number;
    published: number;
    rejected: number;
  };
  predictionAccuracy: {
    approvedPredictions: number;
    publishedIntelligence: number;
    accuracyNote: string;
  };
  dailyPlatformActivity: Array<{
    date: string;
    auditEvents: number;
    logins: number;
  }>;
};

export type PlatformHealth = {
  api: "OK";
  database: "OK" | "DEGRADED";
  footballJobs: "RUNNING" | "STOPPED";
  lastSyncAt: string | null;
  version: string;
};

export type InvestmentPlan = {
  id: string;
  name: string;
  description: string;
  minimumInvestmentCents: number;
  maximumInvestmentCents: number;
  historicalPerformanceNote: string;
  riskDisclosure: string;
};

export type InvestorInvestment = {
  id: string;
  planName: string;
  amountCents: number;
  currentValueCents: number;
  weeklyRoiPercent: number;
  lifetimeRoiPercent: number;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  createdAt: string;
};

export type InvestorReport = {
  id: string;
  investmentId: string;
  periodType: "WEEKLY" | "MONTHLY";
  summary: string;
  roiPercent: number;
  portfolioValueCents: number;
  periodStart: string;
  periodEnd: string;
};

export type WithdrawalRequest = {
  id: string;
  amountCents: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  reviewedAt: string | null;
  adminNotes: string | null;
};

export type InvestorDashboard = {
  totalInvestmentCents: number;
  currentPortfolioValueCents: number;
  weeklyRoiPercent: number;
  lifetimeRoiPercent: number;
  currentStatus: string;
  investmentHistory: InvestorInvestment[];
};

export type WalletTransaction = {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "INVESTMENT" | "ADJUSTMENT";
  status: "PENDING" | "CONFIRMED" | "FAILED" | "APPROVED" | "REJECTED";
  amountCents: number;
  currency: string;
  externalPaymentId: string | null;
  invoiceUrl: string | null;
  createdAt: string;
};

export type InvestorWallet = {
  availableBalanceCents: number;
  pendingBalanceCents: number;
  investmentBalanceCents: number;
  withdrawalBalanceCents: number;
  transactions: WalletTransaction[];
};

export type AnalystAssignmentStatus = "ASSIGNED" | "COMPLETED" | "CANCELLED";
export type IntelligenceSubmissionStatus = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "PUBLISHED";

export type AnalystAssignment = {
  id: string;
  fixtureId: string;
  match: string;
  leagueName: string;
  kickoffAt: string;
  status: AnalystAssignmentStatus;
  adminNotes: string | null;
};

export type AnalystIntelligenceSubmission = {
  id: string;
  fixtureId: string;
  match: string;
  leagueName: string;
  market: string;
  prediction: string;
  confidence: number;
  riskLevel: string;
  detailedReasoning: string;
  supportingStatistics: string;
  sourceNotes: string;
  briefExplanation: string;
  recommendedStake: string;
  adminNotes: string | null;
  status: IntelligenceSubmissionStatus;
  createdAt: string;
  publishedAt: string | null;
};

export type AnalystDashboard = {
  assignedMatches: AnalystAssignment[];
  assignedLeagues: string[];
  pendingTasks: number;
  submittedIntelligence: number;
  approvedIntelligence: number;
  rejectedIntelligence: number;
  analystPerformanceSummary: string;
  adminNotes: string[];
};

export type AnalystAssistance = {
  teamFormSummary: string;
  headToHeadSummary: string;
  injurySummary: string;
  oddsMovement: string;
  riskWarnings: string[];
  valueOpportunityNotes: string;
};

export type PublishedIntelligence = {
  id: string;
  fixtureId: string;
  match: string;
  leagueName: string;
  market: string;
  prediction: string;
  confidence: number;
  riskRating: string;
  briefExplanation: string;
  recommendedStake: string;
  publishedAt: string | null;
};

export type SubscriberOpportunity = {
  id: string;
  fixtureId: string;
  match: string;
  league: string;
  kickoffTime: string | null;
  market: string;
  prediction: string;
  aiConfidence: number;
  riskGrade: "Low" | "Medium" | "High";
  expectedValue: string;
  status: "Live" | "Upcoming" | "Published" | "Monitoring";
  explanation: string;
  source: "AI Prediction" | "FPF Intelligence";
};

export type SubscriberIntelligenceFeedItem = {
  id: string;
  type: "Market Movement" | "Odds Movement" | "Injury Alert" | "Line-up Confirmation" | "Weather Impact" | "Value Opportunity" | "System Announcement";
  title: string;
  description: string;
  severity: "Info" | "Watch" | "Important";
  timestamp: string;
};

export type SubscriberPerformanceSummary = {
  wins: number;
  losses: number;
  strikeRate: number;
  roi: number;
  weeklyProfit: number;
  monthlyProfit: number;
  chart: Array<{ label: string; value: number }>;
};

export type SubscriberReport = {
  id: string;
  title: string;
  category: "Daily Briefing" | "Weekly Report" | "Monthly Report" | "Market Trends" | "League Analysis";
  summary: string;
  publishedAt: string;
};

export type SubscriberNotification = {
  id: string;
  type: "New Opportunity" | "Line-up Change" | "Odds Movement" | "Subscription Update" | "System Announcement";
  title: string;
  message: string;
  createdAt: string;
};

export type SubscriberReferralSummary = {
  referralCode: string;
  referralLink: string;
  earningsCents: number;
  invitedSubscribers: number;
  rewards: string[];
};

export type SubscriberCommandCenter = {
  executiveOverview: {
    welcomeMessage: string;
    membershipTier: string;
    aiIntelligenceScore: number;
    subscriptionStatus: "Active" | "Trial" | "Expired";
    walletBalanceCents: number;
    performanceSummary: string;
  };
  opportunities: SubscriberOpportunity[];
  liveIntelligenceFeed: SubscriberIntelligenceFeedItem[];
  performance: SubscriberPerformanceSummary;
  reports: SubscriberReport[];
  notifications: SubscriberNotification[];
  referral: SubscriberReferralSummary;
};

export type DecisionRecommendationStatus = "APPROVED_CANDIDATE" | "NEEDS_REVIEW" | "REJECTED";

export type DecisionEngineScoreBreakdown = {
  teamFormScore: number;
  attackStrengthScore: number;
  defenceStrengthScore: number;
  homeAwayAdvantageScore: number;
  injuryImpactScore: number;
  oddsMovementScore: number;
  marketValueScore: number;
  liveMomentumScore: number;
  riskScore: number;
  confidenceScore: number;
  opportunityScore: number;
  valueScore: number;
  momentumScore: number;
  volatilityScore: number;
};

export type DecisionEngineOutput = {
  id: string;
  fixtureId: string;
  match: string;
  league: string;
  kickoffTime: string | null;
  recommendedMarket: string;
  predictedOutcome: string;
  status: DecisionRecommendationStatus;
  scores: DecisionEngineScoreBreakdown;
  reasoning: string[];
  warnings: string[];
  dataQualityStatus: PredictionDataQualityStatus;
  generatedAt: string;
};

export type PredictionLifecycleStatus =
  | "NEW"
  | "ANALYZING"
  | "PENDING_REVIEW"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHED"
  | "EXPIRED"
  | "ARCHIVED";

export type PredictionQueueItem = {
  id: string;
  fixtureId: string;
  match: string;
  league: string;
  kickoffTime: string | null;
  recommendedMarket: string;
  predictedOutcome: string;
  confidenceScore: number;
  riskScore: number;
  opportunityScore: number;
  valueScore: number;
  priority: number;
  status: PredictionLifecycleStatus;
  predictionType: string;
  explanation: string;
  reasoning: string[];
  warnings: string[];
  analystNotes: string | null;
  flags: string[];
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
};

export type PredictionQueueSummary = {
  pending: number;
  approved: number;
  rejected: number;
  published: number;
  draft: number;
  expired: number;
  archived: number;
};

export type PredictionWorkflowQueue = {
  items: PredictionQueueItem[];
  summary: PredictionQueueSummary;
};

export type PredictionWorkflowAction =
  | "APPROVE"
  | "REJECT"
  | "SAVE_DRAFT"
  | "REQUEST_REVIEW"
  | "FLAG_HIGH_RISK"
  | "FLAG_HIGH_OPPORTUNITY"
  | "MARK_FEATURED"
  | "PUBLISH"
  | "ARCHIVE"
  | "RESTORE";
