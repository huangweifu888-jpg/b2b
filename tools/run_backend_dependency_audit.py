"""Run pip-audit and permit only active, documented PyPI exceptions."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REQUIREMENTS = ROOT / "backend" / "requirements.lock.txt"
POLICY = ROOT / "security" / "supply-chain-exceptions.json"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sbom-output", type=Path)
    args = parser.parse_args()
    completed = subprocess.run(
        [sys.executable, "-m", "pip_audit", "-r", str(REQUIREMENTS), "--format", "json"],
        check=False,
        capture_output=True,
        text=True,
    )
    try:
        report = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"pip-audit did not return JSON: {completed.stderr.strip()}") from exc
    findings = report.get("dependencies", []) if isinstance(report, dict) else report
    if not isinstance(findings, list):
        raise RuntimeError("pip-audit JSON does not contain a dependency list")

    policy = json.loads(POLICY.read_text(encoding="utf-8"))
    exceptions = {
        (item["package"], item["vulnerability_id"]): item
        for item in policy["exceptions"]
        if item.get("ecosystem") == "pypi" and date.fromisoformat(item["expires_on"]) >= date.today()
    }
    blocked: list[str] = []
    permitted: list[str] = []
    for dependency in findings:
        for vulnerability in dependency.get("vulns", []):
            key = (dependency["name"], vulnerability["id"])
            label = f"{dependency['name']} ({vulnerability['id']})"
            if key in exceptions:
                permitted.append(label)
            else:
                blocked.append(label)

    if permitted:
        print("Documented temporary Python exceptions:", ", ".join(sorted(permitted)))
    if blocked:
        print("Unapproved Python dependency findings:", ", ".join(sorted(blocked)), file=sys.stderr)
        return 1
    if completed.returncode not in {0, 1}:
        print(completed.stderr.strip(), file=sys.stderr)
        return completed.returncode
    if args.sbom_output:
        args.sbom_output.parent.mkdir(parents=True, exist_ok=True)
        sbom_command = [
            sys.executable,
            "-m",
            "pip_audit",
            "-r",
            str(REQUIREMENTS),
            "--format",
            "cyclonedx-json",
            "--output",
            str(args.sbom_output),
        ]
        for vulnerability_id in sorted({vulnerability_id for _, vulnerability_id in exceptions}):
            sbom_command.extend(["--ignore-vuln", vulnerability_id])
        sbom = subprocess.run(sbom_command, check=False, capture_output=True, text=True)
        if sbom.returncode:
            print(sbom.stderr.strip() or sbom.stdout.strip(), file=sys.stderr)
            return sbom.returncode
    print("Backend dependency audit: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
