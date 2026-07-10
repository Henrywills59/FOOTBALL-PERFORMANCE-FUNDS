import type { AuthUser } from "@fpf/shared";
import type { AdminService } from "../admin/adminService.js";
import { defaultCommercialStructure } from "../commercial/defaults.js";
import { getNowPaymentsRuntimeConfig, getNowPaymentsWebhookUrl, safeNowPaymentsConfigStatus } from "./config.js";
import { nowPaymentsPayloadHash, signNowPaymentsPayload, verifyNowPaymentsSignature } from "./nowPaymentsProvider.js";
import type {
  CreateInvestorFundingInput,
  CreateSubscriptionPaymentInput,
  NowPaymentsProvider,
  NowPaymentsWebhookPayload,
  PaymentCenter,
  PaymentOrder,
  PaymentRepository,
  PaymentStatus,
} from "./types.js";

export class PaymentError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
  }
}

const activationStatuses = new Set<PaymentStatus>(["CONFIRMED", "FINISHED"]);
const finalFailureStatuses = new Set<PaymentStatus>(["FAILED", "EXPIRED", "REFUNDED", "DISPUTED"]);

function dollars(cents: number) {
  return cents / 100;
}

function cents(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100);
}

export function mapNowPaymentsStatus(status: string | undefined | null): PaymentStatus {
  switch (String(status ?? "").toLowerCase()) {
    case "waiting":
      return "WAITING";
    case "confirming":
    case "sending":
      return "CONFIRMING";
    case "confirmed":
      return "CONFIRMED";
    case "finished":
      return "FINISHED";
    case "partially_paid":
      return "PARTIALLY_PAID";
    case "failed":
      return "FAILED";
    case "expired":
      return "EXPIRED";
    case "refunded":
      return "REFUNDED";
    default:
      return "MANUAL_REVIEW";
  }
}

export class PaymentService {
  constructor(
    private readonly repository: PaymentRepository,
    private readonly provider: NowPaymentsProvider,
    private readonly adminService: AdminService,
  ) {}

  status() {
    return safeNowPaymentsConfigStatus();
  }

  async userCenter(userId: string): Promise<PaymentCenter> {
    return {
      provider: this.providerStatus(),
      orders: await this.repository.listUserOrders(userId),
    };
  }

  async adminCenter(): Promise<PaymentCenter> {
    return {
      provider: this.providerStatus(),
      orders: await this.repository.listAdminOrders(),
    };
  }

  async createSubscriptionPayment(user: AuthUser, input: CreateSubscriptionPaymentInput) {
    const plan = defaultCommercialStructure.subscriberPlans.find((candidate) => candidate.code === input.planCode && candidate.monthlyPriceCents > 0);
    if (!plan) throw new PaymentError("Subscription plan is not available for checkout.", 400);
    const billingCycle = input.billingCycle;
    const expectedAmountCents = billingCycle === "ANNUAL" ? plan.yearlyPriceCents : plan.monthlyPriceCents;
    const purpose = input.purpose ?? "SUBSCRIPTION";
    if (!["SUBSCRIPTION", "SUBSCRIPTION_RENEWAL", "SUBSCRIPTION_UPGRADE"].includes(purpose)) {
      throw new PaymentError("Invalid subscription payment purpose.", 400);
    }
    return this.createProviderBackedOrder(user.id, {
      purpose,
      expectedAmountCents,
      planCode: plan.code,
      billingCycle,
      description: `FPF ${plan.name} ${billingCycle.toLowerCase()} subscription`,
      metadata: { planName: plan.name, source: "subscription_checkout" },
    });
  }

  async createInvestorFunding(user: AuthUser, input: CreateInvestorFundingInput) {
    if (user.role !== "INVESTOR" && user.role !== "ADMIN") {
      throw new PaymentError("Investor funding is restricted to approved investor accounts.", 403);
    }
    if (!input.acknowledgementsAccepted || !input.termsAccepted) {
      throw new PaymentError("Investment risk acknowledgement and terms must be accepted.", 400);
    }
    const structure = defaultCommercialStructure;
    const investmentPackage = structure.investorPackages.find((candidate) => candidate.id === input.packageId && candidate.status === "ACTIVE" && candidate.visible);
    if (!investmentPackage) throw new PaymentError("Investor package is not available.", 400);
    const lockPeriod = structure.lockPeriods.find((candidate) => candidate.code === input.lockPeriodCode && candidate.enabled);
    if (!lockPeriod) throw new PaymentError("Investment lock period is not available.", 400);
    if (input.amountCents < structure.minimumInvestmentCents || input.amountCents < investmentPackage.minimumAmountCents) {
      throw new PaymentError("Investment amount is below the configured minimum.", 400);
    }
    if (investmentPackage.maximumAmountCents !== null && input.amountCents > investmentPackage.maximumAmountCents) {
      throw new PaymentError("Investment amount is above the selected package maximum.", 400);
    }
    return this.createProviderBackedOrder(user.id, {
      purpose: "INVESTOR_FUNDING",
      expectedAmountCents: input.amountCents,
      investmentPackageId: investmentPackage.id,
      lockPeriodCode: lockPeriod.code,
      description: `FPF investor funding ${investmentPackage.name} ${lockPeriod.label}`,
      metadata: {
        packageName: investmentPackage.name,
        lockPeriodMonths: lockPeriod.months,
        riskDisclosure: investmentPackage.riskDisclosure,
        simulationNotice: "Funding is principal only. Simulator projections are not guaranteed returns.",
      },
    });
  }

  async refreshStatus(actorUserId: string, orderId: string) {
    const order = await this.repository.findOrderById(orderId);
    if (!order) throw new PaymentError("Payment order not found.", 404);
    if (!order.providerPaymentId) throw new PaymentError("Payment order has no provider payment ID yet.", 400);
    const status = await this.provider.getPaymentStatus(order.providerPaymentId);
    const updated = await this.applyStatus(order, {
      providerPaymentId: status.paymentId || order.providerPaymentId,
      orderId: order.id,
      status: mapNowPaymentsStatus(status.paymentStatus),
      receivedAmountCents: cents(status.raw.actually_paid_at_fiat ?? status.raw.price_amount),
      priceCurrency: status.priceCurrency ?? order.priceCurrency,
      payCurrency: status.payCurrency ?? order.payCurrency,
      payload: status.raw,
      source: "ADMIN_REFRESH",
    });
    await this.adminService.audit(actorUserId, "PAYMENT_STATUS_REFRESHED", "PAYMENT_ORDER", orderId);
    return updated;
  }

  async runSignedWebhookSelfTest(orderId: string) {
    const config = getNowPaymentsRuntimeConfig();
    if (!config.ipnSecret) {
      throw new PaymentError("NOWPayments IPN secret is not configured.", 503);
    }

    const order = await this.repository.findOrderById(orderId);
    if (!order) throw new PaymentError("Payment order not found.", 404);
    if (!order.providerPaymentId) throw new PaymentError("Payment order has no provider payment ID yet.", 400);

    const payload = {
      payment_id: order.providerPaymentId,
      order_id: order.id,
      payment_status: "confirming",
      price_amount: dollars(order.expectedAmountCents),
      actually_paid_at_fiat: 0,
      price_currency: order.priceCurrency,
      pay_currency: order.payCurrency,
      test_callback: true,
    };
    const response = await fetch(getNowPaymentsWebhookUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-nowpayments-sig": signNowPaymentsPayload(payload, config.ipnSecret),
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new PaymentError("Signed NOWPayments webhook self-test failed.", response.status);
    }
    return {
      ok: true,
      endpoint: getNowPaymentsWebhookUrl(),
      statusCode: response.status,
      response: body,
      activatedPayment: false,
      testStatus: "confirming",
    };
  }

  async processWebhook(payload: NowPaymentsWebhookPayload, signature: string | undefined | null) {
    const config = getNowPaymentsRuntimeConfig();
    if (!config.ipnSecret) {
      throw new PaymentError("NOWPayments IPN secret is not configured.", 503);
    }
    const signatureValid = verifyNowPaymentsSignature(payload, signature, config.ipnSecret);
    const providerPaymentId = payload.payment_id === undefined ? null : String(payload.payment_id);
    const eventStatus = mapNowPaymentsStatus(payload.payment_status);
    const payloadHash = nowPaymentsPayloadHash(payload);
    const eventKey = `${providerPaymentId ?? payload.order_id ?? "unknown"}:${String(payload.payment_status ?? "unknown").toLowerCase()}:${payloadHash}`;
    const order = providerPaymentId ? await this.repository.findOrderByProviderPaymentId(providerPaymentId) : payload.order_id ? await this.repository.findOrderById(payload.order_id) : null;
    const receipt = await this.repository.recordWebhookReceipt({
      providerPaymentId,
      orderId: order?.id ?? null,
      eventKey,
      signatureValid,
      payloadHash,
      payload,
    });

    if (receipt.duplicate) {
      await this.repository.updateWebhookReceipt({ receiptId: receipt.receiptId, processingStatus: "DUPLICATE" });
      return { received: true, duplicate: true, processed: false };
    }
    if (!signatureValid) {
      await this.repository.updateWebhookReceipt({ receiptId: receipt.receiptId, processingStatus: "REJECTED", errorMessage: "Invalid NOWPayments signature." });
      await this.adminService.audit(null, "NOWPAYMENTS_WEBHOOK_INVALID_SIGNATURE", "PAYMENT_WEBHOOK", receipt.receiptId);
      throw new PaymentError("Invalid NOWPayments signature.", 401);
    }
    if (!order) {
      await this.repository.updateWebhookReceipt({ receiptId: receipt.receiptId, processingStatus: "MANUAL_REVIEW", errorMessage: "No matching payment order." });
      await this.adminService.audit(null, "NOWPAYMENTS_WEBHOOK_UNMATCHED_ORDER", "PAYMENT_WEBHOOK", receipt.receiptId);
      return { received: true, duplicate: false, processed: false, status: "MANUAL_REVIEW" };
    }
    const updated = await this.applyStatus(order, {
      providerPaymentId,
      orderId: order.id,
      status: eventStatus,
      receivedAmountCents: cents(payload.actually_paid_at_fiat ?? payload.price_amount),
      priceCurrency: payload.price_currency ? String(payload.price_currency).toUpperCase() : order.priceCurrency,
      payCurrency: payload.pay_currency ? String(payload.pay_currency).toUpperCase() : order.payCurrency,
      payload,
      source: "NOWPAYMENTS_WEBHOOK",
      receiptId: receipt.receiptId,
    });
    await this.repository.updateWebhookReceipt({ receiptId: receipt.receiptId, processingStatus: "PROCESSED" });
    return { received: true, duplicate: false, processed: true, order: updated };
  }

  async addAdminNote(actorUserId: string, orderId: string, note: string) {
    await this.repository.addAdminNote({ actorUserId, orderId, note });
    await this.adminService.audit(actorUserId, "PAYMENT_NOTE_ADDED", "PAYMENT_ORDER", orderId);
  }

  private providerStatus(): PaymentCenter["provider"] {
    const status = this.status();
    return {
      name: "NOWPayments",
      configured: status.configured,
      status: status.configured ? "CONFIGURED" : "MISSING_CONFIGURATION",
      priceCurrency: status.priceCurrency,
      payCurrency: status.payCurrency,
      webhookUrl: status.webhookUrl,
      missingVariables: status.missingVariables,
    };
  }

  private async createProviderBackedOrder(userId: string, input: {
    purpose: PaymentOrder["purpose"];
    expectedAmountCents: number;
    description: string;
    planCode?: string | null;
    billingCycle?: string | null;
    investmentPackageId?: string | null;
    lockPeriodCode?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const config = getNowPaymentsRuntimeConfig();
    const order = await this.repository.createOrder({
      userId,
      purpose: input.purpose,
      planCode: input.planCode,
      billingCycle: input.billingCycle,
      investmentPackageId: input.investmentPackageId,
      lockPeriodCode: input.lockPeriodCode,
      expectedAmountCents: input.expectedAmountCents,
      priceCurrency: config.priceCurrency,
      payCurrency: config.payCurrency,
      metadata: input.metadata,
    });
    await this.adminService.audit(userId, "PAYMENT_ORDER_CREATED", "PAYMENT_ORDER", order.id);
    const providerPayment = await this.provider.createPayment({
      priceAmount: dollars(input.expectedAmountCents),
      priceCurrency: config.priceCurrency,
      payCurrency: config.payCurrency,
      orderId: order.id,
      orderDescription: input.description,
      ipnCallbackUrl: getNowPaymentsWebhookUrl(),
    });
    const updated = await this.repository.attachProviderPayment({
      orderId: order.id,
      providerPaymentId: providerPayment.paymentId,
      providerInvoiceId: providerPayment.invoiceId,
      checkoutUrl: providerPayment.checkoutUrl,
      paymentAddress: providerPayment.payAddress,
      expiresAt: providerPayment.expiresAt,
      raw: providerPayment.raw,
    });
    await this.adminService.audit(userId, "NOWPAYMENTS_PAYMENT_CREATED", "PAYMENT_ORDER", order.id);
    return updated;
  }

  private async applyStatus(order: PaymentOrder, input: {
    providerPaymentId: string | null;
    orderId: string;
    status: PaymentStatus;
    receivedAmountCents: number;
    priceCurrency: string;
    payCurrency: string;
    payload: Record<string, unknown>;
    source: string;
    receiptId?: string | null;
  }) {
    let status = input.status;
    let reconciliationStatus = "NOT_STARTED";
    const amountMismatch = input.receivedAmountCents > 0 && input.receivedAmountCents < order.expectedAmountCents;
    const currencyMismatch = input.priceCurrency.toUpperCase() !== order.priceCurrency.toUpperCase() || input.payCurrency.toUpperCase() !== order.payCurrency.toUpperCase();
    if (currencyMismatch) {
      status = "MANUAL_REVIEW";
      reconciliationStatus = "CURRENCY_MISMATCH";
      await this.repository.createManualReview({ orderId: order.id, reason: "Currency mismatch", notes: "Provider currency did not match the internal order." });
    } else if (amountMismatch || status === "PARTIALLY_PAID") {
      status = "PARTIALLY_PAID";
      reconciliationStatus = "AMOUNT_MISMATCH";
    } else if (activationStatuses.has(status)) {
      reconciliationStatus = "MATCHED";
    } else if (finalFailureStatuses.has(status)) {
      reconciliationStatus = "PROVIDER_DISCREPANCY";
    }

    const updated = await this.repository.transitionOrder({
      orderId: order.id,
      status,
      receivedAmountCents: input.receivedAmountCents,
      reconciliationStatus,
      confirmedAt: activationStatuses.has(status) ? new Date() : null,
      reason: `Provider status ${input.status}`,
      source: input.source,
      providerPayload: input.payload,
    });

    if (activationStatuses.has(status)) {
      if (order.purpose.startsWith("SUBSCRIPTION")) await this.repository.activateSubscription({ order: updated, receiptId: input.receiptId });
      if (order.purpose === "INVESTOR_FUNDING") await this.repository.activateInvestorFunding({ order: updated, receiptId: input.receiptId });
      await this.adminService.audit(null, `PAYMENT_${status}`, "PAYMENT_ORDER", order.id);
    }

    return updated;
  }
}
