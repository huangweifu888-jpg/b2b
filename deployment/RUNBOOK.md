# B2B production runbook

The API and durable job worker use the same reviewed backend image. Their roles
are selected with `APP_COMPONENT`; do not run slow jobs in an API process.

## Required service roles

| Role | Required value | Purpose |
| --- | --- | --- |
| API | `APP_COMPONENT=api` | HTTP requests, authentication, tenant operations |
| Worker | `APP_COMPONENT=worker` | Release batches, scans, backup verification |
| Database | `DATABASE_URL=postgresql+asyncpg://...` | Shared transactional tenant state |
| Queue | `REDIS_URL=redis://...` and `RATE_LIMIT_BACKEND=redis` | Durable jobs and shared rate limiting |

The production environment file must also define a private asset mount and a
separate offsite backup target. `ASSET_STORAGE_URI` and `BACKUP_TARGET` may not
refer to the same bucket. Record both a managed backup schedule identifier and
the latest isolated restore-drill reference before release.

## Deployment order

1. Run Alembic migrations against PostgreSQL from the approved release image.
2. Start or update API instances with `APP_COMPONENT=api`.
3. Start at least one separate Worker instance with `APP_COMPONENT=worker`.
4. Verify `/api/v1/operations/health` returns HTTP 200 and reports
   `database_engine: postgresql`, `background_job_queue: redis-ready`, and
   `deployment: ready`.
5. Watch `queue.queued` and `queue.processing` during the first release batch.
6. Keep the previous image available until release smoke checks and one backup
   restore verification have completed.

Production readiness is intentionally fail-closed. It also requires a valid
`DEPLOYMENT_ID`, TLS Redis (`rediss://`), HTTPS public base URL, and explicit
HTTPS CORS origins. Do not weaken these checks to make a deployment start.

## 1–7 server scale-out path

The complete and machine-readable placement authority is
[`profiles/01-server.yaml` through `profiles/07-server.yaml`](./profiles/README.md).
Do not maintain a second 1/3/5 mapping in this runbook. The tenant registry and a
plan's `deployment_id` / `database_id` remain the runtime placement authority;
scale-out changes role placement only and must not clone a client database,
rewrite tenant identifiers, or bypass the release workflow.

| Servers | Placement boundary | Backup boundary |
| ---: | --- | --- |
| 1 | Roles `01`–`06` share one host; local, demo, or low-risk pilot only. | External backup target is required. |
| 2 | Application roles `01`–`05` are separated from role `06` data services. | External backup target is required. |
| 3 | Application/edge, role `04` worker, and role `06` data services are separated. | External backup target is required. |
| 4 | Control/runtime, worker, edge, and data services are separated. | External backup target is required. |
| 5 | Role `01` control/source is separated from roles `02`/`03` runtime, worker, edge, and data. | External backup target is required. |
| 6 | Roles `01`–`06` each receive an independent placement unit. | External backup target is required. |
| 7 | Roles `01`–`06` remain separated and role `07` adds dedicated offsite backup and disaster recovery. | Role `07` must use separate credentials and a separate failure domain. |

All placements use the same approved source version and role artifacts. Move one
placement boundary at a time, run the selected role health checks, verify a
representative headquarters/agency/client-plan flow, and keep the prior version
available until restore evidence and the observation window pass.

For a high-traffic or contractually isolated customer, add a dedicated runtime
stamp by updating its approved `deployment_id`; keep the central tenant
registry, release records, audit logs, and restore drills unchanged.

## Recovery boundary

Do not copy production databases, object storage, or backups into the source
tree. Stop old workers before running processing-job recovery, otherwise a job
could execute twice. Backup restoration is performed only in an isolated
verification environment.
