# Lovable UI Integration Audit

Date: 2026-07-10

## Source of Truth

The production FPF system remains the source of truth for authentication, roles, backend APIs, database access, NOWPayments, treasury, reconciliation, notifications, reporting, monitoring, and infrastructure controls.

## Repository Findings

- No separate Lovable source tree was present in the repository.
- Current public redesign work is already integrated through `frontend/src/PublicExperience.tsx`.
- Current authenticated role experiences are consolidated in `frontend/src/App.tsx`.
- The frontend uses one API client path through `VITE_API_BASE_URL` / `VITE_API_URL` and the deployed backend fallback.
- Authentication is single-session based with one login/register/forgot flow and role-based rendering.

## Public Routes

The public route inventory is defined in `frontend/src/App.tsx` via `publicPageDefinitions`.

Operational public routes now resolve into the unified public experience:

- `/`
- `/about`
- `/platform`
- `/how-fpf-works`
- `/subscribers`
- `/investors`
- `/analyst-applications`
- `/technology`
- `/ai-intelligence`
- `/performance`
- `/pricing`
- `/investor-packages`
- `/security`
- `/blog`
- `/media`
- `/careers`
- `/contact`
- `/faq`
- `/privacy-policy`
- `/terms-and-conditions`
- `/risk-disclosure`
- `/responsible-participation`
- `/cookie-policy`

Legacy aliases remain:

- `/for-subscribers` -> `/subscribers`
- `/for-investors` -> `/investors`
- `/for-analysts` -> `/analyst-applications`
- `/legal` -> `/terms-and-conditions`
- `/privacy` -> `/privacy-policy`
- `/terms` -> `/terms-and-conditions`

## Authenticated Route Model

Authenticated navigation remains role-specific and production-connected:

- Subscriber: dashboard, opportunities, live intelligence, performance, live match center, reports, profile, settings, notifications, referrals.
- Investor: dashboard, simulator, earnings, reports, capital, profile, settings, documents, support, wallet, payments, plans, portfolio, withdrawals.
- Analyst: dashboard, War Room, academy, prediction workspace, performance, analytics, treasury, rewards, profile, settings.
- Admin: command center, executive BI, infrastructure, payments, prediction review, intelligence review, analysts, War Room, treasury, investor management, business, media, reports, monitoring, announcements, fixtures, users, audit logs, settings.

## Preserved Production Modules

No backend routes, database models, authentication logic, payment logic, treasury logic, reconciliation logic, or role guards were replaced by visual placeholders.

## Duplicate Components

No duplicate Lovable components were found to archive. The repository currently uses one public experience component and one authenticated app shell.

## Module 7 Preparation

The future Executive Global Command Wall is prepared but disabled by default.

- Feature flag: `VITE_ENABLE_EXECUTIVE_GLOBAL_COMMAND_WALL=true`
- Reserved admin navigation item: `Global Command Wall`
- Reserved route handler: `ExecutiveGlobalCommandWallPlaceholder`
- Reusable shell components: `CommandCenterLayout`, `StatusCard`

This keeps Module 7 addable without rebuilding the app shell.

## Release Notes

The integration keeps the current deployment architecture intact. Production verification should continue to use `scripts/deploy-production.ps1`.
