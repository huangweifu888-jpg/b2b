# Backup automation runbook

Local development may create a SQLite snapshot only through `tools/create_local_sqlite_backup.py`. It requires both the exact source database and a backup root, copies with SQLite's online backup API, verifies an isolated restore, calculates SHA-256, and then writes an immutable artifact plus manifest. It never prunes formal backups.

The proposed Windows Task Scheduler entry is in `deployment/schedules/backup-jobs.yaml`. Review the database path first; each headquarters, agency, customer, and independent-plan database needs its own explicit scheduled command and backup root. Do not schedule a wildcard or a source-tree directory.

Staging and production do not use this SQLite tool. Use managed PostgreSQL backups with point-in-time recovery, an encrypted copy to the separate `BACKUP_TARGET`, and a stable `BACKUP_SCHEDULE_ID` stored in the secret-managed environment configuration. Every month, restore one representative client-plan backup into an isolated environment, run the PostgreSQL read-only restore verifier, and update `RESTORE_DRILL_REFERENCE`. A failed drill blocks the next release.

The backup job may enqueue `backup_verify` in Redis for status processing, but the database provider remains responsible for durable production snapshots. Never put passwords, database URLs, or object-storage credentials in a backup manifest, queue payload, or drill ticket.
