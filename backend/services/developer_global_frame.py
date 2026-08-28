"""Appearance-only integration helpers for template snapshot releases."""

from __future__ import annotations

from copy import deepcopy
from typing import Any

from pydantic import ValidationError

from schemas.developer_global_frame import (
    DEVELOPER_GLOBAL_FRAME_SECTION,
    DeveloperGlobalFrameSection,
)


RUNTIME_SCOPE_BY_SOURCE_SCOPE = {
    "agency_source": "agency",
    "client_source": "client",
}


def normalize_developer_global_frame_release_sections(sections: list[str] | None) -> list[str]:
    """Fail closed for every partial template-sync entry point.

    ``None`` is the legacy full-template operation.  If a caller explicitly
    supplies ``sections``, exactly one appearance-only section is required;
    empty, blank, duplicate, mixed, and business-section lists are rejected.
    """
    if sections is None:
        return []
    if not isinstance(sections, list) or len(sections) != 1:
        raise ValueError("Partial template synchronization requires exactly developer_global_frame")
    section = sections[0]
    if not isinstance(section, str) or section.strip() != DEVELOPER_GLOBAL_FRAME_SECTION:
        raise ValueError("Partial template synchronization may synchronize developer_global_frame only")
    return [DEVELOPER_GLOBAL_FRAME_SECTION]


def normalize_developer_global_frame_document(
    config: dict[str, Any],
    *,
    owner_scope: str,
) -> dict[str, Any]:
    """Validate and normalize the optional frame section without touching peers."""
    normalized = deepcopy(config)
    if DEVELOPER_GLOBAL_FRAME_SECTION not in normalized:
        return normalized
    raw_section = normalized[DEVELOPER_GLOBAL_FRAME_SECTION]
    if not isinstance(raw_section, dict):
        raise ValueError("developer_global_frame must be an object")
    try:
        section = DeveloperGlobalFrameSection.model_validate(raw_section)
    except ValidationError as exc:
        first = exc.errors(include_url=False)[0]
        location = ".".join(str(item) for item in first.get("loc", ()))
        message = str(first.get("msg") or "invalid appearance-only contract")
        suffix = f" at {location}" if location else ""
        raise ValueError(f"Invalid developer_global_frame{suffix}: {message}") from exc
    if section.source_scope != owner_scope:
        raise ValueError(
            f"developer_global_frame source_scope {section.source_scope} does not match template owner_scope {owner_scope}"
        )
    normalized[DEVELOPER_GLOBAL_FRAME_SECTION] = section.model_dump(mode="json", exclude_none=True)
    return normalized


def validate_runtime_developer_global_frame_document(
    config: dict[str, Any],
    *,
    runtime_scope: str,
) -> dict[str, Any]:
    """Validate a runtime copy against its owning source shell."""
    section = config.get(DEVELOPER_GLOBAL_FRAME_SECTION)
    if section is None:
        return deepcopy(config)
    if not isinstance(section, dict):
        raise ValueError("developer_global_frame must be an object")
    source_scope = str(section.get("source_scope") or "")
    expected_runtime_scope = RUNTIME_SCOPE_BY_SOURCE_SCOPE.get(source_scope)
    if expected_runtime_scope != runtime_scope:
        raise ValueError(
            f"developer_global_frame source_scope {source_scope or 'missing'} cannot be stored by runtime scope {runtime_scope}"
        )
    return normalize_developer_global_frame_document(config, owner_scope=source_scope)


def assert_developer_global_frame_publish_version(config: dict[str, Any], *, version: str) -> None:
    """Bind the profile identifier to the immutable template version row."""
    section = config.get(DEVELOPER_GLOBAL_FRAME_SECTION)
    if section is None:
        return
    profile_version = str(section.get("profile_version") or "") if isinstance(section, dict) else ""
    if profile_version != version:
        raise ValueError(
            "developer_global_frame profile_version must equal the immutable template publish version"
        )


def require_developer_global_frame_release(
    config: dict[str, Any],
    *,
    owner_scope: str,
    runtime_scope: str,
) -> dict[str, Any]:
    """Fail closed before a section-only rollout batch is queued."""
    normalized = normalize_developer_global_frame_document(config, owner_scope=owner_scope)
    if DEVELOPER_GLOBAL_FRAME_SECTION not in normalized:
        raise ValueError("The published template does not contain developer_global_frame")
    expected_runtime_scope = RUNTIME_SCOPE_BY_SOURCE_SCOPE.get(owner_scope)
    if expected_runtime_scope is None:
        raise ValueError("HQ frame profiles must first be promoted to a source shell before runtime rollout")
    if runtime_scope != expected_runtime_scope:
        raise ValueError(
            f"developer_global_frame from {owner_scope} can roll out only to {expected_runtime_scope} instances"
        )
    return normalized[DEVELOPER_GLOBAL_FRAME_SECTION]


def apply_source_owned_developer_global_frame(
    merged: dict[str, Any],
    preserved_overrides: dict[str, Any],
    source: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Make the global frame source-owned while preserving every peer section.

    Version 1 deliberately permits no page-local frame overrides.  The shared
    section therefore replaces that section only; business and page-owned
    siblings keep the existing merge semantics.
    """
    if DEVELOPER_GLOBAL_FRAME_SECTION not in source:
        return merged, preserved_overrides
    next_merged = deepcopy(merged)
    next_overrides = deepcopy(preserved_overrides)
    next_merged[DEVELOPER_GLOBAL_FRAME_SECTION] = deepcopy(source[DEVELOPER_GLOBAL_FRAME_SECTION])
    next_overrides.pop(DEVELOPER_GLOBAL_FRAME_SECTION, None)
    return next_merged, next_overrides
