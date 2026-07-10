import type { PaymentOrder, PaymentRepository, PaymentStatus } from "./types.js";

const now = () => new Date().toISOString();

function id(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export class InMemoryPaymentRepository implements PaymentRepository {
  orders = new Map<string, PaymentOrder>();
  webhookEvents = new Map<string, string>();
  manualReviews: Array<{ orderId: string; reason: string }> = [];
  activations: Array<{ type: "SUBSCRIPTION" | "INVESTOR_FUNDING"; orderId: string }> = [];

  async createOrder(input: Parameters<PaymentRepository["createOrder"]>[0]) {
    const order: PaymentOrder = {
      id: id("order"),
      userId: input.userId,
      purpose: input.purpose,
      status: "CREATED",
      provider: "NOWPAYMENTS",
      providerPaymentId: null,
      providerInvoiceId: null,
      planCode: input.planCode ?? null,
      billingCycle: input.billingCycle ?? null,
      investmentPackageId: input.investmentPackageId ?? null,
      lockPeriodCode: input.lockPeriodCode ?? null,
      expectedAmountCents: input.expectedAmountCents,
      receivedAmountCents: 0,
      priceCurrency: input.priceCurrency,
      payCurrency: input.payCurrency,
      paymentAddress: null,
      checkoutUrl: null,
      expiresAt: null,
      confirmedAt: null,
      reconciliationStatus: "NOT_STARTED",
      metadata: input.metadata ?? {},
      createdAt: now(),
      updatedAt: now(),
    };
    this.orders.set(order.id, order);
    return order;
  }

  async attachProviderPayment(input: Parameters<PaymentRepository["attachProviderPayment"]>[0]) {
    const order = this.orders.get(input.orderId);
    if (!order) throw new Error("Order not found");
    Object.assign(order, {
      providerPaymentId: input.providerPaymentId,
      providerInvoiceId: input.providerInvoiceId ?? null,
      checkoutUrl: input.checkoutUrl ?? null,
      paymentAddress: input.paymentAddress ?? null,
      expiresAt: input.expiresAt ?? null,
      status: "WAITING" as PaymentStatus,
      updatedAt: now(),
    });
    return order;
  }

  async findOrderById(id: string) {
    return this.orders.get(id) ?? null;
  }

  async findOrderByProviderPaymentId(providerPaymentId: string) {
    return Array.from(this.orders.values()).find((order) => order.providerPaymentId === providerPaymentId) ?? null;
  }

  async listUserOrders(userId: string) {
    return Array.from(this.orders.values()).filter((order) => order.userId === userId);
  }

  async listAdminOrders() {
    return Array.from(this.orders.values());
  }

  async recordWebhookReceipt(input: Parameters<PaymentRepository["recordWebhookReceipt"]>[0]) {
    const existing = this.webhookEvents.get(input.eventKey);
    if (existing) return { duplicate: true, receiptId: existing };
    const receiptId = id("receipt");
    this.webhookEvents.set(input.eventKey, receiptId);
    return { duplicate: false, receiptId };
  }

  async updateWebhookReceipt() {}

  async transitionOrder(input: Parameters<PaymentRepository["transitionOrder"]>[0]) {
    const order = this.orders.get(input.orderId);
    if (!order) throw new Error("Order not found");
    Object.assign(order, {
      status: input.status,
      receivedAmountCents: input.receivedAmountCents ?? order.receivedAmountCents,
      reconciliationStatus: input.reconciliationStatus ?? order.reconciliationStatus,
      confirmedAt: input.confirmedAt ? input.confirmedAt.toISOString() : order.confirmedAt,
      updatedAt: now(),
    });
    return order;
  }

  async createManualReview(input: Parameters<PaymentRepository["createManualReview"]>[0]) {
    this.manualReviews.push({ orderId: input.orderId, reason: input.reason });
  }

  async activateSubscription(input: Parameters<PaymentRepository["activateSubscription"]>[0]) {
    this.activations.push({ type: "SUBSCRIPTION", orderId: input.order.id });
  }

  async activateInvestorFunding(input: Parameters<PaymentRepository["activateInvestorFunding"]>[0]) {
    this.activations.push({ type: "INVESTOR_FUNDING", orderId: input.order.id });
  }

  async addAdminNote(input: Parameters<PaymentRepository["addAdminNote"]>[0]) {
    this.manualReviews.push({ orderId: input.orderId, reason: `ADMIN_NOTE:${input.note}` });
  }
}
