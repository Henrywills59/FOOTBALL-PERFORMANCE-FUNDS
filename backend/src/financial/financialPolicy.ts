import type { FinancialAllocationType } from "./types.js";

export const financialAllocationPolicy: Array<{
  allocationType: FinancialAllocationType;
  label: string;
  percent: number;
  distributable: boolean;
}> = [
  {
    allocationType: "PERFORMANCE_PARTNER_POOL",
    label: "Performance Partner Pool",
    percent: 35,
    distributable: true,
  },
  {
    allocationType: "ANALYST_PERFORMANCE_POOL",
    label: "Analyst Performance Pool",
    percent: 15,
    distributable: true,
  },
  {
    allocationType: "RISK_STABILITY_RESERVE",
    label: "Risk & Stability Reserve",
    percent: 15,
    distributable: false,
  },
  {
    allocationType: "COMPANY_GROWTH_OPERATIONS_FUND",
    label: "Company Growth & Operations Fund",
    percent: 35,
    distributable: false,
  },
];

export function allocationPolicyTotal() {
  return financialAllocationPolicy.reduce((total, item) => total + item.percent, 0);
}
