export type HealthStatus = {
  status: "ok";
  service: "football-performance-fund-api";
  version: string;
};

export const USER_ROLES = ["SUBSCRIBER", "INVESTOR", "ANALYST", "ADMIN"] as const;
export const PUBLIC_USER_ROLES = ["SUBSCRIBER", "INVESTOR", "ANALYST"] as const;

export type UserRole = (typeof USER_ROLES)[number];
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

export type DashboardRoute = {
  role: UserRole;
  path: string;
  title: string;
};

export type FootballFixtureStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED";

export type FootballFixtureSummary = {
  id: string;
  apiFootballFixtureId: number;
  leagueName: string;
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
    bookmaker: string;
    market: string;
    outcome: string;
    price: number;
  }>;
};

export type FootballSyncStatus = {
  jobsEnabled: boolean;
  jobsStarted: boolean;
  lastRunAt: string | null;
  lastRunStatus: "SUCCESS" | "FAILED" | "RUNNING" | null;
  nextRunHint: string;
};
