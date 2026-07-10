import type { CommercialStructure } from "@fpf/shared";

export const defaultCommercialStructure: CommercialStructure = {
  subscriberPlans: [
    {
      code: "STARTER",
      name: "Starter",
      monthlyPriceCents: 1900,
      yearlyPriceCents: 19000,
      highlighted: false,
      features: ["Basic AI predictions", "Limited daily opportunities", "Basic statistics", "Standard support"],
    },
    {
      code: "PRO",
      name: "Pro",
      monthlyPriceCents: 4900,
      yearlyPriceCents: 49000,
      highlighted: true,
      features: ["Full AI predictions", "Confidence scores", "Opportunity Centre", "Advanced statistics", "Notifications", "Priority support"],
    },
    {
      code: "ELITE",
      name: "Elite",
      monthlyPriceCents: 9900,
      yearlyPriceCents: 99000,
      highlighted: false,
      features: ["Everything in Pro", "Premium Intelligence", "Advanced analytics", "Executive reports", "Early feature access", "VIP support"],
    },
  ],
  investorLevels: [
    { name: "Bronze", minimumInvestmentCents: 10000, badgeColor: "amber" },
    { name: "Silver", minimumInvestmentCents: 100000, badgeColor: "slate" },
    { name: "Gold", minimumInvestmentCents: 500000, badgeColor: "yellow" },
    { name: "Platinum", minimumInvestmentCents: 1000000, badgeColor: "emerald" },
    { name: "Diamond", minimumInvestmentCents: 5000000, badgeColor: "cyan" },
  ],
  lockPeriods: [
    { code: "SIX_MONTHS", label: "6 Months", months: 6, enabled: true },
    { code: "TWELVE_MONTHS", label: "12 Months", months: 12, enabled: true },
  ],
  minimumInvestmentCents: 10000,
  simulatorDefaults: {
    weeklyReturnPercent: 1.25,
    platformFeePercent: 10,
  },
  notices: {
    paymentPlaceholder: "Payment processing is not connected yet. These plans are commercial placeholders only.",
    investmentRisk: "Capital is at risk. Historical or simulated performance is not a guarantee of future results.",
    simulationOnly: "Simulation only. Returns are not guaranteed and actual results depend on real platform performance.",
  },
};
