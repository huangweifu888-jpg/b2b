"""Fail-closed malware scanner integration for private content-download assets."""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess


CLEAN_SCAN_STATUS = "clean"


def is_local_environment() -> bool:
    return os.getenv("ENVIRONMENT", "dev").lower() in {"dev", "development", "test", "local"}


def scanner_command() -> list[str] | None:
    raw_command = os.getenv("CONTENT_DOWNLOAD_SCANNER_COMMAND_JSON", "").strip()
    if not raw_command:
        return None
    try:
        command = json.loads(raw_command)
    except json.JSONDecodeError:
        return None
    if not isinstance(command, list) or not command or not all(isinstance(item, str) for item in command):
        return None
    if "{file}" not in command:
        return None
    return command


def scanner_readiness() -> str:
    """Return a non-sensitive scanner state suitable for health probes."""
    if is_local_environment():
        return "development-bypass"
    command = scanner_command()
    if not command:
        return "not-configured"
    executable = command[0]
    if Path(executable).is_file() or shutil.which(executable):
        return "ready"
    return "unavailable"


def scan_file(path: Path) -> tuple[str, str]:
    """Scan one private file without a shell; unavailability stays fail-closed as pending."""
    if is_local_environment():
        return CLEAN_SCAN_STATUS, "development-bypass"
    command = scanner_command()
    if not command:
        return "pending", "scanner-not-configured"
    readiness = scanner_readiness()
    if readiness != "ready":
        return "pending", f"scanner-{readiness}"
    try:
        timeout_seconds = int(os.getenv("CONTENT_DOWNLOAD_SCAN_TIMEOUT_SECONDS", "120"))
        if timeout_seconds <= 0:
            raise ValueError("timeout must be positive")
        completed = subprocess.run(
            [str(path) if item == "{file}" else item for item in command],
            check=False,
            capture_output=True,
            timeout=timeout_seconds,
            shell=False,
        )
    except (OSError, subprocess.TimeoutExpired, ValueError) as exc:
        return "pending", f"scanner-unavailable:{type(exc).__name__}"
    if completed.returncode == 0:
        return CLEAN_SCAN_STATUS, "scanner-clean"
    return "rejected", f"scanner-exit:{completed.returncode}"
