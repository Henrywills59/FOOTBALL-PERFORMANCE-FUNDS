import { PrismaClient } from "@prisma/client";
import type { UserGlobalPreferences } from "@fpf/shared";
import { getPrismaClient } from "../database/prismaClient.js";
import {
  defaultCountrySettings,
  defaultCurrencies,
  defaultLanguages,
  defaultPreferences,
  defaultTimezones,
} from "./defaults.js";

export class GlobalizationRepository {
  constructor(private readonly prismaClient?: PrismaClient) {}

  private get prisma() {
    return this.prismaClient ?? getPrismaClient();
  }

  languages() {
    return defaultLanguages;
  }

  currencies() {
    return defaultCurrencies;
  }

  timezones() {
    return defaultTimezones;
  }

  countries() {
    return defaultCountrySettings;
  }

  async preferences(userId: string): Promise<UserGlobalPreferences> {
    try {
      const row = await this.prisma.userGlobalPreference.findUnique({ where: { userId } });
      if (!row) return defaultPreferences;
      return {
        language: row.language as UserGlobalPreferences["language"],
        currency: row.currency as UserGlobalPreferences["currency"],
        timezone: row.timezone,
        country: row.country,
        region: row.region,
        measurementSystem: row.measurementSystem as UserGlobalPreferences["measurementSystem"],
        dateFormat: row.dateFormat,
        numberFormat: row.numberFormat,
      };
    } catch (error) {
      console.warn("GLOBALIZATION_PREFERENCES_FALLBACK", {
        message: error instanceof Error ? error.message : "Unknown preferences failure",
      });
      return defaultPreferences;
    }
  }

  async updatePreferences(userId: string, preferences: Partial<UserGlobalPreferences>) {
    const next = { ...defaultPreferences, ...(await this.preferences(userId)), ...preferences };
    try {
      const row = await this.prisma.userGlobalPreference.upsert({
        where: { userId },
        update: next,
        create: { userId, ...next },
      });
      return {
        language: row.language as UserGlobalPreferences["language"],
        currency: row.currency as UserGlobalPreferences["currency"],
        timezone: row.timezone,
        country: row.country,
        region: row.region,
        measurementSystem: row.measurementSystem as UserGlobalPreferences["measurementSystem"],
        dateFormat: row.dateFormat,
        numberFormat: row.numberFormat,
      };
    } catch (error) {
      console.warn("GLOBALIZATION_UPDATE_FALLBACK", {
        message: error instanceof Error ? error.message : "Unknown preferences update failure",
      });
      return next;
    }
  }
}
