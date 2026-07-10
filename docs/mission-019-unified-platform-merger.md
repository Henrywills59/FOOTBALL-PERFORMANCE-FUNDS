# Mission 019 - Unified Website and Operating System Merger

## Pre-Merger Architecture Map

FPF is already a monorepo with one production frontend, one production backend, one Prisma schema, and one deployment workflow.

- Frontend: `frontend/src/App.tsx`, Vite, React, Tailwind, single-page application.
- Backend: `backend/src/app.ts`, Express, serverless-ready Vercel entrypoints.
- Database: `database/prisma/schema.prisma`, PostgreSQL/Supabase through Prisma.
- Shared contracts: `shared/src/index.ts` plus standalone frontend types.
- Deployment: `scripts/deploy-production.ps1`, Vercel frontend and backend projects.

## Existing Roles

Current implemented backend roles are `SUBSCRIBER`, `INVESTOR`, `ANALYST`, and `ADMIN`.
Mission-level roles such as Analyst Applicant, Academy Analyst, Active Analyst, Media Team, Reviewer, Executive, and Super Admin are represented through current modules, workflow status, admin permissions, and placeholders without adding an unsafe second role system.

## Backend Route Map

Public backend routes include authentication, commercial structure, globalization reference data, analyst applications, health, and debug/config-safe diagnostics.

Protected route groups include:

- `/api/users/me`, `/api/dashboards/me`
- `/api/intelligence/*`
- `/api/football/*`
- `/api/predictions/*`
- `/api/prediction-workflow/*`
- `/api/subscriber/*`
- `/api/investor/*`
- `/api/wallet/*`
- `/api/analyst/*`
- `/api/war-room`
- `/api/treasury/*`
- `/api/analytics/*`
- `/api/reports`, `/api/notifications`
- `/api/admin/*`

Backend authorization remains the final security boundary.

## Database Map

The existing Prisma schema remains the source of truth. Major table groups cover users/auth, football data, predictions, prediction workflow, investors, wallets, globalization, commercial pricing, reports, notifications, media, analysts, treasury, analytics, infrastructure, procurement, renewals, billing metadata, and audit logs.

No destructive database changes were required for Mission 019.

## Merger Plan Followed

1. Preserve the existing Codex-engineered operating system as the source of truth.
2. Keep a single React frontend and single Express backend.
3. Convert the public website from hash-only sections into canonical public routes.
4. Keep one login, one registration flow, one password-recovery flow, and one session.
5. Route authenticated users into `/app`.
6. Keep public pages public and mark private app paths as noindex.
7. Add safe legacy route handling for dashboard bookmarks.
8. Extend public search/navigation without exposing private data.
9. Preserve role-based dashboards and backend guards.
10. Run full regression checks and deploy through the existing production script.

## Public Pages Integrated

Canonical public pages now include:

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

Legacy public aliases such as `/for-subscribers`, `/for-investors`, `/for-analysts`, `/privacy`, and `/terms` resolve to canonical public content.

## Auth Consolidation

The existing `/api/auth/login`, `/api/auth/register`, and `/api/auth/reset-password` endpoints remain the only auth flow. The public website auth card uses the same API client and session storage as the operating system.

Authenticated users are routed to `/app`; signing out returns users to `/`.

## Unified Navigation

Public pages use a public navigation shell. Authenticated pages use the existing secure application shell with sidebar navigation, global search, notifications, preferences, workspace switching for admins, and role-specific views.

## Global Search

Global search includes public pages plus role-loaded private entities. Admin-only entities only appear after admin data loads for an authorized admin.

## SEO and Indexing

Public canonical pages are listed in `frontend/public/sitemap.xml`.
Private `/app` and `/dashboard` paths are disallowed in `frontend/public/robots.txt`, and runtime metadata sets `noindex,nofollow` for authenticated/private views.

## Security Validation

- Public pages do not expose private analyst, investor, treasury, or admin datasets.
- Backend role guards remain unchanged.
- Private route data continues to require JWT authorization.
- Raw secrets are not exposed.
- Public search does not grant access to private modules.

## Rollback Reference

Previous production commit before Mission 019: `a406b031243b8e2c1b5df809dd40461852664d76`.

Rollback command:

```powershell
git revert <mission-019-commit>
git push origin main
powershell -ExecutionPolicy Bypass -File scripts/deploy-production.ps1
```

## Remaining Placeholders

External APIs remain intentionally unconnected for live payments, live exchange rates, external translations, live AI providers, payment gateways, and provider billing APIs.
