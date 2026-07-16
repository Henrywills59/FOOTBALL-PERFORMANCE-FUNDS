const requiredNowPaymentsVariables = [
  "NOWPAYMENTS_API_KEY",
  "NOWPAYMENTS_IPN_SECRET",
] as const;

export const supportedPaymentNetworks = ["USDT_TRC20", "USDT_ERC20"] as const;

export type PaymentNetwork = typeof supportedPaymentNetworks[number];

export type NowPaymentsPayoutWalletConfig = {
  network: PaymentNetwork;
  payCurrency: string;
  envVarName: string;
  reference: string;
  configured: boolean;
};

export type NowPaymentsRuntimeConfig = {
  apiKey?: string;
  publicKey?: string;
  ipnSecret?: string;
  baseUrl: string;
  payCurrency: string;
  priceCurrency: string;
  payoutWallets: Record<PaymentNetwork, NowPaymentsPayoutWalletConfig>;
  missingPayoutWalletVariables: string[];
  missingVariables: string[];
  configured: boolean;
};

function clean(value: string | undefined, fallback = "") {
  return value?.trim() || fallback;
}

const payoutWalletDefinitions: Record<PaymentNetwork, Omit<NowPaymentsPayoutWalletConfig, "configured">> = {
  USDT_TRC20: {
    network: "USDT_TRC20",
    payCurrency: "USDTTRC20",
    envVarName: "NOWPAYMENTS_USDT_TRC20_PAYOUT_WALLET",
    reference: "NOWPAYMENTS_USDT_TRC20_PAYOUT_WALLET",
  },
  USDT_ERC20: {
    network: "USDT_ERC20",
    payCurrency: "USDTERC20",
    envVarName: "NOWPAYMENTS_USDT_ERC20_PAYOUT_WALLET",
    reference: "NOWPAYMENTS_USDT_ERC20_PAYOUT_WALLET",
  },
};

export function normalizePaymentNetwork(value: unknown, fallbackPayCurrency?: string): PaymentNetwork {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[-\s]/g, "_");
  if (normalized === "USDT_TRC20" || normalized === "TRC20" || normalized === "USDTTRC20") return "USDT_TRC20";
  if (normalized === "USDT_ERC20" || normalized === "ERC20" || normalized === "USDTERC20") return "USDT_ERC20";
  return networkForPayCurrency(fallbackPayCurrency ?? process.env.NOWPAYMENTS_PAY_CURRENCY ?? "USDTTRC20");
}

export function networkForPayCurrency(payCurrency: string): PaymentNetwork {
  const normalized = clean(payCurrency, "USDTTRC20").toUpperCase();
  return normalized === "USDTERC20" ? "USDT_ERC20" : "USDT_TRC20";
}

export function payCurrencyForNetwork(network: PaymentNetwork) {
  return payoutWalletDefinitions[network].payCurrency;
}

export function getNowPaymentsRuntimeConfig(): NowPaymentsRuntimeConfig {
  const payoutWallets = Object.fromEntries(
    supportedPaymentNetworks.map((network) => {
      const wallet = payoutWalletDefinitions[network];
      return [network, { ...wallet, configured: Boolean(clean(process.env[wallet.envVarName])) }];
    }),
  ) as Record<PaymentNetwork, NowPaymentsPayoutWalletConfig>;
  const missingPayoutWalletVariables = supportedPaymentNetworks
    .map((network) => payoutWallets[network])
    .filter((wallet) => !wallet.configured)
    .map((wallet) => wallet.envVarName);
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
    payoutWallets,
    missingPayoutWalletVariables,
    missingVariables: [...missingVariables],
    configured: missingVariables.length === 0,
  };
}

export function getPayoutWalletForNetwork(network: PaymentNetwork) {
  return getNowPaymentsRuntimeConfig().payoutWallets[network];
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
    supportedNetworks: supportedPaymentNetworks.map((network) => ({
      network,
      payCurrency: config.payoutWallets[network].payCurrency,
      payoutWalletReference: config.payoutWallets[network].reference,
      payoutWalletConfigured: config.payoutWallets[network].configured,
    })),
    missingPayoutWalletVariables: config.missingPayoutWalletVariables,
    publicKeyConfigured: Boolean(config.publicKey),
    apiKeyConfigured: Boolean(config.apiKey),
    ipnSecretConfigured: Boolean(config.ipnSecret),
    baseUrlConfigured: Boolean(config.baseUrl),
    webhookUrl: getNowPaymentsWebhookUrl(),
  };
}
