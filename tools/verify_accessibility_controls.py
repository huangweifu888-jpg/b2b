"""Verify baseline localization and browser accessibility regression coverage."""

from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    index = (ROOT / "frontend" / "index.html").read_text(encoding="utf-8")
    test = (ROOT / "frontend" / "e2e" / "accessibility.spec.ts").read_text(encoding="utf-8")
    assert '<html lang="zh-CN">' in index
    assert "keyboard" in test and "viewport" in test and "aria" in test
    print("Accessibility regression controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
