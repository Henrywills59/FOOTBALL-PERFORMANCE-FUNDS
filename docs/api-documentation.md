# API Documentation

All protected routes use `Authorization: Bearer <jwt>`.

## Health

- `GET /health`
- `GET /api/admin/monitoring`

## Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/users/me`
- `POST /api/users/me/password`

## Football

- `GET /api/football/fixtures`
- `GET /api/football/fixtures/:id`
- `GET /api/football/sync/status`
- `POST /api/football/sync`

## Predictions And Intelligence

- `GET /api/predictions/approved`
- `POST /api/predictions/fixtures/:fixtureId/generate`
- `GET /api/intelligence/published`
- `GET /api/analyst/dashboard`
- `POST /api/analyst/intelligence`
- `GET /api/admin/intelligence`

## Admin

- `GET /api/admin/overview`
- `GET /api/admin/reports`
- `GET /api/admin/audit-logs`
- `GET /api/admin/settings`
- `PATCH /api/admin/settings`

## Investor And Wallet

- `GET /api/investor/dashboard`
- `GET /api/wallet`
- `POST /api/wallet/deposits`
- `POST /api/wallet/withdrawals`
- `POST /api/nowpayments/ipn`

