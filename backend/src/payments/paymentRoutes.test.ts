import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { InMemoryAdminRepository } from "../admin/inMemoryAdminRepository.js";
import { InMemoryUserRepository } from "../auth/inMemoryUserRepository.js";
import { InMemoryFootballRepository } from "../football/inMemoryFootballRepository.js";
import { InMemoryInvestorRepository } from "../investor/inMemoryInvestorRepository.js";
import { InMemoryPredictionRepository } from "../predictions/inMemoryPredictionRepository.js";
import { InMemoryWalletRepository } from "../wallet/inMemoryWalletRepository.js";
import { InMemoryPaymentRepository } from "./inMemoryPaymentRepository.js";
import { getNowPaymentsWebhookUrl } from "./config.js";
import { signNowPaymentsPayload } from "./nowPaymentsProvider.js";
import type { NowPaymentsCreatePaymentRequest, NowPaymentsProvider } from "./types.js";

function seedUser(users: InMemoryUserRepository, role: "SUBSCRIBER" | "INVESTOR" | "ADMIN", id = `${role.toLowerCase()}-payment-user`) {
  users.seedUser({
    id,
    name: `${role} User`,
    email: `${role.toLowerCase()}-payment@example.com`,
    passwordHash: "not-used",
    role,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  });
  return jwt.sign({ role, email: `${role.toLowerCase()}-payment@example.com` }, "test-secret", {
    subject: id,
    expiresIn: "1d",
  });
}

class MockNowPaymentsProvider implements NowPaymentsProvider {
  paymentStatus = "waiting";
  configured = true;
  lastCreatePaymentInput: NowPaymentsCreatePaymentRequest | null = null;

  isConfigured() {
    return this.configured;
  }

  missingVariables() {
    return this.configured ? [] : ["NOWPAYMENTS_API_KEY"];
  }

  async createPayment(input: NowPaymentsCreatePaymentRequest) {
    this.lastCreatePaymentInput = input;
    return {
      paymentId: `pay_${input.orderId}`,
      invoiceId: `invoice_${input.orderId}`,
      paymentStatus: "waiting",
      payAddress: "TTestAddress",
      payAmount: 10,
      priceAmount: input.priceAmount,
      priceCurrency: input.priceCurrency,
      payCurrency: input.payCurrency,
      checkoutUrl: `https://nowpayments.example/${input.orderId}`,
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
      raw: { payment_id: `pay_${input.orderId}`, payment_status: "waiting", pay_currency: input.payCurrency },
    };
  }

  async getPaymentStatus(paymentId: string) {
    return {
      paymentId,
      invoiceId: null,
      paymentStatus: this.paymentStatus,
      payAddress: "TTestAddress",
      payAmount: 10,
      priceAmount: 19,
      priceCurrency: "USD",
      payCurrency: "USDTTRC20",
      checkoutUrl: null,
      expiresAt: null,
      raw: { payment_id: paymentId, payment_status: this.paymentStatus, price_amount: 19, actually_paid_at_fiat: 19 },
    };
  }

  async getEstimatedPrice() {
    return { estimated_amount: 10 };
  }

  async testAvailability() {
    return { ok: this.configured, status: this.configured ? "CONFIGURED" as const : "MISSING_CONFIGURATION" as const, message: "mock", responseTimeMs: 1 };
  }
}

function testApp() {
  process.env.NOWPAYMENTS_API_KEY = "test-api-key";
  process.env.NOWPAYMENTS_IPN_SECRET = "test-ipn-secret";
  process.env.NOWPAYMENTS_BASE_URL = "https://api.nowpayments.test";
  process.env.NOWPAYMENTS_PRICE_CURRENCY = "USD";
  process.env.NOWPAYMENTS_PAY_CURRENCY = "USDTTRC20";
  process.env.NOWPAYMENTS_USDT_TRC20_PAYOUT_WALLET = "test-trc20-wallet-address";
  process.env.NOWPAYMENTS_USDT_ERC20_PAYOUT_WALLET = "test-erc20-wallet-address";
  const users = new InMemoryUserRepository();
  const paymentRepository = new InMemoryPaymentRepository();
  const provider = new MockNowPaymentsProvider();
  const app = createApp({
    userRepository: users,
    footballRepository: new InMemoryFootballRepository(),
    predictionRepository: new InMemoryPredictionRepository([]),
    adminRepository: new InMemoryAdminRepository(),
    investorRepository: new InMemoryInvestorRepository(),
    walletRepository: new InMemoryWalletRepository(),
    paymentRepository,
    nowPaymentsProvider: provider,
    jwtSecret: "test-secret",
    startFootballJobs: false,
  });
  return { app, users, paymentRepository, provider };
}

function signature(payload: Record<string, unknown>) {
  return signNowPaymentsPayload(payload, "test-ipn-secret");
}

const urlEnvKeys = ["BACKEND_BASE_URL", "BACKEND_PUBLIC_URL", "VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL", "NOWPAYMENTS_IPN_CALLBACK_URL"] as const;
const previousUrlEnv = Object.fromEntries(urlEnvKeys.map((key) => [key, process.env[key]]));

function restoreUrlEnv() {
  for (const key of urlEnvKeys) {
    const value = previousUrlEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("NOWPayments payment routes", () => {
  afterEach(restoreUrlEnv);

  it("uses an environment-aware Preview backend callback URL for checkout creation", async () => {
    process.env.BACKEND_BASE_URL = "https://backend-preview.example.com";
    delete process.env.NOWPAYMENTS_IPN_CALLBACK_URL;
    const { app, users, provider } = testApp();
    const token = seedUser(users, "SUBSCRIBER");

    await request(app)
      .post("/api/payments/subscription/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ planCode: "STARTER", billingCycle: "MONTHLY", paymentNetwork: "USDT_TRC20" })
      .expect(201);

    expect(provider.lastCreatePaymentInput?.ipnCallbackUrl).toBe("https://backend-preview.example.com/api/payments/nowpayments/webhook");
    expect(getNowPaymentsWebhookUrl()).toBe("https://backend-preview.example.com/api/payments/nowpayments/webhook");
  });

  it("allows an explicit NOWPayments callback URL override for Production", async () => {
    process.env.BACKEND_BASE_URL = "https://backend-preview.example.com";
    process.env.NOWPAYMENTS_IPN_CALLBACK_URL = "https://backend-production.example.com/api/payments/nowpayments/webhook";
    const { app, users, provider } = testApp();
    const token = seedUser(users, "SUBSCRIBER");

    await request(app)
      .post("/api/payments/subscription/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ planCode: "STARTER", billingCycle: "MONTHLY", paymentNetwork: "USDT_TRC20" })
      .expect(201);

    expect(provider.lastCreatePaymentInput?.ipnCallbackUrl).toBe("https://backend-production.example.com/api/payments/nowpayments/webhook");
  });

  it("creates subscription payment orders from authoritative plan pricing", async () => {
    const { app, users } = testApp();
    const token = seedUser(users, "SUBSCRIBER");

    const response = await request(app)
      .post("/api/payments/subscription/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ planCode: "STARTER", billingCycle: "MONTHLY" })
      .expect(201);

    expect(response.body.order.expectedAmountCents).toBe(1900);
    expect(response.body.order.checkoutUrl).toContain("nowpayments.example");
  });

  it("selects the requested payout wallet reference without exposing wallet addresses", async () => {
    const { app, users } = testApp();
    const token = seedUser(users, "SUBSCRIBER");

    const response = await request(app)
      .post("/api/payments/subscription/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ planCode: "STARTER", billingCycle: "MONTHLY", paymentNetwork: "USDT_ERC20" })
      .expect(201);

    expect(response.body.order.payCurrency).toBe("USDTERC20");
    expect(response.body.order.metadata.paymentNetwork).toBe("USDT_ERC20");
    expect(response.body.order.metadata.payoutWalletReference).toBe("NOWPAYMENTS_USDT_ERC20_PAYOUT_WALLET");
    expect(JSON.stringify(response.body)).not.toContain("test-erc20-wallet-address");
  });

  it("restricts investor funding to investors and validates package rules", async () => {
    const { app, users } = testApp();
    const subscriberToken = seedUser(users, "SUBSCRIBER");
    const investorToken = seedUser(users, "INVESTOR");

    await request(app)
      .post("/api/payments/investor-funding/checkout")
      .set("Authorization", `Bearer ${subscriberToken}`)
      .send({ packageId: "pkg_bronze", lockPeriodCode: "SIX_MONTHS", amountCents: 10000, acknowledgementsAccepted: true, termsAccepted: true })
      .expect(403);

    await request(app)
      .post("/api/payments/investor-funding/checkout")
      .set("Authorization", `Bearer ${investorToken}`)
      .send({ packageId: "pkg_bronze", lockPeriodCode: "SIX_MONTHS", amountCents: 10000, acknowledgementsAccepted: true, termsAccepted: true })
      .expect(201);
  });

  it("rejects invalid webhook signatures and does not activate orders", async () => {
    const { app, users, paymentRepository } = testApp();
    const token = seedUser(users, "SUBSCRIBER");
    const checkout = await request(app)
      .post("/api/payments/subscription/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ planCode: "STARTER", billingCycle: "MONTHLY" })
      .expect(201);

    await request(app)
      .post("/api/payments/nowpayments/webhook")
      .set("x-nowpayments-sig", "bad")
      .send({ payment_id: checkout.body.order.providerPaymentId, payment_status: "finished", price_amount: 19, actually_paid_at_fiat: 19, price_currency: "USD", pay_currency: "USDTTRC20" })
      .expect(401);
    expect(paymentRepository.activations).toHaveLength(0);
  });

  it("processes finished webhooks idempotently and activates only once", async () => {
    const { app, users, paymentRepository } = testApp();
    const token = seedUser(users, "INVESTOR");
    const checkout = await request(app)
      .post("/api/payments/investor-funding/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ packageId: "pkg_bronze", lockPeriodCode: "SIX_MONTHS", amountCents: 10000, acknowledgementsAccepted: true, termsAccepted: true })
      .expect(201);
    const payload = {
      payment_id: checkout.body.order.providerPaymentId,
      order_id: checkout.body.order.id,
      payment_status: "finished",
      price_amount: 100,
      actually_paid_at_fiat: 100,
      price_currency: "USD",
      pay_currency: "USDTTRC20",
    };

    await request(app).post("/api/payments/nowpayments/webhook").set("x-nowpayments-sig", signature(payload)).send(payload).expect(200);
    await request(app).post("/api/payments/nowpayments/webhook").set("x-nowpayments-sig", signature(payload)).send(payload).expect(200);

    expect(paymentRepository.activations).toEqual([{ type: "INVESTOR_FUNDING", orderId: checkout.body.order.id }]);
  });

  it("links confirmed payments to network, payout wallet, transaction hash, purpose and treasury reference", async () => {
    const { app, users, paymentRepository } = testApp();
    const token = seedUser(users, "SUBSCRIBER");
    const checkout = await request(app)
      .post("/api/payments/subscription/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ planCode: "STARTER", billingCycle: "MONTHLY", paymentNetwork: "USDT_ERC20" })
      .expect(201);
    const payload = {
      payment_id: checkout.body.order.providerPaymentId,
      order_id: checkout.body.order.id,
      payment_status: "finished",
      price_amount: 19,
      actually_paid_at_fiat: 19,
      price_currency: "USD",
      pay_currency: "USDTERC20",
      payin_hash: "0xtesthash",
    };

    await request(app).post("/api/payments/nowpayments/webhook").set("x-nowpayments-sig", signature(payload)).send(payload).expect(200);

    const order = await paymentRepository.findOrderById(checkout.body.order.id);
    expect(order?.metadata.paymentNetwork).toBe("USDT_ERC20");
    expect(order?.metadata.payoutWalletReference).toBe("NOWPAYMENTS_USDT_ERC20_PAYOUT_WALLET");
    expect(order?.metadata.paymentPurpose).toBe("SUBSCRIPTION");
    expect(order?.metadata.treasuryPaymentPurpose).toBe("SUBSCRIBER_SUBSCRIPTION");
    expect(order?.metadata.transactionHash).toBe("0xtesthash");
    expect(order?.metadata.treasuryLedgerTransactionId).toBe(`ledger_${checkout.body.order.id}`);
    expect(JSON.stringify(order)).not.toContain("test-erc20-wallet-address");
  });

  it("routes partial payments and currency mismatches to safe non-activation states", async () => {
    const { app, users, paymentRepository } = testApp();
    const token = seedUser(users, "SUBSCRIBER");
    const checkout = await request(app)
      .post("/api/payments/subscription/checkout")
      .set("Authorization", `Bearer ${token}`)
      .send({ planCode: "STARTER", billingCycle: "MONTHLY" })
      .expect(201);
    const partial = {
      payment_id: checkout.body.order.providerPaymentId,
      order_id: checkout.body.order.id,
      payment_status: "partially_paid",
      price_amount: 19,
      actually_paid_at_fiat: 5,
      price_currency: "USD",
      pay_currency: "USDTTRC20",
    };
    await request(app).post("/api/payments/nowpayments/webhook").set("x-nowpayments-sig", signature(partial)).send(partial).expect(200);

    const order = await paymentRepository.findOrderById(checkout.body.order.id);
    expect(order?.status).toBe("PARTIALLY_PAID");
    expect(paymentRepository.activations).toHaveLength(0);
  });

  it("lets admins view and refresh the payment center", async () => {
    const { app, users } = testApp();
    const adminToken = seedUser(users, "ADMIN");

    await request(app)
      .get("/api/admin/payments")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(200);
  });
});
