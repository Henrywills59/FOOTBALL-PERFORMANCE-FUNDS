# Football Performance Fund

Clean Phase 1 scaffold for the Football Performance Fund platform.

## Tech Stack

- Node.js
- Express
- PostgreSQL / Supabase
- Prisma
- React
- Vite
- Tailwind CSS
- Docker
- Vercel

## Project Structure

```text
backend/   Express API and health checks
database/  Prisma schema and database tooling
docs/      Architecture and operating notes
frontend/  React + Vite web app
shared/    Shared TypeScript types
```

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment templates:

   ```bash
   cp .env.example .env
   cp frontend/.env.local.example frontend/.env.local
   cp backend/.env.example backend/.env
   ```

3. Start local infrastructure:

   ```bash
   docker compose up -d postgres
   ```

4. Run the apps:

   ```bash
   npm run dev
   ```

## Health Check

The API exposes:

```text
GET /health
```

Expected response:

```json
{
  "status": "ok",
  "service": "football-performance-fund-api"
}
```

## Phase 1 Scope

Included:

- Clean monorepo scaffold
- Frontend placeholder
- Backend health endpoint
- Shared types package
- Prisma database package
- Environment templates
- Docker setup
- Documentation starter

Not included yet:

- Payments
- Football APIs
- AI features
- Investor features
