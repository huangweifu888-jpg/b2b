"""Static checks for non-root, immutable, attestable container releases."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile


ROOT = Path(__file__).resolve().parents[1]
DOCKERFILE = ROOT / "deployment" / "containers" / "backend.Dockerfile"
COMPOSE = ROOT / "deployment" / "compose" / "customer-stamp.compose.example.yaml"


def load_attestation_tool():
    spec = importlib.util.spec_from_file_location("container_attestation", ROOT / "tools" / "create_container_attestation.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    dockerfile = DOCKERFILE.read_text(encoding="utf-8")
    compose = COMPOSE.read_text(encoding="utf-8")
    assert "USER b2b" in dockerfile
    assert "--no-cache-dir" in dockerfile and "--disable-pip-version-check" in dockerfile
    assert "read_only: true" in compose
    assert "no-new-privileges:true" in compose
    assert "cap_drop:" in compose and "- ALL" in compose
    tool = load_attestation_tool()
    with tempfile.TemporaryDirectory(prefix="b2b-container-attestation-") as directory:
        root = Path(directory)
        sbom = root / "frontend.cdx.json"
        sbom.write_text(json.dumps({"bomFormat": "CycloneDX"}), encoding="utf-8")
        statement = tool.create_statement("registry.invalid/b2b", "sha256:" + "a" * 64, [sbom])
        assert statement["subject"][0]["digest"]["sha256"] == "a" * 64
        assert statement["predicate"]["materials"]
    print("Container controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
