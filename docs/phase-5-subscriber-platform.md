# Phase 5 Subscriber Platform

This phase adds the subscriber-facing product experience without adding investor features, payments, wallet features, or an admin portal.

## Modules

- Dashboard with welcome state, subscription display, featured opportunities, summary metrics, and recent predictions.
- Match Center with fixture search, league filtering, date filtering, match analysis, confidence, risk, and value rating.
- Smart Bet Slip for approved predictions only, with combined odds, overall confidence, risk level, and a five-selection limit.
- Daily Opportunities sorted by confidence.
- Prediction Details with team form, head-to-head count, league position availability, odds edge, AI explanation, confidence, risk, and value.
- Subscriber Profile with account details, subscription display, expiry placeholder, and password change.

## Data Rules

- Only approved predictions can be added to the Smart Bet Slip.
- No unapproved predictions are shown in subscriber views.
- Slip odds are derived from approved prediction implied probability.
- Subscription details are display-only in this phase because payments are not implemented.
