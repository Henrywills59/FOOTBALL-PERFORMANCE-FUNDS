# Phase 4 AI Prediction Engine

This phase adds a conservative prediction engine on top of the Phase 3 football data layer. It does not add payments, wallet features, settlement, FPF Coin, or digital asset features.

## Inputs

Predictions use stored provider data only:

- Fixture details
- Team form from league standings
- Head-to-head records
- League standings
- Injuries where available
- Odds where available

## Output

Each generated prediction includes:

- Recommended market
- Predicted outcome
- Confidence score
- Risk score
- Value rating
- Brief explanation
- Data quality status
- Approval status

## Safety Rules

- Missing required football inputs returns `Insufficient data`.
- The engine does not invent football data.
- Explanations explicitly avoid guarantees.
- Predictions are stored as `PENDING`.
- Subscribers only see `APPROVED` predictions.

## Value Logic

The engine compares model probability with bookmaker implied probability. Positive value is only flagged when the edge is above the configured threshold. Stale odds and risky markets are flagged and withheld from storage as publishable predictions.

## API

- `POST /api/predictions/fixtures/:fixtureId/generate`
- `GET /api/admin/predictions`
- `POST /api/admin/predictions/:id/approve`
- `POST /api/admin/predictions/:id/reject`
- `GET /api/predictions/approved`
