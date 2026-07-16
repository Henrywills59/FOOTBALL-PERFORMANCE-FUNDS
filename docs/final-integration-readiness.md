# Final Integration Readiness

This checklist covers the production provider integration layer. It is intentionally provider-abstracted so the platform can run safely with missing credentials and switch to live providers once environment variables are configured.

## Provider Environment

Required for deployment readiness:

- `DATABASE_URL`
- `JWT_SECRET`
- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`
- `NOWPAYMENTS_BASE_URL`

Football data:

- `API_FOOTBALL_KEY`
- `API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io`
- `FOOTBALL_SEASON`
- `API_FOOTBALL_LEAGUE_IDS`

Odds:

- `ODDS_API_KEY`
- `ODDS_API_BASE_URL=https://api.the-odds-api.com`
- `ODDS_API_SPORT=soccer_epl`
- `ODDS_API_REGIONS=us,uk,eu`
- `ODDS_API_MARKETS=h2h,totals,btts`
- `ODDS_API_BOOKMAKERS`

OpenAI:

- `OPENAI_API_KEY`
- `OPENAI_MODEL=gpt-4.1-mini`
- `OPENAI_BASE_URL=https://api.openai.com`
- `OPENAI_TIMEOUT_MS=12000`

Notifications:

- `EMAIL_PROVIDER=RESEND`
- `EMAIL_API_KEY` or `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_API_URL=https://api.resend.com/emails`
- `SMS_PROVIDER=TWILIO`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `SMS_FROM` or `TWILIO_FROM_NUMBER`
- `PUSH_PROVIDER=WEB_PUSH`
- `PUSH_API_URL`
- `PUSH_API_KEY`

## Readiness Checks

- `GET /api/production/readiness`
- `GET /api/football/status`
- `POST /api/football/provider/diagnostics`
- `POST /api/football/odds/diagnostics`
- `GET /api/intelligence/ai/status`
- `GET /api/admin/notifications/providers`
- `GET /api/payments/config`

The readiness endpoint returns `ACTION_REQUIRED` when a required production dependency is missing and never exposes secret values.

## Deployment Approval Gate

Before production deployment:

1. Configure the required provider environment variables in the backend Vercel project.
2. Run the local verification commands from the final integration report.
3. Confirm the readiness endpoint returns `READY` after deployment.
4. Run football provider diagnostics and odds diagnostics.
5. Run one NOWPayments config check and webhook signature test.

Stop here until final approval is given for production deployment.
