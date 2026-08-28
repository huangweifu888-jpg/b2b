# Customer-stamp deployment runbook

`deployment/compose/customer-stamp.compose.example.yaml` is the repeatable unit for one shared or dedicated customer deployment. It runs the same reviewed image twice: `api` serves FastAPI; `worker` consumes Redis jobs. The file intentionally references external PostgreSQL, Redis, private object-storage mounts, offsite backups, and TLS termination rather than creating disposable production data services inside Compose.

Copy `deployment/compose/customer-stamp.runtime.env.example` to a secret-managed path outside the repository, replace every placeholder, and run release preflight before `docker compose up`. Set the three bind-mount variables in the deployment host environment; all are read-only. Run Alembic migrations as an explicit, separately logged release step before starting the new API/Worker image.

For the first server, deploy one API and one Worker in the same stamp. At growth, add Worker replicas or separate content-download workers without changing tenant routing; at contractual isolation, create another stamp with its own deployment ID, database, Redis namespace/service, mounts, backup schedule, and release record.
