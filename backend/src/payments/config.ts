const requiredNowPaymentsVariables = [
  "NOWPAYMENTS_API_KEY",
  "NOWPAYMENTS_IPN_SECRET",
] as const;

export type NowPaymentsRuntimeConfig = {
  apiKey?: string;
  publicKey?: string;
  ipnSecret?: string;
  baseUrl: string;
  payCurrency: string;
  priceCurrency: string;
  missingVariables: string[];
  configured: boolean;
};

function clean(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

export function getNowPaymentsRuntimeConfig(): NowPaymentsRuntimeConfig {
  const config = {
    apiKey: clean(process.env.NOWPAYMENTS_API_KEY) || undefined,
    publicKey: clean(process.env.NOWPAYMENTS_PUBLIC_KEY) || undefined,
    ipnSecret: clean(process.env.NOWPAYMENTS_IPN_SECRET) || undefined,
    baseUrl: clean(process.env.NOWPAYMENTS_BASE_URL, "https://api.nowpayments.io"),
    payCurrency: clean(process.env.NOWPAYMENTS_PAY_CURRENCY, "USDTTRC20").toUpperCase(),
    priceCurrency: clean(process.env.NOWPAYMENTS_PRICE_CURRENCY, "USD").toUpperCase(),
  };
  const missingVariables = requiredNowPaymentsVariables.filter((key) => !clean(process.env[key]));
  return {
    ...config,
    missingVariables: [...missingVariables],
    configured: missingVariables.length === 0,
  };
}

export function getNowPaymentsWebhookUrl() {
  const baseUrl = clean(process.env.BACKEND_PUBLIC_URL, "https://football-performance-funds-backend.vercel.app").replace(/\/+$/, "");
  return `${baseUrl}/api/payments/nowpayments/webhook`;
}

export function safeNowPaymentsConfigStatus() {
  const config = getNowPaymentsRuntimeConfig();
  return {
    configured: config.configured,
    missingVariables: config.missingVariables,
    priceCurrency: config.priceCurrency,
    payCurrency: config.payCurrency,
    publicKeyConfigured: Boolean(config.publicKey),
    apiKeyConfigured: Boolean(config.apiKey),
    ipnSecretConfigured: Boolean(config.ipnSecret),
    baseUrlConfigured: Boolean(config.baseUrl),
    webhookUrl: getNowPaymentsWebhookUrl(),
  };
}
