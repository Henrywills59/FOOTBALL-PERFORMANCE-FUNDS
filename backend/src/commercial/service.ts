import type { AdminSettings, CommercialStructure } from "@fpf/shared";
import type { AdminService } from "../admin/adminService.js";
import { defaultCommercialStructure } from "./defaults.js";

export class CommercialService {
  constructor(private readonly adminService: AdminService) {}

  async structure(): Promise<CommercialStructure> {
    const settings = await this.adminService.settings();
    return {
      ...defaultCommercialStructure,
      minimumInvestmentCents: settings.minimumInvestmentCents ?? defaultCommercialStructure.minimumInvestmentCents,
      lockPeriods: defaultCommercialStructure.lockPeriods.map((period) => ({
        ...period,
        enabled: settings.enabledLockPeriods?.length ? settings.enabledLockPeriods.includes(period.code) : period.enabled,
      })),
      simulatorDefaults: {
        weeklyReturnPercent:
          settings.defaultSimulationWeeklyReturnPercent ?? defaultCommercialStructure.simulatorDefaults.weeklyReturnPercent,
        platformFeePercent: settings.defaultPlatformFeePercent ?? defaultCommercialStructure.simulatorDefaults.platformFeePercent,
      },
    };
  }

  async updateSettings(actorUserId: string, input: Partial<AdminSettings>) {
    return this.adminService.updateSettings(actorUserId, {
      minimumInvestmentCents: input.minimumInvestmentCents,
      enabledLockPeriods: input.enabledLockPeriods,
      defaultSimulationWeeklyReturnPercent: input.defaultSimulationWeeklyReturnPercent,
      defaultPlatformFeePercent: input.defaultPlatformFeePercent,
    });
  }
}
