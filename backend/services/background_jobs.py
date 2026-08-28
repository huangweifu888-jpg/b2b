"""Small Redis-backed job queue contract for slow operational work.

Workers are intentionally separate from the web process. Callers can enqueue
only recognised operational jobs; production delivery is durable through Redis.
"""

from __future__ import annotations

import json
from collections import deque
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from middlewares.request_security import rate_limit_backend, redis_rate_limiter
from services.audit import redact_audit_detail


QUEUE_KEY = "b2b:jobs:default"
PROCESSING_QUEUE_KEY = "b2b:jobs:processing"
RESULT_KEY_PREFIX = "b2b:jobs:result:"
SUPPORTED_JOB_TYPES = frozenset({"content_scan", "backup_verify", "release_smoke_check", "template_sync_batch"})
_local_queue: deque[str] = deque()
_local_processing: set[str] = set()
_local_results: dict[str, dict[str, Any]] = {}


def _encode_job(job_type: str, payload: Mapping[str, Any]) -> tuple[str, dict[str, Any]]:
    if job_type not in SUPPORTED_JOB_TYPES:
        raise ValueError(f"Unsupported background job type: {job_type}")
    job = {
        "id": str(uuid4()),
        "type": job_type,
        "payload": redact_audit_detail(dict(payload)),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "attempt": 0,
    }
    return json.dumps(job, ensure_ascii=False, separators=(",", ":")), job


async def enqueue_background_job(job_type: str, payload: Mapping[str, Any]) -> dict[str, Any]:
    """Add a safe operational job. Production requires the shared Redis queue."""
    encoded, job = _encode_job(job_type, payload)
    if rate_limit_backend() == "memory":
        _local_queue.append(encoded)
    else:
        limiter = await redis_rate_limiter()
        await limiter.client.rpush(QUEUE_KEY, encoded)
    return {"id": job["id"], "type": job["type"], "created_at": job["created_at"]}


async def dequeue_background_job() -> dict[str, Any] | None:
    """Take one job for a dedicated worker; never execute jobs in the API process."""
    if rate_limit_backend() == "memory":
        encoded = _local_queue.popleft() if _local_queue else None
    else:
        limiter = await redis_rate_limiter()
        encoded = await limiter.client.lpop(QUEUE_KEY)
    return json.loads(encoded) if encoded else None


async def claim_background_job(timeout_seconds: int = 5) -> tuple[dict[str, Any], str] | None:
    """Atomically move one task into processing so a worker can acknowledge it later."""
    if timeout_seconds < 0:
        raise ValueError("timeout_seconds must not be negative")
    if rate_limit_backend() == "memory":
        raw = _local_queue.popleft() if _local_queue else None
        if raw:
            _local_processing.add(raw)
    else:
        limiter = await redis_rate_limiter()
        raw = await limiter.client.brpoplpush(QUEUE_KEY, PROCESSING_QUEUE_KEY, timeout=timeout_seconds)
    if not raw:
        return None
    try:
        job = json.loads(raw)
    except (TypeError, ValueError) as exc:
        await acknowledge_background_job(raw, {"status": "failed", "reason": "invalid-job-payload"})
        raise ValueError("Queued job payload is invalid") from exc
    if not isinstance(job, dict) or job.get("type") not in SUPPORTED_JOB_TYPES or not job.get("id"):
        await acknowledge_background_job(raw, {"status": "failed", "reason": "invalid-job-contract"})
        raise ValueError("Queued job contract is invalid")
    return job, raw


async def acknowledge_background_job(raw: str, result: Mapping[str, Any]) -> None:
    """Remove a claimed task and retain a redacted result for short operational lookup."""
    try:
        job_id = str(json.loads(raw).get("id", ""))
    except (TypeError, ValueError):
        job_id = ""
    safe_result = {"completed_at": datetime.now(timezone.utc).isoformat(), **redact_audit_detail(dict(result))}
    if rate_limit_backend() == "memory":
        _local_processing.discard(raw)
        if job_id:
            _local_results[job_id] = safe_result
        return
    limiter = await redis_rate_limiter()
    await limiter.client.lrem(PROCESSING_QUEUE_KEY, 1, raw)
    if job_id:
        await limiter.client.setex(f"{RESULT_KEY_PREFIX}{job_id}", 7 * 24 * 3600, json.dumps(safe_result, ensure_ascii=False))


async def retry_background_job(raw: str, job: Mapping[str, Any], reason: str, *, max_attempts: int = 3) -> bool:
    """Requeue a transient failure up to the bounded retry count; otherwise mark it failed."""
    attempt = int(job.get("attempt", 0)) + 1
    if attempt >= max_attempts:
        await acknowledge_background_job(raw, {"status": "failed", "attempt": attempt, "reason": reason})
        return False
    retry_job = {**job, "attempt": attempt}
    retry_raw = json.dumps(retry_job, ensure_ascii=False, separators=(",", ":"))
    if rate_limit_backend() == "memory":
        _local_processing.discard(raw)
        _local_queue.append(retry_raw)
    else:
        limiter = await redis_rate_limiter()
        await limiter.client.lrem(PROCESSING_QUEUE_KEY, 1, raw)
        await limiter.client.rpush(QUEUE_KEY, retry_raw)
    return True


async def background_job_result(job_id: str) -> dict[str, Any] | None:
    if rate_limit_backend() == "memory":
        return _local_results.get(job_id)
    limiter = await redis_rate_limiter()
    raw = await limiter.client.get(f"{RESULT_KEY_PREFIX}{job_id}")
    return json.loads(raw) if raw else None


async def recover_processing_jobs() -> int:
    """Return unacknowledged jobs to ready state after a confirmed worker outage.

    Operators must first stop old workers; otherwise a still-running task could be
    duplicated. This is deliberately explicit rather than an unsafe auto-requeue.
    """
    if rate_limit_backend() == "memory":
        recovered = list(_local_processing)
        _local_processing.clear()
        _local_queue.extend(recovered)
        return len(recovered)
    limiter = await redis_rate_limiter()
    recovered = await limiter.client.lrange(PROCESSING_QUEUE_KEY, 0, -1)
    if recovered:
        await limiter.client.delete(PROCESSING_QUEUE_KEY)
        await limiter.client.rpush(QUEUE_KEY, *recovered)
    return len(recovered)


async def background_job_queue_health() -> str:
    if rate_limit_backend() == "memory":
        return "memory-local"
    try:
        await redis_rate_limiter()
        return "redis-ready"
    except Exception:
        return "redis-unavailable"


async def background_job_queue_metrics() -> dict[str, int | str]:
    """Return queue depth only; payloads and tenant data stay private."""
    if rate_limit_backend() == "memory":
        return {
            "backend": "memory-local",
            "queued": len(_local_queue),
            "processing": len(_local_processing),
        }
    try:
        limiter = await redis_rate_limiter()
        queued, processing = await limiter.client.llen(QUEUE_KEY), await limiter.client.llen(PROCESSING_QUEUE_KEY)
        return {"backend": "redis", "queued": int(queued), "processing": int(processing)}
    except Exception:
        return {"backend": "redis-unavailable", "queued": -1, "processing": -1}
