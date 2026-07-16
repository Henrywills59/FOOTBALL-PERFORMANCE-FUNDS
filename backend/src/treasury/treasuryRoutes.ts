import { Router } from "express";
import type { AuthService } from "../auth/authService.js";
import { AuthError } from "../auth/authService.js";
import { requireAuth, requireRole } from "../auth/authMiddleware.js";
import { TreasuryControlError, TreasuryService } from "./treasuryService.js";

function actorId(request: { user?: { id: string } }) {
  return request.user?.id ?? "unknown-user";
}

function sendTreasuryError(error: unknown, response: { status: (status: number) => { json: (body: object) => void } }, next: (error: unknown) => void) {
  if (error instanceof TreasuryControlError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }
  if (error instanceof AuthError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }
  next(error);
}

export function createTreasuryRouter({
  authService,
  treasuryService,
}: {
  authService: AuthService;
  treasuryService: TreasuryService;
}) {
  const router = Router();
  const adminOnly = [requireAuth(authService), requireRole(["ADMIN"])];
  const analystOnly = [requireAuth(authService), requireRole(["ANALYST"])];

  router.get("/treasury", adminOnly, (_request, response) => {
    response.json(treasuryService.dashboard());
  });

  router.get("/treasury/daily", adminOnly, (_request, response) => {
    response.json(treasuryService.dashboard().daily);
  });

  router.get("/treasury/weekly", adminOnly, (_request, response) => {
    response.json(treasuryService.dashboard().weekly);
  });

  router.get("/treasury/executive-situation-room", adminOnly, (_request, response) => {
    response.json(treasuryService.executiveSituationRoom());
  });

  router.get("/treasury/ledger", adminOnly, (_request, response) => {
    response.json(treasuryService.ledgerOverview());
  });

  router.post("/treasury/ledger/transactions", adminOnly, (request, response, next) => {
    try {
      response.status(201).json({
        transaction: treasuryService.createLedgerTransaction(actorId(request), {
          sourceAccount: request.body?.sourceAccount,
          destinationAccount: request.body?.destinationAccount,
          amount: request.body?.amount,
          currency: request.body?.currency,
          purpose: request.body?.purpose,
          referenceType: request.body?.referenceType,
          referenceId: request.body?.referenceId,
          externalTransactionReference: request.body?.externalTransactionReference,
          reconciliationStatus: request.body?.reconciliationStatus,
          metadata: request.body?.metadata,
          approvalStatus: request.body?.approvalStatus,
        }),
      });
    } catch (error) {
      sendTreasuryError(error, response, next);
    }
  });

  router.post("/treasury/ledger/transactions/:id/approve", adminOnly, (request, response, next) => {
    try {
      response.json({ transaction: treasuryService.approveLedgerTransaction(actorId(request), request.params.id) });
    } catch (error) {
      sendTreasuryError(error, response, next);
    }
  });

  router.post("/treasury/ledger/transactions/:id/reject", adminOnly, (request, response, next) => {
    try {
      response.json({ transaction: treasuryService.rejectLedgerTransaction(actorId(request), request.params.id, request.body?.reason) });
    } catch (error) {
      sendTreasuryError(error, response, next);
    }
  });

  router.post("/treasury/ledger/transactions/:id/reconcile", adminOnly, (request, response, next) => {
    try {
      response.json({
        transaction: treasuryService.updateLedgerReconciliation(actorId(request), request.params.id, {
          reconciliationStatus: request.body?.reconciliationStatus,
          externalTransactionReference: request.body?.externalTransactionReference,
        }),
      });
    } catch (error) {
      sendTreasuryError(error, response, next);
    }
  });

  router.post("/treasury/ledger/eligible-profit/allocate", adminOnly, (request, response, next) => {
    try {
      response.status(201).json({
        transactions: treasuryService.allocateEligibleProfit(actorId(request), {
          amount: request.body?.amount,
          currency: request.body?.currency,
          referenceId: request.body?.referenceId,
          externalTransactionReference: request.body?.externalTransactionReference,
        }),
      });
    } catch (error) {
      sendTreasuryError(error, response, next);
    }
  });

  router.post("/treasury/executions", adminOnly, (request, response, next) => {
    try {
      response.status(201).json({ execution: treasuryService.createExecution(actorId(request), request.body) });
    } catch (error) {
      sendTreasuryError(error, response, next);
    }
  });

  router.post("/treasury/executions/:id/settle", adminOnly, (request, response, next) => {
    try {
      response.status(201).json({
        settlement: treasuryService.settleExecution(actorId(request), request.params.id, {
          outcome: request.body?.outcome ?? "PENDING_VERIFICATION",
          verificationStatus: request.body?.verificationStatus,
        }),
      });
    } catch (error) {
      sendTreasuryError(error, response, next);
    }
  });

  router.post("/treasury/settlements/:id/reconcile", adminOnly, (request, response, next) => {
    try {
      response.status(201).json({
        reconciliation: treasuryService.reconcileSettlement(actorId(request), request.params.id, {
          amountDepositedBackCents: Number(request.body?.amountDepositedBackCents ?? 0),
          notes: request.body?.notes,
          evidencePlaceholder: request.body?.evidencePlaceholder,
        }),
      });
    } catch (error) {
      sendTreasuryError(error, response, next);
    }
  });

  router.post("/treasury/daily/close", adminOnly, (request, response, next) => {
    try {
      response.json({
        daily: treasuryService.closeTradingDay(actorId(request), {
          overrideReason: request.body?.overrideReason,
          followUpAction: request.body?.followUpAction,
        }),
      });
    } catch (error) {
      sendTreasuryError(error, response, next);
    }
  });

  router.post("/treasury/weekly/close", adminOnly, (request, response, next) => {
    try {
      response.json({
        closure: treasuryService.closeWeeklyPeriod(actorId(request), {
          executiveApproval: Boolean(request.body?.executiveApproval),
          approvalNotes: request.body?.approvalNotes,
        }),
      });
    } catch (error) {
      sendTreasuryError(error, response, next);
    }
  });

  router.post("/treasury/policy", adminOnly, (request, response, next) => {
    try {
      response.json({
        policy: treasuryService.updatePolicy(actorId(request), {
          companySharePercent: Number(request.body?.companySharePercent ?? 50),
          analystRewardPercent: Number(request.body?.analystRewardPercent ?? 20),
          investorDistributionPercent: Number(request.body?.investorDistributionPercent ?? 30),
        }),
      });
    } catch (error) {
      sendTreasuryError(error, response, next);
    }
  });

  router.get("/treasury/analyst/me", analystOnly, (request, response) => {
    response.json(treasuryService.analystView(actorId(request)));
  });

  return router;
}
