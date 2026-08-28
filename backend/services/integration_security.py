"""Small, dependency-free primitives for signed and idempotent integrations."""

from __future__ import annotations

import hashlib
import hmac
import re


_IDEMPOTENCY_KEY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$")


def validate_idempotency_key(value: str) -> str:
    key = str(value or "").strip()
    if not _IDEMPOTENCY_KEY.fullmatch(key):
        raise ValueError("idempotency key must be 16-128 safe characters")
    return key


def sign_webhook(payload: bytes, secret: str) -> str:
    if len(secret) < 16:
        raise ValueError("webhook signing secret is too short")
    return "sha256=" + hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def verify_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    try:
        expected = sign_webhook(payload, secret)
    except ValueError:
        return False
    return hmac.compare_digest(expected, str(signature or ""))


def event_fingerprint(event_id: str, payload: bytes) -> str:
    if not str(event_id).strip():
        raise ValueError("event_id is required")
    return hashlib.sha256(str(event_id).encode("utf-8") + b"\0" + payload).hexdigest()
