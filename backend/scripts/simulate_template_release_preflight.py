"""Generate a no-write, value-free template-release preflight report."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from services.template_snapshot import build_release_preflight_report


def simulate() -> dict[str, object]:
    previous_template = {
        "layout": {"title": "standard", "spacing": "normal"},
        "modules": {"catalog": {"enabled": True}},
    }
    next_template = {
        "layout": {"title": "standard", "spacing": "comfortable"},
        "modules": {"catalog": {"enabled": False}, "news": {"enabled": True}},
    }
    downstream_snapshot = {
        "layout": {"title": "standard", "spacing": "tenant-custom"},
        "modules": {"catalog": {"enabled": True, "label": "tenant-custom"}, "local-tool": {"enabled": True}},
    }
    agency = build_release_preflight_report(
        source_scope="agency_source",
        target_scope="agency",
        previous_template=previous_template,
        next_template=next_template,
        current_snapshot=downstream_snapshot,
        explicit_overrides={},
    )
    client = build_release_preflight_report(
        source_scope="client_source",
        target_scope="client",
        previous_template=previous_template,
        next_template=next_template,
        current_snapshot=downstream_snapshot,
        explicit_overrides={},
    )
    return {"status": "passed", "write_performed": False, "reports": [agency, client]}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        default=str(ROOT.parent / "release" / "verification-reports" / "development-standard-release-preflight.json"),
    )
    args = parser.parse_args()
    report = simulate()
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(f"{json.dumps(report, ensure_ascii=False, indent=2)}\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "output": str(output), "reports": len(report["reports"])}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
