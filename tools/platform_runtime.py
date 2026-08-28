"""Resolve the Python executable used by local release and verification tools."""

from __future__ import annotations

import os
import shutil
import sys
from collections.abc import Mapping
from pathlib import Path


SOURCE_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = SOURCE_ROOT.parent


def workspace_python_candidates(workspace_root: Path, *, platform: str | None = None) -> tuple[Path, ...]:
    """Return relocatable workspace candidates in native-platform order."""

    platform_name = platform or os.name
    virtual_environment = workspace_root / "local-runtime" / "dependencies" / "backend-venv"
    windows = virtual_environment / "Scripts" / "python.exe"
    posix = (virtual_environment / "bin" / "python3", virtual_environment / "bin" / "python")
    return (windows, *posix) if platform_name == "nt" else (*posix, windows)


def _resolve_executable(candidate: str | Path) -> Path | None:
    raw = str(candidate).strip()
    if not raw:
        return None
    path = Path(raw).expanduser()
    if path.is_file() and os.access(path, os.X_OK):
        return path.resolve()
    discovered = shutil.which(raw)
    if discovered:
        executable = Path(discovered)
        if executable.is_file() and os.access(executable, os.X_OK):
            return executable.resolve()
    return None


def resolve_platform_python(
    *,
    workspace_root: Path | None = None,
    environ: Mapping[str, str] | None = None,
    host_python: str | Path | None = None,
    platform: str | None = None,
) -> str:
    """Resolve PLATFORM_PYTHON, the workspace runtime, then the current host.

    B2B_BACKEND_PYTHON remains a temporary compatibility alias and is considered
    only when PLATFORM_PYTHON is not configured.
    """

    environment = os.environ if environ is None else environ
    configured = environment.get("PLATFORM_PYTHON", "").strip()
    legacy = environment.get("B2B_BACKEND_PYTHON", "").strip() if not configured else ""
    candidates: list[str | Path] = []
    if configured:
        candidates.append(configured)
    elif legacy:
        candidates.append(legacy)
    candidates.extend(workspace_python_candidates((workspace_root or WORKSPACE_ROOT).resolve(), platform=platform))
    candidates.append(host_python or sys.executable)

    for candidate in candidates:
        executable = _resolve_executable(candidate)
        if executable is not None:
            return str(executable)
    raise FileNotFoundError(
        "No executable Python runtime was found. Configure PLATFORM_PYTHON or install "
        "local-runtime/dependencies/backend-venv."
    )
