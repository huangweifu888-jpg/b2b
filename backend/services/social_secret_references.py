"""Validation for opaque server-side secret references."""

from __future__ import annotations

import re


_REFERENCE = re.compile(r"^(?:vault|kms|secret)://[A-Za-z0-9._/:-]{3,240}$")


def validate_secret_reference(value: str) -> str:
    normalized = value.strip()
    if not _REFERENCE.fullmatch(normalized):
        raise ValueError("Secret references must use vault://, kms:// or secret:// and must not contain secret material")
    return normalized
