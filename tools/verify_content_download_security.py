"""Exercise content-download intake rules against temporary files only."""

from __future__ import annotations

import os
from pathlib import Path
import sys
import tempfile


BACKEND = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND))

from fastapi import HTTPException  # noqa: E402
from models.platform import ContentDownloadAsset  # noqa: E402
from routers.content_downloads import (  # noqa: E402
    _decode_ticket,
    _encode_ticket,
    _ensure_asset_unchanged,
    _inspect_asset,
    _scan_asset,
)


def expect_http_error(callback) -> None:
    try:
        callback()
    except HTTPException:
        return
    raise AssertionError("expected download security rule to reject the file")


def main() -> int:
    original = {key: os.environ.get(key) for key in ("ASSET_STORAGE_ROOT", "ENVIRONMENT", "CONTENT_DOWNLOAD_SECRET", "CONTENT_DOWNLOAD_SCANNER_COMMAND_JSON")}
    try:
        with tempfile.TemporaryDirectory(prefix="b2b-download-security-") as directory:
            root = Path(directory)
            safe_file = root / "safe.pdf"
            safe_file.write_bytes(b"%PDF-1.4\nsecurity test\n")
            unsafe_file = root / "unsafe.exe"
            unsafe_file.write_bytes(b"MZ")
            os.environ["ASSET_STORAGE_ROOT"] = str(root)
            os.environ["ENVIRONMENT"] = "test"
            os.environ["CONTENT_DOWNLOAD_SECRET"] = "test-download-secret-0123456789-abcdefghijklmnopqrstuvwxyz"
            os.environ.pop("CONTENT_DOWNLOAD_SCANNER_COMMAND_JSON", None)

            size_bytes, sha256, media_type = _inspect_asset(safe_file, "application/pdf")
            status, detail = _scan_asset(safe_file)
            assert status == "clean" and detail == "development-bypass"
            expect_http_error(lambda: _inspect_asset(unsafe_file, "application/octet-stream"))

            asset = ContentDownloadAsset(
                id="asset-security-test",
                project_id=1,
                client_org_id=1,
                storage_key="safe.pdf",
                display_name="safe.pdf",
                media_type=media_type,
                size_bytes=size_bytes,
                sha256=sha256,
                scan_status="clean",
            )
            ticket = _encode_ticket(asset)
            assert _decode_ticket(ticket)["asset_id"] == asset.id
            assert _ensure_asset_unchanged(asset) == safe_file.resolve()
            safe_file.write_bytes(b"%PDF-1.4\nmodified\n")
            expect_http_error(lambda: _ensure_asset_unchanged(asset))

            os.environ["ENVIRONMENT"] = "production"
            status, detail = _scan_asset(safe_file)
            assert status == "pending" and detail == "scanner-not-configured"
    finally:
        for key, value in original.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    print("Content download security: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
