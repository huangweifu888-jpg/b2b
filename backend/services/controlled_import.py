"""Tenant-scoped CSV preview and masking for controlled onboarding imports."""

from __future__ import annotations

import csv
from dataclasses import dataclass
import hashlib
from io import StringIO
from typing import Iterable

from core.tenant_context import TenantContext


SENSITIVE_FIELDS = frozenset({"email", "phone", "mobile", "contact_name", "address", "id_number"})
REQUIRED_SCOPE_FIELDS = ("agent_path", "tenant_id", "client_id")


@dataclass(frozen=True)
class ImportPreview:
    accepted_rows: int
    rejected_rows: int
    masked_rows: tuple[dict[str, str], ...]
    errors: tuple[str, ...]


def mask_value(field: str, value: str, *, masking_salt: str) -> str:
    if field not in SENSITIVE_FIELDS or not value:
        return value
    digest = hashlib.sha256(f"{masking_salt}:{field}:{value}".encode("utf-8")).hexdigest()[:16]
    return f"masked:{digest}"


def preview_csv(csv_text: str, *, context: TenantContext, non_production: bool, masking_salt: str = "") -> ImportPreview:
    reader = csv.DictReader(StringIO(csv_text))
    fields = set(reader.fieldnames or [])
    missing = set(REQUIRED_SCOPE_FIELDS) - fields
    if missing:
        return ImportPreview(0, 0, (), (f"missing required fields: {', '.join(sorted(missing))}",))
    accepted = rejected = 0
    masked_rows: list[dict[str, str]] = []
    errors: list[str] = []
    for line, row in enumerate(reader, start=2):
        if any(str(row.get(field, "")).strip() != getattr(context, field) for field in REQUIRED_SCOPE_FIELDS):
            rejected += 1
            errors.append(f"line {line}: cross-tenant scope rejected")
            continue
        accepted += 1
        if non_production:
            masked_rows.append({key: mask_value(key, str(value or ""), masking_salt=masking_salt) for key, value in row.items()})
    return ImportPreview(accepted, rejected, tuple(masked_rows), tuple(errors))
