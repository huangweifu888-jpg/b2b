"""Validate a credential-free release change record and rollback ownership."""

from __future__ import annotations

import argparse
from datetime import datetime
import json
import re
from pathlib import Path


DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
SHA = re.compile(r"^[0-9a-f]{64}$")
REQUIRED_ROLES = {"release_manager", "operations", "security"}
REQUIRED_RINGS = ["hq", "test_agency", "test_client_plan", "full_rollout"]


def validate(record: dict[str, object], *, allow_placeholders: bool = False) -> list[str]:
    errors: list[str] = []
    if record.get("schema_version") != 1 or not str(record.get("change_id", "")).strip():
        errors.append("schema_version and change_id are required")
    window = record.get("window_utc")
    try:
        start = datetime.fromisoformat(str(window["start"]).replace("Z", "+00:00"))
        end = datetime.fromisoformat(str(window["end"]).replace("Z", "+00:00"))
        if end <= start:
            errors.append("release window must end after it starts")
    except (TypeError, KeyError, ValueError):
        errors.append("window_utc must provide ISO start and end values")
    artifact = record.get("artifact")
    if not isinstance(artifact, dict) or not DIGEST.fullmatch(str(artifact.get("digest", ""))):
        errors.append("artifact digest must be a sha256 image digest")
    if not isinstance(artifact, dict) or not SHA.fullmatch(str(artifact.get("release_manifest_sha256", ""))):
        errors.append("release manifest digest must be SHA-256")
    if not REQUIRED_ROLES <= set(record.get("approval_roles", [])):
        errors.append("approval roles must include release_manager, operations, and security")
    if record.get("rollout_rings") != REQUIRED_RINGS:
        errors.append("rollout rings must use the controlled sequence")
    rollback = record.get("rollback")
    if not isinstance(rollback, dict) or not rollback.get("owner") or not DIGEST.fullmatch(str(rollback.get("previous_digest", ""))) or len(str(rollback.get("restore_drill_reference", ""))) < 8:
        errors.append("rollback requires owner, previous digest, and restore drill reference")
    communication = record.get("customer_communication")
    if not isinstance(communication, dict) or communication.get("status") not in {"drafted", "sent"}:
        errors.append("customer communication must be drafted or sent")
    if not allow_placeholders and "replace" in json.dumps(record).lower():
        errors.append("live change record contains placeholders")
    return errors


def self_test() -> int:
    valid = {
        "schema_version": 1, "change_id": "CHG-100", "window_utc": {"start": "2026-08-01T01:00:00Z", "end": "2026-08-01T02:00:00Z"},
        "artifact": {"image": "registry.internal/b2b", "digest": "sha256:" + "a" * 64, "release_manifest_sha256": "b" * 64},
        "approval_roles": sorted(REQUIRED_ROLES), "rollout_rings": REQUIRED_RINGS,
        "rollback": {"owner": "ops-1", "previous_digest": "sha256:" + "c" * 64, "restore_drill_reference": "RESTORE-100"},
        "customer_communication": {"status": "drafted", "audience": "affected"},
    }
    assert validate(valid) == []
    assert validate({**valid, "rollout_rings": ["full_rollout"]})
    print("Release governance: OK")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--record", type=Path)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if not args.record or not args.record.is_file():
        parser.error("--record must reference the credential-free live change record")
    errors = validate(json.loads(args.record.read_text(encoding="utf-8")))
    if errors:
        print("Release governance failed:\n" + "\n".join(f"- {error}" for error in errors))
        return 1
    print("Release governance: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
