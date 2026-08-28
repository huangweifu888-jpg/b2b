# Observability and restore-drill runbook

## What is recorded

The platform records tenant-scoped audit events for independent-plan runtime updates and `02-content` download registration, scanning, ticket issuance, and delivery. New event writers must use `services.audit.record_audit_event`; it recursively redacts values whose keys indicate passwords, secrets, tokens, authorization, cookies, or API keys.

Authenticated users query `GET /api/v1/audit-logs`. The endpoint applies the same organization and project visibility rules as the plan APIs. It returns a stable actor reference rather than raw user identifiers and never returns source IP addresses or unredacted details.

`GET /api/v1/operations/health` is the monitor endpoint. It verifies database connectivity and returns HTTP 503 when the database is unavailable. It deliberately contains no connection string, secret, backup location, or internal topology.

## Alert handling

Configure the platform monitor to call the health endpoint every 60 seconds and alert after three consecutive failures. The local implementation is `tools/run_health_monitor.py`; production should use the cloud monitor/provider equivalent. Review audit events for the following operational signals: rejected or pending file scans, repeated permission denials (from edge/API access logs), deployment or plan-runtime changes, and abnormal download failures. Do not place bearer tokens, request bodies, or raw authorization headers into alert payloads.

## Monthly restore drill

1. Select one recent, encrypted backup for a representative client plan. Record only its backup ID and date in the drill ticket.
2. Restore it into an isolated temporary or disposable environment. Never point a drill at a production database or overwrite a live plan.
3. For SQLite backups, expose the selected backup path to the isolated runner and
   run the non-destructive verifier below from the repository root. It opens the
   source backup read-only, restores only into an automatically removed temporary
   directory, then checks database integrity, table presence, and Alembic revision.

```powershell
$backupFile = $env:B2B_SQLITE_RESTORE_DRILL_FILE
if (-not $backupFile) { throw 'B2B_SQLITE_RESTORE_DRILL_FILE is required.' }
python .\tools\verify_sqlite_restore_drill.py --backup $backupFile
```

4. For PostgreSQL, use the managed database provider's isolated restore workflow, then run the equivalent integrity, migration-revision, tenant-isolation, and smoke-login checks there. Do not use the SQLite verifier for PostgreSQL files.
5. Attach the command result (without credentials), restoration duration, revision, and any corrective action to the drill ticket. A failed drill blocks the next release until the backup or procedure is corrected.
