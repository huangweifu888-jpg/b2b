"""Run durable operational jobs outside the FastAPI API process.

Usage: ``python -m scripts.run_job_worker``.
The same application image can run this worker by setting APP_COMPONENT=worker.
"""

from __future__ import annotations

import asyncio
import logging
import signal

from core.config import settings
from core.runtime_readiness import deployment_component, production_runtime_configuration_errors
from services.database import close_database, initialize_database
from services.job_worker import JobWorker
from services.secret_controls import assert_runtime_secrets


logger = logging.getLogger(__name__)


async def serve_worker() -> None:
    if deployment_component() != "worker":
        raise RuntimeError("APP_COMPONENT must be 'worker' when starting the job worker")
    errors = production_runtime_configuration_errors()
    if errors:
        raise RuntimeError("Worker deployment configuration is invalid: " + ", ".join(errors))
    if not settings.is_development_environment:
        assert_runtime_secrets()

    await initialize_database()
    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for signal_name in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(signal_name, stop_event.set)
        except (NotImplementedError, RuntimeError):
            # Windows worker development uses KeyboardInterrupt; production
            # containers support the signal handler above.
            pass

    worker = JobWorker()
    logger.info("Background job worker started")
    try:
        while not stop_event.is_set():
            handled = await worker.process_one(timeout_seconds=5)
            if not handled:
                await asyncio.sleep(0.25)
    finally:
        await close_database()
        logger.info("Background job worker stopped")


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    asyncio.run(serve_worker())


if __name__ == "__main__":
    main()
