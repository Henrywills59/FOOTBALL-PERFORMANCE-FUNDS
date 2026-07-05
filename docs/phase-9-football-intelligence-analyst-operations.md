# Phase 9: Football Intelligence Analyst Operations

Phase 9 adds internal FPF analyst workflows for staff and contracted experts. Analysts are not public tipsters, do not have public profiles, and are never shown by name to subscribers.

## Scope

- Internal analyst dashboard
- Admin match assignment and review
- Analyst intelligence submission lifecycle
- AI assistance summaries based only on synchronized football data
- Subscriber-facing published FPF Intelligence

## Subscriber Privacy Rules

Subscribers only receive FPF-branded intelligence fields:

- Match
- League
- Market
- Prediction
- Confidence
- Risk rating
- Brief explanation
- Recommended stake

Subscribers do not receive analyst names, internal notes, source notes, detailed reasoning, drafts, rejected submissions, or admin comments.

## New Backend Endpoints

- `GET /api/analyst/dashboard`
- `GET /api/analyst/assignments`
- `GET /api/analyst/intelligence`
- `POST /api/analyst/intelligence`
- `PATCH /api/analyst/intelligence/:id`
- `POST /api/analyst/intelligence/:id/submit`
- `GET /api/analyst/fixtures/:fixtureId/assistance`
- `POST /api/admin/intelligence/assign`
- `GET /api/admin/intelligence`
- `PATCH /api/admin/intelligence/:id/notes`
- `POST /api/admin/intelligence/:id/approve`
- `POST /api/admin/intelligence/:id/reject`
- `POST /api/admin/intelligence/:id/request-revision`
- `POST /api/admin/intelligence/:id/publish`
- `POST /api/admin/intelligence/:id/withdraw`
- `GET /api/intelligence/published`

## New Database Tables

- `AnalystAssignment`
- `AnalystIntelligenceSubmission`

## Exclusions

This phase does not add payments, FPF Coin, public analyst profiles, followers, likes, or social tipster features.
