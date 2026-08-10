export type MoneyOperationPurpose =
  | "SUBSCRIPTION"
  | "SUBSCRIPTION_RENEWAL"
  | "SUBSCRIPTION_UPGRADE"
  | "INVESTOR_FUNDING"
  | "WALLET_DEPOSIT"
  | "OTHER_ADMIN_APPROVED";

export type LaunchGovernanceGateStatus = {
  key: string;
  enabled: boolean;
};

export type LaunchGovernanceStatus = {
  moneyOperationsEnabled: boolean;
  gates: LaunchGovernanceGateStatus[];
  missingGates: string[];
  source?: "ENVIRONMENT_EMERGENCY" | "DATABASE_SEASON";
  seasonId?: string | null;
  emergencyKillSwitchEnabled?: boolean;
  capacity?: {
    limitCents: number | null;
    usedCents: number;
    remainingCents: number | null;
  };
};

export interface MoneyOperationGate {
  status(): LaunchGovernanceStatus;
  assertMoneyOperationAllowed(input: {
    userId: string;
    purpose: MoneyOperationPurpose;
    expectedAmountCents?: number;
  }): Promise<void> | void;
}

export class LaunchGovernanceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 423,
  ) {
    super(message);
  }
}

export const requiredMoneyOperationGates = [
  "FPF_SEASON_PUBLIC",
  "FPF_APPLICATIONS_OPEN",
  "FPF_DEPOSITS_ENABLED",
  "FPF_COMPLIANCE_APPROVED",
  "FPF_LEGAL_APPROVED",
  "FPF_PUBLIC_LAUNCH_APPROVED",
  "FPF_ACTIVE_PLAN_APPROVED",
  "FPF_TERMS_APPROVED",
] as const;

function envFlag(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export type PersistedLaunchGovernanceSeason = {
  id: string;
  isPublic: boolean;
  applicationsOpen: boolean;
  depositsEnabled: boolean;
  complianceApproved: boolean;
  legalApproved: boolean;
  publicLaunchApproved: boolean;
  activePlanApproved: boolean;
  investorTermsApproved: boolean;
  capacityLimitCents: number | null;
  capacityUsedCents: number;
};

export interface LaunchGovernanceRepository {
  getAuthoritativeSeason(): Promise<PersistedLaunchGovernanceSeason | null>;
}

const persistedGateMap: Array<[typeof requiredMoneyOperationGates[number], keyof PersistedLaunchGovernanceSeason]> = [
  ["FPF_SEASON_PUBLIC", "isPublic"],
  ["FPF_APPLICATIONS_OPEN", "applicationsOpen"],
  ["FPF_DEPOSITS_ENABLED", "depositsEnabled"],
  ["FPF_COMPLIANCE_APPROVED", "complianceApproved"],
  ["FPF_LEGAL_APPROVED", "legalApproved"],
  ["FPF_PUBLIC_LAUNCH_APPROVED", "publicLaunchApproved"],
  ["FPF_ACTIVE_PLAN_APPROVED", "activePlanApproved"],
  ["FPF_TERMS_APPROVED", "investorTermsApproved"],
];

function emergencyKillSwitchEnabled() {
  return envFlag("FPF_MONEY_OPERATIONS_KILL_SWITCH");
}

function statusFromSeason(season: PersistedLaunchGovernanceSeason): LaunchGovernanceStatus {
  const gates = persistedGateMap.map(([key, field]) => ({
    key,
    enabled: Boolean(season[field]),
  }));
  const missingGates = gates.filter((gate) => !gate.enabled).map((gate) => gate.key);
  const remainingCents = season.capacityLimitCents === null
    ? null
    : Math.max(0, season.capacityLimitCents - season.capacityUsedCents);

  return {
    source: "DATABASE_SEASON",
    seasonId: season.id,
    moneyOperationsEnabled: missingGates.length === 0 && !emergencyKillSwitchEnabled(),
    gates,
    missingGates,
    emergencyKillSwitchEnabled: emergencyKillSwitchEnabled(),
    capacity: {
      limitCents: season.capacityLimitCents,
      usedCents: season.capacityUsedCents,
      remainingCents,
    },
  };
}

export class PersistedLaunchGovernanceGate implements MoneyOperationGate {
  private lastStatus: LaunchGovernanceStatus = {
    source: "DATABASE_SEASON",
    seasonId: null,
    moneyOperationsEnabled: false,
    gates: requiredMoneyOperationGates.map((key) => ({ key, enabled: false })),
    missingGates: [...requiredMoneyOperationGates],
    emergencyKillSwitchEnabled: emergencyKillSwitchEnabled(),
  };

  constructor(private readonly repository: LaunchGovernanceRepository) {}

  status(): LaunchGovernanceStatus {
    return this.lastStatus;
  }

  async assertMoneyOperationAllowed(input: {
    userId: string;
    purpose: MoneyOperationPurpose;
    expectedAmountCents?: number;
  }) {
    if (emergencyKillSwitchEnabled()) {
      this.lastStatus = { ...this.lastStatus, emergencyKillSwitchEnabled: true, moneyOperationsEnabled: false };
      this.logBlocked(input, ["FPF_MONEY_OPERATIONS_KILL_SWITCH"]);
      throw new LaunchGovernanceError("Money operations are disabled by the deployment emergency kill switch.");
    }

    let season: PersistedLaunchGovernanceSeason | null;
    try {
      season = await this.repository.getAuthoritativeSeason();
    } catch (error) {
      this.lastStatus = {
        ...this.lastStatus,
        moneyOperationsEnabled: false,
        missingGates: ["DATABASE_GOVERNANCE_LOOKUP_FAILED"],
      };
      console.error("MONEY_OPERATION_GOVERNANCE_LOOKUP_FAILED", {
        userId: input.userId,
        purpose: input.purpose,
        message: error instanceof Error ? error.message : "Unknown governance lookup failure",
      });
      throw new LaunchGovernanceError("Money operations are not open. Launch governance could not be verified.", 503);
    }

    if (!season) {
      this.lastStatus = {
        ...this.lastStatus,
        seasonId: null,
        moneyOperationsEnabled: false,
        missingGates: ["FPF_ACTIVE_SEASON"],
      };
      this.logBlocked(input, this.lastStatus.missingGates);
      throw new LaunchGovernanceError("Money operations are not open. No authoritative season is configured.");
    }

    this.lastStatus = statusFromSeason(season);
    if (!this.lastStatus.moneyOperationsEnabled) {
      this.logBlocked(input, this.lastStatus.missingGates);
      throw new LaunchGovernanceError(
        "Money operations are not open. Required launch governance approvals are incomplete.",
      );
    }

    if (input.purpose === "INVESTOR_FUNDING" && season.capacityLimitCents !== null) {
      const requestedCents = input.expectedAmountCents ?? 0;
      const remainingCents = Math.max(0, season.capacityLimitCents - season.capacityUsedCents);
      if (requestedCents <= 0 || requestedCents > remainingCents) {
        this.logBlocked(input, ["FPF_SEASON_CAPACITY"]);
        throw new LaunchGovernanceError("Money operations are not open. Season participation capacity is unavailable.");
      }
    }
  }

  private logBlocked(input: { userId: string; purpose: MoneyOperationPurpose }, missingGates: string[]) {
    console.warn("MONEY_OPERATION_BLOCKED_BY_LAUNCH_GOVERNANCE", {
      userId: input.userId,
      purpose: input.purpose,
      missingGates,
    });
  }
}

export class EnvironmentMoneyOperationGate implements MoneyOperationGate {
  status(): LaunchGovernanceStatus {
    const gates = requiredMoneyOperationGates.map((key) => ({
      key,
      enabled: envFlag(key),
    }));
    const missingGates = gates.filter((gate) => !gate.enabled).map((gate) => gate.key);

    return {
      source: "ENVIRONMENT_EMERGENCY",
      moneyOperationsEnabled: missingGates.length === 0,
      gates,
      missingGates,
      emergencyKillSwitchEnabled: emergencyKillSwitchEnabled(),
    };
  }

  assertMoneyOperationAllowed(input: { userId: string; purpose: MoneyOperationPurpose }) {
    const status = this.status();
    if (status.moneyOperationsEnabled) return;

    console.warn("MONEY_OPERATION_BLOCKED_BY_LAUNCH_GOVERNANCE", {
      userId: input.userId,
      purpose: input.purpose,
      missingGates: status.missingGates,
    });

    throw new LaunchGovernanceError(
      "Money operations are not open. Required launch governance approvals are incomplete.",
    );
  }
}

export class OpenMoneyOperationGate implements MoneyOperationGate {
  status(): LaunchGovernanceStatus {
    const gates = requiredMoneyOperationGates.map((key) => ({ key, enabled: true }));
    return {
      source: "ENVIRONMENT_EMERGENCY",
      moneyOperationsEnabled: true,
      gates,
      missingGates: [],
      emergencyKillSwitchEnabled: false,
    };
  }

  assertMoneyOperationAllowed() {
    return undefined;
  }
}
