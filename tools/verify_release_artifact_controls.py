"""Build and re-verify a temporary release artifact from the checked-in manifest."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import tempfile


ROOT = Path(__file__).resolve().parents[1]


def load_tool(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools" / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    import sys
    sys.path.insert(0, str(ROOT / "tools"))
    bundle = load_tool("create_release_bundle")
    verifier = load_tool("verify_release_bundle")
    with tempfile.TemporaryDirectory(prefix="b2b-release-artifact-") as directory:
        artifact = Path(directory) / "client-foundation.zip"
        record = bundle.create_bundle(ROOT / "release" / "manifests" / "client-foundation-0.1.0.json", artifact)
        assert artifact.is_file() and len(record["sha256"]) == 64
        result = verifier.verify_bundle(artifact)
        assert result["status"] == "verified" and result["file_count"] == 2
    print("Release artifact controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
