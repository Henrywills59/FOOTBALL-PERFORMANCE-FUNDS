# Lovable Phase 2 Reconciliation

## Scope

This document records the controlled merge audit for the Lovable Phase 2 frontend work and the current Codex recovery branch.

## Branch And Commit Inventory

- Current integration branch: `codex/lovable-phase2-reconciliation`
- Source branch before reconciliation: `codex/vercel-preview-verification`
- Current Codex recovery commit before reconciliation: `740c00b Fix frontend Vercel routing recovery`
- Country Partner foundation commit: `3910efd Add country partner network foundation`
- Latest reachable Lovable-labelled commit: `34d7c4e Integrate Lovable UI shell into production platform`
- Remote branches exposed by `origin` during audit:
  - `origin/main`
  - `origin/codex/vercel-preview-verification`

No separate remote Lovable branch was exposed by `origin`, and `.lovable/plan.md` was not present in any reachable branch or commit during this audit.

## Lovable Work Already Present

Commit `34d7c4e` is already an ancestor of both the current recovery branch and local `main`.

Files changed by the reachable Lovable commit:

- `docs/lovable-ui-integration-audit.md`
- `frontend/src/App.tsx`
- `frontend/src/PublicExperience.tsx`
- `frontend/src/styles.css`

Already present from reachable history:

- Unified public website/application shell
- Premium public experience components
- Updated navigation shell
- Frontend styling updates
- Match Intelligence wording in the intelligence workflow areas

## Missing From Reachable Git History

The following named Lovable Phase 2 artifacts were not found as a separate commit or branch:

- `.lovable/plan.md`
- Dedicated `/partner/*` frontend route map
- Separate Current Season page file
- Separate Participation Plan page file
- Separate Participation Simulator page file
- Separate Distribution History page file
- Separate Contract Progress page file
- Separate Season Reports page file
- Separate Renewal page file
- Lovable-specific mock adapters for those pages

## Codex Work Preserved

The reconciliation preserves current Codex backend and production recovery work:

- Season Engine foundation
- Performance Partner compatibility model
- Participation plans and simulator APIs
- Financial Engine
- Treasury Ledger
- Company Capital Desk
- Country Partner Network
- NOWPayments integration and payout routing
- Vercel frontend/backend routing recovery

## Frontend Backend Contract Decisions

- Internal role key remains `INVESTOR`.
- Public UI can display `Performance Partner`.
- Existing `/api/investor/*` calls remain untouched because they are the production-backed adapters.
- Existing backend `/api/performance-partner/*` aliases remain available.
- No mock financial adapter was introduced into the production path.
- `/investor/*` links remain backward-compatible.
- `/partner/*` links now map to the authenticated Performance Partner portal views.

## Route Compatibility Added

New frontend private route aliases:

- `/partner`
- `/partner/dashboard`
- `/partner/current-season`
- `/partner/participation-plan`
- `/partner/participation-plans`
- `/partner/participation-simulator`
- `/partner/distribution-history`
- `/partner/distributions`
- `/partner/contract-progress`
- `/partner/season-reports`
- `/partner/renewal`
- `/partner/wallet`
- `/partner/payments`
- `/partner/portfolio`
- `/partner/withdrawals`
- `/partner/profile`
- `/partner/settings`
- `/partner/documents`
- `/partner/support`

Backward-compatible legacy aliases retained:

- `/investor/*`
- `/dashboard/investor`
- `/for-investors`

Public aliases added:

- `/partners`
- `/performance-partners`

## Overlapping Files

Likely overlap if the missing Lovable Phase 2 branch later becomes available:

- `frontend/src/App.tsx`
- `frontend/src/types.ts`
- `frontend/src/styles.css`
- `shared/src/index.ts`

Expected backend overlap:

- `backend/src/investor/*`
- `backend/src/season/*`
- `backend/src/payments/*`
- `database/prisma/schema.prisma`

## Likely Conflict Areas

- Lovable route state versus the current single-file React operating system shell.
- Lovable mock service placeholders versus real backend adapters.
- Public Performance Partner terminology versus internal `INVESTOR` role and database compatibility.
- Season-based UI wording versus older investor plan screens.
- Financial simulator copy versus production treasury and payment safety rules.

## Production Safety Notes

- No browser-only code was added outside React effects or event handlers.
- No server-side rendering assumptions were introduced.
- No provider credentials or wallet addresses were added.
- No backend role key, payment purpose, or database table name was destructively renamed.
- No development-only mock financial behavior was added to the production path.

