"""Verify that a dedicated worker claims, executes, acknowledges, and records a queued job."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.background_jobs import background_job_result, claim_background_job, enqueue_background_job, recover_processing_jobs  # noqa: E402
from services.job_worker import JobWorker, PermanentJobError, execute_job  # noqa: E402


async def verify() -> None:
    os.environ["RATE_LIMIT_BACKEND"] = "memory"
    queued = await enqueue_background_job("release_smoke_check", {"artifact_path": "not-used-by-mock"})

    async def fake_execute(job):
        assert job["id"] == queued["id"]
        return {"status": "completed", "token": "must-be-redacted"}

    with patch("services.job_worker.execute_job", fake_execute):
        assert await JobWorker().process_one(timeout_seconds=0)
    result = await background_job_result(queued["id"])
    assert result and result["status"] == "completed" and result["token"] == "[redacted]"
    stranded = await enqueue_background_job("backup_verify", {"backup_path": "unused"})
    assert await claim_background_job(timeout_seconds=0)
    assert await recover_processing_jobs() == 1
    claimed_again = await claim_background_job(timeout_seconds=0)
    assert claimed_again and claimed_again[0]["id"] == stranded["id"]
    try:
        await execute_job({"type": "release_smoke_check", "payload": {"artifact_path": "D:/outside.zip"}})
    except PermanentJobError:
        pass
    else:
        raise AssertionError("Worker must reject an artifact outside the controlled release root")


def main() -> int:
    asyncio.run(verify())
    print("Dedicated job worker controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
