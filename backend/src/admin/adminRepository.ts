import { PrismaClient } from "@prisma/client";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { getPrismaClient } from "../database/prismaClient.js";
import { isPrismaRecoverableReadError, logOptionalDataFallback } from "../database/prismaErrors.js";
import type { AdminSettings, AdminUser } from "@fpf/shared";
import type { AdminRepository, AuditInput } from "./types.js";

const defaultSettings: AdminSettings = {
  predictionConfidenceThreshold: 60,
  riskThreshold: 70,
  maximumSelections: 5,
  scheduledSyncEnabled: false,
  maintenanceMode: false,
  enabledLanguages: ["en", "fr", "es", "pt", "de", "it", "ar", "zh"],
  enabledCurrencies: ["USD", "EUR", "GBP", "UGX", "KES", "TZS", "NGN", "ZAR", "CAD", "AUD"],
  defaultLanguage: "en",
  defaultCurrency: "USD",
};

const emptyReports = {
  subscribers: { total: 0, active: 0, disabled: 0 },
  investors: { total: 0, active: 0 },
  revenue: {
    trackedWalletDepositsCents: 0,
    note: "Tracked deposits are wallet funding records only; no new payment features are introduced here.",
  },
  withdrawals: {
    pendingCount: 0,
    approvedCount: 0,
    pendingAmountCents: 0,
    approvedAmountCents: 0,
  },
  analystPerformance: {
    submitted: 0,
    approved: 0,
    published: 0,
    rejected: 0,
  },
  predictionAccuracy: {
    approvedPredictions: 0,
    publishedIntelligence: 0,
    accuracyNote: "Accuracy is a production reporting placeholder until settled match result grading is enabled.",
  },
  dailyPlatformActivity: [] as Array<{ date: string; auditEvents: number; logins: number }>,
};

function userRow(user: {
  id: string;
  name: string;
  email: string;
  role: AdminUser["role"];
  status: AdminUser["status"];
  createdAt: Date;
}): AdminUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    subscriptionPlan: user.role === "SUBSCRIBER" ? "Subscriber Preview" : "Platform Access",
  };
}

export class PrismaAdminRepository implements AdminRepository {
  constructor(private readonly prismaClient?: PrismaClient) {}

  private get prisma() {
    return this.prismaClient ?? getPrismaClient();
  }

  async overview() {
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const safeCount = async (scope: string, count: () => Promise<number>) => {
      try {
        return await count();
      } catch (error) {
        if (!isPrismaRecoverableReadError(error)) throw error;
        logOptionalDataFallback(scope, error);
        return 0;
      }
    };
    const [totalUsers, activeSubscribers, activeInvestors, todaysFixtures, pendingPredictions, approvedPredictions] =
      await Promise.all([
        safeCount("admin.overview.totalUsers", () => this.prisma.user.count()),
        safeCount("admin.overview.activeSubscribers", () =>
          this.prisma.user.count({ where: { role: "SUBSCRIBER", status: "ACTIVE" } }),
        ),
        safeCount("admin.overview.activeInvestors", () =>
          this.prisma.user.count({ where: { role: "INVESTOR", status: "ACTIVE" } }),
        ),
        safeCount("admin.overview.todaysFixtures", () =>
          this.prisma.footballFixture.count({ where: { kickoffAt: { gte: start, lt: end } } }),
        ),
        safeCount("admin.overview.pendingPredictions", () =>
          this.prisma.matchPrediction.count({ where: { approvalStatus: "PENDING" } }),
        ),
        safeCount("admin.overview.approvedPredictions", () =>
          this.prisma.matchPrediction.count({ where: { approvalStatus: "APPROVED" } }),
        ),
      ]);
    return {
      totalUsers,
      activeSubscribers,
      activeInvestors,
      todaysFixtures,
      pendingPredictions,
      approvedPredictions,
      systemHealth: "OK" as const,
    };
  }

  async searchUsers(search?: string) {
    try {
      const users = await this.prisma.user.findMany({
        where: search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : undefined,
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      return users.map(userRow);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("admin.users", error);
      return [];
    }
  }

  async updateUserStatus(userId: string, status: "ACTIVE" | "DISABLED") {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { status } });
    return userRow(user);
  }

  async updateUserRole(userId: string, role: AdminUser["role"]) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { role } });
    return userRow(user);
  }

  async resetUserPassword(userId: string, passwordHash: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async settings() {
    let rows: Array<{ key: string; value: string }> = [];
    try {
      rows = await this.prisma.platformSetting.findMany();
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("admin.settings", error);
    }
    const settings = { ...defaultSettings };
    for (const row of rows) {
      if (row.key in settings) {
        const currentValue = (settings as Record<string, unknown>)[row.key];
        (settings as Record<string, unknown>)[row.key] = Array.isArray(currentValue)
          ? row.value.split(",").map((item) => item.trim()).filter(Boolean)
          : typeof currentValue === "string"
            ? row.value
            : row.value === "true"
              ? true
              : row.value === "false"
                ? false
                : Number(row.value);
      }
    }
    return settings;
  }

  async reports() {
    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - index));
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      return { date: start.toISOString().slice(0, 10), start, end };
    }).reverse();

    let results;
    try {
      results = await Promise.all([
        this.prisma.user.count({ where: { role: "SUBSCRIBER" } }),
        this.prisma.user.count({ where: { role: "SUBSCRIBER", status: "ACTIVE" } }),
        this.prisma.user.count({ where: { role: "SUBSCRIBER", status: "DISABLED" } }),
        this.prisma.user.count({ where: { role: "INVESTOR" } }),
        this.prisma.user.count({ where: { role: "INVESTOR", status: "ACTIVE" } }),
        this.prisma.walletTransaction.aggregate({
          where: { type: "DEPOSIT", status: "CONFIRMED" },
          _sum: { amountCents: true },
        }),
        this.prisma.walletTransaction.aggregate({
          where: { type: "WITHDRAWAL", status: "PENDING" },
          _count: true,
          _sum: { amountCents: true },
        }),
        this.prisma.walletTransaction.aggregate({
          where: { type: "WITHDRAWAL", status: "APPROVED" },
          _count: true,
          _sum: { amountCents: true },
        }),
        this.prisma.analystIntelligenceSubmission.count(),
        this.prisma.analystIntelligenceSubmission.count({ where: { status: { in: ["APPROVED", "PUBLISHED"] } } }),
        this.prisma.analystIntelligenceSubmission.count({ where: { status: "PUBLISHED" } }),
        this.prisma.analystIntelligenceSubmission.count({ where: { status: "REJECTED" } }),
        this.prisma.matchPrediction.count({ where: { approvalStatus: "APPROVED" } }),
        Promise.all(
          days.map(async (day) => ({
            date: day.date,
            auditEvents: await this.prisma.auditLog.count({ where: { createdAt: { gte: day.start, lt: day.end } } }),
            logins: await this.prisma.loginHistory.count({ where: { createdAt: { gte: day.start, lt: day.end } } }),
          })),
        ),
      ]);
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("admin.reports", error);
      return emptyReports;
    }

    const [
      totalSubscribers,
      activeSubscribers,
      disabledSubscribers,
      totalInvestors,
      activeInvestors,
      confirmedDeposits,
      pendingWithdrawals,
      approvedWithdrawals,
      submittedIntelligence,
      approvedIntelligence,
      publishedIntelligence,
      rejectedIntelligence,
      approvedPredictions,
      activity,
    ] = results;

    return {
      subscribers: { total: totalSubscribers, active: activeSubscribers, disabled: disabledSubscribers },
      investors: { total: totalInvestors, active: activeInvestors },
      revenue: {
        trackedWalletDepositsCents: confirmedDeposits._sum.amountCents ?? 0,
        note: "Tracked deposits are wallet funding records only; no new payment features are introduced here.",
      },
      withdrawals: {
        pendingCount: pendingWithdrawals._count,
        approvedCount: approvedWithdrawals._count,
        pendingAmountCents: pendingWithdrawals._sum.amountCents ?? 0,
        approvedAmountCents: approvedWithdrawals._sum.amountCents ?? 0,
      },
      analystPerformance: {
        submitted: submittedIntelligence,
        approved: approvedIntelligence,
        published: publishedIntelligence,
        rejected: rejectedIntelligence,
      },
      predictionAccuracy: {
        approvedPredictions,
        publishedIntelligence,
        accuracyNote: "Accuracy is a production reporting placeholder until settled match result grading is enabled.",
      },
      dailyPlatformActivity: activity,
    };
  }

  async updateSettings(input: Partial<AdminSettings>) {
    for (const [key, value] of Object.entries(input)) {
      await this.prisma.platformSetting.upsert({
        where: { key },
        update: { value: Array.isArray(value) ? value.join(",") : String(value) },
        create: { key, value: Array.isArray(value) ? value.join(",") : String(value) },
      });
    }
    return this.settings();
  }

  async audit(input: AuditInput) {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        details: input.details as InputJsonValue,
      },
    });
  }

  async auditLogs() {
    try {
      const logs = await this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
      return logs.map((log) => ({
        id: log.id,
        actorUserId: log.actorUserId,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        createdAt: log.createdAt.toISOString(),
      }));
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("admin.auditLogs", error);
      return [];
    }
  }

  async loginHistory() {
    try {
      const logs = await this.prisma.loginHistory.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
      return logs.map((log) => ({
        id: log.id,
        actorUserId: log.userId,
        action: log.success ? "LOGIN_SUCCESS" : "LOGIN_FAILED",
        entityType: "USER",
        entityId: log.userId,
        createdAt: log.createdAt.toISOString(),
      }));
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("admin.loginHistory", error);
      return [];
    }
  }

  async syncLogs() {
    try {
      const logs = await this.prisma.footballSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 50 });
      return logs.map((log) => ({
        id: log.id,
        actorUserId: null,
        action: `SYNC_${log.status}`,
        entityType: log.jobName,
        entityId: log.provider,
        createdAt: log.startedAt.toISOString(),
      }));
    } catch (error) {
      if (!isPrismaRecoverableReadError(error)) throw error;
      logOptionalDataFallback("admin.syncLogs", error);
      return [];
    }
  }
}
