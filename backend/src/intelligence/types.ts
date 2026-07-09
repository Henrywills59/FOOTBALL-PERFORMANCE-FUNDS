import type {
  AuthUser,
  FootballFixtureDetail,
  FootballFixtureSummary,
  PredictionDataQualityStatus,
  SubscriberCommandCenter,
  SubscriberOpportunity,
} from "@fpf/shared";

export type DataProviderName =
  | "SportMonks"
  | "API-Football"
  | "Football Data"
  | "Odds API"
  | "Weather API"
  | "OpenAI";

export type ProviderStatus = {
  name: DataProviderName;
  configured: boolean;
  environmentVariable: string;
};

export type NormalizedTeam = {
  id: string;
  name: string;
  country: string | null;
  logoUrl: string | null;
};

export type NormalizedPlayer = {
  id: string;
  name: string;
  teamId: string | null;
  position: string | null;
  status: "ACTIVE" | "INJURED" | "UNKNOWN";
};

export type NormalizedCompetition = {
  id: string;
  name: string;
  country: string | null;
  season: number | null;
};

export type NormalizedStanding = {
  teamName: string;
  rank: number;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
};

export type NormalizedMatchStatistics = {
  fixtureId: string;
  possessionHome: number | null;
  possessionAway: number | null;
  shotsHome: number | null;
  shotsAway: number | null;
  dangerousAttacksHome: number | null;
  dangerousAttacksAway: number | null;
  xgHome: number | null;
  xgAway: number | null;
  source: "DATABASE" | "PLACEHOLDER";
};

export type NormalizedLineup = {
  fixtureId: string;
  teamName: string;
  confirmed: boolean;
  players: NormalizedPlayer[];
};

export type NormalizedInjury = {
  fixtureId: string | null;
  teamName: string;
  playerName: string;
  reason: string | null;
};

export type NormalizedReferee = {
  fixtureId: string;
  name: string | null;
};

export type NormalizedVenue = {
  fixtureId: string;
  name: string | null;
};

export type WeatherPlaceholder = {
  fixtureId: string;
  status: "UNAVAILABLE" | "PENDING_PROVIDER";
  summary: string;
};

export type OddsPlaceholder = {
  fixtureId: string;
  status: "UNAVAILABLE" | "AVAILABLE";
  markets: FootballFixtureDetail["odds"];
};

export type IntelligenceScores = {
  aiConfidence: number;
  opportunityScore: number;
  riskScore: number;
  valueScore: number;
  teamStrength: number;
  attackRating: number;
  defenceRating: number;
  formRating: number;
  momentumRating: number;
  volatilityRating: number;
  dataQualityStatus: PredictionDataQualityStatus;
};

export type MatchIntelligence = {
  fixture: FootballFixtureDetail | null;
  scores: IntelligenceScores;
  teamForm: string;
  headToHead: string;
  injuries: NormalizedInjury[];
  lineups: NormalizedLineup[];
  statistics: NormalizedMatchStatistics;
  referee: NormalizedReferee;
  venue: NormalizedVenue;
  weather: WeatherPlaceholder;
  odds: OddsPlaceholder;
  suggestedMarkets: SubscriberOpportunity[];
  explanation: string;
};

export type TeamProfile = {
  team: NormalizedTeam;
  fixtures: FootballFixtureSummary[];
  scores: Pick<IntelligenceScores, "teamStrength" | "attackRating" | "defenceRating" | "formRating">;
  dataQualityStatus: PredictionDataQualityStatus;
};

export type PlayerProfile = {
  player: NormalizedPlayer;
  injuries: NormalizedInjury[];
  dataQualityStatus: PredictionDataQualityStatus;
};

export type LeagueOverview = {
  competition: NormalizedCompetition;
  standings: NormalizedStanding[];
  fixtures: FootballFixtureSummary[];
  opportunityCount: number;
  dataQualityStatus: PredictionDataQualityStatus;
};

export type IntelligenceDashboard = SubscriberCommandCenter & {
  providerStatus: ProviderStatus[];
  generatedAt: string;
};

export type CacheStore = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  delete(key: string): Promise<void>;
};

export type IntelligenceRepository = {
  listFixtures(input: {
    live?: boolean;
    limit?: number;
    search?: string;
    league?: string;
    date?: string;
  }): Promise<FootballFixtureSummary[]>;
  getFixture(id: string): Promise<FootballFixtureDetail | null>;
  listApprovedOpportunities(fixtures: FootballFixtureSummary[]): Promise<SubscriberOpportunity[]>;
  listPublishedOpportunities(): Promise<SubscriberOpportunity[]>;
};

export type IntelligenceServiceInput = {
  user: AuthUser;
};
