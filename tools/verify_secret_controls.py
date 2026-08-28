"""Verify production secret controls without reading or printing any real secret."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.secret_controls import secret_configuration_errors, secret_configuration_health  # noqa: E402
from core.mask_crypto import decrypt_text, encrypt_text  # noqa: E402
from routers.settings import reject_sensitive_frontend_key, require_local_setting_mutation  # noqa: E402


def main() -> int:
    with patch.dict(os.environ, {"ENVIRONMENT": "production"}, clear=False):
        for key in ("JWT_SECRET_KEY", "CONTENT_DOWNLOAD_SECRET", "MASK_KEY"):
            os.environ.pop(key, None)
        assert secret_configuration_health() == "invalid"
        assert any("JWT_SECRET_KEY" in error for error in secret_configuration_errors())
        try:
            require_local_setting_mutation()
        except HTTPException as exc:
            assert exc.status_code == 403
        else:
            raise AssertionError("Production environment-file mutation must be rejected")
    with patch.dict(os.environ, {
        "ENVIRONMENT": "production",
        "JWT_SECRET_KEY": "jwt-0123456789-abcdefghijklmnopqrstuvwxyz",
        "CONTENT_DOWNLOAD_SECRET": "download-0123456789-abcdefghijklmnopqrstuvwxyz",
        "MASK_KEY": "mask-0123456789-abcdefghijklmnopqrstuvwxyz",
        "CORS_ALLOWED_ORIGINS": "https://app.example.test",
    }, clear=False):
        assert secret_configuration_health() == "ready"
        encrypted = encrypt_text("safe-value")
        assert decrypt_text(encrypted) == "safe-value"
    try:
        reject_sensitive_frontend_key("VITE_API_KEY")
    except HTTPException as exc:
        assert exc.status_code == 400
    else:
        raise AssertionError("Frontend secret-like key must be rejected")
    print("Secret controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
