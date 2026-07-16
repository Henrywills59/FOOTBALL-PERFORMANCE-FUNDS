import bcrypt from "bcryptjs";
import { Router } from "express";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import type { AuthService } from "../auth/authService.js";
import { getPrismaClient } from "../database/prismaClient.js";

const previewPassword = "PreviewPass123!";
const previewUserPrefix = "preview.";

const previewUsers = [
  {
    id: "preview-super-admin-user",
    name: "FPF Preview Super Admin",
    email: "preview.superadmin@footballperformancefund.com",
    role: "ADMIN",
    portal: "Admin Command Center",
    notes: "Seeded as ADMIN because current admin routes authorize the ADMIN role.",
  },
  {
    id: "preview-treasury-officer-user",
    name: "FPF Preview Treasury Officer",
    email: "preview.treasury@footballperformancefund.com",
    role: "ADMIN",
    portal: "Treasury Dashboard",
    notes: "Seeded as ADMIN because current treasury routes authorize the ADMIN role.",
  },
  {
    id: "preview-football-analyst-user",
    name: "FPF Preview Football Analyst",
    email: "preview.analyst@footballperformancefund.com",
    role: "ANALYST",
    portal: "Analyst Command Centre",
    notes: null,
  },
  {
    id: "preview-investor-a-user",
    name: "FPF Preview Investor A",
    email: "preview.investor.a@footballperformancefund.com",
    role: "INVESTOR",
    portal: "Investor Portal",
    notes: null,
  },
  {
    id: "preview-investor-b-user",
    name: "FPF Preview Investor B",
    email: "preview.investor.b@footballperformancefund.com",
    role: "INVESTOR",
    portal: "Investor Portal",
    notes: null,
  },
  {
    id: "preview-subscriber-a-user",
    name: "FPF Preview Subscriber A",
    email: "preview.subscriber.a@footballperformancefund.com",
    role: "SUBSCRIBER",
    portal: "Subscriber Portal",
    notes: null,
  },
  {
    id: "preview-subscriber-b-user",
    name: "FPF Preview Subscriber B",
    email: "preview.subscriber.b@footballperformancefund.com",
    role: "SUBSCRIBER",
    portal: "Subscriber Portal",
    notes: null,
  },
  {
    id: "preview-support-agent-user",
    name: "FPF Preview Support Agent",
    email: "preview.support@footballperformancefund.com",
    role: "ADMIN",
    portal: "Support and User Operations",
    notes: "Seeded as ADMIN because a dedicated SUPPORT_AGENT role is not currently part of the deployed auth model.",
  },
] as const;

const treasuryAccounts = [
  ["preview-treasury-performance-partner-capital", "PERFORMANCE_PARTNER_CAPITAL", 3250000],
  ["preview-treasury-company-trading-capital", "COMPANY_TRADING_CAPITAL", 850000],
  ["preview-treasury-performance-partner-distributions", "PERFORMANCE_PARTNER_DISTRIBUTIONS", 110000],
  ["preview-treasury-analyst-performance-pool", "ANALYST_PERFORMANCE_POOL", 45000],
  ["preview-treasury-risk-stability-reserve", "RISK_STABILITY_RESERVE", 150000],
  ["preview-treasury-company-growth-operations", "COMPANY_GROWTH_OPERATIONS", 210000],
  ["preview-treasury-subscriber-revenue", "SUBSCRIBER_REVENUE", 9700],
] as const;

function isPreviewEnvironment() {
  return process.env.VERCEL_ENV === "preview" || process.env.FPF_ALLOW_PREVIEW_SEED === "true";
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function cents(amount: number) {
  return Math.round(amount * 100);
}

function isMissingTableError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2021"
  );
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

async function upsertNotification(prisma: any, input: {
  id: string;
  userId: string;
  category: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.notification.upsert({
    where: { id: input.id },
    update: {
      userId: input.userId,
      category: input.category,
      status: "UNREAD",
      title: input.title,
      message: input.message,
      metadata: { previewSeed: true, ...(input.metadata ?? {}) },
    },
    create: {
      id: input.id,
      userId: input.userId,
      category: input.category,
      status: "UNREAD",
      title: input.title,
      message: input.message,
      metadata: { previewSeed: true, ...(input.metadata ?? {}) },
    },
  });
}

async function seedPreviewOperationalData(actorUserId: string) {
  const prisma = getPrismaClient() as any;
  const passwordHash = await bcrypt.hash(previewPassword, 12);
  const now = new Date();
  const weekStart = daysFromNow(-7);
  const weekEnd = daysFromNow(-1);
  const optionalSeedResults: Array<{ dataset: string; status: "SEEDED" | "SKIPPED"; reason?: string }> = [];

  async function runOptionalSeed(dataset: string, action: () => Promise<void>) {
    try {
      await action();
      optionalSeedResults.push({ dataset, status: "SEEDED" });
    } catch (error) {
      if (!isMissingTableError(error)) {
        throw error;
      }

      const reason = safeErrorMessage(error).split("\n").find((line) => line.includes("does not exist")) ?? "Preview database table is not available.";
      console.warn("PREVIEW_SEED_OPTIONAL_DATASET_SKIPPED", { dataset, reason });
      optionalSeedResults.push({ dataset, status: "SKIPPED", reason });
    }
  }

  const users = [];
  for (const user of previewUsers) {
    users.push(
      await prisma.user.upsert({
        where: { email: user.email },
        update: {
          id: user.id,
          name: user.name,
          passwordHash,
          role: user.role,
          status: "ACTIVE",
        },
        create: {
          id: user.id,
          name: user.name,
          email: user.email,
          passwordHash,
          role: user.role,
          status: "ACTIVE",
        },
      }),
    );
  }

  await Promise.all(
    users.map((user) =>
      prisma.userGlobalPreference.upsert({
        where: { userId: user.id },
        update: {
          language: "en",
          currency: "USD",
          timezone: user.role === "ANALYST" ? "Europe/London" : "America/New_York",
          country: "US",
          region: "Preview",
          numberFormat: "en-US",
        },
        create: {
          userId: user.id,
          language: "en",
          currency: "USD",
          timezone: user.role === "ANALYST" ? "Europe/London" : "America/New_York",
          country: "US",
          region: "Preview",
          dateFormat: "MM/DD/YYYY",
          numberFormat: "en-US",
        },
      }),
    ),
  );

  await Promise.all(
    users.map((user) =>
      prisma.notificationPreference.upsert({
        where: { userId: user.id },
        update: {
          inAppEnabled: true,
          emailPlaceholderEnabled: true,
          financialEnabled: true,
          predictionEnabled: true,
          securityEnabled: true,
        },
        create: {
          userId: user.id,
          inAppEnabled: true,
          emailPlaceholderEnabled: true,
          financialEnabled: true,
          predictionEnabled: true,
          securityEnabled: true,
        },
      }),
    ),
  );

  await prisma.subscriptionPlan.upsert({
    where: { code: "PREMIUM" },
    update: {
      name: "Premium Preview",
      monthlyPriceCents: 4900,
      yearlyPriceCents: 49000,
      highlighted: true,
      active: true,
      features: ["AI intelligence", "Opportunity Center", "Priority notifications", "Preview testing"],
    },
    create: {
      code: "PREMIUM",
      name: "Premium Preview",
      monthlyPriceCents: 4900,
      yearlyPriceCents: 49000,
      highlighted: true,
      active: true,
      features: ["AI intelligence", "Opportunity Center", "Priority notifications", "Preview testing"],
    },
  });
  await prisma.subscriptionPlan.upsert({
    where: { code: "PRO" },
    update: {
      name: "Pro Preview",
      monthlyPriceCents: 4900,
      yearlyPriceCents: 49000,
      highlighted: true,
      active: true,
      features: ["Full AI predictions", "Confidence scores", "Opportunity Centre", "Advanced statistics"],
    },
    create: {
      code: "PRO",
      name: "Pro Preview",
      monthlyPriceCents: 4900,
      yearlyPriceCents: 49000,
      highlighted: true,
      active: true,
      features: ["Full AI predictions", "Confidence scores", "Opportunity Centre", "Advanced statistics"],
    },
  });
  await prisma.subscriptionPlan.upsert({
    where: { code: "STARTER" },
    update: {
      name: "Starter Preview",
      monthlyPriceCents: 1900,
      yearlyPriceCents: 19000,
      active: true,
      features: ["Basic AI predictions", "Limited daily opportunities", "Standard support"],
    },
    create: {
      code: "STARTER",
      name: "Starter Preview",
      monthlyPriceCents: 1900,
      yearlyPriceCents: 19000,
      active: true,
      features: ["Basic AI predictions", "Limited daily opportunities", "Standard support"],
    },
  });

  await prisma.subscriptionRecord.upsert({
    where: { id: "preview-subscription-a" },
    update: {
      userId: "preview-subscriber-a-user",
      planCode: "PREMIUM",
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      renewalDate: daysFromNow(28),
      receipts: [{ id: "preview-receipt-sub-a", amountCents: cents(49), provider: "NOWPAYMENTS", previewSeed: true }],
    },
    create: {
      id: "preview-subscription-a",
      userId: "preview-subscriber-a-user",
      planCode: "PREMIUM",
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      renewalDate: daysFromNow(28),
      receipts: [{ id: "preview-receipt-sub-a", amountCents: cents(49), provider: "NOWPAYMENTS", previewSeed: true }],
    },
  });
  await prisma.subscriptionRecord.upsert({
    where: { id: "preview-subscription-b" },
    update: {
      userId: "preview-subscriber-b-user",
      planCode: "PRO",
      status: "ACTIVE",
      billingCycle: "ANNUAL",
      renewalDate: daysFromNow(330),
      receipts: [{ id: "preview-receipt-sub-b", amountCents: cents(490), provider: "NOWPAYMENTS", previewSeed: true }],
    },
    create: {
      id: "preview-subscription-b",
      userId: "preview-subscriber-b-user",
      planCode: "PRO",
      status: "ACTIVE",
      billingCycle: "ANNUAL",
      renewalDate: daysFromNow(330),
      receipts: [{ id: "preview-receipt-sub-b", amountCents: cents(490), provider: "NOWPAYMENTS", previewSeed: true }],
    },
  });

  const investorInputs = [
    {
      userId: "preview-investor-a-user",
      accountId: "preview-investor-a-account",
      tier: "Platinum",
      capital: cents(25000),
      weekly: cents(875),
      total: cents(4200),
      pending: cents(875),
      paid: cents(3325),
      returnRate: 3.5,
    },
    {
      userId: "preview-investor-b-user",
      accountId: "preview-investor-b-account",
      tier: "Gold",
      capital: cents(7500),
      weekly: cents(225),
      total: cents(960),
      pending: cents(225),
      paid: cents(735),
      returnRate: 3.0,
    },
  ];

  for (const investor of investorInputs) {
    await prisma.investorAccount.upsert({
      where: { userId: investor.userId },
      update: {
        id: investor.accountId,
        tier: investor.tier,
        kycStatus: "APPROVED_PLACEHOLDER",
        agreementStatus: "SIGNED_PLACEHOLDER",
        paymentMethod: "NOWPayments preview checkout history",
        withdrawalMethod: "USDT payout wallet placeholder - admin approval required",
        startDate: daysFromNow(-45),
      },
      create: {
        id: investor.accountId,
        userId: investor.userId,
        tier: investor.tier,
        kycStatus: "APPROVED_PLACEHOLDER",
        agreementStatus: "SIGNED_PLACEHOLDER",
        paymentMethod: "NOWPayments preview checkout history",
        withdrawalMethod: "USDT payout wallet placeholder - admin approval required",
        startDate: daysFromNow(-45),
      },
    });
    await prisma.investorBalance.upsert({
      where: { investorAccountId: investor.accountId },
      update: {
        totalCapitalCents: investor.capital,
        activeInvestmentBalanceCents: investor.capital,
        weeklyEarningsCents: investor.weekly,
        totalEarningsCents: investor.total,
        pendingDistributionCents: investor.pending,
        paidDistributionCents: investor.paid,
      },
      create: {
        investorAccountId: investor.accountId,
        totalCapitalCents: investor.capital,
        activeInvestmentBalanceCents: investor.capital,
        weeklyEarningsCents: investor.weekly,
        totalEarningsCents: investor.total,
        pendingDistributionCents: investor.pending,
        paidDistributionCents: investor.paid,
      },
    });
    await prisma.investorWallet.upsert({
      where: { userId: investor.userId },
      update: {
        availableBalanceCents: investor.pending,
        pendingBalanceCents: 0,
        investmentBalanceCents: investor.capital,
        withdrawalBalanceCents: investor.paid,
      },
      create: {
        id: `${investor.accountId}-wallet`,
        userId: investor.userId,
        availableBalanceCents: investor.pending,
        pendingBalanceCents: 0,
        investmentBalanceCents: investor.capital,
        withdrawalBalanceCents: investor.paid,
      },
    });
    const wallet = await prisma.investorWallet.findUniqueOrThrow({ where: { userId: investor.userId } });
    await prisma.walletTransaction.upsert({
      where: { id: `${investor.accountId}-wallet-deposit` },
      update: {
        walletId: wallet.id,
        type: "DEPOSIT",
        status: "CONFIRMED",
        amountCents: investor.capital,
        currency: "USD",
        externalPaymentId: `${investor.accountId}-nowpayments-confirmed`,
        invoiceUrl: "https://preview.nowpayments.example/redacted",
        metadata: { previewSeed: true, network: "USDT_TRC20", payoutWalletReference: "USDT_TRC20_PREVIEW" },
      },
      create: {
        id: `${investor.accountId}-wallet-deposit`,
        walletId: wallet.id,
        type: "DEPOSIT",
        status: "CONFIRMED",
        amountCents: investor.capital,
        currency: "USD",
        externalPaymentId: `${investor.accountId}-nowpayments-confirmed`,
        invoiceUrl: "https://preview.nowpayments.example/redacted",
        metadata: { previewSeed: true, network: "USDT_TRC20", payoutWalletReference: "USDT_TRC20_PREVIEW" },
      },
    });
    await prisma.walletTransaction.upsert({
      where: { id: `${investor.accountId}-wallet-withdrawal` },
      update: {
        walletId: wallet.id,
        type: "WITHDRAWAL",
        status: "APPROVED",
        amountCents: investor.paid,
        currency: "USD",
        metadata: { previewSeed: true, network: "USDT_ERC20", payoutWalletReference: "USDT_ERC20_PREVIEW" },
      },
      create: {
        id: `${investor.accountId}-wallet-withdrawal`,
        walletId: wallet.id,
        type: "WITHDRAWAL",
        status: "APPROVED",
        amountCents: investor.paid,
        currency: "USD",
        metadata: { previewSeed: true, network: "USDT_ERC20", payoutWalletReference: "USDT_ERC20_PREVIEW" },
      },
    });
    await prisma.investorPortalReport.upsert({
      where: { id: `${investor.accountId}-weekly-report` },
      update: {
        investorAccountId: investor.accountId,
        periodType: "WEEKLY",
        title: `${investor.tier} preview weekly performance`,
        summary: "Preview report seeded for portal validation. Returns are historical placeholders only and not guaranteed.",
        earningsCents: investor.weekly,
        capitalCents: investor.capital,
        roiPercent: investor.returnRate,
      },
      create: {
        id: `${investor.accountId}-weekly-report`,
        investorAccountId: investor.accountId,
        periodType: "WEEKLY",
        title: `${investor.tier} preview weekly performance`,
        summary: "Preview report seeded for portal validation. Returns are historical placeholders only and not guaranteed.",
        earningsCents: investor.weekly,
        capitalCents: investor.capital,
        roiPercent: investor.returnRate,
      },
    });
    await prisma.investorAuditLog.upsert({
      where: { id: `${investor.accountId}-audit-seeded` },
      update: {
        investorAccountId: investor.accountId,
        actorUserId,
        action: "PREVIEW_INVESTOR_SEEDED",
        entityType: "InvestorAccount",
        entityId: investor.accountId,
        details: { previewSeed: true, tier: investor.tier, capitalCents: investor.capital },
      },
      create: {
        id: `${investor.accountId}-audit-seeded`,
        investorAccountId: investor.accountId,
        actorUserId,
        action: "PREVIEW_INVESTOR_SEEDED",
        entityType: "InvestorAccount",
        entityId: investor.accountId,
        details: { previewSeed: true, tier: investor.tier, capitalCents: investor.capital },
      },
    });
  }

  await prisma.investorDistributionBatch.upsert({
    where: { id: "preview-investor-distribution-batch" },
    update: {
      weekStart,
      weekEnd,
      status: "PENDING_APPROVAL",
      totalCapitalCents: cents(32500),
      totalGrossReturnCents: cents(1100),
      totalNetDistributionCents: cents(1045),
      investorCount: 2,
    },
    create: {
      id: "preview-investor-distribution-batch",
      weekStart,
      weekEnd,
      status: "PENDING_APPROVAL",
      totalCapitalCents: cents(32500),
      totalGrossReturnCents: cents(1100),
      totalNetDistributionCents: cents(1045),
      investorCount: 2,
    },
  });
  for (const investor of investorInputs) {
    await prisma.investorDistribution.upsert({
      where: { id: `${investor.accountId}-distribution-current` },
      update: {
        investorAccountId: investor.accountId,
        batchId: "preview-investor-distribution-batch",
        periodStart: weekStart,
        periodEnd: weekEnd,
        capitalBaseCents: investor.capital,
        returnRatePercent: investor.returnRate,
        grossReturnCents: investor.weekly,
        platformFeeCents: Math.round(investor.weekly * 0.05),
        netDistributionCents: investor.pending,
        status: "PENDING_APPROVAL",
        calculatedAt: now,
        adminNotes: "Preview distribution awaiting admin approval.",
      },
      create: {
        id: `${investor.accountId}-distribution-current`,
        investorAccountId: investor.accountId,
        batchId: "preview-investor-distribution-batch",
        periodStart: weekStart,
        periodEnd: weekEnd,
        capitalBaseCents: investor.capital,
        returnRatePercent: investor.returnRate,
        grossReturnCents: investor.weekly,
        platformFeeCents: Math.round(investor.weekly * 0.05),
        netDistributionCents: investor.pending,
        status: "PENDING_APPROVAL",
        calculatedAt: now,
        adminNotes: "Preview distribution awaiting admin approval.",
      },
    });
  }

  const league = await prisma.footballLeague.upsert({
    where: { apiFootballLeagueId: 990001 },
    update: { name: "FPF Preview Premier League", country: "England", season: 2026, logoUrl: null },
    create: { apiFootballLeagueId: 990001, name: "FPF Preview Premier League", country: "England", season: 2026, logoUrl: null },
  });
  const teams = await Promise.all(
    [
      [990101, "Northbridge FC", "England"],
      [990102, "Harbour Athletic", "England"],
      [990103, "Emerald City FC", "Portugal"],
      [990104, "Capital United", "Spain"],
    ].map(([apiFootballTeamId, name, country]) =>
      prisma.footballTeam.upsert({
        where: { apiFootballTeamId: Number(apiFootballTeamId) },
        update: { name: String(name), country: String(country), logoUrl: null },
        create: { apiFootballTeamId: Number(apiFootballTeamId), name: String(name), country: String(country), logoUrl: null },
      }),
    ),
  );
  const fixtureA = await prisma.footballFixture.upsert({
    where: { apiFootballFixtureId: 990201 },
    update: {
      leagueId: league.id,
      homeTeamId: teams[0].id,
      awayTeamId: teams[1].id,
      season: 2026,
      round: "Preview Round 12",
      kickoffAt: daysFromNow(1),
      status: "SCHEDULED",
      statusShort: "NS",
      venue: "FPF Preview Stadium",
      referee: "Preview Referee",
      raw: { previewSeed: true, source: "FPF Preview Seed" },
    },
    create: {
      apiFootballFixtureId: 990201,
      leagueId: league.id,
      homeTeamId: teams[0].id,
      awayTeamId: teams[1].id,
      season: 2026,
      round: "Preview Round 12",
      kickoffAt: daysFromNow(1),
      status: "SCHEDULED",
      statusShort: "NS",
      venue: "FPF Preview Stadium",
      referee: "Preview Referee",
      raw: { previewSeed: true, source: "FPF Preview Seed" },
    },
  });
  const fixtureB = await prisma.footballFixture.upsert({
    where: { apiFootballFixtureId: 990202 },
    update: {
      leagueId: league.id,
      homeTeamId: teams[2].id,
      awayTeamId: teams[3].id,
      season: 2026,
      round: "Preview Round 12",
      kickoffAt: daysFromNow(0),
      status: "LIVE",
      statusShort: "1H",
      elapsed: 34,
      homeScore: 1,
      awayScore: 0,
      venue: "Emerald Arena",
      raw: { previewSeed: true, liveSignals: ["momentum-home", "odds-shortening"] },
    },
    create: {
      apiFootballFixtureId: 990202,
      leagueId: league.id,
      homeTeamId: teams[2].id,
      awayTeamId: teams[3].id,
      season: 2026,
      round: "Preview Round 12",
      kickoffAt: daysFromNow(0),
      status: "LIVE",
      statusShort: "1H",
      elapsed: 34,
      homeScore: 1,
      awayScore: 0,
      venue: "Emerald Arena",
      raw: { previewSeed: true, liveSignals: ["momentum-home", "odds-shortening"] },
    },
  });

  for (const [index, team] of teams.entries()) {
    await prisma.leagueStanding.upsert({
      where: { leagueId_teamId_season: { leagueId: league.id, teamId: team.id, season: 2026 } },
      update: {
        rank: index + 1,
        points: 31 - index * 3,
        played: 14,
        won: 9 - index,
        drawn: 4,
        lost: 1 + index,
        goalsFor: 28 - index * 2,
        goalsAgainst: 12 + index * 2,
        raw: { previewSeed: true },
      },
      create: {
        leagueId: league.id,
        teamId: team.id,
        season: 2026,
        rank: index + 1,
        points: 31 - index * 3,
        played: 14,
        won: 9 - index,
        drawn: 4,
        lost: 1 + index,
        goalsFor: 28 - index * 2,
        goalsAgainst: 12 + index * 2,
        raw: { previewSeed: true },
      },
    });
    await prisma.teamStatistic.upsert({
      where: { leagueId_teamId_season: { leagueId: league.id, teamId: team.id, season: 2026 } },
      update: {
        raw: { previewSeed: true, form: ["W", "W", "D", "W", "L"].slice(index), attackRating: 78 - index * 4, defenceRating: 72 - index * 3 },
      },
      create: {
        leagueId: league.id,
        teamId: team.id,
        season: 2026,
        raw: { previewSeed: true, form: ["W", "W", "D", "W", "L"].slice(index), attackRating: 78 - index * 4, defenceRating: 72 - index * 3 },
      },
    });
  }

  await prisma.playerInjury.upsert({
    where: { id: "preview-injury-a" },
    update: { fixtureId: fixtureA.id, teamId: teams[1].id, playerName: "Preview Forward", reason: "Hamstring watchlist", raw: { previewSeed: true, status: "doubtful" } },
    create: { id: "preview-injury-a", fixtureId: fixtureA.id, teamId: teams[1].id, playerName: "Preview Forward", reason: "Hamstring watchlist", raw: { previewSeed: true, status: "doubtful" } },
  });
  await prisma.headToHeadRecord.upsert({
    where: { fixtureId: fixtureA.id },
    update: { raw: { previewSeed: true, lastFive: ["1-1", "2-0", "0-0", "3-1", "1-2"], trend: "Home side unbeaten in four of five." } },
    create: { fixtureId: fixtureA.id, raw: { previewSeed: true, lastFive: ["1-1", "2-0", "0-0", "3-1", "1-2"], trend: "Home side unbeaten in four of five." } },
  });

  const oddA = await prisma.matchOdd.upsert({
    where: { id: "preview-odd-a" },
    update: { fixtureId: fixtureA.id, fixtureApiId: 990201, bookmaker: "PreviewBook", market: "Match Winner", outcome: "Northbridge FC", price: 1.82, raw: { previewSeed: true, previousPrice: 1.91 } },
    create: { id: "preview-odd-a", fixtureId: fixtureA.id, fixtureApiId: 990201, bookmaker: "PreviewBook", market: "Match Winner", outcome: "Northbridge FC", price: 1.82, raw: { previewSeed: true, previousPrice: 1.91 } },
  });
  await prisma.matchOdd.upsert({
    where: { id: "preview-odd-b" },
    update: { fixtureId: fixtureB.id, fixtureApiId: 990202, bookmaker: "PreviewBook", market: "Over/Under", outcome: "Over 1.5 Goals", price: 1.67, raw: { previewSeed: true, movement: "shortening" } },
    create: { id: "preview-odd-b", fixtureId: fixtureB.id, fixtureApiId: 990202, bookmaker: "PreviewBook", market: "Over/Under", outcome: "Over 1.5 Goals", price: 1.67, raw: { previewSeed: true, movement: "shortening" } },
  });
  await prisma.matchPrediction.upsert({
    where: { id: "preview-approved-prediction-a" },
    update: {
      fixtureId: fixtureA.id,
      oddId: oddA.id,
      recommendedMarket: "Match Winner",
      predictedOutcome: "Northbridge FC",
      confidenceScore: 78,
      riskScore: 34,
      valueRating: "HIGH",
      explanation: "Strong home form, opponent defensive absences, and value edge against current market.",
      dataQualityStatus: "READY",
      approvalStatus: "APPROVED",
      edge: 0.08,
      impliedProbability: 0.55,
      modelProbability: 0.63,
    },
    create: {
      id: "preview-approved-prediction-a",
      fixtureId: fixtureA.id,
      oddId: oddA.id,
      recommendedMarket: "Match Winner",
      predictedOutcome: "Northbridge FC",
      confidenceScore: 78,
      riskScore: 34,
      valueRating: "HIGH",
      explanation: "Strong home form, opponent defensive absences, and value edge against current market.",
      dataQualityStatus: "READY",
      approvalStatus: "APPROVED",
      edge: 0.08,
      impliedProbability: 0.55,
      modelProbability: 0.63,
    },
  });

  await runOptionalSeed("prediction_queue", async () => {
    await prisma.predictionQueue.upsert({
      where: { id: "preview-prediction-queue-a" },
      update: {
        fixtureId: fixtureA.id,
        match: "Northbridge FC vs Harbour Athletic",
        league: league.name,
        kickoffTime: fixtureA.kickoffAt,
        recommendedMarket: "Match Winner",
        predictedOutcome: "Northbridge FC",
        confidenceScore: 78,
        riskScore: 34,
        opportunityScore: 82,
        valueScore: 74,
        priority: 1,
        status: "PUBLISHED",
        explanation: "Preview published candidate for dashboard and Opportunity Center testing.",
        reasoning: { previewSeed: true, reasons: ["Strong home form", "Opponent injury risk", "Positive value"] },
        warnings: { previewSeed: true, warnings: ["Simulation only", "No guaranteed returns"] },
        featured: true,
        publishedAt: now,
      },
      create: {
        id: "preview-prediction-queue-a",
        fixtureId: fixtureA.id,
        match: "Northbridge FC vs Harbour Athletic",
        league: league.name,
        kickoffTime: fixtureA.kickoffAt,
        recommendedMarket: "Match Winner",
        predictedOutcome: "Northbridge FC",
        confidenceScore: 78,
        riskScore: 34,
        opportunityScore: 82,
        valueScore: 74,
        priority: 1,
        status: "PUBLISHED",
        explanation: "Preview published candidate for dashboard and Opportunity Center testing.",
        reasoning: { previewSeed: true, reasons: ["Strong home form", "Opponent injury risk", "Positive value"] },
        warnings: { previewSeed: true, warnings: ["Simulation only", "No guaranteed returns"] },
        featured: true,
        publishedAt: now,
      },
    });
  });

  await runOptionalSeed("analyst_operational_data", async () => {
    await prisma.analystProfile.upsert({
      where: { userId: "preview-football-analyst-user" },
      update: {
        rank: "SENIOR_PREVIEW_ANALYST",
        status: "APPROVED",
        reliabilityIndex: 84,
        capitalAllocationCents: cents(2500),
        rewardBalanceCents: cents(450),
        currentForm: 79,
        drawdownPercent: 4.2,
        marketSpecialization: "Premier League value markets",
        adminNotes: "Preview analyst seeded for command centre validation.",
      },
      create: {
        userId: "preview-football-analyst-user",
        rank: "SENIOR_PREVIEW_ANALYST",
        status: "APPROVED",
        reliabilityIndex: 84,
        capitalAllocationCents: cents(2500),
        rewardBalanceCents: cents(450),
        currentForm: 79,
        drawdownPercent: 4.2,
        marketSpecialization: "Premier League value markets",
        adminNotes: "Preview analyst seeded for command centre validation.",
      },
    });
    await prisma.analystAssignment.upsert({
      where: { analystId_fixtureId: { analystId: "preview-football-analyst-user", fixtureId: fixtureA.id } },
      update: { leagueName: league.name, status: "ASSIGNED", adminNotes: "Preview assignment for match analysis testing." },
      create: { analystId: "preview-football-analyst-user", fixtureId: fixtureA.id, leagueName: league.name, status: "ASSIGNED", adminNotes: "Preview assignment for match analysis testing." },
    });
    await prisma.analystIntelligenceSubmission.upsert({
      where: { id: "preview-analyst-submission-a" },
      update: {
        analystId: "preview-football-analyst-user",
        fixtureId: fixtureA.id,
        leagueName: league.name,
        market: "Match Winner",
        prediction: "Northbridge FC",
        confidence: 78,
        riskLevel: "MEDIUM",
        detailedReasoning: "Home team pressing metrics and opponent absences support the candidate while market movement remains within policy.",
        supportingStatistics: "Home xG placeholder 1.84, away xGA placeholder 1.47, recent form W-W-D-W-L.",
        sourceNotes: "Preview seeded evidence only.",
        briefExplanation: "FPF intelligence favors the home side with moderate risk.",
        recommendedStake: "1.0 unit",
        status: "PUBLISHED",
        publishedAt: now,
      },
      create: {
        id: "preview-analyst-submission-a",
        analystId: "preview-football-analyst-user",
        fixtureId: fixtureA.id,
        leagueName: league.name,
        market: "Match Winner",
        prediction: "Northbridge FC",
        confidence: 78,
        riskLevel: "MEDIUM",
        detailedReasoning: "Home team pressing metrics and opponent absences support the candidate while market movement remains within policy.",
        supportingStatistics: "Home xG placeholder 1.84, away xGA placeholder 1.47, recent form W-W-D-W-L.",
        sourceNotes: "Preview seeded evidence only.",
        briefExplanation: "FPF intelligence favors the home side with moderate risk.",
        recommendedStake: "1.0 unit",
        status: "PUBLISHED",
        publishedAt: now,
      },
    });
  });

  await runOptionalSeed("treasury_operational_data", async () => {
    for (const [id, accountType, balanceCents] of treasuryAccounts) {
      await prisma.treasuryAccount.upsert({
        where: { id },
        update: {
          name: accountType.replace(/_/g, " "),
          accountType,
          balanceCents,
          currency: "USD",
          status: "ACTIVE",
          metadata: { previewSeed: true },
        },
        create: {
          id,
          name: accountType.replace(/_/g, " "),
          accountType,
          balanceCents,
          currency: "USD",
          status: "ACTIVE",
          metadata: { previewSeed: true },
        },
      });
      await prisma.treasuryLedger.upsert({
        where: { id: `${id}-ledger-entry` },
        update: {
          account: accountType,
          direction: "CREDIT",
          amountCents: balanceCents,
          classification: "PREVIEW_OPENING_BALANCE",
          referenceType: "PreviewSeed",
          referenceId: id,
          notes: "Preview opening balance generated for operational dashboard testing.",
          createdBy: actorUserId,
        },
        create: {
          id: `${id}-ledger-entry`,
          account: accountType,
          direction: "CREDIT",
          amountCents: balanceCents,
          classification: "PREVIEW_OPENING_BALANCE",
          referenceType: "PreviewSeed",
          referenceId: id,
          notes: "Preview opening balance generated for operational dashboard testing.",
          createdBy: actorUserId,
        },
      });
    }
  });

  await runOptionalSeed("capital_allocation_extensions", async () => {
    await prisma.capitalAllocationExtension.upsert({
      where: { id: "preview-capital-allocation-a" },
      update: {
        fixture: "Northbridge FC vs Harbour Athletic",
        market: "Match Winner",
        selection: "Northbridge FC",
        analystIds: ["preview-football-analyst-user"],
        recommendedStakeCents: cents(500),
        maximumAllowedStakeCents: cents(750),
        dailyAllocationCents: cents(5000),
        weeklyAllocationCents: cents(15000),
        matchAllocationCents: cents(750),
        marketAllocationCents: cents(2500),
        riskGrade: "MEDIUM",
        expectedReturnCents: cents(910),
        approvalStatus: "APPROVED",
        allocatedBy: actorUserId,
        controls: { previewSeed: true, oddsPolicy: "1.60-2.00" },
      },
      create: {
        id: "preview-capital-allocation-a",
        fixture: "Northbridge FC vs Harbour Athletic",
        market: "Match Winner",
        selection: "Northbridge FC",
        analystIds: ["preview-football-analyst-user"],
        recommendedStakeCents: cents(500),
        maximumAllowedStakeCents: cents(750),
        dailyAllocationCents: cents(5000),
        weeklyAllocationCents: cents(15000),
        matchAllocationCents: cents(750),
        marketAllocationCents: cents(2500),
        riskGrade: "MEDIUM",
        expectedReturnCents: cents(910),
        approvalStatus: "APPROVED",
        allocatedBy: actorUserId,
        controls: { previewSeed: true, oddsPolicy: "1.60-2.00" },
      },
    });
  });

  const paymentOrders = [
    { id: "preview-payment-sub-a", userId: "preview-subscriber-a-user", purpose: "SUBSCRIPTION", amount: cents(49), payCurrency: "USDTTRC20", planCode: "PREMIUM" },
    { id: "preview-payment-sub-b", userId: "preview-subscriber-b-user", purpose: "SUBSCRIPTION", amount: cents(490), payCurrency: "USDTERC20", planCode: "PRO" },
    { id: "preview-payment-investor-a", userId: "preview-investor-a-user", purpose: "INVESTOR_FUNDING", amount: cents(25000), payCurrency: "USDTTRC20", planCode: null },
    { id: "preview-payment-investor-b", userId: "preview-investor-b-user", purpose: "INVESTOR_FUNDING", amount: cents(7500), payCurrency: "USDTERC20", planCode: null },
  ];
  for (const order of paymentOrders) {
    await prisma.paymentOrder.upsert({
      where: { id: order.id },
      update: {
        userId: order.userId,
        purpose: order.purpose,
        status: "FINISHED",
        provider: "NOWPAYMENTS",
        providerPaymentId: `${order.id}-provider`,
        providerInvoiceId: `${order.id}-invoice`,
        planCode: order.planCode,
        expectedAmountCents: order.amount,
        receivedAmountCents: order.amount,
        priceCurrency: "USD",
        payCurrency: order.payCurrency,
        paymentAddress: "preview-redacted-address",
        checkoutUrl: "https://nowpayments.io/payment/?preview=redacted",
        confirmedAt: now,
        reconciliationStatus: "MATCHED",
        metadata: {
          previewSeed: true,
          network: order.payCurrency === "USDTTRC20" ? "USDT_TRC20" : "USDT_ERC20",
          payoutWalletReference: order.payCurrency === "USDTTRC20" ? "USDT_TRC20_PREVIEW" : "USDT_ERC20_PREVIEW",
          transactionHash: `${order.id}-tx-hash-redacted`,
        },
      },
      create: {
        id: order.id,
        userId: order.userId,
        purpose: order.purpose,
        status: "FINISHED",
        provider: "NOWPAYMENTS",
        providerPaymentId: `${order.id}-provider`,
        providerInvoiceId: `${order.id}-invoice`,
        planCode: order.planCode,
        expectedAmountCents: order.amount,
        receivedAmountCents: order.amount,
        priceCurrency: "USD",
        payCurrency: order.payCurrency,
        paymentAddress: "preview-redacted-address",
        checkoutUrl: "https://nowpayments.io/payment/?preview=redacted",
        confirmedAt: now,
        reconciliationStatus: "MATCHED",
        metadata: {
          previewSeed: true,
          network: order.payCurrency === "USDTTRC20" ? "USDT_TRC20" : "USDT_ERC20",
          payoutWalletReference: order.payCurrency === "USDTTRC20" ? "USDT_TRC20_PREVIEW" : "USDT_ERC20_PREVIEW",
          transactionHash: `${order.id}-tx-hash-redacted`,
        },
      },
    });
    await prisma.paymentTransaction.upsert({
      where: { id: `${order.id}-transaction` },
      update: {
        orderId: order.id,
        providerPaymentId: `${order.id}-provider`,
        status: "FINISHED",
        expectedAmountCents: order.amount,
        receivedAmountCents: order.amount,
        priceCurrency: "USD",
        payCurrency: order.payCurrency,
        providerFeeCents: Math.round(order.amount * 0.01),
        providerPayload: { previewSeed: true, provider: "NOWPAYMENTS", secretsExposed: false },
      },
      create: {
        id: `${order.id}-transaction`,
        orderId: order.id,
        providerPaymentId: `${order.id}-provider`,
        status: "FINISHED",
        expectedAmountCents: order.amount,
        receivedAmountCents: order.amount,
        priceCurrency: "USD",
        payCurrency: order.payCurrency,
        providerFeeCents: Math.round(order.amount * 0.01),
        providerPayload: { previewSeed: true, provider: "NOWPAYMENTS", secretsExposed: false },
      },
    });
    await prisma.paymentStatusHistory.upsert({
      where: { id: `${order.id}-history-finished` },
      update: {
        orderId: order.id,
        previousStatus: "CONFIRMED",
        newStatus: "FINISHED",
        reason: "Preview seed confirmed payment history.",
        source: "PREVIEW_SEED",
      },
      create: {
        id: `${order.id}-history-finished`,
        orderId: order.id,
        previousStatus: "CONFIRMED",
        newStatus: "FINISHED",
        reason: "Preview seed confirmed payment history.",
        source: "PREVIEW_SEED",
      },
    });
    await prisma.paymentReconciliation.upsert({
      where: { orderId: order.id },
      update: {
        status: "MATCHED",
        expectedAmountCents: order.amount,
        receivedAmountCents: order.amount,
        differenceCents: 0,
        expectedCurrency: "USD",
        receivedCurrency: "USD",
        notes: "Preview reconciliation matched.",
      },
      create: {
        orderId: order.id,
        status: "MATCHED",
        expectedAmountCents: order.amount,
        receivedAmountCents: order.amount,
        differenceCents: 0,
        expectedCurrency: "USD",
        receivedCurrency: "USD",
        notes: "Preview reconciliation matched.",
      },
    });
    await prisma.paymentWebhookReceipt.upsert({
      where: { eventKey: `${order.id}-webhook-finished` },
      update: {
        provider: "NOWPAYMENTS",
        providerPaymentId: `${order.id}-provider`,
        orderId: order.id,
        signatureValid: true,
        processingStatus: "PROCESSED",
        payloadHash: `${order.id}-payload-hash-redacted`,
        payload: { previewSeed: true, payment_status: "finished", payment_id: `${order.id}-provider` },
        processedAt: now,
      },
      create: {
        id: `${order.id}-webhook-receipt`,
        provider: "NOWPAYMENTS",
        providerPaymentId: `${order.id}-provider`,
        orderId: order.id,
        eventKey: `${order.id}-webhook-finished`,
        signatureValid: true,
        processingStatus: "PROCESSED",
        payloadHash: `${order.id}-payload-hash-redacted`,
        payload: { previewSeed: true, payment_status: "finished", payment_id: `${order.id}-provider` },
        processedAt: now,
      },
    });
  }

  for (const user of users) {
    await upsertNotification(prisma, {
      id: `${user.id}-notification-welcome`,
      userId: user.id,
      category: "SYSTEM",
      title: "Preview account ready",
      message: "Your FPF Preview account has been seeded for end-to-end portal testing.",
      metadata: { role: user.role },
    });
  }
  await upsertNotification(prisma, {
    id: "preview-subscriber-a-notification-opportunity",
    userId: "preview-subscriber-a-user",
    category: "PREDICTION",
    title: "New FPF Intelligence published",
    message: "Northbridge FC opportunity is now available in the Opportunity Center.",
  });
  await upsertNotification(prisma, {
    id: "preview-investor-a-notification-distribution",
    userId: "preview-investor-a-user",
    category: "FINANCIAL",
    title: "Weekly distribution calculated",
    message: "Your Preview weekly distribution is pending admin approval.",
  });

  await prisma.auditLog.upsert({
    where: { id: "preview-operational-seed-audit" },
    update: {
      actorUserId,
      action: "PREVIEW_OPERATIONAL_DATA_SEEDED",
      entityType: "PreviewSeed",
      entityId: "preview-operational-data",
      details: {
        previewSeed: true,
        users: previewUsers.length,
        investors: 2,
        subscribers: 2,
        fixtures: 2,
        payments: paymentOrders.length,
        treasuryAccounts: treasuryAccounts.length,
      },
    },
    create: {
      id: "preview-operational-seed-audit",
      actorUserId,
      action: "PREVIEW_OPERATIONAL_DATA_SEEDED",
      entityType: "PreviewSeed",
      entityId: "preview-operational-data",
      details: {
        previewSeed: true,
        users: previewUsers.length,
        investors: 2,
        subscribers: 2,
        fixtures: 2,
        payments: paymentOrders.length,
        treasuryAccounts: treasuryAccounts.length,
      },
    },
  });

  return {
    status: "ok",
    environment: "preview",
    credentials: {
      password: previewPassword,
      note: "Preview-only test password. Do not use in Production.",
    },
    accounts: previewUsers.map(({ email, name, role, portal, notes }) => ({ email, name, role, portal, notes })),
    seeded: {
      users: previewUsers.length,
      investorAccounts: 2,
      subscriberSubscriptions: 2,
      paymentOrders: paymentOrders.length,
      treasuryAccounts: treasuryAccounts.length,
      treasuryLedgerEntries: treasuryAccounts.length,
      footballFixtures: 2,
      odds: 2,
      approvedPredictions: 1,
      analystAssignments: 1,
      analystSubmissions: 1,
      notifications: users.length + 2,
      auditLogs: 1,
      optionalDatasets: optionalSeedResults,
      schemaDriftSkipped: optionalSeedResults.filter((result) => result.status === "SKIPPED"),
    },
    safety: {
      productionModified: false,
      walletAddressesExposed: false,
      secretsExposed: false,
      idempotent: true,
      emailDomainPrefix: previewUserPrefix,
    },
  };
}

export function createPreviewSeedRouter(input: {
  authService: AuthService;
  seed?: (actorUserId: string) => Promise<unknown>;
}) {
  const router = Router();
  const adminOnly = [requireAuth(input.authService), requireRole(["ADMIN"])];
  const runSeed = input.seed ?? seedPreviewOperationalData;

  router.post("/preview/seed-operational-data", ...adminOnly, async (request, response, next) => {
    try {
      if (!isPreviewEnvironment()) {
        response.status(404).json({ error: "Preview seed endpoint is only available in Preview." });
        return;
      }

      response.status(201).json(await runSeed(request.user!.id));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
