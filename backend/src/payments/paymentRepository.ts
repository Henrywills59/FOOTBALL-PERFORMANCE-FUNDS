import { PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../database/prismaClient.js";
import type { PaymentOrder, PaymentRepository, PaymentStatus } from "./types.js";

type PaymentOrderRow = {
  id: string;
  userId: string;
  purpose: string;
  status: string;
  provider: string;
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
  expiresAt: Date | null;
  confirmedAt: Date | null;
  reconciliationStatus: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function orderRow(row: PaymentOrderRow): PaymentOrder {
  return {
    id: row.id,
    userId: row.userId,
    purpose: row.purpose as PaymentOrder["purpose"],
    status: row.status as PaymentStatus,
    provider: "NOWPAYMENTS",
    providerPaymentId: row.providerPaymentId,
    providerInvoiceId: row.providerInvoiceId,
    planCode: row.planCode,
    billingCycle: row.billingCycle,
    investmentPackageId: row.investmentPackageId,
    lockPeriodCode: row.lockPeriodCode,
    expectedAmountCents: row.expectedAmountCents,
    receivedAmountCents: row.receivedAmountCents,
    priceCurrency: row.priceCurrency,
    payCurrency: row.payCurrency,
    paymentAddress: row.paymentAddress,
    checkoutUrl: row.checkoutUrl,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    reconciliationStatus: row.reconciliationStatus,
    metadata: toJson(row.metadata),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function renewalDate(billingCycle: string | null) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + (billingCycle === "ANNUAL" ? 365 : 30));
  return date;
}

export class PrismaPaymentRepository implements PaymentRepository {
  constructor(private readonly prismaClient?: PrismaClient) {}

  private get prisma() {
    return this.prismaClient ?? getPrismaClient();
  }

  async createOrder(input: Parameters<PaymentRepository["createOrder"]>[0]) {
    const row = await this.prisma.paymentOrder.create({
      data: {
        userId: input.userId,
        purpose: input.purpose,
        planCode: input.planCode ?? null,
        billingCycle: input.billingCycle ?? null,
        investmentPackageId: input.investmentPackageId ?? null,
        lockPeriodCode: input.lockPeriodCode ?? null,
        expectedAmountCents: input.expectedAmountCents,
        priceCurrency: input.priceCurrency,
        payCurrency: input.payCurrency,
        metadata: toJson(input.metadata),
        statusHistory: {
          create: {
            newStatus: "CREATED",
            source: "SYSTEM",
            reason: "Internal payment order created.",
          },
        },
      },
    });
    return orderRow(row);
  }

  async attachProviderPayment(input: Parameters<PaymentRepository["attachProviderPayment"]>[0]) {
    const row = await this.prisma.paymentOrder.update({
      where: { id: input.orderId },
      data: {
        providerPaymentId: input.providerPaymentId,
        providerInvoiceId: input.providerInvoiceId ?? null,
        checkoutUrl: input.checkoutUrl ?? null,
        paymentAddress: input.paymentAddress ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        status: "WAITING",
        transactions: {
          create: {
            providerPaymentId: input.providerPaymentId,
            status: "WAITING",
            expectedAmountCents: 0,
            providerPayload: toJson(input.raw),
          },
        },
        statusHistory: {
          create: {
            previousStatus: "CREATED",
            newStatus: "WAITING",
            source: "NOWPAYMENTS",
            reason: "Provider payment created.",
          },
        },
      },
    });
    return orderRow(row);
  }

  async findOrderById(id: string) {
    const row = await this.prisma.paymentOrder.findUnique({ where: { id } });
    return row ? orderRow(row) : null;
  }

  async findOrderByProviderPaymentId(providerPaymentId: string) {
    const row = await this.prisma.paymentOrder.findUnique({ where: { providerPaymentId } });
    return row ? orderRow(row) : null;
  }

  async listUserOrders(userId: string) {
    const rows = await this.prisma.paymentOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
    return rows.map(orderRow);
  }

  async listAdminOrders() {
    const rows = await this.prisma.paymentOrder.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return rows.map(orderRow);
  }

  async recordWebhookReceipt(input: Parameters<PaymentRepository["recordWebhookReceipt"]>[0]) {
    try {
      const receipt = await this.prisma.paymentWebhookReceipt.create({
        data: {
          providerPaymentId: input.providerPaymentId,
          orderId: input.orderId,
          eventKey: input.eventKey,
          signatureValid: input.signatureValid,
          payloadHash: input.payloadHash,
          payload: toJson(input.payload),
          processingStatus: "RECEIVED",
        },
      });
      return { duplicate: false, receiptId: receipt.id };
    } catch (error) {
      const existing = await this.prisma.paymentWebhookReceipt.findUnique({ where: { eventKey: input.eventKey } });
      if (existing) return { duplicate: true, receiptId: existing.id };
      throw error;
    }
  }

  async updateWebhookReceipt(input: Parameters<PaymentRepository["updateWebhookReceipt"]>[0]) {
    await this.prisma.paymentWebhookReceipt.update({
      where: { id: input.receiptId },
      data: {
        processingStatus: input.processingStatus,
        errorMessage: input.errorMessage ?? null,
        processedAt: new Date(),
      },
    });
  }

  async transitionOrder(input: Parameters<PaymentRepository["transitionOrder"]>[0]) {
    const existing = await this.prisma.paymentOrder.findUnique({ where: { id: input.orderId } });
    const row = await this.prisma.paymentOrder.update({
      where: { id: input.orderId },
      data: {
        status: input.status,
        receivedAmountCents: input.receivedAmountCents ?? undefined,
        reconciliationStatus: input.reconciliationStatus as never,
        confirmedAt: input.confirmedAt === undefined ? undefined : input.confirmedAt,
        transactions: {
          create: {
            providerPaymentId: existing?.providerPaymentId ?? null,
            status: input.status,
            expectedAmountCents: existing?.expectedAmountCents ?? 0,
            receivedAmountCents: input.receivedAmountCents ?? 0,
            priceCurrency: existing?.priceCurrency ?? "USD",
            payCurrency: existing?.payCurrency ?? "USDTTRC20",
            providerPayload: toJson(input.providerPayload),
          },
        },
        statusHistory: {
          create: {
            previousStatus: existing?.status as never,
            newStatus: input.status,
            reason: input.reason,
            source: input.source,
          },
        },
        reconciliation: {
          upsert: {
            update: {
              status: (input.reconciliationStatus ?? "NOT_STARTED") as never,
              expectedAmountCents: existing?.expectedAmountCents ?? 0,
              receivedAmountCents: input.receivedAmountCents ?? existing?.receivedAmountCents ?? 0,
              differenceCents: (input.receivedAmountCents ?? existing?.receivedAmountCents ?? 0) - (existing?.expectedAmountCents ?? 0),
              expectedCurrency: existing?.priceCurrency ?? "USD",
            },
            create: {
              status: (input.reconciliationStatus ?? "NOT_STARTED") as never,
              expectedAmountCents: existing?.expectedAmountCents ?? 0,
              receivedAmountCents: input.receivedAmountCents ?? existing?.receivedAmountCents ?? 0,
              differenceCents: (input.receivedAmountCents ?? existing?.receivedAmountCents ?? 0) - (existing?.expectedAmountCents ?? 0),
              expectedCurrency: existing?.priceCurrency ?? "USD",
            },
          },
        },
      },
    });
    return orderRow(row);
  }

  async createManualReview(input: Parameters<PaymentRepository["createManualReview"]>[0]) {
    await this.prisma.paymentManualReview.create({
      data: {
        orderId: input.orderId,
        reason: input.reason,
        notes: input.notes ?? null,
        createdByUserId: input.createdByUserId ?? null,
      },
    });
  }

  async activateSubscription(input: Parameters<PaymentRepository["activateSubscription"]>[0]) {
    await this.prisma.$transaction(async (tx) => {
      await tx.subscriptionRecord.upsert({
        where: { id: `subscription_${input.order.userId}` },
        update: {
          planCode: input.order.planCode ?? "PROFESSIONAL",
          billingCycle: input.order.billingCycle ?? "MONTHLY",
          status: "ACTIVE",
          renewalDate: renewalDate(input.order.billingCycle),
          receipts: [{ orderId: input.order.id, amountCents: input.order.receivedAmountCents, issuedAt: new Date().toISOString() }],
        },
        create: {
          id: `subscription_${input.order.userId}`,
          userId: input.order.userId,
          planCode: input.order.planCode ?? "PROFESSIONAL",
          billingCycle: input.order.billingCycle ?? "MONTHLY",
          status: "ACTIVE",
          renewalDate: renewalDate(input.order.billingCycle),
          receipts: [{ orderId: input.order.id, amountCents: input.order.receivedAmountCents, issuedAt: new Date().toISOString() }],
        },
      });
      await tx.treasuryLedger.create({
        data: {
          account: "COMPANY_TREASURY",
          direction: "CREDIT",
          amountCents: input.order.receivedAmountCents,
          classification: "SUBSCRIPTION_REVENUE",
          referenceType: "PAYMENT_ORDER",
          referenceId: input.order.id,
          notes: "NOWPayments subscription payment confirmed. Provider fee is tracked as placeholder unless supplied.",
          createdBy: "NOWPAYMENTS_WEBHOOK",
        },
      });
      await tx.notification.create({
        data: {
          userId: input.order.userId,
          category: "ACCOUNT_ACTION_REQUIRED",
          status: "UNREAD",
          title: "Subscription payment confirmed",
          message: "Your FPF subscription payment has been confirmed.",
          metadata: { orderId: input.order.id },
        },
      });
    });
  }

  async activateInvestorFunding(input: Parameters<PaymentRepository["activateInvestorFunding"]>[0]) {
    await this.prisma.$transaction(async (tx) => {
      const plan = await tx.investmentPlan.findFirst({ where: { active: true }, orderBy: { minimumInvestmentCents: "asc" } });
      const fallbackPlan = plan ?? await tx.investmentPlan.create({
        data: {
          name: "NOWPayments Investor Funding",
          description: "Investor funding created from confirmed NOWPayments deposit.",
          minimumInvestmentCents: 10000,
          maximumInvestmentCents: 1000000000,
          historicalPerformanceNote: "Historical performance only. Returns are not guaranteed.",
          riskDisclosure: "Capital is at risk.",
        },
      });
      const investment = await tx.investment.create({
        data: {
          userId: input.order.userId,
          planId: fallbackPlan.id,
          amountCents: input.order.receivedAmountCents,
          currentValueCents: input.order.receivedAmountCents,
          status: "ACTIVE",
        },
      });
      const account = await tx.investorAccount.upsert({
        where: { userId: input.order.userId },
        update: { startDate: new Date() },
        create: { userId: input.order.userId, startDate: new Date() },
      });
      await tx.investorBalance.upsert({
        where: { investorAccountId: account.id },
        update: {
          totalCapitalCents: { increment: input.order.receivedAmountCents },
          activeInvestmentBalanceCents: { increment: input.order.receivedAmountCents },
        },
        create: {
          investorAccountId: account.id,
          totalCapitalCents: input.order.receivedAmountCents,
          activeInvestmentBalanceCents: input.order.receivedAmountCents,
        },
      });
      await tx.investorAuditLog.create({
        data: {
          investorAccountId: account.id,
          actorUserId: input.order.userId,
          action: "INVESTOR_FUNDING_CONFIRMED",
          entityType: "PAYMENT_ORDER",
          entityId: input.order.id,
          details: { investmentId: investment.id, amountCents: input.order.receivedAmountCents },
        },
      });
      await tx.treasuryLedger.create({
        data: {
          account: "INVESTOR_PRINCIPAL",
          direction: "CREDIT",
          amountCents: input.order.receivedAmountCents,
          classification: "INVESTOR_PRINCIPAL",
          referenceType: "PAYMENT_ORDER",
          referenceId: input.order.id,
          notes: "Investor principal recorded separately from company profit. No payout automation occurred.",
          createdBy: "NOWPAYMENTS_WEBHOOK",
        },
      });
      await tx.notification.create({
        data: {
          userId: input.order.userId,
          category: "ACCOUNT_ACTION_REQUIRED",
          status: "UNREAD",
          title: "Investor funding confirmed",
          message: "Your investor funding payment has been confirmed and principal has been recorded.",
          metadata: { orderId: input.order.id, investmentId: investment.id },
        },
      });
    });
  }

  async addAdminNote(input: Parameters<PaymentRepository["addAdminNote"]>[0]) {
    await this.prisma.paymentManualReview.create({
      data: {
        orderId: input.orderId,
        reason: "ADMIN_NOTE",
        notes: input.note,
        createdByUserId: input.actorUserId,
      },
    });
  }
}
