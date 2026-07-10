import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NowPaymentsRuntimeConfig } from "./config.js";
import type { NowPaymentsPaymentResponse, NowPaymentsProvider, NowPaymentsCreatePaymentRequest } from "./types.js";

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 503,
    public readonly code = "PAYMENT_PROVIDER_ERROR",
  ) {
    super(message);
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

export function nowPaymentsPayloadHash(payload: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(sortObjectDeep(payload))).digest("hex");
}

export function signNowPaymentsPayload(payload: Record<string, unknown>, ipnSecret: string) {
  return createHmac("sha512", ipnSecret).update(JSON.stringify(sortObjectDeep(payload))).digest("hex");
}

export function verifyNowPaymentsSignature(payload: Record<string, unknown>, signature: string | undefined | null, ipnSecret?: string) {
  if (!ipnSecret || !signature) return false;
  const expected = signNowPaymentsPayload(payload, ipnSecret);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

function asNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizePaymentResponse(data: Record<string, unknown>): NowPaymentsPaymentResponse {
  return {
    paymentId: String(data.payment_id ?? data.id ?? ""),
    invoiceId: data.invoice_id === undefined || data.invoice_id === null ? null : String(data.invoice_id),
    paymentStatus: String(data.payment_status ?? "waiting"),
    payAddress: data.pay_address === undefined || data.pay_address === null ? null : String(data.pay_address),
    payAmount: asNumber(data.pay_amount),
    priceAmount: asNumber(data.price_amount),
    priceCurrency: data.price_currency === undefined || data.price_currency === null ? null : String(data.price_currency).toUpperCase(),
    payCurrency: data.pay_currency === undefined || data.pay_currency === null ? null : String(data.pay_currency).toUpperCase(),
    checkoutUrl: data.invoice_url === undefined && data.payment_url === undefined ? null : String(data.invoice_url ?? data.payment_url),
    expiresAt: data.expiration_estimate_date === undefined && data.valid_until === undefined ? null : String(data.expiration_estimate_date ?? data.valid_until),
    raw: data,
  };
}

export class NowPaymentsApiProvider implements NowPaymentsProvider {
  constructor(private readonly config: NowPaymentsRuntimeConfig) {}

  isConfigured() {
    return this.config.configured;
  }

  missingVariables() {
    return this.config.missingVariables;
  }

  async createPayment(input: NowPaymentsCreatePaymentRequest) {
    const data = await this.request<Record<string, unknown>>("/v1/payment", {
      method: "POST",
      body: JSON.stringify({
        price_amount: Number(input.priceAmount.toFixed(2)),
        price_currency: input.priceCurrency.toLowerCase(),
        pay_currency: input.payCurrency.toLowerCase(),
        order_id: input.orderId,
        order_description: input.orderDescription,
        ipn_callback_url: input.ipnCallbackUrl,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
      }),
    });
    return normalizePaymentResponse(data);
  }

  async getPaymentStatus(paymentId: string) {
    const data = await this.request<Record<string, unknown>>(`/v1/payment/${encodeURIComponent(paymentId)}`, {
      method: "GET",
    });
    return normalizePaymentResponse(data);
  }

  async getEstimatedPrice(input: { amount: number; currencyFrom: string; currencyTo: string }) {
    const params = new URLSearchParams({
      amount: String(input.amount),
      currency_from: input.currencyFrom.toLowerCase(),
      currency_to: input.currencyTo.toLowerCase(),
    });
    return this.request<Record<string, unknown>>(`/v1/estimate?${params.toString()}`, { method: "GET" });
  }

  async testAvailability() {
    const startedAt = Date.now();
    if (!this.isConfigured()) {
      return {
        ok: false,
        status: "MISSING_CONFIGURATION" as const,
        message: `Missing ${this.missingVariables().join(", ")}`,
        responseTimeMs: Date.now() - startedAt,
      };
    }
    try {
      await this.request<Record<string, unknown>>("/v1/status", { method: "GET" });
      return { ok: true, status: "CONFIGURED" as const, message: "NOWPayments API responded.", responseTimeMs: Date.now() - startedAt };
    } catch (error) {
      return {
        ok: false,
        status: "ERROR" as const,
        message: error instanceof Error ? error.message : "NOWPayments availability check failed.",
        responseTimeMs: Date.now() - startedAt,
      };
    }
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    if (!this.isConfigured()) {
      throw new PaymentProviderError(`NOWPayments is not configured. Missing ${this.missingVariables().join(", ")}`, 503, "PROVIDER_NOT_CONFIGURED");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(new URL(path, this.config.baseUrl), {
        ...init,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey ?? "",
          ...(init.headers ?? {}),
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 429) throw new PaymentProviderError("NOWPayments rate limit reached.", 429, "PROVIDER_RATE_LIMITED");
        throw new PaymentProviderError(
          typeof data?.message === "string" ? data.message : "NOWPayments request failed.",
          response.status,
        );
      }
      return data as T;
    } catch (error) {
      if (error instanceof PaymentProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new PaymentProviderError("NOWPayments request timed out.", 504, "PROVIDER_TIMEOUT");
      }
      throw new PaymentProviderError(error instanceof Error ? error.message : "NOWPayments request failed.");
    } finally {
      clearTimeout(timeout);
    }
  }
}
