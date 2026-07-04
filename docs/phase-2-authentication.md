# Phase 2 Authentication & Users

This phase adds simple role-aware authentication without adding payments, football APIs, AI, settlement, or token features.

## Included

- Registration for Subscriber, Investor, and Analyst
- Admin role support, but not public Admin selection
- Login with hashed passwords and JWT sessions
- Remember me session duration
- Forgot/reset password token flow
- Placeholder email handoff for reset tokens
- Protected profile route
- Role-based dashboard routes
- Frontend login, registration, reset, profile, and dashboard placeholders

## API Routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/users/me`
- `GET /api/dashboards/me`
- `GET /api/dashboards/subscriber`
- `GET /api/dashboards/investor`
- `GET /api/dashboards/analyst`
- `GET /api/dashboards/admin`
