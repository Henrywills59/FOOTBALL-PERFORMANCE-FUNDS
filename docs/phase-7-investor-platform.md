# Phase 7 Investor Platform

This phase adds a professional investor portal without cryptocurrency features, payment gateways, NOWPayments, or wallet functionality.

## Included

- Investor dashboard with total investment, portfolio value, weekly ROI, lifetime ROI, history, and status.
- Investment plans with minimum and maximum investment ranges.
- Historical performance notes only.
- Risk disclosure before recording investment interest.
- Portfolio view for active and completed investments.
- Investor reports for weekly and monthly summaries.
- Withdrawal request creation and status history.
- Admin approval endpoint for withdrawal requests.
- Audit logging for investment and withdrawal actions.

## Safety Rules

- Investor routes require the `INVESTOR` role.
- Admin withdrawal review requires the `ADMIN` role.
- No guaranteed profits are shown.
- Historical performance is explicitly labeled as historical.
- Every investment action is audited.
