# B2B execution roadmap

## Completed local implementation scope

1. Keep one editable source tree in `00-platform-source`; use outer `01`-`07` only as generated delivery areas, `local-data` for persistent data, and `local-runtime` for replaceable local processes and dependencies.
2. Introduce durable Codex guidance and a shared module registry without moving legacy pages.
3. Add database-backed tenant/plan runtime resolution with descendant-agent access checks.
4. Add content-download metadata, short-lived ticket endpoints, and private-storage boundaries for plans.
5. Add module registry endpoints plus frontend registry loading types.
6. Add release-manifest, backup-boundary, and local verification tooling.
7. Make database schema bootstrap development-only; staging and production now require an Alembic migration state at the current head before application startup.
8. Protect platform routes with authenticated identity, organization descendant scope, and plan-level membership checks; platform-wide settings remain headquarters-admin only.
9. Add a release preflight that validates manifests, secret configuration, migration-only mode, PostgreSQL, HTTPS, and offsite backup storage before deployment.
10. Add a secret-free CI verification workflow for source, tenant-boundary, release-policy, and TypeScript checks.
11. Require file allowlisting, size/hash verification, scan status, scanner configuration, and audit events for independent-plan content downloads.

## Migration sequence

1. Migrate `05-social-media` into the module adapter pattern while preserving `/social`.
2. Connect the existing content pages to the download-management UI and asset registration workflow.
3. Move reusable frontend and backend code into `shared` only after its contract tests exist.
4. Configure a non-local secret and offsite backup target before staging or production deployment.
5. Publish immutable releases, then use deployment rings: headquarters, test agency, test customer, full rollout.
6. Before every staging/production release, run `tools/run-migrations.ps1` with the target `DATABASE_URL`, verify its backup, then start the application with `DATABASE_SCHEMA_MODE=migrate`.

## Non-negotiable boundaries

- Production databases and formal backups are never updated by source-tree scripts.
- Every customer asset and download record must include tenant, client, and plan ownership.
- A customer plan is an overlay, not a fork of the client application.
