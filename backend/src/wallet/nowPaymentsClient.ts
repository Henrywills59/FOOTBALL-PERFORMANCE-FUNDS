import { createHmac, timingSafeEqual } from "node:crypto";

export type NowPaymentsConfig = {
  apiKey?: string;
  ipnSecret?: string;
  baseUrl: string;
};

export function getNowPaymentsConfig(): NowPaymentsConfig {
  return {
    apiKey: process.env.NOWPAYMENTS_API_KEY,
    ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET,
    baseUrl: process.env.NOWPAYMENTS_BASE_URL ?? "https://api.nowpayments.io",
  };
}

export class NowPaymentsClient {
  constructor(private readonly config: NowPaymentsConfig) {}

  isConfigured() {
    return Boolean(this.config.apiKey);
  }

  async createInvoice(input: { priceAmount: number; orderId: string; orderDescription: string }) {
    if (!this.config.apiKey) {
      throw new Error("NOWPAYMENTS_API_KEY is not configured");
    }
    const response = await fetch(new URL("/v1/invoice", this.config.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
      },
      body: JSON.stringify({
        price_amount: input.priceAmount,
        price_currency: "usd",
        order_id: input.orderId,
        order_description: input.orderDescription,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message ?? "NOWPayments invoice creation failed");
    }
    return data as { invoice_url?: string; id?: string; payment_id?: string };
  }

  verifyIpn(payload: unknown, signature: string | undefined | null) {
    if (!this.config.ipnSecret || !signature) {
      return false;
    }
    const body = JSON.stringify(sortObjectDeep(payload));
    const expected = createHmac("sha512", this.config.ipnSecret).update(body).digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const actualBuffer = Buffer.from(signature, "hex");
    if (expectedBuffer.length !== actualBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, actualBuffer);
  }
}

function sortObjectDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectDeep);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = sortObjectDeep((value as Record<string, unknown>)[key]);
      return result;
    }, {});
}
