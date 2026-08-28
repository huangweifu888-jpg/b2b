"""Run the B2B worker as a process separate from the FastAPI API service."""

from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
import sys
sys.path.insert(0, str(ROOT / "backend"))

from services.database import close_database, initialize_database
from services.background_jobs import recover_processing_jobs
from services.job_worker import JobWorker
from services.secret_controls import assert_runtime_secrets


async def run(once: bool, recover_processing: bool) -> None:
    assert_runtime_secrets()
    await initialize_database()
    worker = JobWorker()
    try:
        if recover_processing:
            print(f"Recovered {await recover_processing_jobs()} unacknowledged jobs")
        while True:
            processed = await worker.process_one(timeout_seconds=5)
            if once:
                return
            if not processed:
                await asyncio.sleep(1)
    finally:
        await close_database()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--once", action="store_true", help="Process at most one queued job, then exit")
    parser.add_argument("--recover-processing", action="store_true", help="Requeue processing jobs only after old workers are stopped")
    args = parser.parse_args()
    if os.getenv("APP_COMPONENT", "worker").lower() != "worker":
        raise SystemExit("APP_COMPONENT must be worker for this process")
    asyncio.run(run(args.once, args.recover_processing))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
