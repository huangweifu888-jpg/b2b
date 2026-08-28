"""Select the API or worker process from the same reviewed container image."""

from __future__ import annotations

import os
import sys

from core.runtime_readiness import deployment_component


def command_for_component(component: str) -> list[str]:
    if component == "api":
        return [sys.executable, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", os.getenv("PORT", "8000")]
    if component == "worker":
        return [sys.executable, "-m", "scripts.run_job_worker"]
    raise RuntimeError("APP_COMPONENT must be 'api' or 'worker'")


def main() -> None:
    os.execvp(sys.executable, command_for_component(deployment_component()))


if __name__ == "__main__":
    main()
