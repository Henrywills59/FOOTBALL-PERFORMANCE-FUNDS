# Phase 3 Football Data Layer

This phase adds the live football data foundation. It does not add AI predictions, payments, settlement, or token features.

## Providers

- API-Football for fixtures, live matches, standings, team statistics, injuries, and head-to-head history.
- The Odds API for match odds.

## Credentials

Credentials are read from environment variables:

- `API_FOOTBALL_KEY`
- `API_FOOTBALL_BASE_URL`
- `API_FOOTBALL_LEAGUE_IDS`
- `FOOTBALL_SEASON`
- `ODDS_API_KEY`
- `ODDS_API_BASE_URL`
- `ODDS_API_SPORT`

## Scheduled Jobs

Set `ENABLE_FOOTBALL_JOBS=true` to start automatic updates when the backend starts.

`FOOTBALL_SYNC_INTERVAL_MINUTES` controls the interval and has a minimum runtime interval of five minutes.

When provider keys are missing, sync jobs record a successful skipped run instead of failing the app.

## API

- `GET /api/football/fixtures`
- `GET /api/football/fixtures?live=true`
- `GET /api/football/fixtures/:id`
- `GET /api/football/sync/status`
- `POST /api/football/sync`

Manual sync is restricted to Analyst and Admin users.
