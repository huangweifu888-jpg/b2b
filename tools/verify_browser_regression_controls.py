"""Verify browser-level app shell and social-media routes are covered."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    package = (ROOT / "frontend" / "package.json").read_text(encoding="utf-8")
    config = (ROOT / "frontend" / "playwright.config.ts").read_text(encoding="utf-8")
    spec = (ROOT / "frontend" / "e2e" / "app-shell.spec.ts").read_text(encoding="utf-8")
    assert '"test:e2e"' in package
    assert "webServer" in config and "B2B_E2E_BASE_URL" in config
    assert "application shell renders" in spec and "/social" in spec and "社交媒体" in spec
    print("Browser regression controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
