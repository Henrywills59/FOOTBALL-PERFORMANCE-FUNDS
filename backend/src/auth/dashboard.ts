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
};

export function getDashboardRoute(role: UserRole) {
  return dashboardRoutes[role];
}
