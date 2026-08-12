# FPF Production Launch Hardening Report

Branch: `codex/final-production-launch`

Base: `origin/main` at `ed9d2c7707a47c0c283c9c64ad36cd81e78919eb`

## Summary

This launch hardening pass preserved the current Express, Prisma, React, Vite, Vercel architecture and made the safest launch-critical access-control update: the legacy `ANALYST` workspace role is now retired at authentication and protected route boundaries.

The platform still preserves historical/internal analyst data structures, financial allocation labels, and existing internal workflow code where removing them would risk data loss or break production modules. Active workspace access is now constrained through runtime authorization instead of destructive schema changes.

## Role Model

Active launch roles are represented operationally as:

- `SUBSCRIBER`
- `INVESTOR` / public Performance Partner wording
- `COUNTRY_PARTNER`
- `CEO` / executive-capital internal access where already implemented
- `ADMIN`

Legacy role handling:

- `ANALYST` remains in Prisma/shared types for backward compatibility with existing data and internal model names.
- `ANALYST` login now fails closed with HTTP 403.
- Stale `ANALYST` JWT sessions are rejected by protected middleware.
- Admin role assignment no longer offers `ANALYST`.
- Operational routes that previously accepted `ANALYST` now require admin/internal access.

## Supabase Auth and RLS Scope Note

The current repository is not a Supabase Auth/RLS client application. It is an Express API using Prisma against PostgreSQL/Supabase. No Supabase Auth helper or SQL RLS policy surface exists in this repository to harden without changing architecture.

No RLS policies were added in this pass because doing so would require a separate database-policy migration plan and production data access review. Current authorization is enforced server-side through Express JWT middleware, role guards, service-level ownership checks, and tests.

## Launch-Critical Changes

- Added active/retired role helpers in the shared package.
- Denied retired roles in `requireRole`.
- Denied retired analyst accounts during login and token hydration.
- Removed retired analyst assignment from admin user role update validation.
- Converted football, prediction, intelligence workflow, media, analytics, treasury, and analyst operational routes from analyst access to admin/internal access.
- Preserved subscriber and investor access to customer-safe intelligence endpoints.
- Added/updated tests proving:
  - Public investor role normalization remains safe.
  - Public admin registration remains blocked.
  - Retired analyst login fails closed.
  - Retired analyst tokens cannot run football sync or internal operational routes.
  - Internal workflows still operate through admin authorization.
  - Payment idempotency and wallet protections remain intact.

## Files Changed

- `shared/src/index.ts`
- `frontend/src/App.tsx`
- `backend/src/admin/adminRoutes.ts`
- `backend/src/analyst/analystRoutes.ts`
- `backend/src/analytics/analyticsRoutes.ts`
- `backend/src/auth/authMiddleware.ts`
- `backend/src/auth/authRoutes.ts`
- `backend/src/auth/authService.ts`
- `backend/src/auth/dashboard.ts`
- `backend/src/football/footballRoutes.ts`
- `backend/src/intelligence/aiRoutes.ts`
- `backend/src/intelligence/routes.ts`
- `backend/src/intelligenceWorkflow/intelligenceWorkflowRoutes.ts`
- `backend/src/media/routes.ts`
- `backend/src/operations/routes.ts`
- `backend/src/predictionWorkflow/predictionWorkflowRoutes.ts`
- `backend/src/predictions/predictionRoutes.ts`
- `backend/src/treasury/treasuryRoutes.ts`
- Backend tests for auth, football, analyst, analytics, treasury, media, predictions, prediction workflow, and intelligence decision/workflow routes.

## Database

No Prisma schema or migration changes were made.

Reason: deleting or renaming `ANALYST` in the database enum would be destructive and could break existing historical records, treasury allocation labels, and internal intelligence audit data. Runtime access was hardened instead.

## APIs and Authorization

Changed behavior:

- `POST /api/auth/login` returns HTTP 403 for active legacy `ANALYST` users.
- `GET /api/auth/dashboards/analyst` is admin-only compatibility surface.
- Manual football sync endpoints are admin-only.
- Prediction generation and operational workflow endpoints are admin-only.
- Analyst/war-room/internal intelligence routes are no longer available to retired analyst tokens.

Unchanged:

- Subscriber dashboard/intelligence access.
- Investor / Performance Partner access.
- Country Partner routes.
- Payment routes and NOWPayments webhook behavior.
- Treasury and ledger business rules.
- Frontend route structure.

## Verification Results

Completed successfully:

- `npm audit --omit=dev` - PASS, 0 vulnerabilities.
- `npm run typecheck` - PASS.
- `npm test` - PASS.
- `npm run build` - PASS.

Prisma:

- `prisma generate` completed through workspace scripts.
- `prisma validate` completed through `npm run typecheck`.

Notes:

- Local tests intentionally log provider startup warnings for missing production provider variables. These warnings do not fail tests and do not expose secret values.
- Prisma reported a non-blocking major version update notice from `5.22.0` to `7.9.1`; no dependency upgrade was performed during this launch hardening pass.

## Remaining Deferred Work

- If FPF later decides to physically remove legacy `ANALYST` from the database enum, perform it as a dedicated data migration after mapping or archiving existing rows.
- Supabase RLS hardening should be handled as a separate database-policy project if direct browser database access is ever introduced.
- Production provider health checks must be verified in Vercel with production environment variables present; local tests use safe fallback mode.

## Launch Recommendation

Ready for review as a launch-hardening pull request.

Do not merge until reviewers confirm that retiring active analyst workspace access is the intended public launch posture.
