"""Verify that release SBOM generation stays reproducible and complete."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile


ROOT = Path(__file__).resolve().parents[1]


def load_generator():
    spec = importlib.util.spec_from_file_location("frontend_sbom", ROOT / "tools" / "generate_frontend_sbom.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    generator = load_generator()
    first = generator.build_sbom()
    second = generator.build_sbom()
    assert first["bomFormat"] == "CycloneDX" and first["specVersion"] == "1.5"
    assert first["serialNumber"] == second["serialNumber"], "SBOM identity must be deterministic for one lockfile"
    components = first["components"]
    assert components and all("purl" in component for component in components)
    with tempfile.TemporaryDirectory(prefix="b2b-sbom-") as directory:
        output = Path(directory) / "frontend.cdx.json"
        output.write_text(json.dumps(first), encoding="utf-8")
        assert json.loads(output.read_text(encoding="utf-8"))["components"] == components
    print(f"SBOM controls: OK ({len(components)} frontend components)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
