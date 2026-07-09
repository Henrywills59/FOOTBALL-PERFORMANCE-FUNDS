import type { DataProviderName, ProviderStatus } from "./types.js";

export type IntelligenceProvider<TInput, TOutput> = {
  readonly name: DataProviderName;
  fetch(input: TInput): Promise<TOutput>;
};

const providerEnvironment: Array<{ name: DataProviderName; environmentVariable: string }> = [
  { name: "SportMonks", environmentVariable: "SPORTMONKS_API_KEY" },
  { name: "API-Football", environmentVariable: "API_FOOTBALL_KEY" },
  { name: "Football Data", environmentVariable: "FOOTBALL_DATA_API_KEY" },
  { name: "Odds API", environmentVariable: "ODDS_API_KEY" },
  { name: "Weather API", environmentVariable: "WEATHER_API_KEY" },
  { name: "OpenAI", environmentVariable: "OPENAI_API_KEY" },
];

function configured(environmentVariable: string) {
  return Boolean(process.env[environmentVariable]?.trim());
}

export function getProviderStatus(): ProviderStatus[] {
  return providerEnvironment.map((provider) => ({
    ...provider,
    configured: configured(provider.environmentVariable),
  }));
}

