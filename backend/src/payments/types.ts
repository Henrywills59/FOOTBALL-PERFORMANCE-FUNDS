import type { BillingCycle, SubscriberPlanCode } from "@fpf/shared";
import type { PaymentNetwork } from "./config.js";

export type PaymentPurpose =
  | "SUBSCRIPTION"
  | "INVESTOR_FUNDING"
  | "SUBSCRIPTION_RENEWAL"
  | "SUBSCRIPTION_UPGRADE"
  | "OTHER_ADMIN_APPROVED";

export type PaymentStatus =
  | "CREATED"
  | "WAITING"
  | "CONFIRMING"
  | "PARTIALLY_PAID"
  | "CONFIRMED"
  | "FINISHED"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED"
  | "DISPUTED"
  | "MANUAL_REVIEW";

export type PaymentOrder = {
  id: string;
  userId: string;
  purpose: PaymentPurpose;
  status: PaymentStatus;
  provider: "NOWPAYMENTS";
  providerPaymentId: string | null;
  providerInvoiceId: string | null;
  planCode: string | null;
  billingCycle: string | null;
  investmentPackageId: string | null;
  lockPeriodCode: string | null;
  expectedAmountCents: number;
  receivedAmountCents: number;
  priceCurrency: string;
  payCurrency: string;
  paymentAddress: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
  confirmedAt: string | null;
  reconciliationStatus: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type PaymentCenter = {
  provider: {
    name: "NOWPayments";
    configured: boolean;
    status: "CONFIGURED" | "MISSING_CONFIGURATION";
    priceCurrency: string;
    payCurrency: string;
    webhookUrl: string;
    missingVariables: string[];
  };
  orders: PaymentOrder[];
};

export type CreateSubscriptionPaymentInput = {
  planCode: SubscriberPlanCode;
  billingCycle: BillingCycle;
  purpose?: Extract<PaymentPurpose, "SUBSCRIPTION" | "SUBSCRIPTION_RENEWAL" | "SUBSCRIPTION_UPGRADE">;
  paymentNetwork?: PaymentNetwork;
};

export type CreateInvestorFundingInput = {
  packageId: string;
  lockPeriodCode: "SIX_MONTHS" | "TWELVE_MONTHS";
  amountCents: number;
  acknowledgementsAccepted: boolean;
  termsAccepted: boolean;
  paymentNetwork?: PaymentNetwork;
};

export type NowPaymentsCreatePaymentRequest = {
  priceAmount: number;
  priceCurrency: string;
  payCurrency: string;
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl: string;
  successUrl?: string;
  cancelUrl?: string;
};

export type NowPaymentsPaymentResponse = {
  paymentId: string;
  invoiceId: string | null;
  paymentStatus: string;
  payAddress: string | null;
  payAmount: number | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  payCurrency: string | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
  raw: Record<string, unknown>;
};

export type NowPaymentsWebhookPayload = {
  payment_id?: string | number;
  invoice_id?: string | number;
  order_id?: string;
  payment_status?: string;
  price_amount?: string | number;
  actually_paid?: string | number;
  actually_paid_at_fiat?: string | number;
  pay_amount?: string | number;
  pay_currency?: string;
  price_currency?: string;
  outcome_amount?: string | number;
  purchase_id?: string;
  [key: string]: unknown;
};

export type PaymentRepository = {
  createOrder(input: {
    userId: string;
    purpose: PaymentPurpose;
    planCode?: string | null;
    billingCycle?: string | null;
    investmentPackageId?: string | null;
    lockPeriodCode?: string | null;
    expectedAmountCents: number;
    priceCurrency: string;
    payCurrency: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaymentOrder>;
  attachProviderPayment(input: {
    orderId: string;
    providerPaymentId: string;
    providerInvoiceId?: string | null;
    checkoutUrl?: string | null;
    paymentAddress?: string | null;
    expiresAt?: string | null;
    raw: Record<string, unknown>;
  }): Promise<PaymentOrder>;
  findOrderById(id: string): Promise<PaymentOrder | null>;
  findOrderByProviderPaymentId(providerPaymentId: string): Promise<PaymentOrder | null>;
  listUserOrders(userId: string): Promise<PaymentOrder[]>;
  listAdminOrders(): Promise<PaymentOrder[]>;
  recordWebhookReceipt(input: {
    providerPaymentId: string | null;
    orderId: string | null;
    eventKey: string;
    signatureValid: boolean;
    payloadHash: string;
    payload: Record<string, unknown>;
  }): Promise<{ duplicate: boolean; receiptId: string }>;
  updateWebhookReceipt(input: { receiptId: string; processingStatus: string; errorMessage?: string | null }): Promise<void>;
  transitionOrder(input: {
    orderId: string;
    status: PaymentStatus;
    receivedAmountCents?: number;
    reconciliationStatus?: string;
    confirmedAt?: Date | null;
    reason: string;
    source: string;
    providerPayload?: Record<string, unknown>;
  }): Promise<PaymentOrder>;
  createManualReview(input: { orderId: string; reason: string; createdByUserId?: string | null; notes?: string | null }): Promise<void>;
  activateSubscription(input: { order: PaymentOrder; receiptId?: string | null }): Promise<{ treasuryLedgerTransactionId?: string | null } | void>;
  activateInvestorFunding(input: { order: PaymentOrder; receiptId?: string | null }): Promise<{ treasuryLedgerTransactionId?: string | null } | void>;
  linkConfirmedPayment(input: {
    orderId: string;
    paymentNetwork: PaymentNetwork;
    payoutWalletReference: string;
    treasuryLedgerTransactionId?: string | null;
    paymentPurpose: PaymentPurpose;
    transactionHash?: string | null;
    receiptId?: string | null;
  }): Promise<PaymentOrder>;
  addAdminNote(input: { orderId: string; actorUserId: string; note: string }): Promise<void>;
};

export type NowPaymentsProvider = {
  isConfigured(): boolean;
  missingVariables(): string[];
  createPayment(input: NowPaymentsCreatePaymentRequest): Promise<NowPaymentsPaymentResponse>;
  getPaymentStatus(paymentId: string): Promise<NowPaymentsPaymentResponse>;
  getEstimatedPrice(input: { amount: number; currencyFrom: string; currencyTo: string }): Promise<Record<string, unknown>>;
  testAvailability(): Promise<{ ok: boolean; status: "CONFIGURED" | "MISSING_CONFIGURATION" | "ERROR"; message: string; responseTimeMs: number }>;
};
