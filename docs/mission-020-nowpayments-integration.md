# Mission 020 - Secure NOWPayments Integration

## Summary

Mission 020 adds a secure server-side NOWPayments integration for Football Performance Fund.

The integration supports:

- Subscription checkout orders.
- Investor funding checkout orders.
- Server-side NOWPayments payment creation.
- Signed IPN webhook verification.
- Idempotent webhook receipts.
- USDT TRC20 and USDT ERC20 payout wallet references selected by customer payment network.
- Conservative payment status mapping.
- Subscription activation only after verified final payment status.
- Investor principal recording only after verified final payment status.
- Treasury ledger records for confirmed payments.
- User notifications and audit logs.
- Admin Payment Center visibility.
- Infrastructure Control Center NOWPayments metadata.

No secrets are stored in Git, frontend bundles, API responses, logs, or documentation.

## Production Webhook URL

`https://football-performance-funds-backend.vercel.app/api/payments/nowpayments/webhook`

Configure this URL in the NOWPayments dashboard IPN settings.

## Environment Variables

Required server-side variables:

- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`
- `NOWPAYMENTS_BASE_URL`
- `NOWPAYMENTS_PAY_CURRENCY`
- `NOWPAYMENTS_PRICE_CURRENCY`
- `NOWPAYMENTS_USDT_TRC20_PAYOUT_WALLET`
- `NOWPAYMENTS_USDT_ERC20_PAYOUT_WALLET`

Optional:

- `NOWPAYMENTS_PUBLIC_KEY`
- `BACKEND_PUBLIC_URL`

Recommended production values:

- `NOWPAYMENTS_BASE_URL=https://api.nowpayments.io`
- `NOWPAYMENTS_PRICE_CURRENCY=USD`
- `NOWPAYMENTS_PAY_CURRENCY=USDTTRC20`
- `BACKEND_PUBLIC_URL=https://football-performance-funds-backend.vercel.app`

Wallet addresses are backend-only configuration. API responses expose only the wallet reference names, for example `NOWPAYMENTS_USDT_TRC20_PAYOUT_WALLET`, never the address value.

## Status Mapping

NOWPayments statuses are normalized as:

- `waiting` -> `WAITING`
- `confirming` / `sending` -> `CONFIRMING`
- `confirmed` -> `CONFIRMED`
- `finished` -> `FINISHED`
- `partially_paid` -> `PARTIALLY_PAID`
- `failed` -> `FAILED`
- `expired` -> `EXPIRED`
- `refunded` -> `REFUNDED`
- unknown -> `MANUAL_REVIEW`

Only `CONFIRMED` and `FINISHED` activate subscriptions or investor funding.

Partial, failed, expired, refunded, mismatched, and unknown statuses do not activate entitlements.

## Security Controls

- NOWPayments calls are server-side only.
- API keys and IPN secrets are never sent to the browser.
- IPN signatures use HMAC-SHA512 over alphabetically sorted JSON.
- Signature comparison uses timing-safe comparison.
- Duplicate webhook events are blocked by unique event keys.
- Amount and currency mismatches route to manual review.
- Investor principal is recorded separately from company profit.
- Payout automation is not implemented in this mission.

## Safe Minimum-Value Live Test

1. Confirm production env vars are configured in Vercel.
2. Configure the NOWPayments IPN webhook URL above.
3. Log in as a test subscriber or investor.
4. Create the smallest allowed checkout from the Payment Center.
5. Pay only the displayed asset on the displayed network.
6. Confirm the Admin Payment Center shows `WAITING`, then `CONFIRMING`, then `CONFIRMED` or `FINISHED`.
7. Confirm subscription or investor principal activates only after final verified status.
8. Confirm treasury ledger, notification, and audit entries are created.

Do not use simulator projected returns as payout promises.

## Rollback

Rollback target before Mission 020:

`00935781f88a7fa4fe686d9e76283b5b75d143ad`

Rollback command if required:

`git revert <mission-020-commit-hash>`

Then redeploy backend and frontend with:

`powershell -ExecutionPolicy Bypass -File scripts/deploy-production.ps1`
