# PostgreSQL isolated restore-drill runbook

Once each month, restore one representative client-plan backup into a new, isolated PostgreSQL instance using the managed-provider workflow. Do not point this process at a live database and do not reuse the production hostname. Put that temporary connection only in `B2B_RESTORE_DATABASE_URL` in the release operator's process environment.

Run `tools/run_postgres_restore_drill.ps1 -ExpectedRevision <approved-alembic-head>`. The verifier connects with the supplied credentials only in a read-only transaction. It checks core table presence, Alembic revision, project-to-client ownership, membership-to-organization ownership, and records aggregate counts without printing a URL, username, password, or data rows.

Record the time, provider restore job ID, backup identifier, returned revision/count summary, duration, and operator in the drill ticket. After review, update `RESTORE_DRILL_REFERENCE` in the secret-managed deployment configuration. A failed drill blocks the next production release; tear down the isolated restored instance after evidence is retained.
