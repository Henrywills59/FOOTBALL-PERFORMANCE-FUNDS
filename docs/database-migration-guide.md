# Database Migration Guide

1. Set `DATABASE_URL` to the production PostgreSQL or Supabase connection string.
2. Validate the schema:

```bash
npm run typecheck -w database
```

3. Generate Prisma Client:

```bash
npm run build -w database
```

4. Apply migrations before starting production traffic.
5. Confirm the API health endpoint returns `ok`.

Back up production data before every schema migration.

