import { defaultCommercialStructure } from "../commercial/defaults.js";
import { getPrismaClient, isDatabaseUrlConfigured } from "../database/prismaClient.js";
import { isPrismaRecoverableReadError } from "../database/prismaErrors.js";
import { safeNowPaymentsConfigStatus } from "../payments/config.js";

type PublicStatus = "OPERATIONAL" | "PREPARING" | "DEGRADED" | "MAINTENANCE" | "PROVIDER_PENDING";

function isoNow() {
  return new Date().toISOString();
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

async function safeCount(label: string, count: () => Promise<number>) {
  try {
    return await count();
  } catch (error) {
    if (isPrismaRecoverableReadError(error)) return 0;
    console.warn("Public experience count fallback", {
      label,
      message: error instanceof Error ? error.message : "Unknown count error",
    });
    return 0;
  }
}

async function safeDate(label: string, query: () => Promise<Date | null>) {
  try {
    return await query();
  } catch (error) {
    if (isPrismaRecoverableReadError(error)) return null;
    console.warn("Public experience date fallback", {
      label,
      message: error instanceof Error ? error.message : "Unknown date error",
    });
    return null;
  }
}

export class PublicExperienceService {
  async overview() {
    const payment = safeNowPaymentsConfigStatus();
    const prisma = isDatabaseUrlConfigured() ? getPrismaClient() : null;
    const today = startOfToday();

    const [
      fixturesMonitored,
      liveMatches,
      approvedOpportunities,
      pendingPredictions,
      analystReviewsCompleted,
      reportsPending,
      leaguesCovered,
      lastFixtureRefresh,
      lastAuditEvent,
    ] = await Promise.all([
      prisma ? safeCount("fixtures", () => prisma.footballFixture.count()) : 0,
      prisma ? safeCount("liveMatches", () => prisma.footballFixture.count({ where: { status: "LIVE" } })) : 0,
      prisma ? safeCount("approvedOpportunities", () => prisma.predictionQueue.count({ where: { status: "PUBLISHED" } })) : 0,
      prisma ? safeCount("pendingPredictions", () => prisma.predictionQueue.count({ where: { status: { in: ["NEW", "UNDER_REVIEW", "APPROVED"] } } })) : 0,
      prisma ? safeCount("analystReviewsCompleted", () => prisma.analystIntelligenceSubmission.count({ where: { updatedAt: { gte: today }, status: { in: ["APPROVED", "PUBLISHED"] } } })) : 0,
      prisma ? safeCount("reportsPending", () => prisma.report.count({ where: { status: { in: ["DRAFT", "GENERATING"] } } })) : 0,
      prisma ? safeCount("leaguesCovered", () => prisma.footballLeague.count()) : 0,
      prisma ? safeDate("lastFixtureRefresh", async () => (await prisma.footballFixture.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }))?.updatedAt ?? null) : null,
      prisma ? safeDate("lastAuditEvent", async () => (await prisma.auditLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }))?.createdAt ?? null) : null,
    ]);

    const providerConnected = fixturesMonitored > 0 || lastFixtureRefresh !== null;
    const platformStatus: PublicStatus = prisma ? "OPERATIONAL" : "DEGRADED";
    const paymentStatus: PublicStatus = payment.configured ? "OPERATIONAL" : "PROVIDER_PENDING";
    const footballStatus: PublicStatus = providerConnected ? "OPERATIONAL" : "PROVIDER_PENDING";

    return {
      generatedAt: isoNow(),
      activity: {
        fixturesMonitored,
        liveMatches,
        analysisJobsCompletedToday: analystReviewsCompleted,
        analystReviewsCompleted,
        pendingApproval: pendingPredictions,
        reportsPending,
        leaguesCovered,
        approvedOpportunities,
        lastSuccessfulDataRefresh: lastFixtureRefresh?.toISOString() ?? null,
        platformStatus,
        safeState: fixturesMonitored > 0 ? "Intelligence desk online" : "Live coverage begins after provider activation",
      },
      intelligencePreview: {
        providerConnected,
        status: providerConnected ? "DATA_COLLECTION" : "PROVIDER_PENDING",
        message: providerConnected
          ? "Fixtures are being monitored through the Intelligence Core."
          : "Provider connection pending. Public fixture previews will appear after the next verified data cycle.",
        fixtures: [],
      },
      performance: {
        liveVerifiedResults: [],
        preLaunchModelTesting: {
          label: "PRE-LAUNCH MODEL TESTING",
          status: "Simulation only",
          methodology: "Backtesting and paper-trading methodology will be published separately from verified live results.",
          notice: "No real company capital is represented in this category. Future performance is not guaranteed.",
        },
        currentReportingPeriod: {
          status: "PREPARING",
          positionsSettled: 0,
          positionsPending: 0,
          reportingCompletion: 0,
          reconciliationStatus: "Awaiting the first completed verified reporting period.",
        },
      },
      trust: {
        websiteStatus: "OPERATIONAL" as PublicStatus,
        backendStatus: platformStatus,
        paymentProviderStatus: paymentStatus,
        footballDataStatus: footballStatus,
        notificationProviderStatus: "PREPARING" as PublicStatus,
        monitoringStatus: "OPERATIONAL" as PublicStatus,
        treasuryReconciliationStatus: "PREPARING" as PublicStatus,
        lastPlatformUpdate: lastAuditEvent?.toISOString() ?? isoNow(),
        latestCompletedReportingPeriod: null,
        riskManagementPolicy: "Suggested odds policy: minimum 1.60, maximum 2.00. Outcomes are never guaranteed.",
        responsibleParticipationPolicy: "FPF intelligence is informational and risk-managed. Users must participate responsibly.",
        privacySummary: "Private identities, treasury balances, API secrets, and internal selections are never displayed publicly.",
      },
      milestones: [
        { title: "Platform architecture completed", status: "VERIFIED", date: "2026-07-04" },
        { title: "Subscriber Portal deployed", status: "VERIFIED", date: "2026-07-05" },
        { title: "Investor Portal deployed", status: "VERIFIED", date: "2026-07-06" },
        { title: "Intelligence Core deployed", status: "VERIFIED", date: "2026-07-09" },
        { title: "Unified platform launched", status: "VERIFIED", date: "2026-07-09" },
        { title: "NOWPayments integration activated", status: payment.configured ? "VERIFIED" : "PREPARING", date: payment.configured ? "2026-07-10" : null },
        { title: "First verified intelligence cycle", status: "PREPARING", date: null },
      ],
      foundingMembers: {
        enabled: true,
        labels: ["Founding Subscriber", "Founding Investor", "Charter Analyst Cohort", "Early Access Member"],
        benefits: ["Early access pricing", "Priority onboarding", "Founding-member badge", "Launch briefing access"],
        seatLimit: null,
        message: "Founding access is open for early users while launch operations are prepared.",
      },
      commercial: {
        subscriberPlans: defaultCommercialStructure.subscriberPlans,
        investorPackages: defaultCommercialStructure.investorPackages,
        lockPeriods: defaultCommercialStructure.lockPeriods,
        minimumInvestmentCents: defaultCommercialStructure.minimumInvestmentCents,
        paymentConfigured: payment.configured,
      },
      contentControls: {
        adminManaged: true,
        editableAreas: ["Hero slides", "Homepage copy", "Trust Center", "FAQ", "Founding-member programme", "Public milestones", "Public status messages"],
      },
    };
  }
}
