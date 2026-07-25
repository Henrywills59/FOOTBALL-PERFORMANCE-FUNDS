# FPF Master Implementation Gap Analysis

Generated: 2026-07-15

## Executive Positioning

Football Performance Fund is moving from a prediction-platform posture to a global football performance intelligence company. The public brand remains Football Performance Fund (FPF). The internal product platform is FPF OS, the Football Performance Fund Operating System.

This repository already contains a broad production platform. The correct path is an incremental migration that preserves authentication, dashboards, payment scaffolding, football-data services, and existing database records while introducing the new seasonal and Performance Partner operating model.

## Repository Inspection Summary

Inspected areas:

- Root workspace configuration: `package.json`, workspaces, Vercel configs.
- Backend modules: `admin`, `analyst`, `analytics`, `auth`, `commercial`, `football`, `globalization`, `infrastructure`, `intelligence`, `investor`, `media`, `operations`, `payments`, `predictionWorkflow`, `public`, `subscriber`, `treasury`, `wallet`.
- Frontend application shell: `frontend/src/App.tsx`, public metadata, local types.
- Shared contracts: `shared/src/index.ts`.
- Database schema: `database/prisma/schema.prisma`.
- Documentation and deployment artifacts.

## Current Feature Inventory

Keep these working modules:

- Authentication, JWT sessions, protected routes, and role redirects.
- Admin command center, monitoring, reports, infrastructure, media, commercial control, payments control, and treasury views.
- Subscriber portal, intelligence dashboard, opportunities, live fixtures, reports, settings, notifications, and profile.
- Analyst portal, War Room, prediction workflow, academy placeholders, intelligence review, and performance views.
- Current investor portal and wallet/payment scaffolding as the migration foundation for Performance Partner portal.
- Intelligence Core, AI Decision Engine, API-Football integration, provider diagnostics, and safe fallback behavior.
- Prisma/PostgreSQL data layer and workspace build pipeline.

## Major Gap Analysis

### 1. Brand and Terminology

Current state:

- Public copy still uses "prediction", "investor", "investment", "bet", "bet slip", and related finance/betting language in several places.
- `frontend/index.html` already describes FPF as a unified operating system, but most application modules still use investor-era naming.

Required state:

- Public language: Football Performance Fund, global football performance intelligence company.
- Internal language: FPF OS.
- Subscriber-facing output: verified selections, not public tips.
- Investor-facing language migrates to Performance Partner.

Gap:

- Needs a terminology migration layer before renaming code symbols or database tables.

### 2. Season Operating Model

Current state:

- Football data uses a numeric `season` field for leagues, fixtures, standings, and statistics.
- Financial participation does not belong to an explicit FPF business season.

Required state:

- Season Registration.
- Active Season.
- Season Settlement.
- Season Closing.
- Next Season Registration.
- Every participation agreement belongs to one FPF Season.

Gap:

- Missing FPF-specific season tables, status lifecycle, and season-linked participation agreements.

### 3. Performance Partner Model

Current state:

- Backend package/module names, routes, shared types, database tables, UI labels, tests, and docs use investor terminology.
- Role enum contains `INVESTOR`.

Required state:

- User-facing model: Performance Partner.
- Participation plans: Half Season, Full Season, Remaining Season.
- Contracts expire at end of agreed participation period.
- No automatic renewals.

Gap:

- Needs compatibility strategy. The internal role may temporarily remain `INVESTOR` while UI/API aliases expose "Performance Partner" to avoid destructive migration.

### 4. Mid-Season Participation

Current state:

- Investor simulator supports weeks, reinvestment, withdrawal frequency, and placeholder returns.
- No explicit current-season calendar or no-retroactive-distribution rule.

Required state:

- Calculate remaining weeks, remaining distributions, remaining contract duration, and contract expiry.
- No retroactive distributions.

Gap:

- Requires season calendar, participation agreement dates, and distribution eligibility windows.

### 5. Contract Model

Current state:

- Existing portal and docs still reference investment amount, capital, withdrawals, and end-of-contract concepts.

Required state:

- Contractual payout is the complete financial obligation.
- No separate capital repayment after completion.
- Returning members register for the next season.

Gap:

- Requires financial-copy cleanup and new contract ledger fields that preserve historical records.

### 6. Financial Constitution

Current state:

- Treasury schema has `ProfitDistributionPolicy` with older defaults around company, analyst, and investor distribution percentages.
- Analytics copy references an old 30% investor share.

Required state:

- 35% Performance Partner Distribution Pool.
- 15% Analyst Performance Pool.
- 15% Risk & Stability Reserve.
- 35% Company Growth & Operations Fund.
- Future seasons can change percentages without changing historical records.

Gap:

- Need season-versioned financial policy with immutable allocation snapshots.

### 7. Risk Reserve and Growth Fund

Current state:

- Treasury ledger exists and supports account-style records.
- No dedicated reserve/growth-fund models exposed as first-class concepts.

Required state:

- Risk & Stability Reserve is non-distributable.
- Company Growth & Operations Fund supports infrastructure, APIs, technology, marketing, expansion, product development, legal, and compliance.

Gap:

- Need explicit fund accounts, ledger classifications, and admin/executive reporting.

### 8. Analyst Reward Model

Current state:

- Analyst performance, rewards, rankings, and treasury placeholders exist.
- Some copy and logic still risks simple share-based assumptions.

Required state:

- Weekly Analyst Performance Pool.
- Rewards based on accuracy, analysis quality, confidence calibration, risk discipline, documentation, team contribution, and continuous improvement.
- Equal sharing prohibited.

Gap:

- Need weighted scoring model and immutable weekly reward calculations.

### 9. Analyst Workflow

Current state:

- Intelligence Core, Decision Engine, Prediction Workflow, Analyst Assignment, Analyst Submission, War Room, and Admin Review exist.

Required state:

- Intelligence Engine -> Global Match Scanner -> Candidate Queue -> Analyst Assignment -> Analysis -> Evidence -> Confidence -> Risk Review -> Senior Review -> Approval -> Publication -> Settlement -> Performance Review.

Gap:

- Current workflow is close but needs explicit status names, evidence model, senior-review step, settlement link, and performance-review closure.

### 10. Company Capital Desk

Current state:

- Treasury and executive situation modules exist.

Required state:

- Private Company Capital Desk with capital approval, exposure management, execution history, performance reporting, and risk monitoring.
- Never visible to subscribers.

Gap:

- Needs route/UI naming alignment and strict RBAC audit for subscriber isolation.

### 11. Intelligence Engine Boundaries

Current state:

- Decision Engine returns scored recommendations and does not publish automatically.
- Prediction workflow uses admin/analyst actions.

Required state:

- Engine scans, ranks, recommends.
- Human analysts remain responsible for approval.

Gap:

- Mostly satisfied. Needs documentation and tests proving no automatic publication path.

### 12. Subscriber Platform

Current state:

- Subscriber can see confidence, risk, value, opportunity cards, and intelligence.

Required state:

- Subscribers receive only verified selections.
- Never expose internal confidence calculations, company capital positions, or analyst discussions.

Gap:

- Needs classification between public display confidence/risk and internal calculations. UI copy should say verified selections and curated intelligence.

### 13. Performance Partner Portal

Current state:

- Investor dashboard, profile, distributions, reports, simulator, wallet/payments, capital, documents, and support placeholders exist.

Required state:

- Performance Partner dashboard, active season, contract progress, weekly distribution history, remaining participation, season reports, renewal, participation simulator.

Gap:

- Existing portal can be upgraded through labels, types, and new season participation APIs.

### 14. Executive Dashboards

Current state:

- Admin dashboard, executive BI, treasury executive situation, analytics executive dashboard.

Required state:

- CEO, Finance, Risk, Intelligence, and Operations dashboards with season KPIs, analyst performance, financial overview, risk exposure, platform health.

Gap:

- Existing dashboards need role/view segmentation and season-aware metrics.

### 15. Provider Abstraction

Current state:

- API-Football, Odds API, NOWPayments, and placeholder provider layers exist.

Required state:

- Replaceable providers for football data, odds, AI, and payments.

Gap:

- Mostly started; needs consistent provider registry interface and adapters across all integrations.

### 16. Security

Current state:

- JWT auth, RBAC, audit logs, rate limiting, helmet, CORS, and Prisma exist.

Required state:

- Stronger RBAC, immutable financial records, 2FA placeholder, secret management, audit logs.

Gap:

- Missing 2FA implementation, stronger role taxonomy, immutable ledger enforcement, and production-debug endpoint hardening.

## Modules Requiring Upgrade

- `backend/src/investor`: migrate outward-facing model to Performance Partner while preserving internal compatibility.
- `backend/src/commercial`: replace investment packages with participation plans and season-linked settings.
- `backend/src/treasury`: add Financial Constitution allocations, Risk & Stability Reserve, Company Growth & Operations Fund, and immutable seasonal snapshots.
- `backend/src/analytics`: update old investor-share assumptions and add executive dashboard segmentation.
- `backend/src/predictionWorkflow`: formalize full workflow stages and settlement/performance-review closure.
- `backend/src/analyst`: add evidence/senior review weighting and analyst pool calculation.
- `frontend/src/App.tsx`: user-facing terminology, navigation, and portal screens need incremental extraction and migration.
- `shared/src/index.ts`: introduce compatibility aliases and new FPF Season/Performance Partner contracts.
- `database/prisma/schema.prisma`: add non-destructive seasonal and participation models.
- `README.md` and docs: update positioning and remove legacy prediction/investor emphasis.

## Missing Modules

- FPF Season registry and lifecycle manager.
- Participation agreement model.
- Participation plan model: Half Season, Full Season, Remaining Season.
- Mid-season eligibility calculator.
- Season-versioned Financial Constitution.
- Risk & Stability Reserve ledger/fund.
- Company Growth & Operations Fund ledger/fund.
- Analyst Performance Pool scoring and weekly allocation engine.
- Evidence artifact model for analyst workflow.
- Senior review stage.
- Settlement and performance-review closure linkage.
- Public/internal terminology layer.
- Production-safe 2FA placeholder and session/device center.

## Keep / Upgrade / Add Matrix

| Area | Decision | Reason |
| --- | --- | --- |
| Auth and RBAC | Keep, then harden | Working and tested; needs future roles/2FA. |
| Prisma schema | Extend only | Existing production data must be preserved. |
| Investor module | Upgrade incrementally | Becomes Performance Partner portal without destructive table renames first. |
| Treasury module | Upgrade | Foundation exists, but constitution/funds must change. |
| Intelligence Engine | Keep | Already matches scan/rank/recommend direction. |
| Prediction workflow | Upgrade | Needs explicit evidence, senior review, settlement, performance review. |
| Subscriber portal | Upgrade copy/data exposure | Must show verified selections, not internal calculations. |
| Frontend monolith | Refactor gradually | Large file is functional but difficult to safely evolve. |
| Deployment scripts | Keep | Do not change unless blocking production. |

## Phased Implementation Roadmap

### Phase 1: Stabilizing Language and Compatibility

- Add a terminology compatibility layer.
- Update public copy to FPF OS and performance intelligence.
- Replace user-facing "Investor" labels with "Performance Partner" while retaining internal role compatibility.
- Add tests proving current role redirects still work.

### Phase 2: FPF Season Foundation

- Add FPF season schema, lifecycle statuses, and season settings.
- Add season service and admin APIs.
- Link new participation records to season.
- Do not migrate old investor records destructively.

### Phase 3: Performance Partner Participation Agreements

- Add participation plans: Half Season, Full Season, Remaining Season.
- Add mid-season calculator.
- Add contract expiry and no-retroactive-distribution rules.
- Upgrade partner dashboard to active season/contract progress.

### Phase 4: Financial Constitution and Funds

- Add season-versioned financial policy.
- Implement 35/15/15/35 allocation snapshots.
- Add Risk & Stability Reserve and Company Growth & Operations Fund ledger classifications.
- Update treasury and executive reports.

### Phase 5: Analyst Performance Pool and Workflow

- Add evidence model and senior review.
- Add analyst performance scoring weights.
- Create weekly analyst performance pool allocation engine.
- Prohibit equal-share allocation in service validation.

### Phase 6: Subscriber Verified Selection Experience

- Rename subscriber-facing outputs to verified selections.
- Hide internal calculations and analyst/private company data.
- Add tests that subscriber endpoints never expose internal War Room, capital, or analyst discussion fields.

### Phase 7: Executive Role Dashboards and Security

- Add CEO, Finance, Risk, Intelligence, and Operations dashboard views.
- Strengthen RBAC and audit logs.
- Add 2FA placeholder flow and immutable financial record controls.

### Phase 8: Provider Adapter Normalization

- Standardize football, odds, AI, payment, weather, and notification provider contracts.
- Route all provider diagnostics through the same registry.

## Proposed First Incremental Batch

Recommended first implementation batch:

1. Add shared terminology constants and UI labels for FPF OS and Performance Partner.
2. Update public-facing copy only, leaving database names and role enum unchanged.
3. Add non-breaking shared types for FPF Season and Participation Plan.
4. Add tests around role redirects and protected route compatibility.
5. Prepare, but do not apply, the first Prisma migration for season records until production migration timing is approved.

This avoids the dangerous failure mode: renaming `INVESTOR`, `investor_*` tables, and route names before the production data model has a compatibility layer.

## Risks

- Blindly renaming database tables would break deployed data and Prisma queries.
- Changing the `INVESTOR` enum immediately would invalidate existing users and tests.
- Removing internal confidence/risk fields too early could break subscriber and admin screens that still depend on them.
- Financial constitution changes require immutable historical snapshots to avoid rewriting old distributions.
- Public copy can be changed safely before data model migration, but route and DB names need staged compatibility.

## Manual Decisions Needed Before Schema Work

- Confirm whether internal role value remains `INVESTOR` temporarily while UI says Performance Partner.
- Confirm first FPF Season name/date range.
- Confirm whether previous investor records should be displayed as legacy Performance Partner records.
- Confirm whether season policy defaults should immediately be 35/15/15/35 for all new seasons only.
