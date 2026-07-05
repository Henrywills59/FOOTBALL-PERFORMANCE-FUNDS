# Phase 8 Wallet & NOWPayments

This phase adds investor wallet infrastructure and NOWPayments deposit handling. It does not add FPF Coin or platform-specific crypto assets.

## Wallet

- Available balance
- Pending balance
- Investment balance
- Withdrawal balance
- Transaction history

## NOWPayments

- Server-side invoice creation
- Payment status handling through verified IPN webhooks
- Wallet credit only after confirmed payment status
- API keys are read from backend environment variables only

## Security

- No negative wallet balances
- Duplicate deposits are blocked by external payment ID
- Withdrawal transactions can be reviewed only once
- Withdrawal requests require admin approval before payout processing
- Every wallet transaction action is audited

## Environment Variables

- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`
- `NOWPAYMENTS_BASE_URL`
