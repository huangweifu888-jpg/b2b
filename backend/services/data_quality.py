"""Small reusable quality rules for business records before publication or sync."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlparse


REQUIRED_FIELDS = {
    "company": ("legal_name", "contact_email", "country"),
    "product": ("title", "sku", "description"),
    "news": ("title", "body", "published_at"),
    "seo": ("page_path", "title", "description"),
    "social": ("channel", "account_url"),
    "inquiry": ("contact_name", "email", "message"),
    "crm": ("customer_name", "owner_id", "stage"),
}
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_record(record_type: str, record: Mapping[str, Any]) -> list[str]:
    if record_type not in REQUIRED_FIELDS:
        return ["unsupported record type"]
    errors = [f"missing required field: {field}" for field in REQUIRED_FIELDS[record_type] if not str(record.get(field, "")).strip()]
    if record_type in {"company", "inquiry"} and record.get("email", record.get("contact_email")) and not EMAIL.fullmatch(str(record.get("email", record.get("contact_email")))):
        errors.append("invalid email")
    if record_type == "seo" and record.get("page_path") and not str(record["page_path"]).startswith("/"):
        errors.append("SEO page_path must start with /")
    if record_type == "social" and record.get("account_url"):
        parsed = urlparse(str(record["account_url"]))
        if parsed.scheme != "https" or not parsed.netloc:
            errors.append("social account_url must use HTTPS")
    return errors


def validate_batch(record_type: str, records: list[Mapping[str, Any]], *, unique_field: str) -> dict[str, object]:
    errors = {index: validate_record(record_type, record) for index, record in enumerate(records)}
    duplicates: set[str] = set()
    seen: set[str] = set()
    for record in records:
        value = str(record.get(unique_field, "")).strip().lower()
        if value and value in seen:
            duplicates.add(value)
        seen.add(value)
    return {"valid": not any(errors.values()) and not duplicates, "record_errors": errors, "duplicates": sorted(duplicates)}
