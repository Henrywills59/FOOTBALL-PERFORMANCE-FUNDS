# Deployment Guide

## Frontend

Deploy `frontend` to Vercel.

Required variable:

- `VITE_API_BASE_URL`

Use `frontend/vercel.json` for SPA routing and production headers.

## Backend

Deploy the backend as a Node.js service or with `backend/Dockerfile`.

Required variables:

- `DATABASE_URL`
- `DIRECT_URL`
- `FRONTEND_URL`
- `FRONTEND_URLS`
- `ALLOWED_ORIGINS`
- `JWT_SECRET`
- `API_FOOTBALL_KEY`
- `ODDS_API_KEY`
- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`

Run:

```bash
npm install
npm run db:deploy -w database
npm run seed:admin -w backend
npm run build
npm run start -w backend
```

For Supabase on Vercel, use the transaction pooler for runtime and the session pooler or direct connection for Prisma schema deployment:

```bash
DATABASE_URL="postgresql://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"
DIRECT_URL="postgresql://postgres.PROJECT_REF:URL_ENCODED_PASSWORD@REGION.pooler.supabase.com:5432/postgres?sslmode=require"
```

Production checks:

- `GET /health` confirms the backend function is alive.
- `GET /health/db` confirms `DATABASE_URL`, `JWT_SECRET`, and Prisma connectivity without exposing secrets.

## Docker Production

Use:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## Health Checks

- `GET /health`
- `GET /api/admin/monitoring`
