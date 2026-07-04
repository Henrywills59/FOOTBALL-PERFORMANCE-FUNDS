# Phase 6 Admin Portal

This phase adds a secure Admin-only dashboard for managing platform operations.

## Included

- Admin dashboard metrics
- Prediction review with approve, reject, and admin notes
- Fixture management with manual sync, API status, and sync logs
- User management with search, suspend, activate, password reset, and role assignment
- Audit logs for admin actions
- Login history storage
- Settings for prediction confidence, risk threshold, maximum selections, scheduled sync, and maintenance mode

## Security

- Admin routes require a valid JWT and the `ADMIN` role.
- Admin actions are written to audit logs.
- Approved predictions are the only predictions visible to subscribers.

## Deferred

- Investor management
- Payments
- Wallet functionality
