"""Verify API versioning, signed webhook, and idempotency primitives."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from services.integration_security import event_fingerprint, sign_webhook, validate_idempotency_key, verify_webhook_signature  # noqa: E402


def main() -> int:
    policy = json.loads((ROOT / "deployment" / "policies" / "integration-governance.json").read_text(encoding="utf-8"))
    assert policy["api"] == {"version_prefix": "/api/v1", "idempotency_key_required_for_writes": True, "tenant_context_required": True}
    assert all(policy["webhook"][key] is True for key in ("hmac_sha256_required", "secret_manager_reference_required", "replay_protection_required", "event_id_required"))
    assert policy["retries"] == {"transient_only": True, "max_attempts": 3, "dead_letter_required": True}
    key = validate_idempotency_key("invoice:2026-07-28:000001")
    payload, secret = b'{"event":"paid"}', "minimum-webhook-secret"
    signature = sign_webhook(payload, secret)
    assert verify_webhook_signature(payload, signature, secret)
    assert not verify_webhook_signature(payload + b"x", signature, secret)
    assert event_fingerprint("evt-1", payload) == event_fingerprint("evt-1", payload)
    print("Integration controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
