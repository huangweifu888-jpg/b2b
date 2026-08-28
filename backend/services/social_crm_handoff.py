"""Input boundaries for social-to-CRM handoffs."""

from __future__ import annotations

import re


_PHONE_LIKE = re.compile(r"\d[\d\s-]{6,}\d")


def initial_handoff_status(*, auto_handoff_enabled: bool) -> str:
    """Keep the default human-review boundary explicit and testable."""
    return "approved_for_crm" if auto_handoff_enabled else "pending_manual_review"


def validate_contact_reference(value: str) -> str:
    normalized = value.strip()
    if not 2 <= len(normalized) <= 160 or "@" in normalized or _PHONE_LIKE.search(normalized):
        raise ValueError("Use an opaque account or CRM reference; do not submit email addresses or phone numbers")
    return normalized
