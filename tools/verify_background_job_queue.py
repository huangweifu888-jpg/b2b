"""Executable contract checks for the shared background-job queue."""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.background_jobs import dequeue_background_job, enqueue_background_job  # noqa: E402


async def verify_local_queue() -> None:
    os.environ["RATE_LIMIT_BACKEND"] = "memory"
    result = await enqueue_background_job("backup_verify", {"backup_id": "safe-id", "token": "do-not-store"})
    assert result["type"] == "backup_verify"
    job = await dequeue_background_job()
    assert job and job["id"] == result["id"]
    assert job["payload"]["token"] == "[redacted]"
    assert await dequeue_background_job() is None
    try:
        await enqueue_background_job("arbitrary_shell", {})
    except ValueError:
        pass
    else:
        raise AssertionError("Unknown job type must be rejected")


def main() -> int:
    asyncio.run(verify_local_queue())
    print("Background job queue controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
