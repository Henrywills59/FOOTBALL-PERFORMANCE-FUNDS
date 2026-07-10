import type {
  CountrySetting,
  CurrencySetting,
  LanguageSetting,
  TimezoneSetting,
  UserGlobalPreferences,
} from "@fpf/shared";

export const defaultLanguages: LanguageSetting[] = [
  { code: "en", name: "English", nativeName: "English", direction: "ltr", enabled: true },
  { code: "fr", name: "French", nativeName: "Français", direction: "ltr", enabled: true },
  { code: "es", name: "Spanish", nativeName: "Español", direction: "ltr", enabled: true },
  { code: "pt", name: "Portuguese", nativeName: "Português", direction: "ltr", enabled: true },
  { code: "de", name: "German", nativeName: "Deutsch", direction: "ltr", enabled: true },
  { code: "it", name: "Italian", nativeName: "Italiano", direction: "ltr", enabled: true },
  { code: "ar", name: "Arabic", nativeName: "العربية", direction: "rtl", enabled: true },
  { code: "zh", name: "Chinese", nativeName: "中文", direction: "ltr", enabled: true },
];

export const defaultCurrencies: CurrencySetting[] = [
  { code: "USD", name: "US Dollar", symbol: "$", placeholderRateFromUsd: 1, enabled: true },
  { code: "EUR", name: "Euro", symbol: "€", placeholderRateFromUsd: 0.92, enabled: true },
  { code: "GBP", name: "British Pound", symbol: "£", placeholderRateFromUsd: 0.79, enabled: true },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh", placeholderRateFromUsd: 3700, enabled: true },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", placeholderRateFromUsd: 130, enabled: true },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh", placeholderRateFromUsd: 2600, enabled: true },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", placeholderRateFromUsd: 1500, enabled: true },
  { code: "ZAR", name: "South African Rand", symbol: "R", placeholderRateFromUsd: 18.2, enabled: true },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", placeholderRateFromUsd: 1.36, enabled: true },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", placeholderRateFromUsd: 1.52, enabled: true },
];

export const defaultTimezones: TimezoneSetting[] = [
  { id: "UTC", label: "UTC", offset: "+00:00", enabled: true },
  { id: "America/New_York", label: "New York", offset: "-04:00", enabled: true },
  { id: "Europe/London", label: "London", offset: "+01:00", enabled: true },
  { id: "Europe/Paris", label: "Paris", offset: "+02:00", enabled: true },
  { id: "Africa/Kampala", label: "Kampala", offset: "+03:00", enabled: true },
  { id: "Africa/Nairobi", label: "Nairobi", offset: "+03:00", enabled: true },
  { id: "Africa/Lagos", label: "Lagos", offset: "+01:00", enabled: true },
  { id: "Asia/Dubai", label: "Dubai", offset: "+04:00", enabled: true },
  { id: "Asia/Shanghai", label: "Shanghai", offset: "+08:00", enabled: true },
];

export const defaultCountrySettings: CountrySetting[] = [
  { countryCode: "US", countryName: "United States", region: "North America", defaultLanguage: "en", defaultCurrency: "USD", defaultTimezone: "America/New_York", measurementSystem: "imperial", dateFormat: "MM/DD/YYYY", numberFormat: "en-US" },
  { countryCode: "GB", countryName: "United Kingdom", region: "Europe", defaultLanguage: "en", defaultCurrency: "GBP", defaultTimezone: "Europe/London", measurementSystem: "metric", dateFormat: "DD/MM/YYYY", numberFormat: "en-GB" },
  { countryCode: "UG", countryName: "Uganda", region: "Africa", defaultLanguage: "en", defaultCurrency: "UGX", defaultTimezone: "Africa/Kampala", measurementSystem: "metric", dateFormat: "DD/MM/YYYY", numberFormat: "en-UG" },
  { countryCode: "KE", countryName: "Kenya", region: "Africa", defaultLanguage: "en", defaultCurrency: "KES", defaultTimezone: "Africa/Nairobi", measurementSystem: "metric", dateFormat: "DD/MM/YYYY", numberFormat: "en-KE" },
  { countryCode: "NG", countryName: "Nigeria", region: "Africa", defaultLanguage: "en", defaultCurrency: "NGN", defaultTimezone: "Africa/Lagos", measurementSystem: "metric", dateFormat: "DD/MM/YYYY", numberFormat: "en-NG" },
  { countryCode: "FR", countryName: "France", region: "Europe", defaultLanguage: "fr", defaultCurrency: "EUR", defaultTimezone: "Europe/Paris", measurementSystem: "metric", dateFormat: "DD/MM/YYYY", numberFormat: "fr-FR" },
];

export const defaultPreferences: UserGlobalPreferences = {
  language: "en",
  currency: "USD",
  timezone: "UTC",
  country: "US",
  region: "North America",
  measurementSystem: "metric",
  dateFormat: "MM/DD/YYYY",
  numberFormat: "en-US",
};

export type ExchangeRateProvider = {
  latestRates(): Promise<CurrencySetting[]>;
};

export type TranslationProvider = {
  translate(key: string, language: string): Promise<string>;
};

export type GeolocationProvider = {
  countryForIp(ipAddress?: string): Promise<string | null>;
};

export type TimezoneProvider = {
  detectTimezone(input?: { country?: string; browserTimezone?: string }): Promise<string>;
};
