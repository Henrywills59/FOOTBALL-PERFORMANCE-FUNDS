import type { UserGlobalPreferences } from "@fpf/shared";
import type { AdminService } from "../admin/adminService.js";
import { defaultCurrencies, defaultLanguages, defaultPreferences } from "./defaults.js";
import type { GlobalizationRepository } from "./repository.js";

export class GlobalizationService {
  constructor(
    private readonly repository: GlobalizationRepository,
    private readonly adminService: AdminService,
  ) {}

  languages() {
    return { languages: this.repository.languages() };
  }

  currencies() {
    return { currencies: this.repository.currencies(), baseCurrency: "USD", liveRatesConnected: false };
  }

  timezones() {
    return { timezones: this.repository.timezones() };
  }

  async preferences(userId: string) {
    return {
      preferences: await this.repository.preferences(userId),
      languages: this.repository.languages(),
      currencies: this.repository.currencies(),
      timezones: this.repository.timezones(),
      countrySettings: this.repository.countries(),
    };
  }

  updatePreferences(userId: string, preferences: Partial<UserGlobalPreferences>) {
    const allowedLanguage = defaultLanguages.some((language) => language.code === preferences.language && language.enabled);
    const allowedCurrency = defaultCurrencies.some((currency) => currency.code === preferences.currency && currency.enabled);
    return this.repository.updatePreferences(userId, {
      ...preferences,
      language: preferences.language && allowedLanguage ? preferences.language : undefined,
      currency: preferences.currency && allowedCurrency ? preferences.currency : undefined,
    });
  }

  async updateAdminGlobalSettings(
    actorUserId: string,
    input: {
      enabledLanguages?: string[];
      enabledCurrencies?: string[];
      defaultLanguage?: string;
      defaultCurrency?: string;
    },
  ) {
    const updated = await this.adminService.updateSettings(actorUserId, {
      enabledLanguages: input.enabledLanguages,
      enabledCurrencies: input.enabledCurrencies,
      defaultLanguage: input.defaultLanguage ?? defaultPreferences.language,
      defaultCurrency: input.defaultCurrency ?? defaultPreferences.currency,
    });
    return updated;
  }
}
