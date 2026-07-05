# Deployment Guide

## Frontend

Deploy `frontend` to Vercel.

Required variable:

- `VITE_API_URL`

Use `frontend/vercel.json` for SPA routing and production headers.

## Backend

Deploy the backend as a Node.js service or with `backend/Dockerfile`.

Required variables:

- `DATABASE_URL`
- `FRONTEND_URL`
- `JWT_SECRET`
- `API_FOOTBALL_KEY`
- `ODDS_API_KEY`
- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`

Run:

```bash
npm install
npm run build
npm run start -w backend
```

## Docker Production

Use:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## Health Checks

- `GET /health`
- `GET /api/admin/monitoring`

