# Football Performance Fund

Clean Phase 1 scaffold for the Football Performance Fund platform.

## Tech Stack

- Node.js
- Express
- PostgreSQL / Supabase
- Prisma
- React
- Vite
- Tailwind CSS
- Docker
- Vercel

## Project Structure

```text
backend/   Express API and health checks
database/  Prisma schema and database tooling
docs/      Architecture and operating notes
frontend/  React + Vite web app
shared/    Shared TypeScript types
```

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment templates:

   ```bash
   cp .env.example .env
   cp frontend/.env.local.example frontend/.env.local
   cp backend/.env.example backend/.env
   ```

3. Start local infrastructure:

   ```bash
   docker compose up -d postgres
   ```

4. Run the apps:

   ```bash
   npm run dev
   ```

## Health Check

The API exposes:

```text
GET /health
```

Expected response:

```json
{
  "status": "ok",
  "service": "football-performance-fund-api"
}
```

## One-Command Production Deployment

After the Vercel deployment limit resets, run this once from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-production.ps1
```

The script verifies Git status, commits pending fixes if needed, pushes to `origin main`, configures a fresh protected admin seed token in the backend Vercel project, deploys the backend, synchronizes the production admin password hash through the deployed backend, checks production `/api/health`, tests the admin login endpoint, then deploys the frontend. It prints clear PASS/FAIL results and is safe to rerun.

Every run also saves the full result here:

```text
docs/latest-deploy-result.txt
```

If deployment or login fails, open that file. It includes Git status, backend deployment output, health/login responses, debug-login output, warnings, the final PASS/FAIL summary, and the exact `failedStage` when the backend reports one. Git LF/CRLF warnings are reported separately and do not stop the deployment unless Git exits with a non-zero status.

To avoid putting the admin password in the command, the script uses the seeded default password unless `FPF_ADMIN_PASSWORD` is set.

The script does not require local `DATABASE_URL` entry for normal deployments. If Vercel does not expose sensitive production secrets through `vercel env pull`, the script seeds the admin password through a protected backend endpoint that runs inside Vercel, where the backend already has access to `DATABASE_URL`.

## Phase 1 Scope

Included:

- Clean monorepo scaffold
- Frontend placeholder
- Backend health endpoint
- Authentication and user roles
- Football data sync and fixture display
- Prediction generation and admin review
- Subscriber dashboard, match center, smart slip, opportunities, and profile
- Secure admin dashboard, audit logs, settings, and platform controls
- Professional investor portal with plans, portfolio, reports, and withdrawal requests
- Shared types package
- Prisma database package
- Environment templates
- Docker setup
- Documentation starter

Not included yet:

- Payments
- Football APIs
- AI features
- Investor features

## Football Data

Phase 3 adds API-Football and The Odds API integration through backend services. Provider keys are stored in environment variables, and automatic sync jobs are enabled with `ENABLE_FOOTBALL_JOBS=true`.

## Prediction Review

Phase 4 adds a prediction engine that reads stored football fixtures, standings, injuries, head-to-head records, and odds. Predictions remain pending until Admin approval, and only approved predictions appear in the subscriber-facing preview.

## Subscriber Platform

Phase 5 adds the subscriber workspace: dashboard, match center, smart bet slip, daily opportunities, prediction details, and profile/password management. It uses approved predictions only and does not add payment, wallet, investor, or admin portal features.

## Admin Dashboard

Phase 6 adds admin-only platform management for users, predictions, fixtures, audit logs, settings, and system health. Investor management, payments, and wallet functionality remain out of scope.

## Investor Platform

Phase 7 adds a conventional investor portal with investment plans, portfolio tracking, reports, and withdrawal requests. It does not include payment gateways, NOWPayments, wallet functionality, or cryptocurrency features.

## Wallet & NOWPayments

Phase 8 adds investor wallet balances, transaction history, NOWPayments deposit invoices, verified IPN handling, confirmed-only wallet credits, and admin-approved wallet withdrawals. API keys remain backend-only.

## Authentication

Phase 2 adds:

- Public registration for Subscriber, Investor, and Analyst roles
- Admin role support without public Admin registration
- Login with JWT sessions and a remember me option
- Forgot/reset password token flow with a placeholder email handoff
- Protected profile and role-based dashboard routes

API routes are mounted under `/api`.
