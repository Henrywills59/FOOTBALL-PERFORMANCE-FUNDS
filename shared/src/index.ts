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
