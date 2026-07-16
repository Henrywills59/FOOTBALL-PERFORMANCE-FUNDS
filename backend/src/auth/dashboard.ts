import type { DashboardRoute, UserRole } from "@fpf/shared";

const dashboardRoutes: Record<UserRole, DashboardRoute> = {
  SUBSCRIBER: {
    role: "SUBSCRIBER",
    path: "/dashboard/subscriber",
    title: "Subscriber Dashboard",
  },
  INVESTOR: {
    role: "INVESTOR",
    path: "/dashboard/investor",
    title: "Investor Dashboard",
  },
  ANALYST: {
    role: "ANALYST",
    path: "/dashboard/analyst",
    title: "Analyst Dashboard",
  },
  ADMIN: {
    role: "ADMIN",
    path: "/dashboard/admin",
    title: "Admin Dashboard",
  },
  CEO: {
    role: "CEO",
    path: "/dashboard/company-capital",
    title: "Company Capital Desk",
  },
  FINANCE: {
    role: "FINANCE",
    path: "/dashboard/company-capital",
    title: "Company Capital Desk",
  },
  RISK_MANAGER: {
    role: "RISK_MANAGER",
    path: "/dashboard/company-capital",
    title: "Company Capital Desk",
  },
  CAPITAL_MANAGER: {
    role: "CAPITAL_MANAGER",
    path: "/dashboard/company-capital",
    title: "Company Capital Desk",
  },
  SUPER_ADMINISTRATOR: {
    role: "SUPER_ADMINISTRATOR",
    path: "/dashboard/company-capital",
    title: "Company Capital Desk",
  },
};

export function getDashboardRoute(role: UserRole) {
  return dashboardRoutes[role];
}
