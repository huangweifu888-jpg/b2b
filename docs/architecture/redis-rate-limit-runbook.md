# Redis shared rate-limit and job-queue runbook

Local development uses `RATE_LIMIT_BACKEND=memory`. Staging and production require `RATE_LIMIT_BACKEND=redis` and a secret-managed `REDIS_URL`. Redis keys contain only a hash of client identity, route class, and short time bucket; raw IP addresses, passwords, bearer tokens, and request bodies are never stored.

The same private Redis service holds the background-job queue. Only `content_scan`, `backup_verify`, and `release_smoke_check` jobs are accepted. The web process only enqueues work; dedicated workers dequeue it, so slow scanning, verification, and release checks never block an HTTP request. Job payloads apply the same sensitive-field redaction as audit logs.

The shared limiter applies to login, download-ticket issuance, and template snapshot mutations. If Redis becomes unavailable in staging or production, those sensitive requests return HTTP 503 with `Retry-After` rather than silently falling back to per-process counters. The operational health endpoint reports `rate_limit_backend` and `background_job_queue` as `redis-ready` or `redis-unavailable`, without disclosing the connection URL.

Use a managed Redis service with TLS (`rediss://`) where available, private network access, authentication, and eviction capacity sized for short-lived rate-limit keys. Redis is a control dependency, not a source of record; PostgreSQL remains the authoritative application database.
