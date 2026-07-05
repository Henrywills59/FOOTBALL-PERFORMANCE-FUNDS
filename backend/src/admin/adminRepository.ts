import { Prisma, PrismaClient } from "@prisma/client";
import type { AdminSettings, AdminUser } from "@fpf/shared";
import type { AdminRepository, AuditInput } from "./types.js";

const defaultSettings: AdminSettings = {
  predictionConfidenceThreshold: 60,
  riskThreshold: 70,
  maximumSelections: 5,
  scheduledSyncEnabled: false,
  maintenanceMode: false,
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
  constructor(private readonly prisma = new PrismaClient()) {}

  async overview() {
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const [totalUsers, activeSubscribers, activeInvestors, todaysFixtures, pendingPredictions, approvedPredictions] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { role: "SUBSCRIBER", status: "ACTIVE" } }),
        this.prisma.user.count({ where: { role: "INVESTOR", status: "ACTIVE" } }),
        this.prisma.footballFixture.count({ where: { kickoffAt: { gte: start, lt: end } } }),
        this.prisma.matchPrediction.count({ where: { approvalStatus: "PENDING" } }),
        this.prisma.matchPrediction.count({ where: { approvalStatus: "APPROVED" } }),
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
    const rows = await this.prisma.platformSetting.findMany();
    const settings = { ...defaultSettings };
    for (const row of rows) {
      if (row.key in settings) {
        (settings as Record<string, unknown>)[row.key] =
          row.value === "true" ? true : row.value === "false" ? false : Number(row.value);
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
    ] = await Promise.all([
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
        update: { value: String(value) },
        create: { key, value: String(value) },
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
        details: input.details as Prisma.InputJsonValue,
      },
    });
  }

  async auditLogs() {
    const logs = await this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return logs.map((log) => ({
      id: log.id,
      actorUserId: log.actorUserId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  async loginHistory() {
    const logs = await this.prisma.loginHistory.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return logs.map((log) => ({
      id: log.id,
      actorUserId: log.userId,
      action: log.success ? "LOGIN_SUCCESS" : "LOGIN_FAILED",
      entityType: "USER",
      entityId: log.userId,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  async syncLogs() {
    const logs = await this.prisma.footballSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 50 });
    return logs.map((log) => ({
      id: log.id,
      actorUserId: null,
      action: `SYNC_${log.status}`,
      entityType: log.jobName,
      entityId: log.provider,
      createdAt: log.startedAt.toISOString(),
    }));
  }
}
