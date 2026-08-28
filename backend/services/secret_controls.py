"""Secret presence and strength controls without ever returning secret values."""

from __future__ import annotations

import os

from core.runtime_security import cors_configuration_errors


LOCAL_ENVIRONMENTS = {"dev", "development", "local", "test", "testing"}
REQUIRED_PRODUCTION_SECRETS = ("JWT_SECRET_KEY", "CONTENT_DOWNLOAD_SECRET", "MASK_KEY")


def is_local_environment() -> bool:
    return os.getenv("ENVIRONMENT", "production").strip().lower() in LOCAL_ENVIRONMENTS


def secret_configuration_errors() -> list[str]:
    """Return key names and policy failures only; never include configured values."""
    if is_local_environment():
        return []
    values = {key: os.getenv(key, "").strip() for key in REQUIRED_PRODUCTION_SECRETS}
    errors = [f"{key}:missing-or-too-short" for key, value in values.items() if len(value) < 32]
    configured = [value for value in values.values() if value]
    if len(configured) != len(set(configured)):
        errors.append("secret-values-must-be-distinct")
    errors.extend(cors_configuration_errors())
    return errors


def assert_runtime_secrets() -> None:
    errors = secret_configuration_errors()
    if errors:
        raise RuntimeError("Production secret configuration is invalid: " + ", ".join(errors))


def secret_configuration_health() -> str:
    if is_local_environment():
        return "development-bypass"
    return "ready" if not secret_configuration_errors() else "invalid"
