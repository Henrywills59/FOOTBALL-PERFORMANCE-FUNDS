# Football Performance Fund Deployment Package - 2026-07-07

This package is prepared for the next Vercel deployment window. No deployment should be attempted on 2026-07-06 because the free deployment limit has been reached.

## Goal

Finish the production login fix without more broad deployment churn.

Expected production result after deployment:

- `GET https://football-performance-funds-backend.vercel.app/health` returns JSON with `status: "ok"`.
- `GET https://football-performance-funds-backend.vercel.app/api/debug/login` returns valid JSON, never `FUNCTION_INVOCATION_FAILED`.
- `POST https://football-performance-funds-backend.vercel.app/api/debug/login` reports the exact failed login stage if login is still blocked.
- `POST https://football-performance-funds-backend.vercel.app/api/auth/login` succeeds for the seeded admin account.
- The deployed frontend can log in and route to the correct dashboard.

Production finding from the latest run:

- `/api/debug/login` reached `passwordHashVerification`.
- The admin user exists and has a valid bcrypt-length password hash.
- `bcrypt.compare` returned `false`, which means the production admin row was hashed for a different/stale password.
- The deployment script now synchronizes the production admin password hash before testing login.

## Included Backend Fixes

The backend now has standalone Vercel diagnostic handlers that do not import the full Express app:

- `api/debug/login.ts`
- `backend/api/debug/login.ts`

These handlers execute the login flow in isolated stages and always return safe JSON:

- environment check
- Prisma client initialization
- database connection
- admin user lookup
- password hash verification
- JWT signing
- audit/login-history write

The route is placed before the catch-all Express route in both Vercel configs:

- `vercel.json`
- `backend/vercel.json`

This is intentional. If the full Express app crashes during startup, `/api/debug/login` should still work and identify the failing runtime stage.

## Included Auth Hardening

The auth service and route now log each production login stage and keep audit/history writes from breaking an otherwise valid login:

- `backend/src/auth/authRoutes.ts`
- `backend/src/auth/authService.ts`
- `backend/src/auth/prismaUserRepository.ts`
- `backend/src/auth/types.ts`

Relevant behavior:

- `/health` does not require database access.
- `/health/db` checks database access separately.
- `/api/debug/config` reports whether required environment variables exist without exposing values.
- Login diagnostics identify whether the failure is environment, Prisma, database, password verification, JWT signing, audit write, middleware, or rate limiting.
- Login audit write failures are logged but do not block successful authentication.

## Admin Password Hash Synchronization

The deploy script now repairs the production admin row before login verification without requiring the production database URL on the local machine:

1. It generates a fresh deployment token.
2. It stores that token as `ADMIN_SEED_TOKEN` on the backend Vercel production project.
3. It deploys the backend with the token.
4. It calls `POST /api/admin/seed-default-admin` with the token.
5. The deployed backend uses its own configured `DATABASE_URL` to bcrypt-hash and upsert the admin password.
6. It then tests `/api/auth/login` with the same admin credentials.

This avoids downloading Supabase credentials into the local shell. Vercel can keep sensitive values configured for runtime while not exposing their plaintext value through `vercel env pull`.

If Vercel refuses to add `ADMIN_SEED_TOKEN`, the deploy report will show that exact CLI failure. Otherwise, no manual `DATABASE_URL` entry is required for normal deployments.

## Included Frontend Integration

The frontend is configured to use:

```text
https://football-performance-funds-backend.vercel.app
```

The login page visibly shows the API URL and includes a test API connection button.

Relevant files:

- `frontend/vercel.json`
- `frontend/src/App.tsx`

The frontend Vercel build remains standalone from the frontend folder:

- install command: `npm install --ignore-scripts`
- build command: `npm run build`
- output directory: `dist`

## Required Production Environment Variables

Backend Vercel project:

```text
DATABASE_URL=<Supabase PostgreSQL URL used by Prisma>
DIRECT_URL=<Supabase direct PostgreSQL URL used by Prisma migrations/direct access>
JWT_SECRET=<strong production secret>
FRONTEND_URL=https://football-performance-funds-frontend.vercel.app
ALLOWED_ORIGINS=https://football-performance-fund-frontend.vercel.app,https://football-performance-funds-frontend.vercel.app,https://we-are-starting-football-performanc.vercel.app
```

Frontend Vercel project:

```text
VITE_API_BASE_URL=https://football-performance-funds-backend.vercel.app
VITE_API_URL=https://football-performance-funds-backend.vercel.app
```

## Local Verification Completed

These checks passed locally before this package was prepared:

```text
npm run build -w shared
npm run build -w database
npm run build -w backend
npm run build -w frontend
npm run typecheck
npm test -w backend -- authRoutes --testTimeout=15000
npm test -w backend -- productionRouting --testTimeout=15000
npm test -w backend -- productionSmoke --testTimeout=15000
```

Current local verification results:

```text
Shared build: passed
Database build and Prisma generate: passed
Backend build: passed
Frontend build: passed
Full workspace typecheck: passed
Auth tests: 17 passed
Production routing tests: 2 passed
Production smoke tests: 1 passed
PowerShell deployment script syntax: passed
```

Note: One earlier combined test run under parallel build/test load timed out on a demo-user login test. The same auth suite passed when rerun directly with a larger timeout, so this is treated as a local timing issue rather than a code failure.

## One-Time Commands For Tomorrow

Run these from the repository root after the Vercel deployment limit resets.

### 1. Final local preflight

```powershell
npm run typecheck
npm run build -w shared
npm run build -w database
npm run build -w backend
npm run build -w frontend
npm test -w backend -- authRoutes --testTimeout=15000
npm test -w backend -- productionRouting --testTimeout=15000
npm test -w backend -- productionSmoke --testTimeout=15000
```

### 2. Stage and commit the package

```powershell
git add database/package.json docs/deployment-package-2026-07-07.md
git status --short
git commit -m "Prepare backend login deployment package"
git push origin main
```

If the local Git permission issue still blocks staging with `.git/index.lock: Permission denied`, fix the file ownership/permissions first, then rerun the same commands above.

### 3. Deploy once

Use the Vercel dashboard or the Vercel CLI for the backend project only after the commit is pushed.

Important local project-link note:

- The repository root `.vercel/project.json` is currently linked to `we-are-starting-football-performance-fund`.
- The frontend `.vercel/project.json` is currently linked to `football-performance-fund-frontend`.
- Do not deploy the backend from the repo root with the existing local Vercel link unless that link is first changed to the backend project.

Safest backend option:

1. Open the Vercel dashboard.
2. Select the backend project `football-performance-funds-backend`.
3. Redeploy from the pushed `main` commit.

CLI backend option:

```powershell
npx vercel link --project football-performance-funds-backend --yes
npx vercel --prod
```

Frontend CLI option, using the already linked frontend folder:

```powershell
Push-Location frontend
npx vercel --prod
Pop-Location
```

Do not run the frontend deployment until the backend checks below are green.

If the Vercel CLI is not available locally, use the Vercel dashboard for both projects.

Backend build target:

- project: `football-performance-funds-backend`
- expected health URL: `https://football-performance-funds-backend.vercel.app/health`

Frontend build target:

- project: `football-performance-fund-frontend`
- frontend env points to `https://football-performance-funds-backend.vercel.app`

### 4. Verify production backend

```powershell
Invoke-RestMethod https://football-performance-funds-backend.vercel.app/health
Invoke-RestMethod https://football-performance-funds-backend.vercel.app/api/debug/config
Invoke-RestMethod https://football-performance-funds-backend.vercel.app/api/debug/login
Invoke-RestMethod -Method Post https://football-performance-funds-backend.vercel.app/api/debug/login -ContentType "application/json" -Body '{"email":"admin@footballperformancefund.com","password":"ChooseAStrongPassword123!","rememberMe":false}'
Invoke-RestMethod -Method Post https://football-performance-funds-backend.vercel.app/api/auth/login -ContentType "application/json" -Body '{"email":"admin@footballperformancefund.com","password":"ChooseAStrongPassword123!","rememberMe":false}'
```

Expected results:

- `/health` returns `status: "ok"`.
- `/api/debug/config` shows required environment variables are configured without exposing values.
- `/api/debug/login` returns JSON and does not crash.
- `/api/debug/login` returns `ok: true` for the admin credentials.
- `/api/auth/login` returns a token and the admin user profile.

### 5. Verify production frontend

Open the deployed frontend, press **Test API connection**, then log in with the admin account. The dashboard should open without "Failed to fetch".

## Debug Flow If Login Still Fails

Do not redeploy repeatedly. Use `/api/debug/login` first. If it reports `ok: false`, fix only the returned `failedStage`, rerun local checks, then deploy once more.

## Admin Login To Verify

```text
Email: admin@footballperformancefund.com
Password: ChooseAStrongPassword123!
```

## Notes

- No feature work is included in this package.
- No prediction, wallet, investor, payment, or football-data logic was changed for this package.
- The standalone login debug endpoint should be treated as temporary production diagnostics and removed after the production login issue is fully resolved.
