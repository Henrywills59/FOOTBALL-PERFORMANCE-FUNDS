import { defaultCommercialStructure } from "../commercial/defaults.js";
import { getPrismaClient, isDatabaseUrlConfigured } from "../database/prismaClient.js";
import { isPrismaRecoverableReadError } from "../database/prismaErrors.js";
import { safeNowPaymentsConfigStatus } from "../payments/config.js";
import type { HistoricalArchiveRecord } from "@fpf/shared";

type PublicStatus = "OPERATIONAL" | "PREPARING" | "DEGRADED" | "MAINTENANCE" | "PROVIDER_PENDING";

function isoNow() {
  return new Date().toISOString();
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

const historicalArchiveDisclosure =
  "Historical figures relate to FPF operations before automated digital tracking. Digital platform performance is recorded separately from the first settled production cycle.";

function fallbackHistoricalArchive(now = isoNow()): HistoricalArchiveRecord[] {
  return [
    {
      id: "baseline-operations-established",
      metricKey: "operations_established",
      label: "FPF football intelligence operations established",
      value: "2024",
      valueType: "YEAR",
      displayValue: "2024",
      reportingPeriod: "Pre-platform operating archive",
      archiveNotes: "Management-approved historical operating baseline.",
      evidenceReference: "Internal historical archive baseline",
      visible: true,
      reviewStatus: "APPROVED",
      lastReviewedAt: now,
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "baseline-community-reach",
      metricKey: "historical_community_reach",
      label: "Historical community reach",
      value: "20000",
      valueType: "COUNT",
      displayValue: "20,000+",
      reportingPeriod: "Pre-platform operating archive",
      archiveNotes: "Management-approved historical community reach baseline.",
      evidenceReference: "Internal historical archive baseline",
      visible: true,
      reviewStatus: "APPROVED",
      lastReviewedAt: now,
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "baseline-operating-win-rate",
      metricKey: "historical_operating_win_rate",
      label: "Historical operating win rate",
      value: "85",
      valueType: "PERCENT",
      displayValue: "85%",
      reportingPeriod: "Pre-platform operating archive",
      archiveNotes: "Historical operating record. Digital platform performance is tracked separately.",
      evidenceReference: "Internal historical archive baseline",
      visible: true,
      reviewStatus: "APPROVED",
      lastReviewedAt: now,
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "baseline-digital-verification",
      metricKey: "digital_platform_introduced",
      label: "Digital performance verification introduced",
      value: "2026",
      valueType: "YEAR",
      displayValue: "2026",
      reportingPeriod: "Digital platform launch",
      archiveNotes: "Automated digital tracking begins with production-settled cycles.",
      evidenceReference: "Internal platform launch record",
      visible: true,
      reviewStatus: "APPROVED",
      lastReviewedAt: now,
      updatedByUserId: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function historicalArchiveRow(row: {
  id: string;
  metricKey: string;
  label: string;
  value: string;
  valueType: string;
  displayValue: string;
  reportingPeriod: string | null;
  archiveNotes: string | null;
  evidenceReference: string | null;
  visible: boolean;
  reviewStatus: string;
  lastReviewedAt: Date | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): HistoricalArchiveRecord {
  return {
    id: row.id,
    metricKey: row.metricKey,
    label: row.label,
    value: row.value,
    valueType: ["YEAR", "COUNT", "PERCENT", "TEXT"].includes(row.valueType) ? row.valueType as HistoricalArchiveRecord["valueType"] : "TEXT",
    displayValue: row.displayValue,
    reportingPeriod: row.reportingPeriod,
    archiveNotes: row.archiveNotes,
    evidenceReference: row.evidenceReference,
    visible: row.visible,
    reviewStatus: ["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED"].includes(row.reviewStatus) ? row.reviewStatus as HistoricalArchiveRecord["reviewStatus"] : "DRAFT",
    lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
    updatedByUserId: row.updatedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function publicHistoricalArchive(prisma: ReturnType<typeof getPrismaClient> | null) {
  if (!prisma) return fallbackHistoricalArchive();
  try {
    const rows = await prisma.historicalArchiveRecord.findMany({
      where: {
        visible: true,
        reviewStatus: "APPROVED",
        evidenceReference: { not: null },
      },
      orderBy: { createdAt: "asc" },
    });
    return rows.length ? rows.map(historicalArchiveRow) : fallbackHistoricalArchive();
  } catch (error) {
    if (!isPrismaRecoverableReadError(error)) {
      console.warn("Public experience historical archive fallback", {
        message: error instanceof Error ? error.message : "Unknown archive read error",
      });
    }
    return fallbackHistoricalArchive();
  }
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
      intelligenceReviewsCompleted,
      reportsPending,
      leaguesCovered,
      lastFixtureRefresh,
      lastAuditEvent,
      historicalArchive,
    ] = await Promise.all([
      prisma ? safeCount("fixtures", () => prisma.footballFixture.count()) : 0,
      prisma ? safeCount("liveMatches", () => prisma.footballFixture.count({ where: { status: "LIVE" } })) : 0,
      prisma ? safeCount("approvedOpportunities", () => prisma.predictionQueue.count({ where: { status: "PUBLISHED" } })) : 0,
      prisma ? safeCount("pendingPredictions", () => prisma.predictionQueue.count({ where: { status: { in: ["NEW", "UNDER_REVIEW", "APPROVED"] } } })) : 0,
      prisma ? safeCount("intelligenceReviewsCompleted", () => prisma.analystIntelligenceSubmission.count({ where: { updatedAt: { gte: today }, status: { in: ["APPROVED", "PUBLISHED"] } } })) : 0,
      prisma ? safeCount("reportsPending", () => prisma.report.count({ where: { status: { in: ["DRAFT", "GENERATING"] } } })) : 0,
      prisma ? safeCount("leaguesCovered", () => prisma.footballLeague.count()) : 0,
      prisma ? safeDate("lastFixtureRefresh", async () => (await prisma.footballFixture.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }))?.updatedAt ?? null) : null,
      prisma ? safeDate("lastAuditEvent", async () => (await prisma.auditLog.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }))?.createdAt ?? null) : null,
      publicHistoricalArchive(prisma),
    ]);

    const providerConnected = fixturesMonitored > 0 || lastFixtureRefresh !== null;
    const platformStatus: PublicStatus = prisma ? "OPERATIONAL" : "DEGRADED";
    const paymentStatus: PublicStatus = payment.configured ? "OPERATIONAL" : "PROVIDER_PENDING";
    const footballStatus: PublicStatus = providerConnected ? "OPERATIONAL" : "PROVIDER_PENDING";

    return {
      generatedAt: isoNow(),
      historicalArchive: {
        operatingHistory: historicalArchive,
        disclosure: historicalArchiveDisclosure,
      },
      activity: {
        fixturesMonitored,
        liveMatches,
        analysisJobsCompletedToday: intelligenceReviewsCompleted,
        intelligenceReviewsCompleted,
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
        digitalSummary: {
          status: "Digital tracking active",
          totalSettledSelections: 0,
          digitalWins: 0,
          digitalLosses: 0,
          voidSelections: 0,
          digitalWinRate: null,
          latestVerifiedUpdate: null,
          message: "Awaiting first settled production cycle. No digitally verified result published yet.",
        },
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
        labels: ["Founding Subscriber", "Founding Performance Partner", "Charter Intelligence Cohort", "Early Access Member"],
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
