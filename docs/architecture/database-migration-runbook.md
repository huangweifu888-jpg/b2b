# Database migration runbook

## Runtime rule

- `ENVIRONMENT=dev|local|test` may use `DATABASE_SCHEMA_MODE=bootstrap` for a disposable local database.
- Staging and production must use `DATABASE_SCHEMA_MODE=migrate`. Application startup performs no table creation and no automatic table repair in this mode.
- If the `alembic_version` state is missing or behind the repository head, startup stops before serving requests.

## Release procedure

1. Confirm the target database and take a verified backup outside the application server.
2. From the reviewed repository root, run the explicit migration command on a
   release runner. Supply the real database URL through the runner's protected
   environment or secret manager; the value below is only a placeholder:

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\run-migrations.ps1 `
  -Environment staging `
  -DatabaseUrl 'postgresql+asyncpg://USER:PASSWORD@HOST:5432/b2b'
```

3. Start the API with `ENVIRONMENT=staging` or `production` and `DATABASE_SCHEMA_MODE=migrate`.
4. Check `/health`, application logs, and the applied Alembic head before enabling traffic.

Do not use `DATABASE_SCHEMA_MODE=bootstrap` with shared, staging, or production data.

## Existing legacy databases

Legacy local databases may have been created by the former automatic-bootstrap path and therefore lack an `alembic_version` record. Do **not** run the full history against such a database: the old migrations will try to create tables that already exist. First take a restore-tested backup, compare the live schema with the release schema, and have a release operator record the matching Alembic head (`52f927590325`) only after that comparison is clean. New staging and production databases must always use `upgrade head`.
