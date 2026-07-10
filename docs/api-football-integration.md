# API-Football Production Integration

Date: 2026-07-10

## Environment Variables

Secrets remain backend-only.

- `API_FOOTBALL_KEY`
- `API_FOOTBALL_BASE_URL`
- `API_FOOTBALL_HOST`
- `API_FOOTBALL_LEAGUE_IDS`
- `API_FOOTBALL_DAILY_LIMIT`
- `API_FOOTBALL_TIMEOUT_MS`
- `API_FOOTBALL_QUOTA_WARNING_THRESHOLDS`
- `API_FOOTBALL_CATALOG_CACHE_MINUTES`
- `API_FOOTBALL_TEAM_CACHE_MINUTES`
- `API_FOOTBALL_FIXTURE_CACHE_MINUTES`
- `API_FOOTBALL_LIVE_CACHE_SECONDS`
- `API_FOOTBALL_STANDINGS_CACHE_MINUTES`
- `API_FOOTBALL_INJURY_CACHE_MINUTES`
- `API_FOOTBALL_FINISHED_CACHE_HOURS`

## Provider Adapter

`backend/src/football/apiFootballClient.ts` is the only API-Football adapter. It:

- Sends `x-apisports-key` from backend environment only.
- Never exposes or logs the secret key.
- Uses timeouts and retries.
- Handles 429/rate-limit responses as structured provider failures.
- Tracks last success, last failure, quota headers, average response time, and cache hit rate.
- Caches stable provider calls using configurable windows.

## Existing Database Structures Reused

The production schema already contains operational football tables:

- `FootballLeague`
- `FootballTeam`
- `FootballFixture`
- `LeagueStanding`
- `TeamStatistic`
- `PlayerInjury`
- `HeadToHeadRecord`
- `MatchOdd`
- `FootballSyncRun`

No destructive migration was required for this integration step. Repeated syncs now avoid duplicate injury and odd records by clearing matching records before inserting the latest normalized copy.

## Normalized Backend Routes

All routes are backend-only, authenticated, and rate-limited:

- `GET /api/football/status`
- `GET /api/football/leagues`
- `GET /api/football/fixtures`
- `GET /api/football/fixtures/live`
- `GET /api/football/fixtures/:id`
- `GET /api/football/standings`
- `GET /api/football/teams/:id`
- `GET /api/football/teams/:id/statistics`
- `GET /api/football/fixtures/:id/statistics`
- `GET /api/football/fixtures/:id/events`
- `GET /api/football/fixtures/:id/lineups`
- `GET /api/football/fixtures/:id/injuries`
- `GET /api/football/head-to-head`

## Data Freshness

Read responses include freshness metadata where applicable:

- provider
- last synchronized time
- freshness state
- stale flag
- next scheduled refresh placeholder
- provider availability

States:

- `FRESH`
- `STALE`
- `REFRESHING`
- `PROVIDER_PENDING`
- `PROVIDER_ERROR`

## Quota Protection

- Stable catalog/team/standings calls are cached.
- Live fixtures use a short cache window.
- Noncritical sync pauses at the 95% warning threshold or after rate-limit status.
- Sync avoids duplicate live fixture requests per league loop.
- Provider status reports usage and thresholds without exposing secrets.

## Integration Surface

Subscriber, Analyst, Admin, War Room, and Intelligence Core modules continue to consume internal FPF football repositories and Intelligence services. Browser code does not call API-Football directly.

## Verification Note

Automated tests use mocked provider responses and do not consume production API quota.
