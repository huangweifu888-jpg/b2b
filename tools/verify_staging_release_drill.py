"""Verify the staging release drill contract without a live deployment."""

from __future__ import annotations

import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_readiness():
    spec = importlib.util.spec_from_file_location("release_readiness", ROOT / "tools" / "verify_release_readiness.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    readiness = load_readiness()
    assert readiness.self_test() == 0
    template = ROOT / "deployment" / "env" / "release.staging.env.example"
    values = readiness.load_env_file(template)
    assert values["ENVIRONMENT"] == "staging"
    assert values["DATABASE_SCHEMA_MODE"] == "migrate"
    script = (ROOT / "tools" / "run-staging-release-drill.ps1").read_text(encoding="utf-8")
    assert "release-preflight.ps1" in script and "-Probe" in script
    print("Staging release drill controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
