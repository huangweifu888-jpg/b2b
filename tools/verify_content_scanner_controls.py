"""Verify fail-closed scanner command handling without requiring an antivirus installation."""

from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import tempfile
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.content_scanner import scan_file, scanner_readiness  # noqa: E402


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="b2b-scanner-control-") as directory:
        target = Path(directory) / "document.pdf"
        target.write_bytes(b"scanner control fixture")
        clean_command = json.dumps([sys.executable, "-c", "import sys; raise SystemExit(0)", "{file}"])
        rejected_command = json.dumps([sys.executable, "-c", "import sys; raise SystemExit(1)", "{file}"])
        with patch.dict(os.environ, {"ENVIRONMENT": "production", "CONTENT_DOWNLOAD_SCANNER_COMMAND_JSON": clean_command}, clear=False):
            assert scanner_readiness() == "ready"
            assert scan_file(target)[0] == "clean"
        with patch.dict(os.environ, {"ENVIRONMENT": "production", "CONTENT_DOWNLOAD_SCANNER_COMMAND_JSON": rejected_command}, clear=False):
            assert scan_file(target)[0] == "rejected"
        with patch.dict(os.environ, {"ENVIRONMENT": "production", "CONTENT_DOWNLOAD_SCANNER_COMMAND_JSON": "[]"}, clear=False):
            assert scanner_readiness() == "not-configured"
            assert scan_file(target)[0] == "pending"
    print("Content scanner controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
