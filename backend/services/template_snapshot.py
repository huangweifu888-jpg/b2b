from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from models.template_snapshot import (
    DeveloperGlobalFrameAcceptanceArtifact,
    DeveloperGlobalFrameAcceptanceJob,
    DeveloperGlobalFrameAcceptanceJobEvent,
    DeveloperGlobalFrameAcceptanceWorkerNonce,
    DeveloperGlobalFrameFactoryDefaultReceipt,
    DeveloperGlobalFramePreflightEvidence,
    TemplateSnapshotBackup,
    TemplateSnapshotInstance,
    TemplateSnapshotLegacyMapping,
    TemplateSnapshotReleaseBatch,
    TemplateSnapshotReleaseTarget,
    TemplateSnapshotTemplate,
    TemplateSnapshotVersion,
)
from schemas.developer_global_frame import DEVELOPER_GLOBAL_FRAME_SECTION
from services.developer_global_frame import (
    apply_source_owned_developer_global_frame,
    assert_developer_global_frame_publish_version,
    normalize_developer_global_frame_document,
    normalize_developer_global_frame_release_sections,
    validate_runtime_developer_global_frame_document,
)
from services.product_market_factory_default import resolve_product_market_runtime_default

logger = logging.getLogger(__name__)

TEMPLATE_SOURCE_SCOPES = {"hq", "client_source", "agency_source"}
INSTANCE_SCOPES = {"client", "agency"}
ACCEPTANCE_VIEWPORTS = (1440, 1024, 390)
ACCEPTANCE_SOURCE_PAGE_COUNTS = {"hq": 66, "agency_source": 33, "client_source": 102}
ACCEPTANCE_COMPATIBLE_PAGE_COUNT = 196
ACCEPTANCE_ISOLATED_PAGE_COUNT = 5
ACCEPTANCE_CASE_COUNT = 603
ACCEPTANCE_MAX_AGE = timedelta(minutes=30)
ACCEPTANCE_JOB_TTL = timedelta(hours=4)
ACCEPTANCE_JOB_MIN_EXECUTION_WINDOW = timedelta(minutes=60)
ACCEPTANCE_WORKER_LEASE = timedelta(minutes=10)
ACCEPTANCE_WORKER_PROOF_MAX_AGE = timedelta(minutes=5)
ACCEPTANCE_JOB_MAX_ATTEMPTS = 3
ACCEPTANCE_NON_RETRYABLE_FAILURE_CODES = {
    "acceptance.job-ttl-insufficient",
    "acceptance.source-drift",
}
ACCEPTANCE_DEPLOYMENT_HASH_ENV = {
    "page_registry_hash": "DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_PAGE_REGISTRY_HASH",
    "adapter_registry_hash": "DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_ADAPTER_REGISTRY_HASH",
    "isolation_policy_hash": "DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_ISOLATION_POLICY_HASH",
    "test_spec_hash": "DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_TEST_SPEC_HASH",
    "source_build_digest": "DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_SOURCE_BUILD_DIGEST",
}

# Template snapshots are product/layout baselines, never a transport for a
# tenant's commercial or identity records.  Keeping this guard at the service
# boundary protects the rule even if a future UI accidentally includes one of
# these fields in its export document.
PROTECTED_TEMPLATE_CONFIG_KEYS = {
    "companyshortname", "companylogourl", "companylogoassetid", "companylogoicon",
    "brand", "agencybrand", "customers", "customerdata", "orders", "inquiries",
    "members", "users", "roles", "wallet", "finance", "billing", "commission",
    "plans", "clientplans", "projects", "crm", "contacts", "address", "email",
    "mobilephone", "invitecode",
}


def _load_json(value: str | None) -> dict[str, Any]:
    try:
        return json.loads(value or "{}")
    except Exception:
        return {}


def _dump_json(value: dict[str, Any]) -> str:
    return json.dumps(value or {}, ensure_ascii=False)


def _template_document_hash(value: dict[str, Any]) -> str:
    canonical = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _as_utc_datetime(value: datetime | str) -> datetime:
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("Developer global frame preflight checked_at must be ISO-8601") from exc
    if not isinstance(value, datetime):
        raise ValueError("Developer global frame preflight checked_at is required")
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _iso_utc(value: datetime | str) -> str:
    return _as_utc_datetime(value).isoformat().replace("+00:00", "Z")


def _iso_utc_milliseconds(value: datetime | str) -> str:
    """Canonical JavaScript Date.toISOString() representation for receipt hashes."""

    normalized = _as_utc_datetime(value)
    return f"{normalized.strftime('%Y-%m-%dT%H:%M:%S')}.{normalized.microsecond // 1000:03d}Z"


def _acceptance_deployment_hashes(overrides: dict[str, str] | None = None) -> dict[str, str]:
    configured = overrides or {
        field: os.environ.get(environment_name, "").strip()
        for field, environment_name in ACCEPTANCE_DEPLOYMENT_HASH_ENV.items()
    }
    if set(configured) != set(ACCEPTANCE_DEPLOYMENT_HASH_ENV) or any(
        not isinstance(value, str)
        or len(value) != 64
        or any(character not in "0123456789abcdef" for character in value)
        for value in configured.values()
    ):
        raise ValueError("Trusted developer global frame acceptance deployment hashes are not configured")
    return dict(configured)


def _acceptance_hmac_keys(overrides: dict[str, dict[str, str]] | None = None) -> dict[str, dict[str, str]]:
    if overrides is None:
        raw = os.environ.get("DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_HMAC_KEYS", "").strip()
        try:
            decoded = json.loads(raw) if raw else None
        except (TypeError, ValueError) as exc:
            raise ValueError("Trusted developer global frame acceptance HMAC keys are invalid") from exc
    else:
        decoded = overrides
    if not isinstance(decoded, dict) or not decoded:
        raise ValueError("Trusted developer global frame acceptance HMAC keys are not configured")
    normalized: dict[str, dict[str, str]] = {}
    for key_id, descriptor in decoded.items():
        if (
            not isinstance(key_id, str)
            or not key_id
            or not isinstance(descriptor, dict)
            or set(descriptor) != {"issuer", "secret"}
            or not isinstance(descriptor.get("issuer"), str)
            or not descriptor["issuer"]
            or not isinstance(descriptor.get("secret"), str)
            or len(descriptor["secret"].encode("utf-8")) < 32
        ):
            raise ValueError("Trusted developer global frame acceptance HMAC key registry is invalid")
        normalized[key_id] = {"issuer": descriptor["issuer"], "secret": descriptor["secret"]}
    return normalized


def _canonical_acceptance_case_results(case_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    source_order = {"hq": 0, "agency_source": 1, "client_source": 2}
    viewport_order = {viewport: index for index, viewport in enumerate(ACCEPTANCE_VIEWPORTS)}
    normalized = [
        {
            "page_id": str(item["page_id"]),
            "source_scope": str(item["source_scope"]),
            "viewport": int(item["viewport"]),
            "outcome": str(item["outcome"]),
        }
        for item in case_results
    ]
    return sorted(
        normalized,
        key=lambda item: (
            source_order.get(item["source_scope"], 99),
            item["page_id"],
            viewport_order.get(item["viewport"], 99),
        ),
    )


def _acceptance_report_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "run_id": payload["run_id"],
        "issuer": payload["issuer"],
        "key_id": payload["key_id"],
        "template_id": payload["template_id"],
        "source_scope": payload["source_scope"],
        "acceptance_job_id": payload["acceptance_job_id"],
        "base_draft_hash": payload["base_draft_hash"],
        "frame_section_hash": payload["frame_section_hash"],
        "visual_draft_id": payload["visual_draft_id"],
        "recovery_point_id": payload["recovery_point_id"],
        "page_registry_hash": payload["page_registry_hash"],
        "adapter_registry_hash": payload["adapter_registry_hash"],
        "isolation_policy_hash": payload["isolation_policy_hash"],
        "test_spec_hash": payload["test_spec_hash"],
        "source_build_digest": payload["source_build_digest"],
        "issued_at": _iso_utc_milliseconds(payload["issued_at"]),
        "expires_at": _iso_utc_milliseconds(payload["expires_at"]),
        "viewports": list(ACCEPTANCE_VIEWPORTS),
        "compatible_target_page_ids": list(payload["compatible_target_page_ids"]),
        "isolated_page_ids": list(payload["isolated_page_ids"]),
        "case_results": _canonical_acceptance_case_results(list(payload["case_results"])),
        "failure_count": int(payload["failure_count"]),
        "flaky_count": int(payload["flaky_count"]),
        "skipped_count": int(payload["skipped_count"]),
    }


def _acceptance_report_hash(payload: dict[str, Any]) -> str:
    return _template_document_hash(_acceptance_report_payload(payload))


def _acceptance_signature(report_hash: str, secret: str) -> str:
    return hmac.new(secret.encode("utf-8"), report_hash.encode("ascii"), hashlib.sha256).hexdigest()


def _acceptance_worker_action_hash(
    action: str,
    template_id: str,
    job_id: str,
    payload: dict[str, Any],
) -> str:
    canonical = {
        "action": action,
        "template_id": template_id,
        "acceptance_job_id": job_id,
        "issuer": payload["issuer"],
        "key_id": payload["key_id"],
        "issued_at": _iso_utc_milliseconds(payload["issued_at"]),
        "nonce": payload["nonce"],
    }
    if action == "fail":
        canonical["error_code"] = payload["error_code"]
        canonical["error_message"] = payload["error_message"]
    return _template_document_hash(canonical)


def _acceptance_worker_claim_next_hash(payload: dict[str, Any]) -> str:
    return _template_document_hash(
        {
            "action": "claim-next",
            "source_scope": payload["source_scope"],
            "issuer": payload["issuer"],
            "key_id": payload["key_id"],
            "issued_at": _iso_utc_milliseconds(payload["issued_at"]),
            "nonce": payload["nonce"],
        }
    )


def _validate_acceptance_worker_claim_next_proof(
    payload: dict[str, Any],
    *,
    now: datetime,
) -> None:
    if payload.get("source_scope") != "client_source":
        raise ValueError("Developer global frame acceptance queue source scope is not allowed")
    key_registry = _acceptance_hmac_keys()
    descriptor = key_registry.get(str(payload.get("key_id") or ""))
    if not descriptor or not hmac.compare_digest(str(payload.get("issuer") or ""), descriptor["issuer"]):
        raise ValueError("Developer global frame acceptance worker issuer or key is not trusted")
    issued_at = _as_utc_datetime(payload["issued_at"])
    if issued_at > now or now - issued_at > ACCEPTANCE_WORKER_PROOF_MAX_AGE:
        raise ValueError("Developer global frame acceptance worker proof is future or stale")
    action_hash = _acceptance_worker_claim_next_hash(payload)
    expected_signature = _acceptance_signature(action_hash, descriptor["secret"])
    if not hmac.compare_digest(str(payload.get("signature") or ""), expected_signature):
        raise ValueError("Developer global frame acceptance worker signature is invalid")


def _validate_acceptance_worker_proof(
    action: str,
    template_id: str,
    job_id: str,
    payload: dict[str, Any],
    *,
    now: datetime,
) -> None:
    key_registry = _acceptance_hmac_keys()
    descriptor = key_registry.get(str(payload.get("key_id") or ""))
    if not descriptor or not hmac.compare_digest(str(payload.get("issuer") or ""), descriptor["issuer"]):
        raise ValueError("Developer global frame acceptance worker issuer or key is not trusted")
    issued_at = _as_utc_datetime(payload["issued_at"])
    if issued_at > now or now - issued_at > ACCEPTANCE_WORKER_PROOF_MAX_AGE:
        raise ValueError("Developer global frame acceptance worker proof is future or stale")
    action_hash = _acceptance_worker_action_hash(action, template_id, job_id, payload)
    expected_signature = _acceptance_signature(action_hash, descriptor["secret"])
    if not hmac.compare_digest(str(payload.get("signature") or ""), expected_signature):
        raise ValueError("Developer global frame acceptance worker signature is invalid")


def _assert_acceptance_section_matrix(section: dict[str, Any]) -> None:
    targets = section.get("target_matrix")
    if not isinstance(targets, list) or len(targets) != 201:
        raise ValueError("Developer global frame acceptance job requires an exact 201-page target matrix")
    compatible, isolated = _preflight_target_lists(section)
    if len(compatible) != ACCEPTANCE_COMPATIBLE_PAGE_COUNT or len(isolated) != ACCEPTANCE_ISOLATED_PAGE_COUNT:
        raise ValueError("Developer global frame acceptance job requires 196 compatible and 5 isolated pages")
    source_pages = {scope: set() for scope in ACCEPTANCE_SOURCE_PAGE_COUNTS}
    for target in targets:
        source_scope = target.get("source_scope")
        page_id = target.get("page_id")
        if source_scope not in source_pages or not isinstance(page_id, str):
            raise ValueError("Developer global frame acceptance job target matrix has an invalid source scope")
        if target.get("compatibility") == "isolated" and source_scope != "client_source":
            raise ValueError("Developer global frame acceptance job isolation pages must belong to client_source")
        source_pages[source_scope].add(page_id)
    if {scope: len(page_ids) for scope, page_ids in source_pages.items()} != ACCEPTANCE_SOURCE_PAGE_COUNTS:
        raise ValueError("Developer global frame acceptance job source coverage must be hq=66, agency_source=33, client_source=102")


def _assert_acceptance_matrix(payload: dict[str, Any]) -> None:
    compatible = list(payload.get("compatible_target_page_ids") or [])
    isolated = list(payload.get("isolated_page_ids") or [])
    case_results = _canonical_acceptance_case_results(list(payload.get("case_results") or []))
    if len(compatible) != ACCEPTANCE_COMPATIBLE_PAGE_COUNT or len(set(compatible)) != len(compatible):
        raise ValueError("Developer global frame acceptance must contain 196 unique compatible pages")
    if len(isolated) != ACCEPTANCE_ISOLATED_PAGE_COUNT or len(set(isolated)) != len(isolated):
        raise ValueError("Developer global frame acceptance must contain 5 unique isolated pages")
    if set(compatible) & set(isolated):
        raise ValueError("Developer global frame acceptance page dispositions must be disjoint")
    if list(payload.get("viewports") or []) != list(ACCEPTANCE_VIEWPORTS):
        raise ValueError("Developer global frame acceptance viewports must be exactly 1440, 1024, 390")
    if len(case_results) != ACCEPTANCE_CASE_COUNT:
        raise ValueError("Developer global frame acceptance must contain exactly 603 cases")
    identities = {
        (item["page_id"], item["source_scope"], item["viewport"])
        for item in case_results
    }
    if len(identities) != ACCEPTANCE_CASE_COUNT:
        raise ValueError("Developer global frame acceptance cases must be unique by page, source and viewport")
    pages = set(compatible) | set(isolated)
    page_scopes: dict[str, set[str]] = {page_id: set() for page_id in pages}
    page_viewports: dict[str, set[int]] = {page_id: set() for page_id in pages}
    source_pages = {scope: set() for scope in ACCEPTANCE_SOURCE_PAGE_COUNTS}
    for item in case_results:
        page_id = item["page_id"]
        source_scope = item["source_scope"]
        if page_id not in pages or source_scope not in source_pages:
            raise ValueError("Developer global frame acceptance case is outside the signed page matrix")
        expected_outcome = "passed" if page_id in compatible else "isolated"
        if item["outcome"] != expected_outcome:
            raise ValueError("Developer global frame acceptance case outcome contradicts its page disposition")
        if page_id in isolated and source_scope != "client_source":
            raise ValueError("Developer global frame intentional isolation pages must belong to client_source")
        page_scopes[page_id].add(source_scope)
        page_viewports[page_id].add(item["viewport"])
        source_pages[source_scope].add(page_id)
    if any(len(scopes) != 1 for scopes in page_scopes.values()) or any(
        viewports != set(ACCEPTANCE_VIEWPORTS) for viewports in page_viewports.values()
    ):
        raise ValueError("Every developer global frame page must have one source and all three viewport cases")
    if {scope: len(page_ids) for scope, page_ids in source_pages.items()} != ACCEPTANCE_SOURCE_PAGE_COUNTS:
        raise ValueError("Developer global frame acceptance source coverage must be hq=66, agency_source=33, client_source=102")
    if any(int(payload.get(field, -1)) != 0 for field in ("failure_count", "flaky_count", "skipped_count")):
        raise ValueError("Developer global frame acceptance cannot contain failed, flaky or skipped results")


def _load_page_ids(value: str, *, field: str) -> list[str]:
    try:
        decoded = json.loads(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Stored developer global frame preflight {field} is invalid") from exc
    if not isinstance(decoded, list) or any(not isinstance(item, str) or not item for item in decoded):
        raise ValueError(f"Stored developer global frame preflight {field} is invalid")
    if len(decoded) != len(set(decoded)):
        raise ValueError(f"Stored developer global frame preflight {field} contains duplicate page IDs")
    return decoded


def _preflight_target_lists(section: dict[str, Any]) -> tuple[list[str], list[str]]:
    targets = section.get("target_matrix")
    if not isinstance(targets, list):
        raise ValueError("developer_global_frame target matrix is missing")
    compatible = [str(item["page_id"]) for item in targets if item.get("compatibility") == "compatible"]
    isolated = [str(item["page_id"]) for item in targets if item.get("compatibility") == "isolated"]
    if len(compatible) + len(isolated) != len(targets):
        raise ValueError("developer_global_frame target matrix contains an unsupported disposition")
    return compatible, isolated


def _assert_preflight_matches_section(section: dict[str, Any], payload: dict[str, Any]) -> tuple[list[str], list[str]]:
    expected_compatible, expected_isolated = _preflight_target_lists(section)
    compatible = list(payload.get("compatible_target_page_ids") or [])
    isolated = list(payload.get("isolated_page_ids") or [])
    if compatible != expected_compatible or isolated != expected_isolated:
        raise ValueError(
            "Developer global frame preflight target dispositions do not exactly match the current target matrix"
        )
    if len(compatible) != len(set(compatible)) or len(isolated) != len(set(isolated)):
        raise ValueError("Developer global frame preflight target lists must be unique")
    if set(compatible) & set(isolated):
        raise ValueError("Developer global frame preflight target lists must be disjoint")
    recovery = section.get("recovery")
    expected_recovery = recovery.get("recovery_point_id") if isinstance(recovery, dict) else None
    if payload.get("recovery_point_id") != expected_recovery:
        raise ValueError("Developer global frame preflight recovery point does not match the current section")
    return compatible, isolated


def _preflight_evidence_hash(payload: dict[str, Any]) -> str:
    canonical = {
        "template_id": payload["template_id"],
        "source_scope": payload["source_scope"],
        "base_draft_hash": payload["base_draft_hash"],
        "saved_draft_hash": payload["saved_draft_hash"],
        "artifact_hash": payload["artifact_hash"],
        "compatible_target_page_ids": list(payload["compatible_target_page_ids"]),
        "isolated_page_ids": list(payload["isolated_page_ids"]),
        "recovery_point_id": payload["recovery_point_id"],
        "checked_at": _iso_utc(payload["checked_at"]),
    }
    acceptance_artifact_id = payload.get("acceptance_artifact_id")
    acceptance_artifact_hash = payload.get("acceptance_artifact_hash")
    visual_draft_id = payload.get("visual_draft_id")
    if acceptance_artifact_id or acceptance_artifact_hash or visual_draft_id:
        if not all((acceptance_artifact_id, acceptance_artifact_hash, visual_draft_id)):
            raise ValueError("Developer global frame preflight acceptance binding is incomplete")
        canonical.update(
            {
                "acceptance_artifact_id": acceptance_artifact_id,
                "acceptance_artifact_hash": acceptance_artifact_hash,
                "visual_draft_id": visual_draft_id,
            }
        )
    return _template_document_hash(canonical)


def _factory_default_receipt_hash(payload: dict[str, Any]) -> str:
    """Hash the exact camel-case wire contract produced by the coordinator."""

    canonical = {
        "schemaVersion": 1,
        "templateId": payload["template_id"],
        "publishedVersion": payload["published_version"],
        "artifactHash": payload["artifact_hash"],
        "draftHash": payload["draft_hash"],
        "preflightEvidenceHash": payload["preflight_evidence_hash"],
        "compatibleTargetPageIds": list(payload["compatible_target_page_ids"]),
        "isolatedPageIds": list(payload["isolated_page_ids"]),
        "recoveryPointId": payload["recovery_point_id"],
        "rolloutBatchId": payload["rollout_batch_id"],
        "recordedAt": _iso_utc_milliseconds(payload["recorded_at"]),
    }
    return _template_document_hash(canonical)


def _load_template_authoring_document(value: str | None) -> dict[str, Any]:
    try:
        document = json.loads(value or "{}")
    except (TypeError, ValueError) as exc:
        raise ValueError("Template authoring document is not valid JSON") from exc
    if not isinstance(document, dict):
        raise ValueError("Template authoring document must be a JSON object")
    return document


def load_template_version_release_sections(value: str | None) -> list[str]:
    """Decode immutable version scope metadata without guessing.

    ``NULL`` is the only representation of a legacy/full-template version.
    Every non-NULL value must remain the exact supported section list so a
    corrupted history row can never be reinterpreted as a full release.
    """
    if value is None:
        return []
    try:
        sections = json.loads(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Template version release_sections_json is corrupted") from exc
    try:
        return normalize_developer_global_frame_release_sections(sections)
    except ValueError as exc:
        raise ValueError("Template version release_sections_json is corrupted") from exc


def _strip_protected_template_fields(value: Any) -> Any:
    """Remove tenant identity and commercial data from a source snapshot."""
    if isinstance(value, list):
        return [_strip_protected_template_fields(item) for item in value]
    if not isinstance(value, dict):
        return deepcopy(value)
    return {
        key: _strip_protected_template_fields(item)
        for key, item in value.items()
        if str(key).replace("_", "").replace("-", "").lower() not in PROTECTED_TEMPLATE_CONFIG_KEYS
    }


def _deep_merge(base: Any, updates: Any) -> Any:
    if isinstance(base, dict) and isinstance(updates, dict):
        merged = dict(base)
        for key, value in updates.items():
            merged[key] = _deep_merge(merged.get(key), value)
        return merged
    return deepcopy(updates)


_UNCHANGED = object()


def _local_change_patch(base: Any, current: Any) -> Any:
    """Return only changes made below a template snapshot.

    A downstream instance stores an effective snapshot, while its explicit
    override document stores user-authored values.  Comparing the old template
    version with that effective snapshot lets a later template update change
    untouched fields without replacing a downstream edit or a newly-added
    field.  Deletions remain intentionally conservative: this project treats
    them as an explicit restore concern rather than silently deleting an
    upstream field during synchronization.
    """
    if isinstance(base, dict) and isinstance(current, dict):
        patch: dict[str, Any] = {}
        for key, value in current.items():
            if key not in base:
                patch[key] = deepcopy(value)
                continue
            nested = _local_change_patch(base[key], value)
            if nested is not _UNCHANGED:
                patch[key] = nested
        return patch if patch else _UNCHANGED
    return deepcopy(current) if base != current else _UNCHANGED


def _compose_synced_snapshot(
    latest_template: dict[str, Any],
    current_snapshot: dict[str, Any],
    explicit_overrides: dict[str, Any],
    previous_template: dict[str, Any] | None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Apply a new template without overwriting downstream custom data."""
    inferred_changes = (
        _local_change_patch(previous_template, current_snapshot)
        if previous_template is not None
        else deepcopy(current_snapshot)
    )
    inferred_overrides = {} if inferred_changes is _UNCHANGED else inferred_changes
    preserved_overrides = _deep_merge(inferred_overrides, explicit_overrides)
    return _deep_merge(latest_template, preserved_overrides), preserved_overrides


PRODUCT_MARKET_RESTORE_FIELDS = {
    "modules": {
        "products",
        "customDefaultPaths",
        "productOrder",
        "customProducts",
        "layoutStructureCustomized",
    },
    "layout": {
        "layoutStyle",
        "visualCardLayout",
        "layoutSections",
        "activeTheme",
        "customThemes",
        "builtinThemeOverrides",
        "sidebarStyle",
        "globalFontFamily",
        "globalFontWeight",
        "globalLetterSpacing",
        "layoutCustomized",
    },
    "service": {
        "soundEnabled",
        "soundVolume",
        "soundStyle",
        "csAvatarId",
        "csEnabled",
        "csVoiceEnabled",
        "csVoiceGender",
        "csVoiceRate",
        "customerServiceSections",
        "csAvatarOverrides",
        "customerServiceCustomized",
    },
}


def _compose_restored_snapshot(
    source_template: dict[str, Any],
    current_snapshot: dict[str, Any],
    explicit_overrides: dict[str, Any],
    previous_template: dict[str, Any] | None,
    target: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Restore a selected source baseline without replacing downstream edits.

    Restore is intentionally a source-baseline recovery, not a destructive
    reset.  It may change inherited fields for the selected instance only,
    while preserving explicit downstream customisations and newly-added data.
    """
    inferred_changes = (
        _local_change_patch(previous_template, current_snapshot)
        if previous_template is not None
        else deepcopy(current_snapshot)
    )
    inferred_overrides = {} if inferred_changes is _UNCHANGED else inferred_changes
    preserved_overrides = _deep_merge(inferred_overrides, explicit_overrides)
    if target == "all":
        return _deep_merge(source_template, preserved_overrides), preserved_overrides

    restored = deepcopy(current_snapshot)
    if target in PRODUCT_MARKET_RESTORE_FIELDS:
        fully_restored = _deep_merge(source_template, preserved_overrides)
        for field in PRODUCT_MARKET_RESTORE_FIELDS[target]:
            if field in fully_restored:
                restored[field] = deepcopy(fully_restored[field])
        return restored, preserved_overrides
    if target in source_template:
        restored[target] = _deep_merge(source_template[target], preserved_overrides.get(target, {}))
    return restored, preserved_overrides


def build_release_preflight_report(
    *,
    source_scope: str,
    target_scope: str,
    previous_template: dict[str, Any],
    next_template: dict[str, Any],
    current_snapshot: dict[str, Any],
    explicit_overrides: dict[str, Any],
) -> dict[str, Any]:
    """Create a no-write release simulation with a value-free diff report.

    A preflight only reports changed paths and protection decisions.  It never
    returns copied business data or downstream values, so the same artifact is
    safe to attach to an approval record.
    """
    allowed_targets = {
        "hq": {"agency_source", "client_source"},
        "agency_source": {"agency"},
        "client_source": {"client"},
    }
    if target_scope not in allowed_targets.get(source_scope, set()):
        raise ValueError(f"Invalid downstream release direction: {source_scope} -> {target_scope}")

    effective, preserved_overrides = _compose_synced_snapshot(
        next_template,
        current_snapshot,
        explicit_overrides,
        previous_template,
    )
    source_changes = _diff_dict(previous_template, next_template)
    effective_changes = _diff_dict(current_snapshot, effective)
    local_changes = _local_change_patch(previous_template, current_snapshot)
    local_change_paths = _value_paths({} if local_changes is _UNCHANGED else local_changes)
    return {
        "mode": "preflight",
        "direction": f"{source_scope}->{target_scope}",
        "write_performed": False,
        "source_change_paths": [item["path"] for item in source_changes],
        "effective_change_paths": [item["path"] for item in effective_changes],
        "preserved_downstream_paths": local_change_paths,
        "excluded_categories": ["business-data", "downstream-custom-data", "downstream-new-data", "uploaded-assets"],
        "summary": {
            "source_changes": len(source_changes),
            "effective_changes": len(effective_changes),
            "preserved_downstream_changes": len(local_change_paths),
        },
    }


def _diff_dict(current: Any, target: Any, path: str = "") -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    if isinstance(current, dict) and isinstance(target, dict):
        keys = sorted(set(current.keys()) | set(target.keys()))
        for key in keys:
            next_path = f"{path}.{key}" if path else str(key)
            if key not in current:
                entries.append({"path": next_path, "current_value": None, "target_value": target[key], "change_type": "added"})
            elif key not in target:
                entries.append({"path": next_path, "current_value": current[key], "target_value": None, "change_type": "removed"})
            else:
                entries.extend(_diff_dict(current[key], target[key], next_path))
    elif current != target:
        entries.append({"path": path or "root", "current_value": current, "target_value": target, "change_type": "updated"})
    return entries


def _value_paths(value: Any, path: str = "") -> list[str]:
    """Flatten a value to reportable paths without exposing the values."""
    if isinstance(value, dict):
        if not value:
            return [path] if path else []
        return [item for key, nested in value.items() for item in _value_paths(nested, f"{path}.{key}" if path else str(key))]
    return [path] if path else []


class TemplateSnapshotService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _assert_template_payload_allowed(payload: dict[str, Any]) -> None:
        owner_scope = str(payload.get("owner_scope") or "").strip()
        if owner_scope not in TEMPLATE_SOURCE_SCOPES:
            raise ValueError(f"Template writes are only allowed for template-source scopes: {owner_scope}")

    @staticmethod
    def _assert_instance_payload_allowed(payload: dict[str, Any]) -> None:
        owner_scope = str(payload.get("owner_scope") or "").strip()
        if owner_scope not in INSTANCE_SCOPES:
            raise ValueError(f"Instance writes are only allowed for runtime scopes: {owner_scope}")

    @staticmethod
    def _assert_owner_binding_immutable(resource: Any, payload: dict[str, Any]) -> None:
        """Prevent a globally-addressed snapshot ID from being rebound.

        Authorization belongs in the router as well, but this second boundary
        protects internal callers and future endpoints from turning an update
        into a cross-tenant takeover.
        """
        immutable_fields = ("owner_scope", "organization_id", "project_id")
        changed = [field for field in immutable_fields if getattr(resource, field) != payload.get(field)]
        if resource.owner_id is not None and payload.get("owner_id") is not None and resource.owner_id != payload.get("owner_id"):
            changed.append("owner_id")
        if changed:
            raise ValueError(f"Snapshot owner binding is immutable: {', '.join(changed)}")

    async def upsert_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        self._assert_template_payload_allowed(payload)
        template_id = payload.get("template_id")
        template = await self._get_template(template_id) if template_id else None
        normalized_config = normalize_developer_global_frame_document(
            payload.get("config_json") or {},
            owner_scope=payload["owner_scope"],
        )
        next_config = _dump_json(_strip_protected_template_fields(normalized_config))
        if template:
            self._assert_owner_binding_immutable(template, payload)
            template.template_type = payload["template_type"]
            template.owner_scope = payload["owner_scope"]
            template.owner_id = payload.get("owner_id")
            template.organization_id = payload.get("organization_id")
            template.project_id = payload.get("project_id")
            template.parent_template_id = payload.get("parent_template_id")
            template.name = payload["name"]
            # A source editor writes a draft.  It must not replace the
            # immutable configuration installed by existing tenant runtimes
            # until the version has completed its review workflow.
            if template.latest_version and template.is_published:
                template.draft_config_json = next_config
            else:
                template.config_json = next_config
            if payload.get("latest_version"):
                template.latest_version = payload["latest_version"]
            # Once a template has a released version, a subsequent draft save
            # cannot demote it or clear its release pointer.
            template.is_published = bool(payload.get("is_published", False)) or template.is_published
            template.updated_at = datetime.now(timezone.utc)
        else:
            template = TemplateSnapshotTemplate(
                template_id=template_id or f"tpl_{uuid4().hex[:12]}",
                template_type=payload["template_type"],
                owner_scope=payload["owner_scope"],
                owner_id=payload.get("owner_id"),
                organization_id=payload.get("organization_id"),
                project_id=payload.get("project_id"),
                parent_template_id=payload.get("parent_template_id"),
                name=payload["name"],
                latest_version=payload.get("latest_version"),
                config_json=next_config,
                is_published=bool(payload.get("is_published", False)),
            )
            self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)
        return self._template_to_dict(template)

    async def create_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        template_id = payload.get("template_id")
        if template_id and await self._get_template(template_id):
            raise ValueError(f"Template {template_id} already exists; use the authorized update endpoint")
        return await self.upsert_template(payload)

    async def publish_template(self, template_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        template = (
            await self.db.execute(
                select(TemplateSnapshotTemplate)
                .where(TemplateSnapshotTemplate.template_id == template_id)
                .with_for_update()
            )
        ).scalar_one_or_none()
        if not template:
            raise KeyError(f"Template {template_id} not found")
        awaiting_approval = bool(payload.get("requires_approval", False))
        required_review_steps = int(payload.get("required_review_steps", 1)) if awaiting_approval else 0
        required_sections = normalize_developer_global_frame_release_sections(payload.get("required_sections"))
        authoring_document = _load_template_authoring_document(template.draft_config_json or template.config_json)
        current_draft_config_hash = _template_document_hash(authoring_document)
        expected_draft_config_hash = payload.get("expected_draft_config_hash")
        if expected_draft_config_hash is not None:
            if not isinstance(expected_draft_config_hash, str):
                raise ValueError("expected_draft_config_hash must be a string")
            if not hmac.compare_digest(current_draft_config_hash, expected_draft_config_hash):
                if required_sections:
                    raise ValueError(
                        "The source template draft changed before developer_global_frame review submission"
                    )
                raise ValueError("The source template draft changed before publication")
        draft_config_document = normalize_developer_global_frame_document(
            authoring_document,
            owner_scope=template.owner_scope,
        )
        preflight_evidence: DeveloperGlobalFramePreflightEvidence | None = None
        if required_sections:
            if not awaiting_approval:
                raise ValueError("A developer_global_frame release must be submitted for approval")
            if required_review_steps != 2:
                raise ValueError("A developer_global_frame release requires exactly two independent reviews")
            if not isinstance(expected_draft_config_hash, str):
                raise ValueError("A developer_global_frame release requires expected_draft_config_hash")
            if DEVELOPER_GLOBAL_FRAME_SECTION not in draft_config_document:
                raise ValueError("The source template draft does not contain required developer_global_frame")
            expected_artifact_hash = payload.get("expected_preflight_artifact_hash")
            if not isinstance(expected_artifact_hash, str):
                raise ValueError(
                    "A developer_global_frame release requires expected_preflight_artifact_hash"
                )
            preflight_evidence = await self._find_current_preflight_evidence(
                template,
                expected_saved_draft_hash=current_draft_config_hash,
                expected_artifact_hash=expected_artifact_hash,
            )
        assert_developer_global_frame_publish_version(draft_config_document, version=payload["version"])
        version_config_document = draft_config_document
        if required_sections:
            # The immutable history row must not expose unrelated, unapproved
            # authoring siblings.  It records the current live composition plus
            # only the submitted frame; release_sections_json remains the
            # authority boundary for every later consumer.
            version_config_document = normalize_developer_global_frame_document(
                _load_template_authoring_document(template.config_json),
                owner_scope=template.owner_scope,
            )
            version_config_document[DEVELOPER_GLOBAL_FRAME_SECTION] = deepcopy(
                draft_config_document[DEVELOPER_GLOBAL_FRAME_SECTION]
            )
        version_config = _dump_json(version_config_document)
        version = TemplateSnapshotVersion(
            template_id=template.template_id,
            version=payload["version"],
            changelog=payload.get("changelog"),
            config_json=version_config,
            release_sections_json=(
                json.dumps(required_sections, ensure_ascii=False, separators=(",", ":"))
                if required_sections
                else None
            ),
            preflight_evidence_id=preflight_evidence.id if preflight_evidence else None,
            published_by=payload.get("published_by"),
            review_status="pending_review" if awaiting_approval else "published",
            required_review_steps=required_review_steps,
            review_assignee=payload.get("review_assignee"),
            review_due_at=payload.get("review_due_at"),
            published_at=datetime.now(timezone.utc),
        )
        if not awaiting_approval:
            template.latest_version = payload["version"]
            template.is_published = True
            template.config_json = version_config
            template.draft_config_json = None
        self.db.add(version)
        await self.db.commit()
        await self.db.refresh(template)
        await self.db.refresh(version)
        return self._version_to_dict(version)

    async def review_template_version(self, template_id: str, version: str, *, action: str, reviewer: str | None = None, note: str | None = None) -> dict[str, Any]:
        """Promote a reviewed immutable snapshot to the live template pointer."""
        if action not in {"approve", "reject"}:
            raise ValueError("Unsupported review action")
        template = (
            await self.db.execute(
                select(TemplateSnapshotTemplate)
                .where(TemplateSnapshotTemplate.template_id == template_id)
                .with_for_update()
            )
        ).scalar_one_or_none()
        if not template:
            raise KeyError(f"Template {template_id} not found")
        result = await self.db.execute(
            select(TemplateSnapshotVersion).where(
                TemplateSnapshotVersion.template_id == template_id,
                TemplateSnapshotVersion.version == version,
            ).with_for_update()
        )
        snapshot = result.scalar_one_or_none()
        if not snapshot:
            raise KeyError(f"Template version {version} not found")
        release_sections = load_template_version_release_sections(snapshot.release_sections_json)
        if snapshot.review_status not in {"pending_review", "pending_second_review"}:
            raise ValueError("This version is no longer reviewable")
        if action == "approve" and reviewer and snapshot.published_by == reviewer:
            raise ValueError("The publisher cannot approve the same release")
        if action == "approve" and reviewer and snapshot.review_step > 0 and snapshot.approved_by == reviewer:
            raise ValueError("The first and second approval must be performed by different reviewers")
        if action == "approve" and snapshot.review_assignee and reviewer != snapshot.review_assignee:
            raise ValueError("This release is assigned to a different reviewer")

        next_review_step = min(snapshot.review_step + 1, max(snapshot.required_review_steps, 1))
        final_approval = action == "approve" and next_review_step >= max(snapshot.required_review_steps, 1)
        section_live_config: str | None = None
        section_draft_config: str | None = None
        had_authoring_draft = template.draft_config_json is not None
        if final_approval and release_sections:
            await self.validate_developer_global_frame_version_attestation(
                template,
                snapshot,
                require_fresh=True,
            )
            snapshot_document = normalize_developer_global_frame_document(
                _load_template_authoring_document(snapshot.config_json),
                owner_scope=template.owner_scope,
            )
            if DEVELOPER_GLOBAL_FRAME_SECTION not in snapshot_document:
                raise ValueError("The immutable section release does not contain developer_global_frame")
            submitted_section = deepcopy(snapshot_document[DEVELOPER_GLOBAL_FRAME_SECTION])
            live_document = normalize_developer_global_frame_document(
                _load_template_authoring_document(template.config_json),
                owner_scope=template.owner_scope,
            )
            live_document[DEVELOPER_GLOBAL_FRAME_SECTION] = deepcopy(submitted_section)
            section_live_config = _dump_json(live_document)
            if had_authoring_draft:
                draft_document = normalize_developer_global_frame_document(
                    _load_template_authoring_document(template.draft_config_json),
                    owner_scope=template.owner_scope,
                )
                draft_section = draft_document.get(DEVELOPER_GLOBAL_FRAME_SECTION)
                # A draft that still contains the submitted frame is synced to
                # the approved value.  A newer concurrent frame draft remains
                # unpublished and is never replaced by the older snapshot.
                if draft_section is None or draft_section == submitted_section:
                    draft_document[DEVELOPER_GLOBAL_FRAME_SECTION] = deepcopy(submitted_section)
                section_draft_config = _dump_json(draft_document)

        snapshot.review_note = (note or "").strip() or None
        snapshot.approved_by = reviewer
        snapshot.approved_at = datetime.now(timezone.utc)
        if action == "reject":
            snapshot.review_status = "rejected"
            await self.db.commit()
            await self.db.refresh(snapshot)
            return self._version_to_dict(snapshot)
        snapshot.review_step = next_review_step
        if snapshot.review_step < max(snapshot.required_review_steps, 1):
            snapshot.review_status = "pending_second_review"
            await self.db.commit()
            await self.db.refresh(snapshot)
            return self._version_to_dict(snapshot)
        previous = (
            await self.db.execute(
                select(TemplateSnapshotVersion).where(
                    TemplateSnapshotVersion.template_id == template_id,
                    TemplateSnapshotVersion.review_status == "published",
                ).with_for_update()
            )
        ).scalars().all()
        for item in previous:
            item.review_status = "archived"
        snapshot.review_status = "published"
        template.latest_version = snapshot.version
        if release_sections:
            if section_live_config is None:
                raise RuntimeError("Section-only review promotion was not prepared")
            template.config_json = section_live_config
            if had_authoring_draft:
                if section_draft_config is None:
                    raise RuntimeError("Section-only authoring draft promotion was not prepared")
                template.draft_config_json = section_draft_config
        else:
            # Legacy/full-template review keeps its established replacement
            # semantics.  Only an explicitly scoped release uses partial merge.
            template.config_json = snapshot.config_json
            template.draft_config_json = None
        template.is_published = True
        template.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(snapshot)
        return self._version_to_dict(snapshot)

    async def approve_template_version(self, template_id: str, version: str, approved_by: str | None = None) -> dict[str, Any]:
        """Compatibility endpoint for the first approval action."""
        return await self.review_template_version(template_id, version, action="approve", reviewer=approved_by)

    async def get_template(self, template_id: str) -> dict[str, Any]:
        template = await self._get_template(template_id)
        if not template:
            raise KeyError(f"Template {template_id} not found")
        return self._template_to_dict(template)

    @staticmethod
    def _acceptance_job_to_dict(job: DeveloperGlobalFrameAcceptanceJob) -> dict[str, Any]:
        try:
            section = json.loads(job.frame_section_json)
        except (TypeError, ValueError) as exc:
            raise ValueError("Stored developer global frame acceptance job section is invalid") from exc
        if not isinstance(section, dict):
            raise ValueError("Stored developer global frame acceptance job section is invalid")
        def as_utc(value: datetime | None) -> datetime | None:
            return _as_utc_datetime(value) if value is not None else None

        return {
            "acceptance_job_id": job.id,
            "schema_version": job.schema_version,
            "template_id": job.template_id,
            "source_scope": job.source_scope,
            "base_draft_hash": job.base_draft_hash,
            "frame_section_hash": job.frame_section_hash,
            "visual_draft_id": job.visual_draft_id,
            "recovery_point_id": job.recovery_point_id,
            "developer_global_frame": section,
            "page_registry_hash": job.page_registry_hash,
            "adapter_registry_hash": job.adapter_registry_hash,
            "isolation_policy_hash": job.isolation_policy_hash,
            "test_spec_hash": job.test_spec_hash,
            "source_build_digest": job.source_build_digest,
            "status": job.status,
            "attempt_count": job.attempt_count,
            "max_attempts": job.max_attempts,
            "worker_issuer": job.worker_issuer,
            "worker_key_id": job.worker_key_id,
            "claimed_at": as_utc(job.claimed_at),
            "lease_expires_at": as_utc(job.lease_expires_at),
            "acceptance_artifact_id": job.acceptance_artifact_id,
            "report_hash": job.report_hash,
            "last_error_code": job.last_error_code,
            "last_error_message": job.last_error_message,
            "expires_at": as_utc(job.expires_at),
            "completed_at": as_utc(job.completed_at),
            "created_at": as_utc(job.created_at),
            "updated_at": as_utc(job.updated_at),
        }

    def _record_acceptance_job_event(
        self,
        job: DeveloperGlobalFrameAcceptanceJob,
        *,
        event_type: str,
        from_status: str | None,
        to_status: str,
        now: datetime,
        worker_nonce: str | None = None,
        error_code: str | None = None,
        error_message: str | None = None,
    ) -> None:
        self.db.add(
            DeveloperGlobalFrameAcceptanceJobEvent(
                id=str(uuid4()),
                job_id=job.id,
                event_type=event_type,
                from_status=from_status,
                to_status=to_status,
                attempt_count=job.attempt_count,
                worker_issuer=job.worker_issuer,
                worker_key_id=job.worker_key_id,
                worker_nonce=worker_nonce,
                error_code=error_code,
                error_message=error_message,
                created_at=now,
            )
        )

    async def _assert_acceptance_worker_nonce_unused(self, nonce: str) -> None:
        replay = await self.db.scalar(
            select(DeveloperGlobalFrameAcceptanceWorkerNonce).where(
                DeveloperGlobalFrameAcceptanceWorkerNonce.nonce == nonce
            )
        )
        if replay:
            raise ValueError("Developer global frame acceptance worker nonce was already used")

    async def _reserve_acceptance_worker_nonce(
        self,
        *,
        action: str,
        source_scope: str,
        payload: dict[str, Any],
        now: datetime,
        job_id: str | None,
    ) -> DeveloperGlobalFrameAcceptanceWorkerNonce:
        await self._assert_acceptance_worker_nonce_unused(payload["nonce"])
        reservation = DeveloperGlobalFrameAcceptanceWorkerNonce(
            nonce=payload["nonce"],
            action=action,
            issuer=payload["issuer"],
            key_id=payload["key_id"],
            source_scope=source_scope,
            job_id=job_id,
            issued_at=_as_utc_datetime(payload["issued_at"]),
            created_at=now,
        )
        self.db.add(reservation)
        try:
            await self.db.flush()
        except IntegrityError as exc:
            await self.db.rollback()
            raise ValueError("Developer global frame acceptance worker nonce was already used") from exc
        return reservation

    async def _prepare_developer_global_frame_acceptance_queue(
        self,
        *,
        source_scope: str,
        now: datetime,
        deployment_hashes: dict[str, str],
    ) -> None:
        deployment_changed = or_(
            *(
                getattr(DeveloperGlobalFrameAcceptanceJob, field) != expected
                for field, expected in deployment_hashes.items()
            )
        )
        candidates = (
            await self.db.execute(
                select(DeveloperGlobalFrameAcceptanceJob)
                .where(
                    DeveloperGlobalFrameAcceptanceJob.source_scope == source_scope,
                    DeveloperGlobalFrameAcceptanceJob.status.in_(("pending", "running")),
                    or_(
                        DeveloperGlobalFrameAcceptanceJob.expires_at <= now,
                        and_(
                            DeveloperGlobalFrameAcceptanceJob.status == "pending",
                            DeveloperGlobalFrameAcceptanceJob.expires_at
                            <= now + ACCEPTANCE_JOB_MIN_EXECUTION_WINDOW,
                        ),
                        and_(
                            DeveloperGlobalFrameAcceptanceJob.status == "running",
                            DeveloperGlobalFrameAcceptanceJob.lease_expires_at.is_not(None),
                            DeveloperGlobalFrameAcceptanceJob.lease_expires_at <= now,
                        ),
                        and_(
                            DeveloperGlobalFrameAcceptanceJob.status == "pending",
                            DeveloperGlobalFrameAcceptanceJob.attempt_count
                            >= DeveloperGlobalFrameAcceptanceJob.max_attempts,
                        ),
                        and_(
                            DeveloperGlobalFrameAcceptanceJob.status == "pending",
                            deployment_changed,
                        ),
                    ),
                )
                .order_by(
                    DeveloperGlobalFrameAcceptanceJob.created_at.asc(),
                    DeveloperGlobalFrameAcceptanceJob.id.asc(),
                )
                .limit(200)
                .with_for_update(skip_locked=True)
            )
        ).scalars().all()
        for job in candidates:
            if await self._expire_acceptance_job_if_needed(job, now=now):
                continue
            if (
                job.status == "pending"
                and _as_utc_datetime(job.expires_at) <= now + ACCEPTANCE_JOB_MIN_EXECUTION_WINDOW
            ):
                job.status = "failed"
                job.last_error_code = "acceptance.job-ttl-insufficient"
                job.last_error_message = "Acceptance job no longer has the minimum trusted execution window"
                job.completed_at = now
                job.updated_at = now
                self._record_acceptance_job_event(
                    job,
                    event_type="execution-window-insufficient",
                    from_status="pending",
                    to_status="failed",
                    now=now,
                    error_code=job.last_error_code,
                    error_message=job.last_error_message,
                )
                continue
            if job.status == "running" and job.lease_expires_at and _as_utc_datetime(job.lease_expires_at) <= now:
                previous_issuer = job.worker_issuer
                previous_key_id = job.worker_key_id
                if job.attempt_count >= job.max_attempts:
                    job.status = "failed"
                    job.completed_at = now
                    event_type = "attempts-exhausted"
                    to_status = "failed"
                else:
                    job.status = "pending"
                    event_type = "lease-expired"
                    to_status = "pending"
                job.updated_at = now
                job.worker_issuer = previous_issuer
                job.worker_key_id = previous_key_id
                self._record_acceptance_job_event(
                    job,
                    event_type=event_type,
                    from_status="running",
                    to_status=to_status,
                    now=now,
                    error_code="worker-lease-expired",
                    error_message="Trusted worker did not renew the acceptance lease",
                )
                if to_status == "pending":
                    job.worker_issuer = None
                    job.worker_key_id = None
                    job.claim_nonce = None
                    job.claimed_at = None
                    job.lease_expires_at = None
                continue
            if job.status == "pending" and job.attempt_count >= job.max_attempts:
                job.status = "failed"
                job.completed_at = now
                job.updated_at = now
                self._record_acceptance_job_event(
                    job,
                    event_type="attempts-exhausted",
                    from_status="pending",
                    to_status="failed",
                    now=now,
                )
                continue
            if job.status == "pending" and any(
                not hmac.compare_digest(str(getattr(job, field)), expected)
                for field, expected in deployment_hashes.items()
            ):
                job.status = "failed"
                job.last_error_code = "deployment-snapshot-changed"
                job.last_error_message = "Acceptance deployment allowlist changed before trusted execution"
                job.completed_at = now
                job.updated_at = now
                self._record_acceptance_job_event(
                    job,
                    event_type="deployment-invalidated",
                    from_status="pending",
                    to_status="failed",
                    now=now,
                    error_code=job.last_error_code,
                    error_message=job.last_error_message,
                )

    async def create_developer_global_frame_acceptance_job(
        self,
        template_id: str,
        payload: dict[str, Any],
        *,
        requested_by: str | None,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        server_now = _as_utc_datetime(now or datetime.now(timezone.utc))
        template = (
            await self.db.execute(
                select(TemplateSnapshotTemplate)
                .where(TemplateSnapshotTemplate.template_id == template_id)
                .with_for_update()
            )
        ).scalar_one_or_none()
        if not template:
            raise KeyError(f"Template {template_id} not found")
        if template.owner_scope != "client_source":
            raise ValueError(
                "Developer global frame acceptance jobs must be requested from the client_source factory template"
            )
        current_document = _load_template_authoring_document(
            template.draft_config_json or template.config_json
        )
        current_hash = _template_document_hash(current_document)
        if not hmac.compare_digest(current_hash, str(payload.get("base_draft_hash") or "")):
            raise ValueError("Developer global frame acceptance job base draft hash is stale")
        normalized = normalize_developer_global_frame_document(
            {DEVELOPER_GLOBAL_FRAME_SECTION: payload.get("developer_global_frame")},
            owner_scope=template.owner_scope,
        )
        section = normalized.get(DEVELOPER_GLOBAL_FRAME_SECTION)
        if not isinstance(section, dict):
            raise ValueError("Developer global frame acceptance job section is missing")
        _assert_acceptance_section_matrix(section)
        frame_section_hash = _template_document_hash(section)
        if not hmac.compare_digest(frame_section_hash, str(payload.get("frame_section_hash") or "")):
            raise ValueError("Developer global frame acceptance job frame section hash is invalid")
        recovery = section.get("recovery")
        expected_visual_draft_id = recovery.get("draft_id") if isinstance(recovery, dict) else None
        expected_recovery_point_id = recovery.get("recovery_point_id") if isinstance(recovery, dict) else None
        if not isinstance(expected_visual_draft_id, str) or not expected_visual_draft_id:
            raise ValueError("Developer global frame acceptance job visual draft binding is missing")
        if not isinstance(expected_recovery_point_id, str) or not expected_recovery_point_id:
            raise ValueError("Developer global frame acceptance job recovery point binding is missing")
        if (
            payload.get("visual_draft_id") != expected_visual_draft_id
            or payload.get("recovery_point_id") != expected_recovery_point_id
        ):
            raise ValueError("Developer global frame acceptance job recovery binding is invalid")
        deployment_hashes = _acceptance_deployment_hashes()
        reusable = (
            await self.db.execute(
                select(DeveloperGlobalFrameAcceptanceJob)
                .where(
                    DeveloperGlobalFrameAcceptanceJob.template_id == template_id,
                    DeveloperGlobalFrameAcceptanceJob.base_draft_hash == current_hash,
                    DeveloperGlobalFrameAcceptanceJob.frame_section_hash == frame_section_hash,
                    DeveloperGlobalFrameAcceptanceJob.visual_draft_id == expected_visual_draft_id,
                    DeveloperGlobalFrameAcceptanceJob.recovery_point_id == expected_recovery_point_id,
                    DeveloperGlobalFrameAcceptanceJob.requested_by == requested_by,
                    DeveloperGlobalFrameAcceptanceJob.status.in_(("pending", "running", "succeeded")),
                    DeveloperGlobalFrameAcceptanceJob.expires_at > server_now,
                )
                .order_by(DeveloperGlobalFrameAcceptanceJob.created_at.desc())
            )
        ).scalars().first()
        if reusable:
            reusable_section = _load_template_authoring_document(reusable.frame_section_json)
            if reusable_section == section and all(
                hmac.compare_digest(str(getattr(reusable, field)), expected)
                for field, expected in deployment_hashes.items()
            ):
                return self._acceptance_job_to_dict(reusable)
        job = DeveloperGlobalFrameAcceptanceJob(
            id=str(uuid4()),
            schema_version=1,
            template_id=template.template_id,
            source_scope=template.owner_scope,
            base_draft_hash=current_hash,
            frame_section_hash=frame_section_hash,
            visual_draft_id=str(expected_visual_draft_id),
            recovery_point_id=str(expected_recovery_point_id),
            frame_section_json=json.dumps(section, ensure_ascii=False, sort_keys=True, separators=(",", ":")),
            **deployment_hashes,
            status="pending",
            attempt_count=0,
            max_attempts=ACCEPTANCE_JOB_MAX_ATTEMPTS,
            requested_by=requested_by,
            expires_at=server_now + ACCEPTANCE_JOB_TTL,
            created_at=server_now,
            updated_at=server_now,
        )
        self.db.add(job)
        await self.db.flush()
        self._record_acceptance_job_event(
            job,
            event_type="requested",
            from_status=None,
            to_status="pending",
            now=server_now,
        )
        await self.db.commit()
        await self.db.refresh(job)
        return self._acceptance_job_to_dict(job)

    async def _locked_acceptance_job(
        self,
        template_id: str,
        job_id: str,
    ) -> DeveloperGlobalFrameAcceptanceJob:
        job = (
            await self.db.execute(
                select(DeveloperGlobalFrameAcceptanceJob)
                .where(
                    DeveloperGlobalFrameAcceptanceJob.id == job_id,
                    DeveloperGlobalFrameAcceptanceJob.template_id == template_id,
                )
                .with_for_update()
            )
        ).scalar_one_or_none()
        if not job:
            raise KeyError(f"Developer global frame acceptance job {job_id} not found")
        return job

    async def _expire_acceptance_job_if_needed(
        self,
        job: DeveloperGlobalFrameAcceptanceJob,
        *,
        now: datetime,
    ) -> bool:
        if job.status in {"pending", "running"} and _as_utc_datetime(job.expires_at) <= now:
            previous = job.status
            job.status = "expired"
            job.completed_at = now
            job.updated_at = now
            self._record_acceptance_job_event(
                job,
                event_type="expired",
                from_status=previous,
                to_status="expired",
                now=now,
            )
            return True
        return False

    async def get_developer_global_frame_acceptance_job(
        self,
        template_id: str,
        job_id: str,
        *,
        requested_by: str,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        server_now = _as_utc_datetime(now or datetime.now(timezone.utc))
        job = await self._locked_acceptance_job(template_id, job_id)
        if job.requested_by != requested_by:
            raise KeyError(f"Developer global frame acceptance job {job_id} not found")
        if await self._expire_acceptance_job_if_needed(job, now=server_now):
            await self.db.commit()
            await self.db.refresh(job)
        return self._acceptance_job_to_dict(job)

    async def claim_developer_global_frame_acceptance_job(
        self,
        template_id: str,
        job_id: str,
        payload: dict[str, Any],
        *,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        server_now = _as_utc_datetime(now or datetime.now(timezone.utc))
        _validate_acceptance_worker_proof("claim", template_id, job_id, payload, now=server_now)
        job = await self._locked_acceptance_job(template_id, job_id)
        await self._assert_acceptance_worker_nonce_unused(payload["nonce"])
        if await self._expire_acceptance_job_if_needed(job, now=server_now):
            await self.db.commit()
            raise ValueError("Developer global frame acceptance job is expired")
        if job.status == "running" and job.lease_expires_at and _as_utc_datetime(job.lease_expires_at) <= server_now:
            previous_worker_issuer = job.worker_issuer
            previous_worker_key_id = job.worker_key_id
            job.status = "pending"
            job.worker_issuer = previous_worker_issuer
            job.worker_key_id = previous_worker_key_id
            self._record_acceptance_job_event(
                job,
                event_type="lease-expired",
                from_status="running",
                to_status="pending",
                now=server_now,
                error_code="worker-lease-expired",
                error_message="Trusted worker did not complete the acceptance lease",
            )
        if job.status != "pending":
            raise ValueError("Developer global frame acceptance job is not claimable")
        if _as_utc_datetime(job.expires_at) <= server_now + ACCEPTANCE_JOB_MIN_EXECUTION_WINDOW:
            job.status = "failed"
            job.last_error_code = "acceptance.job-ttl-insufficient"
            job.last_error_message = "Acceptance job no longer has the minimum trusted execution window"
            job.completed_at = server_now
            job.updated_at = server_now
            self._record_acceptance_job_event(
                job,
                event_type="execution-window-insufficient",
                from_status="pending",
                to_status="failed",
                now=server_now,
                error_code=job.last_error_code,
                error_message=job.last_error_message,
            )
            await self.db.commit()
            raise ValueError("Developer global frame acceptance job execution window is insufficient")
        if job.attempt_count >= job.max_attempts:
            job.status = "failed"
            job.completed_at = server_now
            job.updated_at = server_now
            self._record_acceptance_job_event(
                job,
                event_type="attempts-exhausted",
                from_status="pending",
                to_status="failed",
                now=server_now,
            )
            await self.db.commit()
            raise ValueError("Developer global frame acceptance job attempts are exhausted")
        current_deployment = _acceptance_deployment_hashes()
        if any(
            not hmac.compare_digest(str(getattr(job, field)), expected)
            for field, expected in current_deployment.items()
        ):
            raise ValueError("Developer global frame acceptance job deployment snapshot is no longer current")
        await self._reserve_acceptance_worker_nonce(
            action="claim",
            source_scope=job.source_scope,
            payload=payload,
            now=server_now,
            job_id=job.id,
        )
        job.status = "running"
        job.attempt_count += 1
        job.worker_issuer = payload["issuer"]
        job.worker_key_id = payload["key_id"]
        job.claim_nonce = payload["nonce"]
        job.claimed_at = server_now
        job.lease_expires_at = min(server_now + ACCEPTANCE_WORKER_LEASE, _as_utc_datetime(job.expires_at))
        job.updated_at = server_now
        self._record_acceptance_job_event(
            job,
            event_type="claimed",
            from_status="pending",
            to_status="running",
            now=server_now,
            worker_nonce=payload["nonce"],
        )
        await self.db.commit()
        await self.db.refresh(job)
        return self._acceptance_job_to_dict(job)

    async def claim_next_developer_global_frame_acceptance_job(
        self,
        payload: dict[str, Any],
        *,
        now: datetime | None = None,
    ) -> dict[str, Any] | None:
        server_now = _as_utc_datetime(now or datetime.now(timezone.utc))
        _validate_acceptance_worker_claim_next_proof(payload, now=server_now)
        reservation = await self._reserve_acceptance_worker_nonce(
            action="claim-next",
            source_scope=payload["source_scope"],
            payload=payload,
            now=server_now,
            job_id=None,
        )
        deployment_hashes = _acceptance_deployment_hashes()
        await self._prepare_developer_global_frame_acceptance_queue(
            source_scope=payload["source_scope"],
            now=server_now,
            deployment_hashes=deployment_hashes,
        )
        job = (
            await self.db.execute(
                select(DeveloperGlobalFrameAcceptanceJob)
                .where(
                    DeveloperGlobalFrameAcceptanceJob.source_scope == payload["source_scope"],
                    DeveloperGlobalFrameAcceptanceJob.status == "pending",
                    DeveloperGlobalFrameAcceptanceJob.expires_at
                    > server_now + ACCEPTANCE_JOB_MIN_EXECUTION_WINDOW,
                    DeveloperGlobalFrameAcceptanceJob.attempt_count
                    < DeveloperGlobalFrameAcceptanceJob.max_attempts,
                    *(
                        getattr(DeveloperGlobalFrameAcceptanceJob, field) == expected
                        for field, expected in deployment_hashes.items()
                    ),
                )
                .order_by(
                    DeveloperGlobalFrameAcceptanceJob.created_at.asc(),
                    DeveloperGlobalFrameAcceptanceJob.id.asc(),
                )
                .limit(1)
                .with_for_update(skip_locked=True)
            )
        ).scalars().first()
        if not job:
            await self.db.commit()
            return None
        job.status = "running"
        job.attempt_count += 1
        job.worker_issuer = payload["issuer"]
        job.worker_key_id = payload["key_id"]
        job.claim_nonce = payload["nonce"]
        job.claimed_at = server_now
        job.lease_expires_at = min(server_now + ACCEPTANCE_WORKER_LEASE, _as_utc_datetime(job.expires_at))
        job.updated_at = server_now
        reservation.job_id = job.id
        self._record_acceptance_job_event(
            job,
            event_type="claimed-next",
            from_status="pending",
            to_status="running",
            now=server_now,
            worker_nonce=payload["nonce"],
        )
        await self.db.commit()
        await self.db.refresh(job)
        return self._acceptance_job_to_dict(job)

    async def heartbeat_developer_global_frame_acceptance_job(
        self,
        template_id: str,
        job_id: str,
        payload: dict[str, Any],
        *,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        server_now = _as_utc_datetime(now or datetime.now(timezone.utc))
        _validate_acceptance_worker_proof("heartbeat", template_id, job_id, payload, now=server_now)
        job = await self._locked_acceptance_job(template_id, job_id)
        await self._assert_acceptance_worker_nonce_unused(payload["nonce"])
        if await self._expire_acceptance_job_if_needed(job, now=server_now):
            await self.db.commit()
            raise ValueError("Developer global frame acceptance job is expired")
        if (
            job.status != "running"
            or job.worker_issuer != payload["issuer"]
            or job.worker_key_id != payload["key_id"]
            or not job.lease_expires_at
            or _as_utc_datetime(job.lease_expires_at) <= server_now
        ):
            raise ValueError("Developer global frame acceptance heartbeat is not bound to the active worker lease")
        current_deployment = _acceptance_deployment_hashes()
        if any(
            not hmac.compare_digest(str(getattr(job, field)), expected)
            for field, expected in current_deployment.items()
        ):
            raise ValueError("Developer global frame acceptance job deployment snapshot is no longer current")
        await self._reserve_acceptance_worker_nonce(
            action="heartbeat",
            source_scope=job.source_scope,
            payload=payload,
            now=server_now,
            job_id=job.id,
        )
        job.lease_expires_at = min(server_now + ACCEPTANCE_WORKER_LEASE, _as_utc_datetime(job.expires_at))
        job.updated_at = server_now
        self._record_acceptance_job_event(
            job,
            event_type="heartbeat",
            from_status="running",
            to_status="running",
            now=server_now,
            worker_nonce=payload["nonce"],
        )
        await self.db.commit()
        await self.db.refresh(job)
        return self._acceptance_job_to_dict(job)

    async def fail_developer_global_frame_acceptance_job(
        self,
        template_id: str,
        job_id: str,
        payload: dict[str, Any],
        *,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        server_now = _as_utc_datetime(now or datetime.now(timezone.utc))
        _validate_acceptance_worker_proof("fail", template_id, job_id, payload, now=server_now)
        job = await self._locked_acceptance_job(template_id, job_id)
        await self._assert_acceptance_worker_nonce_unused(payload["nonce"])
        if await self._expire_acceptance_job_if_needed(job, now=server_now):
            await self.db.commit()
            raise ValueError("Developer global frame acceptance job is expired")
        if (
            job.status != "running"
            or job.worker_issuer != payload["issuer"]
            or job.worker_key_id != payload["key_id"]
            or not job.lease_expires_at
            or _as_utc_datetime(job.lease_expires_at) <= server_now
        ):
            raise ValueError("Developer global frame acceptance failure is not bound to the active worker lease")
        await self._reserve_acceptance_worker_nonce(
            action="fail",
            source_scope=job.source_scope,
            payload=payload,
            now=server_now,
            job_id=job.id,
        )
        retryable = payload["error_code"] not in ACCEPTANCE_NON_RETRYABLE_FAILURE_CODES
        next_status = "pending" if retryable and job.attempt_count < job.max_attempts else "failed"
        job.status = next_status
        job.last_error_code = payload["error_code"]
        job.last_error_message = payload["error_message"]
        job.updated_at = server_now
        if next_status != "pending":
            job.completed_at = server_now
        self._record_acceptance_job_event(
            job,
            event_type="retry-scheduled" if next_status == "pending" else "failed",
            from_status="running",
            to_status=next_status,
            now=server_now,
            worker_nonce=payload["nonce"],
            error_code=payload["error_code"],
            error_message=payload["error_message"],
        )
        if next_status == "pending":
            job.worker_issuer = None
            job.worker_key_id = None
            job.claim_nonce = None
            job.claimed_at = None
            job.lease_expires_at = None
        await self.db.commit()
        await self.db.refresh(job)
        return self._acceptance_job_to_dict(job)

    @staticmethod
    def _acceptance_artifact_payload(
        artifact: DeveloperGlobalFrameAcceptanceArtifact,
    ) -> dict[str, Any]:
        try:
            viewports = json.loads(artifact.viewports_json)
            compatible = json.loads(artifact.compatible_target_page_ids_json)
            isolated = json.loads(artifact.isolated_page_ids_json)
            case_results = json.loads(artifact.case_results_json)
        except (TypeError, ValueError) as exc:
            raise ValueError("Stored developer global frame acceptance artifact JSON is invalid") from exc
        if not all(isinstance(value, list) for value in (viewports, compatible, isolated, case_results)):
            raise ValueError("Stored developer global frame acceptance artifact JSON is invalid")
        return {
            "schema_version": artifact.schema_version,
            "run_id": artifact.run_id,
            "issuer": artifact.issuer,
            "key_id": artifact.key_id,
            "template_id": artifact.template_id,
            "source_scope": artifact.source_scope,
            "acceptance_job_id": artifact.acceptance_job_id,
            "base_draft_hash": artifact.base_draft_hash,
            "frame_section_hash": artifact.frame_section_hash,
            "visual_draft_id": artifact.visual_draft_id,
            "recovery_point_id": artifact.recovery_point_id,
            "page_registry_hash": artifact.page_registry_hash,
            "adapter_registry_hash": artifact.adapter_registry_hash,
            "isolation_policy_hash": artifact.isolation_policy_hash,
            "test_spec_hash": artifact.test_spec_hash,
            "source_build_digest": artifact.source_build_digest,
            "issued_at": artifact.issued_at,
            "expires_at": artifact.expires_at,
            "viewports": viewports,
            "compatible_target_page_ids": compatible,
            "isolated_page_ids": isolated,
            "case_results": case_results,
            "failure_count": artifact.failure_count,
            "flaky_count": artifact.flaky_count,
            "skipped_count": artifact.skipped_count,
            "report_hash": artifact.report_hash,
            "signature": artifact.signature,
        }

    @staticmethod
    def _validate_acceptance_artifact_payload(
        payload: dict[str, Any],
        *,
        require_fresh: bool,
        now: datetime | None = None,
        trusted_keys: dict[str, dict[str, str]] | None = None,
        deployment_hashes: dict[str, str] | None = None,
    ) -> None:
        if payload.get("schema_version") != 1 or payload.get("source_scope") != "client_source":
            raise ValueError("Developer global frame acceptance artifact contract is unsupported")
        _assert_acceptance_matrix(payload)
        expected_deployment = _acceptance_deployment_hashes(deployment_hashes)
        if any(
            not hmac.compare_digest(str(payload.get(field) or ""), expected)
            for field, expected in expected_deployment.items()
        ):
            raise ValueError("Developer global frame acceptance artifact does not match the deployed build allowlist")
        key_registry = _acceptance_hmac_keys(trusted_keys)
        descriptor = key_registry.get(str(payload.get("key_id") or ""))
        if not descriptor or not hmac.compare_digest(str(payload.get("issuer") or ""), descriptor["issuer"]):
            raise ValueError("Developer global frame acceptance artifact issuer or key is not trusted")
        expected_report_hash = _acceptance_report_hash(payload)
        if not hmac.compare_digest(str(payload.get("report_hash") or ""), expected_report_hash):
            raise ValueError("Developer global frame acceptance artifact report hash is invalid")
        expected_signature = _acceptance_signature(expected_report_hash, descriptor["secret"])
        if not hmac.compare_digest(str(payload.get("signature") or ""), expected_signature):
            raise ValueError("Developer global frame acceptance artifact signature is invalid")
        issued_at = _as_utc_datetime(payload["issued_at"])
        expires_at = _as_utc_datetime(payload["expires_at"])
        if expires_at <= issued_at or expires_at - issued_at > ACCEPTANCE_MAX_AGE:
            raise ValueError("Developer global frame acceptance artifact validity window is invalid")
        if require_fresh:
            server_now = _as_utc_datetime(now or datetime.now(timezone.utc))
            if issued_at > server_now:
                raise ValueError("Developer global frame acceptance artifact issued_at is in the future")
            if server_now - issued_at > ACCEPTANCE_MAX_AGE or expires_at <= server_now:
                raise ValueError("Developer global frame acceptance artifact is stale or expired")

    @classmethod
    def _acceptance_artifact_to_dict(
        cls,
        artifact: DeveloperGlobalFrameAcceptanceArtifact,
        *,
        require_fresh: bool,
        now: datetime | None = None,
        trusted_keys: dict[str, dict[str, str]] | None = None,
        deployment_hashes: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        payload = cls._acceptance_artifact_payload(artifact)
        cls._validate_acceptance_artifact_payload(
            payload,
            require_fresh=require_fresh,
            now=now,
            trusted_keys=trusted_keys,
            deployment_hashes=deployment_hashes,
        )
        return {
            "acceptance_artifact_id": artifact.id,
            **payload,
            "case_results": _canonical_acceptance_case_results(payload["case_results"]),
            "valid": True,
            "created_at": artifact.created_at,
        }

    async def register_developer_global_frame_acceptance_artifact(
        self,
        payload: dict[str, Any],
        *,
        now: datetime | None = None,
        trusted_keys: dict[str, dict[str, str]] | None = None,
        deployment_hashes: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        server_now = _as_utc_datetime(now or datetime.now(timezone.utc))
        template = await self._get_template(str(payload.get("template_id") or ""))
        if not template:
            raise KeyError(f"Template {payload.get('template_id')} not found")
        if template.owner_scope != payload.get("source_scope"):
            raise ValueError("Developer global frame acceptance artifact is bound to a different template scope")
        self._validate_acceptance_artifact_payload(
            payload,
            require_fresh=True,
            now=server_now,
            trusted_keys=trusted_keys,
            deployment_hashes=deployment_hashes,
        )
        job = await self._locked_acceptance_job(
            template.template_id,
            str(payload.get("acceptance_job_id") or ""),
        )
        if await self._expire_acceptance_job_if_needed(job, now=server_now):
            await self.db.commit()
            raise ValueError("Developer global frame acceptance job is expired")
        if job.status == "succeeded":
            if (
                job.report_hash
                and job.acceptance_artifact_id
                and hmac.compare_digest(job.report_hash, str(payload.get("report_hash") or ""))
            ):
                existing_success = await self.db.scalar(
                    select(DeveloperGlobalFrameAcceptanceArtifact).where(
                        DeveloperGlobalFrameAcceptanceArtifact.id == job.acceptance_artifact_id,
                        DeveloperGlobalFrameAcceptanceArtifact.acceptance_job_id == job.id,
                    )
                )
                if existing_success:
                    return self._acceptance_artifact_to_dict(
                        existing_success,
                        require_fresh=True,
                        now=server_now,
                        trusted_keys=trusted_keys,
                        deployment_hashes=deployment_hashes,
                    )
            raise ValueError("Developer global frame acceptance job success cannot be replayed with another report")
        if (
            job.status != "running"
            or job.worker_issuer != payload.get("issuer")
            or job.worker_key_id != payload.get("key_id")
            or not job.lease_expires_at
            or _as_utc_datetime(job.lease_expires_at) <= server_now
        ):
            raise ValueError("Developer global frame acceptance artifact is not bound to an active worker lease")
        if not job.claimed_at or _as_utc_datetime(payload["issued_at"]) < _as_utc_datetime(job.claimed_at):
            raise ValueError("Developer global frame acceptance artifact predates its worker claim")
        frozen_bindings = {
            "template_id": job.template_id,
            "source_scope": job.source_scope,
            "acceptance_job_id": job.id,
            "base_draft_hash": job.base_draft_hash,
            "frame_section_hash": job.frame_section_hash,
            "visual_draft_id": job.visual_draft_id,
            "recovery_point_id": job.recovery_point_id,
            "page_registry_hash": job.page_registry_hash,
            "adapter_registry_hash": job.adapter_registry_hash,
            "isolation_policy_hash": job.isolation_policy_hash,
            "test_spec_hash": job.test_spec_hash,
            "source_build_digest": job.source_build_digest,
        }
        if any(
            not hmac.compare_digest(str(payload.get(field) or ""), str(expected))
            for field, expected in frozen_bindings.items()
        ):
            raise ValueError("Developer global frame acceptance artifact does not match the frozen job binding")
        try:
            job_section = json.loads(job.frame_section_json)
        except (TypeError, ValueError) as exc:
            raise ValueError("Stored developer global frame acceptance job section is invalid") from exc
        if not isinstance(job_section, dict):
            raise ValueError("Stored developer global frame acceptance job section is invalid")
        _assert_acceptance_section_matrix(job_section)
        expected_compatible, expected_isolated = _preflight_target_lists(job_section)
        if (
            list(payload.get("compatible_target_page_ids") or []) != expected_compatible
            or list(payload.get("isolated_page_ids") or []) != expected_isolated
        ):
            raise ValueError("Developer global frame acceptance artifact page matrix differs from the frozen job")
        existing_report = await self.db.scalar(
            select(DeveloperGlobalFrameAcceptanceArtifact).where(
                DeveloperGlobalFrameAcceptanceArtifact.report_hash == payload["report_hash"]
            )
        )
        if existing_report:
            if (
                existing_report.run_id != payload["run_id"]
                or existing_report.template_id != template.template_id
                or existing_report.acceptance_job_id != job.id
            ):
                raise ValueError("Developer global frame acceptance report hash is already bound elsewhere")
            raise ValueError("Developer global frame acceptance job state is inconsistent with its stored report")
        existing_run = await self.db.scalar(
            select(DeveloperGlobalFrameAcceptanceArtifact).where(
                DeveloperGlobalFrameAcceptanceArtifact.run_id == payload["run_id"]
            )
        )
        if existing_run:
            raise ValueError("Developer global frame acceptance run ID is already bound to a different report")
        canonical = _acceptance_report_payload(payload)
        artifact = DeveloperGlobalFrameAcceptanceArtifact(
            id=str(uuid4()),
            schema_version=1,
            run_id=payload["run_id"],
            issuer=payload["issuer"],
            key_id=payload["key_id"],
            template_id=template.template_id,
            source_scope=template.owner_scope,
            acceptance_job_id=job.id,
            base_draft_hash=payload["base_draft_hash"],
            frame_section_hash=payload["frame_section_hash"],
            visual_draft_id=payload["visual_draft_id"],
            recovery_point_id=payload["recovery_point_id"],
            page_registry_hash=payload["page_registry_hash"],
            adapter_registry_hash=payload["adapter_registry_hash"],
            isolation_policy_hash=payload["isolation_policy_hash"],
            test_spec_hash=payload["test_spec_hash"],
            source_build_digest=payload["source_build_digest"],
            issued_at=_as_utc_datetime(payload["issued_at"]),
            expires_at=_as_utc_datetime(payload["expires_at"]),
            viewports_json=json.dumps(canonical["viewports"], separators=(",", ":")),
            compatible_target_page_ids_json=json.dumps(
                canonical["compatible_target_page_ids"], ensure_ascii=False, separators=(",", ":")
            ),
            isolated_page_ids_json=json.dumps(
                canonical["isolated_page_ids"], ensure_ascii=False, separators=(",", ":")
            ),
            case_results_json=json.dumps(
                canonical["case_results"], ensure_ascii=False, separators=(",", ":")
            ),
            failure_count=0,
            flaky_count=0,
            skipped_count=0,
            report_hash=payload["report_hash"],
            signature=payload["signature"],
            created_at=server_now,
        )
        self.db.add(artifact)
        await self.db.flush()
        job.status = "succeeded"
        job.acceptance_artifact_id = artifact.id
        job.report_hash = artifact.report_hash
        job.completed_at = server_now
        job.updated_at = server_now
        self._record_acceptance_job_event(
            job,
            event_type="succeeded",
            from_status="running",
            to_status="succeeded",
            now=server_now,
        )
        await self.db.commit()
        await self.db.refresh(artifact)
        return self._acceptance_artifact_to_dict(
            artifact,
            require_fresh=True,
            now=server_now,
            trusted_keys=trusted_keys,
            deployment_hashes=deployment_hashes,
        )

    async def _get_developer_global_frame_acceptance_artifact(
        self,
        acceptance_artifact_id: str,
        *,
        template: TemplateSnapshotTemplate,
        expected_base_draft_hash: str,
        expected_frame_section_hash: str,
        expected_visual_draft_id: str,
        expected_recovery_point_id: str,
        expected_report_hash: str,
        require_fresh: bool,
    ) -> tuple[DeveloperGlobalFrameAcceptanceArtifact, dict[str, Any]]:
        artifact = await self.db.scalar(
            select(DeveloperGlobalFrameAcceptanceArtifact).where(
                DeveloperGlobalFrameAcceptanceArtifact.id == acceptance_artifact_id,
                DeveloperGlobalFrameAcceptanceArtifact.template_id == template.template_id,
            )
        )
        if not artifact:
            raise ValueError("Developer global frame acceptance artifact does not exist for this template")
        if not artifact.acceptance_job_id:
            raise ValueError("Developer global frame acceptance artifact is not linked to a trusted job")
        job = await self.db.scalar(
            select(DeveloperGlobalFrameAcceptanceJob).where(
                DeveloperGlobalFrameAcceptanceJob.id == artifact.acceptance_job_id,
                DeveloperGlobalFrameAcceptanceJob.template_id == template.template_id,
            )
        )
        if (
            not job
            or job.status != "succeeded"
            or job.acceptance_artifact_id != artifact.id
            or not job.report_hash
            or not hmac.compare_digest(job.report_hash, artifact.report_hash)
        ):
            raise ValueError("Developer global frame acceptance artifact has no completed trusted job binding")
        payload = self._acceptance_artifact_payload(artifact)
        self._validate_acceptance_artifact_payload(payload, require_fresh=require_fresh)
        exact_bindings = {
            "base_draft_hash": expected_base_draft_hash,
            "frame_section_hash": expected_frame_section_hash,
            "visual_draft_id": expected_visual_draft_id,
            "recovery_point_id": expected_recovery_point_id,
            "report_hash": expected_report_hash,
        }
        if artifact.source_scope != template.owner_scope or any(
            not hmac.compare_digest(str(payload.get(field) or ""), expected)
            for field, expected in exact_bindings.items()
        ):
            raise ValueError("Developer global frame acceptance artifact does not match the exact draft binding")
        return artifact, payload

    async def get_latest_developer_global_frame_acceptance_artifact(
        self,
        template_id: str,
        *,
        base_draft_hash: str,
        frame_section_hash: str,
        visual_draft_id: str,
        recovery_point_id: str,
    ) -> dict[str, Any]:
        template = await self._get_template(template_id)
        if not template:
            raise KeyError(f"Template {template_id} not found")
        artifact = (
            await self.db.execute(
                select(DeveloperGlobalFrameAcceptanceArtifact)
                .where(
                    DeveloperGlobalFrameAcceptanceArtifact.template_id == template_id,
                    DeveloperGlobalFrameAcceptanceArtifact.base_draft_hash == base_draft_hash,
                    DeveloperGlobalFrameAcceptanceArtifact.frame_section_hash == frame_section_hash,
                    DeveloperGlobalFrameAcceptanceArtifact.visual_draft_id == visual_draft_id,
                    DeveloperGlobalFrameAcceptanceArtifact.recovery_point_id == recovery_point_id,
                )
                .order_by(
                    DeveloperGlobalFrameAcceptanceArtifact.created_at.desc(),
                    DeveloperGlobalFrameAcceptanceArtifact.id.desc(),
                )
            )
        ).scalars().first()
        if not artifact:
            raise KeyError("No exact developer global frame acceptance artifact was found")
        if artifact.source_scope != template.owner_scope:
            raise ValueError("Developer global frame acceptance artifact scope changed after registration")
        if not artifact.acceptance_job_id:
            raise ValueError("Developer global frame acceptance artifact is not linked to a trusted job")
        job = await self.db.scalar(
            select(DeveloperGlobalFrameAcceptanceJob).where(
                DeveloperGlobalFrameAcceptanceJob.id == artifact.acceptance_job_id,
                DeveloperGlobalFrameAcceptanceJob.template_id == template.template_id,
            )
        )
        if (
            not job
            or job.status != "succeeded"
            or job.acceptance_artifact_id != artifact.id
            or not job.report_hash
            or not hmac.compare_digest(job.report_hash, artifact.report_hash)
        ):
            raise ValueError("Developer global frame acceptance artifact has no completed trusted job binding")
        return self._acceptance_artifact_to_dict(artifact, require_fresh=True)

    @staticmethod
    def _preflight_evidence_to_dict(
        evidence: DeveloperGlobalFramePreflightEvidence,
        *,
        valid: bool,
    ) -> dict[str, Any]:
        compatible = _load_page_ids(
            evidence.compatible_target_page_ids_json,
            field="compatible_target_page_ids",
        )
        isolated = _load_page_ids(
            evidence.isolated_page_ids_json,
            field="isolated_page_ids",
        )
        return {
            "evidence_id": evidence.id,
            "template_id": evidence.template_id,
            "source_scope": evidence.source_scope,
            "base_draft_hash": evidence.base_draft_hash,
            "saved_draft_hash": evidence.saved_draft_hash,
            "artifact_hash": evidence.artifact_hash,
            "acceptance_artifact_id": evidence.acceptance_artifact_id,
            "acceptance_artifact_hash": evidence.acceptance_artifact_hash,
            "visual_draft_id": evidence.visual_draft_id,
            "compatible_target_page_ids": compatible,
            "isolated_page_ids": isolated,
            "recovery_point_id": evidence.recovery_point_id,
            "checked_at": evidence.checked_at,
            "evidence_hash": evidence.evidence_hash,
            "valid": valid,
            "created_at": evidence.created_at,
        }

    def _validate_preflight_evidence_record(
        self,
        evidence: DeveloperGlobalFramePreflightEvidence,
        template: TemplateSnapshotTemplate,
        *,
        expected_saved_draft_hash: str,
        expected_artifact_hash: str,
    ) -> dict[str, Any]:
        if evidence.template_id != template.template_id or evidence.source_scope != template.owner_scope:
            raise ValueError("Developer global frame preflight evidence is bound to a different template scope")
        current_document = _load_template_authoring_document(
            template.draft_config_json or template.config_json
        )
        current_hash = _template_document_hash(current_document)
        if not hmac.compare_digest(current_hash, expected_saved_draft_hash):
            raise ValueError("The source template draft changed after developer global frame preflight")
        if not hmac.compare_digest(evidence.saved_draft_hash, expected_saved_draft_hash):
            raise ValueError("Developer global frame preflight evidence is bound to a different saved draft hash")
        if not hmac.compare_digest(evidence.artifact_hash, expected_artifact_hash):
            raise ValueError("Developer global frame preflight evidence is bound to a different artifact hash")
        normalized = normalize_developer_global_frame_document(
            current_document,
            owner_scope=template.owner_scope,
        )
        section = normalized.get(DEVELOPER_GLOBAL_FRAME_SECTION)
        if not isinstance(section, dict):
            raise ValueError("The current source template draft does not contain developer_global_frame")
        compatible = _load_page_ids(
            evidence.compatible_target_page_ids_json,
            field="compatible_target_page_ids",
        )
        isolated = _load_page_ids(
            evidence.isolated_page_ids_json,
            field="isolated_page_ids",
        )
        _assert_preflight_matches_section(
            section,
            {
                "compatible_target_page_ids": compatible,
                "isolated_page_ids": isolated,
                "recovery_point_id": evidence.recovery_point_id,
            },
        )
        expected_evidence_hash = _preflight_evidence_hash(
            {
                "template_id": evidence.template_id,
                "source_scope": evidence.source_scope,
                "base_draft_hash": evidence.base_draft_hash,
                "saved_draft_hash": evidence.saved_draft_hash,
                "artifact_hash": evidence.artifact_hash,
                "acceptance_artifact_id": evidence.acceptance_artifact_id,
                "acceptance_artifact_hash": evidence.acceptance_artifact_hash,
                "visual_draft_id": evidence.visual_draft_id,
                "compatible_target_page_ids": compatible,
                "isolated_page_ids": isolated,
                "recovery_point_id": evidence.recovery_point_id,
                "checked_at": evidence.checked_at,
            }
        )
        if not hmac.compare_digest(evidence.evidence_hash, expected_evidence_hash):
            raise ValueError("Developer global frame preflight evidence integrity check failed")
        return self._preflight_evidence_to_dict(evidence, valid=True)

    async def _validate_preflight_acceptance_binding(
        self,
        evidence: DeveloperGlobalFramePreflightEvidence,
        template: TemplateSnapshotTemplate,
        section: dict[str, Any],
        *,
        require_fresh: bool,
    ) -> dict[str, Any]:
        if not evidence.acceptance_artifact_id or not evidence.acceptance_artifact_hash or not evidence.visual_draft_id:
            raise ValueError("Developer global frame preflight evidence has no trusted acceptance artifact")
        recovery = section.get("recovery")
        visual_draft_id = recovery.get("draft_id") if isinstance(recovery, dict) else None
        recovery_point_id = recovery.get("recovery_point_id") if isinstance(recovery, dict) else None
        if evidence.visual_draft_id != visual_draft_id:
            raise ValueError("Developer global frame preflight visual draft binding changed")
        _artifact, artifact_payload = await self._get_developer_global_frame_acceptance_artifact(
            evidence.acceptance_artifact_id,
            template=template,
            expected_base_draft_hash=evidence.base_draft_hash,
            expected_frame_section_hash=_template_document_hash(section),
            expected_visual_draft_id=evidence.visual_draft_id,
            expected_recovery_point_id=str(recovery_point_id or ""),
            expected_report_hash=evidence.acceptance_artifact_hash,
            require_fresh=require_fresh,
        )
        compatible = _load_page_ids(
            evidence.compatible_target_page_ids_json,
            field="compatible_target_page_ids",
        )
        isolated = _load_page_ids(
            evidence.isolated_page_ids_json,
            field="isolated_page_ids",
        )
        if (
            compatible != artifact_payload["compatible_target_page_ids"]
            or isolated != artifact_payload["isolated_page_ids"]
            or _iso_utc_milliseconds(evidence.checked_at) != _iso_utc_milliseconds(artifact_payload["issued_at"])
        ):
            raise ValueError("Developer global frame preflight evidence does not exactly match trusted acceptance")
        return artifact_payload

    async def validate_developer_global_frame_version_attestation(
        self,
        template: TemplateSnapshotTemplate,
        version: TemplateSnapshotVersion,
        *,
        require_fresh: bool,
    ) -> tuple[DeveloperGlobalFramePreflightEvidence, dict[str, Any]]:
        if load_template_version_release_sections(version.release_sections_json) != [DEVELOPER_GLOBAL_FRAME_SECTION]:
            raise ValueError("Immutable version is not an exact developer_global_frame release")
        if not version.preflight_evidence_id:
            raise ValueError("Developer global frame version has no durable preflight evidence")
        evidence = await self.db.scalar(
            select(DeveloperGlobalFramePreflightEvidence).where(
                DeveloperGlobalFramePreflightEvidence.id == version.preflight_evidence_id,
                DeveloperGlobalFramePreflightEvidence.template_id == template.template_id,
            )
        )
        if not evidence:
            raise ValueError("Developer global frame version preflight evidence does not exist")
        if evidence.source_scope != template.owner_scope:
            raise ValueError("Developer global frame version preflight scope does not match its template")
        version_document = normalize_developer_global_frame_document(
            _load_template_authoring_document(version.config_json),
            owner_scope=template.owner_scope,
        )
        section = version_document.get(DEVELOPER_GLOBAL_FRAME_SECTION)
        if not isinstance(section, dict):
            raise ValueError("Immutable developer global frame version has no frame section")
        compatible = _load_page_ids(
            evidence.compatible_target_page_ids_json,
            field="compatible_target_page_ids",
        )
        isolated = _load_page_ids(
            evidence.isolated_page_ids_json,
            field="isolated_page_ids",
        )
        _assert_preflight_matches_section(
            section,
            {
                "compatible_target_page_ids": compatible,
                "isolated_page_ids": isolated,
                "recovery_point_id": evidence.recovery_point_id,
            },
        )
        expected_evidence_hash = _preflight_evidence_hash(
            {
                "template_id": evidence.template_id,
                "source_scope": evidence.source_scope,
                "base_draft_hash": evidence.base_draft_hash,
                "saved_draft_hash": evidence.saved_draft_hash,
                "artifact_hash": evidence.artifact_hash,
                "acceptance_artifact_id": evidence.acceptance_artifact_id,
                "acceptance_artifact_hash": evidence.acceptance_artifact_hash,
                "visual_draft_id": evidence.visual_draft_id,
                "compatible_target_page_ids": compatible,
                "isolated_page_ids": isolated,
                "recovery_point_id": evidence.recovery_point_id,
                "checked_at": evidence.checked_at,
            }
        )
        if not hmac.compare_digest(evidence.evidence_hash, expected_evidence_hash):
            raise ValueError("Developer global frame version preflight evidence integrity check failed")
        artifact_payload = await self._validate_preflight_acceptance_binding(
            evidence,
            template,
            section,
            require_fresh=require_fresh,
        )
        return evidence, artifact_payload

    async def _find_current_preflight_evidence(
        self,
        template: TemplateSnapshotTemplate,
        *,
        expected_saved_draft_hash: str,
        expected_artifact_hash: str,
    ) -> DeveloperGlobalFramePreflightEvidence:
        evidence = (
            await self.db.execute(
                select(DeveloperGlobalFramePreflightEvidence)
                .where(
                    DeveloperGlobalFramePreflightEvidence.template_id == template.template_id,
                    DeveloperGlobalFramePreflightEvidence.saved_draft_hash == expected_saved_draft_hash,
                    DeveloperGlobalFramePreflightEvidence.artifact_hash == expected_artifact_hash,
                )
                .order_by(
                    DeveloperGlobalFramePreflightEvidence.checked_at.desc(),
                    DeveloperGlobalFramePreflightEvidence.created_at.desc(),
                )
            )
        ).scalars().first()
        if not evidence:
            raise ValueError(
                "The developer_global_frame draft has no durable preflight evidence for the expected artifact"
            )
        self._validate_preflight_evidence_record(
            evidence,
            template,
            expected_saved_draft_hash=expected_saved_draft_hash,
            expected_artifact_hash=expected_artifact_hash,
        )
        current_document = normalize_developer_global_frame_document(
            _load_template_authoring_document(template.draft_config_json or template.config_json),
            owner_scope=template.owner_scope,
        )
        await self._validate_preflight_acceptance_binding(
            evidence,
            template,
            current_document[DEVELOPER_GLOBAL_FRAME_SECTION],
            require_fresh=True,
        )
        return evidence

    async def get_latest_developer_global_frame_preflight_evidence(
        self,
        template_id: str,
    ) -> dict[str, Any]:
        template = await self._get_template(template_id)
        if not template:
            raise KeyError(f"Template {template_id} not found")
        current_document = _load_template_authoring_document(
            template.draft_config_json or template.config_json
        )
        current_hash = _template_document_hash(current_document)
        evidence = (
            await self.db.execute(
                select(DeveloperGlobalFramePreflightEvidence)
                .where(
                    DeveloperGlobalFramePreflightEvidence.template_id == template_id,
                    DeveloperGlobalFramePreflightEvidence.saved_draft_hash == current_hash,
                )
                .order_by(
                    DeveloperGlobalFramePreflightEvidence.checked_at.desc(),
                    DeveloperGlobalFramePreflightEvidence.created_at.desc(),
                )
            )
        ).scalars().first()
        if not evidence:
            raise KeyError(
                f"Template {template_id} has no durable preflight evidence for its current draft"
            )
        result = self._validate_preflight_evidence_record(
            evidence,
            template,
            expected_saved_draft_hash=current_hash,
            expected_artifact_hash=evidence.artifact_hash,
        )
        current_document = normalize_developer_global_frame_document(
            _load_template_authoring_document(template.draft_config_json or template.config_json),
            owner_scope=template.owner_scope,
        )
        await self._validate_preflight_acceptance_binding(
            evidence,
            template,
            current_document[DEVELOPER_GLOBAL_FRAME_SECTION],
            require_fresh=True,
        )
        return result

    async def validate_developer_global_frame_preflight_evidence(
        self,
        template_id: str,
        evidence_id: str,
        *,
        expected_saved_draft_hash: str,
        expected_artifact_hash: str,
    ) -> dict[str, Any]:
        template = await self._get_template(template_id)
        if not template:
            raise KeyError(f"Template {template_id} not found")
        evidence = await self.db.scalar(
            select(DeveloperGlobalFramePreflightEvidence).where(
                DeveloperGlobalFramePreflightEvidence.id == evidence_id,
                DeveloperGlobalFramePreflightEvidence.template_id == template_id,
            )
        )
        if not evidence:
            raise KeyError(f"Developer global frame preflight evidence {evidence_id} not found")
        result = self._validate_preflight_evidence_record(
            evidence,
            template,
            expected_saved_draft_hash=expected_saved_draft_hash,
            expected_artifact_hash=expected_artifact_hash,
        )
        current_document = normalize_developer_global_frame_document(
            _load_template_authoring_document(template.draft_config_json or template.config_json),
            owner_scope=template.owner_scope,
        )
        await self._validate_preflight_acceptance_binding(
            evidence,
            template,
            current_document[DEVELOPER_GLOBAL_FRAME_SECTION],
            require_fresh=True,
        )
        return result

    @staticmethod
    def _factory_default_receipt_to_dict(
        receipt: DeveloperGlobalFrameFactoryDefaultReceipt,
    ) -> dict[str, Any]:
        compatible = _load_page_ids(
            receipt.compatible_target_page_ids_json,
            field="factory_default_compatible_target_page_ids",
        )
        isolated = _load_page_ids(
            receipt.isolated_page_ids_json,
            field="factory_default_isolated_page_ids",
        )
        payload = {
            "template_id": receipt.template_id,
            "published_version": receipt.published_version,
            "artifact_hash": receipt.artifact_hash,
            "draft_hash": receipt.draft_hash,
            "preflight_evidence_hash": receipt.preflight_evidence_hash,
            "compatible_target_page_ids": compatible,
            "isolated_page_ids": isolated,
            "recovery_point_id": receipt.recovery_point_id,
            "rollout_batch_id": receipt.rollout_batch_id,
            "recorded_at": receipt.recorded_at,
        }
        expected_hash = _factory_default_receipt_hash(payload)
        if receipt.schema_version != 1 or not hmac.compare_digest(receipt.receipt_hash, expected_hash):
            raise ValueError("Developer global frame factory-default receipt integrity check failed")
        return {
            "receipt_id": receipt.id,
            "schema_version": 1,
            "template_id": receipt.template_id,
            "source_scope": receipt.source_scope,
            "rollout_owner_scope": receipt.rollout_owner_scope,
            "published_version": receipt.published_version,
            "preflight_evidence_id": receipt.preflight_evidence_id,
            "artifact_hash": receipt.artifact_hash,
            "draft_hash": receipt.draft_hash,
            "preflight_evidence_hash": receipt.preflight_evidence_hash,
            "compatible_target_page_ids": compatible,
            "isolated_page_ids": isolated,
            "recovery_point_id": receipt.recovery_point_id,
            "rollout_batch_id": receipt.rollout_batch_id,
            "recorded_at": _iso_utc_milliseconds(receipt.recorded_at),
            "receipt_hash": receipt.receipt_hash,
            "recorded_by": receipt.recorded_by,
            "created_at": receipt.created_at,
            "valid": True,
        }

    async def _factory_default_release_dependencies(
        self,
        template: TemplateSnapshotTemplate,
        payload: dict[str, Any],
        *,
        require_current_publication: bool,
        validate_current_target_bindings: bool,
    ) -> tuple[TemplateSnapshotVersion, DeveloperGlobalFramePreflightEvidence, TemplateSnapshotReleaseBatch]:
        version = await self.db.scalar(
            select(TemplateSnapshotVersion).where(
                TemplateSnapshotVersion.template_id == template.template_id,
                TemplateSnapshotVersion.version == payload["published_version"],
            )
        )
        if not version:
            raise ValueError("Factory-default receipt version does not exist in immutable history")
        allowed_statuses = {"published"} if require_current_publication else {"published", "archived"}
        if version.review_status not in allowed_statuses:
            raise ValueError("Factory-default receipt requires an immutable two-review published version")
        if (
            version.required_review_steps != 2
            or version.review_step != 2
            or not version.approved_by
            or version.approved_at is None
        ):
            raise ValueError("Factory-default receipt requires an immutable two-review published version")
        if load_template_version_release_sections(version.release_sections_json) != [DEVELOPER_GLOBAL_FRAME_SECTION]:
            raise ValueError("Factory-default receipt version is not an exact developer_global_frame release")
        if require_current_publication and (
            not template.is_published or template.latest_version != version.version
        ):
            raise ValueError("Factory-default receipt version is not the template's current published version")
        evidence, _acceptance = await self.validate_developer_global_frame_version_attestation(
            template,
            version,
            require_fresh=False,
        )
        compatible = _load_page_ids(
            evidence.compatible_target_page_ids_json,
            field="compatible_target_page_ids",
        )
        isolated = _load_page_ids(
            evidence.isolated_page_ids_json,
            field="isolated_page_ids",
        )
        expected_evidence_hash = _preflight_evidence_hash(
            {
                "template_id": evidence.template_id,
                "source_scope": evidence.source_scope,
                "base_draft_hash": evidence.base_draft_hash,
                "saved_draft_hash": evidence.saved_draft_hash,
                "artifact_hash": evidence.artifact_hash,
                "acceptance_artifact_id": evidence.acceptance_artifact_id,
                "acceptance_artifact_hash": evidence.acceptance_artifact_hash,
                "visual_draft_id": evidence.visual_draft_id,
                "compatible_target_page_ids": compatible,
                "isolated_page_ids": isolated,
                "recovery_point_id": evidence.recovery_point_id,
                "checked_at": evidence.checked_at,
            }
        )
        if (
            evidence.source_scope != template.owner_scope
            or not hmac.compare_digest(evidence.evidence_hash, expected_evidence_hash)
            or not hmac.compare_digest(evidence.artifact_hash, payload["artifact_hash"])
            or not hmac.compare_digest(evidence.saved_draft_hash, payload["draft_hash"])
            or not hmac.compare_digest(evidence.evidence_hash, payload["preflight_evidence_hash"])
            or compatible != payload["compatible_target_page_ids"]
            or isolated != payload["isolated_page_ids"]
            or evidence.recovery_point_id != payload["recovery_point_id"]
        ):
            raise ValueError("Factory-default receipt does not exactly match its durable preflight evidence")

        version_document = normalize_developer_global_frame_document(
            _load_template_authoring_document(version.config_json),
            owner_scope=template.owner_scope,
        )
        assert_developer_global_frame_publish_version(
            version_document,
            version=version.version,
        )
        version_section = version_document.get(DEVELOPER_GLOBAL_FRAME_SECTION)
        if not isinstance(version_section, dict):
            raise ValueError("Factory-default receipt version does not contain developer_global_frame")
        _assert_preflight_matches_section(
            version_section,
            {
                "compatible_target_page_ids": compatible,
                "isolated_page_ids": isolated,
                "recovery_point_id": evidence.recovery_point_id,
            },
        )
        if require_current_publication:
            live_document = normalize_developer_global_frame_document(
                _load_template_authoring_document(template.config_json),
                owner_scope=template.owner_scope,
            )
            if live_document.get(DEVELOPER_GLOBAL_FRAME_SECTION) != version_section:
                raise ValueError("Factory-default receipt version is not the live developer_global_frame section")

        batch = await self.db.scalar(
            select(TemplateSnapshotReleaseBatch).where(
                TemplateSnapshotReleaseBatch.id == payload["rollout_batch_id"]
            )
        )
        if not batch:
            raise ValueError("Factory-default receipt rollout batch does not exist")
        if (
            batch.template_id != template.template_id
            or batch.template_version != version.version
            or load_template_version_release_sections(batch.sections_json) != [DEVELOPER_GLOBAL_FRAME_SECTION]
            or batch.owner_scope not in INSTANCE_SCOPES
            or batch.status != "completed"
            or batch.total_targets <= 0
            or batch.succeeded_targets != batch.total_targets
            or batch.failed_targets != 0
            or batch.completed_at is None
        ):
            raise ValueError("Factory-default receipt rollout is not an exact successful frame release")
        if _as_utc_datetime(payload["recorded_at"]) < _as_utc_datetime(batch.completed_at):
            raise ValueError("Factory-default receipt cannot predate rollout completion")

        targets = (
            await self.db.execute(
                select(TemplateSnapshotReleaseTarget)
                .where(TemplateSnapshotReleaseTarget.batch_id == batch.id)
                .order_by(TemplateSnapshotReleaseTarget.id)
            )
        ).scalars().all()
        if len(targets) != batch.total_targets:
            raise ValueError("Factory-default receipt rollout target count is inconsistent")
        for target in targets:
            if target.status != "succeeded" or target.error_message or not target.result_json:
                raise ValueError("Factory-default receipt rollout contains a non-successful target")
            try:
                target_result = json.loads(target.result_json)
            except (TypeError, ValueError) as exc:
                raise ValueError("Factory-default receipt rollout target evidence is invalid") from exc
            if (
                not isinstance(target_result, dict)
                or target_result.get("template_version") != version.version
                or target_result.get("sections") != [DEVELOPER_GLOBAL_FRAME_SECTION]
            ):
                raise ValueError("Factory-default receipt rollout target evidence is not version-bound")
            if validate_current_target_bindings:
                instance = await self._get_instance(target.instance_id)
                if (
                    not instance
                    or instance.base_template_id != template.template_id
                    or instance.owner_scope != batch.owner_scope
                    or instance.organization_id != target.organization_id
                    or instance.project_id != target.project_id
                ):
                    raise ValueError("Factory-default receipt rollout owner binding changed before recording")
        return version, evidence, batch

    async def record_developer_global_frame_factory_default_receipt(
        self,
        template_id: str,
        payload: dict[str, Any],
        *,
        recorded_by: str | None,
    ) -> dict[str, Any]:
        if payload.get("template_id") != template_id:
            raise ValueError("Factory-default receipt template ID does not match the request route")
        recorded_at = _as_utc_datetime(payload["recorded_at"])
        if recorded_at > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError("Factory-default receipt recorded_at is too far in the future")
        expected_receipt_hash = _factory_default_receipt_hash(payload)
        if not hmac.compare_digest(payload["receipt_hash"], expected_receipt_hash):
            raise ValueError("Developer global frame factory-default receipt hash is invalid")

        template = (
            await self.db.execute(
                select(TemplateSnapshotTemplate)
                .where(TemplateSnapshotTemplate.template_id == template_id)
                .with_for_update()
            )
        ).scalar_one_or_none()
        if not template:
            raise KeyError(f"Template {template_id} not found")
        # The template row serializes equal receipt submissions.  Recheck only
        # after acquiring it so two concurrent first writes cannot both pass
        # the idempotency lookup and race into the unique constraint.
        existing = await self.db.scalar(
            select(DeveloperGlobalFrameFactoryDefaultReceipt).where(
                DeveloperGlobalFrameFactoryDefaultReceipt.receipt_hash == payload["receipt_hash"]
            )
        )
        if existing:
            if existing.template_id != template_id:
                raise ValueError("Factory-default receipt hash is already bound to a different template")
        _version, evidence, batch = await self._factory_default_release_dependencies(
            template,
            payload,
            require_current_publication=True,
            validate_current_target_bindings=True,
        )
        if existing:
            return self._factory_default_receipt_to_dict(existing)
        receipt = DeveloperGlobalFrameFactoryDefaultReceipt(
            id=str(uuid4()),
            schema_version=1,
            template_id=template.template_id,
            source_scope=template.owner_scope,
            rollout_owner_scope=batch.owner_scope,
            published_version=payload["published_version"],
            preflight_evidence_id=evidence.id,
            artifact_hash=payload["artifact_hash"],
            draft_hash=payload["draft_hash"],
            preflight_evidence_hash=payload["preflight_evidence_hash"],
            compatible_target_page_ids_json=json.dumps(
                payload["compatible_target_page_ids"], ensure_ascii=False, separators=(",", ":")
            ),
            isolated_page_ids_json=json.dumps(
                payload["isolated_page_ids"], ensure_ascii=False, separators=(",", ":")
            ),
            recovery_point_id=payload["recovery_point_id"],
            rollout_batch_id=batch.id,
            recorded_at=_as_utc_datetime(payload["recorded_at"]),
            receipt_hash=payload["receipt_hash"],
            recorded_by=recorded_by,
        )
        self.db.add(receipt)
        await self.db.commit()
        await self.db.refresh(receipt)
        return self._factory_default_receipt_to_dict(receipt)

    async def get_latest_developer_global_frame_factory_default_receipt(
        self,
        template_id: str,
    ) -> dict[str, Any]:
        if not await self._get_template(template_id):
            raise KeyError(f"Template {template_id} not found")
        receipt = (
            await self.db.execute(
                select(DeveloperGlobalFrameFactoryDefaultReceipt)
                .where(DeveloperGlobalFrameFactoryDefaultReceipt.template_id == template_id)
                .order_by(
                    DeveloperGlobalFrameFactoryDefaultReceipt.created_at.desc(),
                    DeveloperGlobalFrameFactoryDefaultReceipt.id.desc(),
                )
            )
        ).scalars().first()
        if not receipt:
            raise KeyError(f"Template {template_id} has no developer global frame factory default")
        return self._factory_default_receipt_to_dict(receipt)

    async def list_developer_global_frame_factory_default_receipts(
        self,
        template_id: str,
        *,
        limit: int,
    ) -> list[dict[str, Any]]:
        if not await self._get_template(template_id):
            raise KeyError(f"Template {template_id} not found")
        receipts = (
            await self.db.execute(
                select(DeveloperGlobalFrameFactoryDefaultReceipt)
                .where(DeveloperGlobalFrameFactoryDefaultReceipt.template_id == template_id)
                .order_by(
                    DeveloperGlobalFrameFactoryDefaultReceipt.created_at.desc(),
                    DeveloperGlobalFrameFactoryDefaultReceipt.id.desc(),
                )
                .limit(limit)
            )
        ).scalars().all()
        return [self._factory_default_receipt_to_dict(receipt) for receipt in receipts]

    async def restore_developer_global_frame_factory_default(
        self,
        instance_id: str,
        *,
        receipt_hash: str | None,
        operator: str | None,
    ) -> dict[str, Any]:
        instance = await self._get_instance(instance_id)
        if not instance:
            raise KeyError(f"Instance {instance_id} not found")
        if not instance.base_template_id:
            raise ValueError("The instance is not bound to a template")
        query = select(DeveloperGlobalFrameFactoryDefaultReceipt).where(
            DeveloperGlobalFrameFactoryDefaultReceipt.template_id == instance.base_template_id
        )
        if receipt_hash:
            query = query.where(DeveloperGlobalFrameFactoryDefaultReceipt.receipt_hash == receipt_hash)
        else:
            query = query.order_by(
                DeveloperGlobalFrameFactoryDefaultReceipt.created_at.desc(),
                DeveloperGlobalFrameFactoryDefaultReceipt.id.desc(),
            )
        receipt = (await self.db.execute(query)).scalars().first()
        if not receipt:
            raise KeyError("No matching developer global frame factory default was found")
        receipt_document = self._factory_default_receipt_to_dict(receipt)
        template = await self._get_template(receipt.template_id)
        if not template:
            raise KeyError(f"Template {receipt.template_id} not found")
        await self._factory_default_release_dependencies(
            template,
            {
                "published_version": receipt.published_version,
                "artifact_hash": receipt.artifact_hash,
                "draft_hash": receipt.draft_hash,
                "preflight_evidence_hash": receipt.preflight_evidence_hash,
                "compatible_target_page_ids": receipt_document["compatible_target_page_ids"],
                "isolated_page_ids": receipt_document["isolated_page_ids"],
                "recovery_point_id": receipt.recovery_point_id,
                "rollout_batch_id": receipt.rollout_batch_id,
                "recorded_at": receipt.recorded_at,
            },
            require_current_publication=False,
            validate_current_target_bindings=False,
        )
        if instance.owner_scope != receipt.rollout_owner_scope:
            raise ValueError("Factory-default receipt belongs to a different runtime owner scope")
        restored = await self.restore_template(
            instance_id,
            {
                "target": DEVELOPER_GLOBAL_FRAME_SECTION,
                "template_version": receipt.published_version,
                "create_backup": True,
                "operator": operator,
            },
        )
        return {"receipt": receipt_document, "instance": restored}

    async def merge_developer_global_frame_draft(
        self,
        template_id: str,
        *,
        expected_binding: tuple[str, str | None, int | None, int | None],
        base_draft_hash: str,
        developer_global_frame: dict[str, Any],
        preflight_evidence: dict[str, Any] | None = None,
        created_by: str | None = None,
    ) -> dict[str, Any]:
        """Atomically replace one validated section in the authoring draft.

        The full-document hash protects every sibling section from a stale
        visual-editor save.  This operation never publishes a version and
        never creates a rollout batch.
        """
        template = (
            await self.db.execute(
                select(TemplateSnapshotTemplate)
                .where(TemplateSnapshotTemplate.template_id == template_id)
                .with_for_update()
            )
        ).scalar_one_or_none()
        if not template:
            raise KeyError(f"Template {template_id} not found")
        current_binding = (
            template.owner_scope,
            template.owner_id,
            template.organization_id,
            template.project_id,
        )
        if current_binding != expected_binding:
            raise ValueError("The source template tenant binding changed; reload it before merging developer_global_frame")
        if template.owner_scope not in TEMPLATE_SOURCE_SCOPES:
            raise ValueError("developer_global_frame drafts are allowed on source templates only")

        current = _load_template_authoring_document(template.draft_config_json or template.config_json)
        current_hash = _template_document_hash(current)
        if not hmac.compare_digest(current_hash, base_draft_hash):
            raise ValueError("The source template draft changed; reload it before merging developer_global_frame")

        sibling_snapshot = {
            key: deepcopy(value)
            for key, value in current.items()
            if key != DEVELOPER_GLOBAL_FRAME_SECTION
        }
        candidate = deepcopy(current)
        candidate[DEVELOPER_GLOBAL_FRAME_SECTION] = deepcopy(developer_global_frame)
        normalized = normalize_developer_global_frame_document(candidate, owner_scope=template.owner_scope)
        if {
            key: value
            for key, value in normalized.items()
            if key != DEVELOPER_GLOBAL_FRAME_SECTION
        } != sibling_snapshot:
            raise RuntimeError("developer_global_frame merge attempted to change a sibling template section")

        next_document = _load_template_authoring_document(_dump_json(normalized))
        saved_draft_hash = _template_document_hash(next_document)
        evidence_record: DeveloperGlobalFramePreflightEvidence | None = None
        if preflight_evidence is not None:
            compatible, isolated = _assert_preflight_matches_section(
                next_document[DEVELOPER_GLOBAL_FRAME_SECTION],
                preflight_evidence,
            )
            acceptance_artifact_id = preflight_evidence.get("acceptance_artifact_id")
            acceptance_artifact_hash = preflight_evidence.get("acceptance_artifact_hash")
            visual_draft_id = preflight_evidence.get("visual_draft_id")
            if not all(isinstance(value, str) and value for value in (
                acceptance_artifact_id,
                acceptance_artifact_hash,
                visual_draft_id,
            )):
                raise ValueError("Developer global frame preflight requires a trusted acceptance artifact binding")
            section = next_document[DEVELOPER_GLOBAL_FRAME_SECTION]
            recovery = section.get("recovery")
            expected_visual_draft_id = recovery.get("draft_id") if isinstance(recovery, dict) else None
            if visual_draft_id != expected_visual_draft_id:
                raise ValueError("Developer global frame preflight visual draft does not match the frame section")
            _acceptance, acceptance_payload = await self._get_developer_global_frame_acceptance_artifact(
                acceptance_artifact_id,
                template=template,
                expected_base_draft_hash=current_hash,
                expected_frame_section_hash=_template_document_hash(section),
                expected_visual_draft_id=visual_draft_id,
                expected_recovery_point_id=str(preflight_evidence.get("recovery_point_id") or ""),
                expected_report_hash=acceptance_artifact_hash,
                require_fresh=True,
            )
            if (
                compatible != acceptance_payload["compatible_target_page_ids"]
                or isolated != acceptance_payload["isolated_page_ids"]
            ):
                raise ValueError("Developer global frame preflight target matrix differs from trusted acceptance")
            checked_at = _as_utc_datetime(acceptance_payload["issued_at"])
            if _iso_utc_milliseconds(preflight_evidence.get("checked_at")) != _iso_utc_milliseconds(checked_at):
                raise ValueError("Developer global frame preflight checked_at is not the trusted acceptance time")
            evidence_values = {
                "template_id": template.template_id,
                "source_scope": template.owner_scope,
                "base_draft_hash": current_hash,
                "saved_draft_hash": saved_draft_hash,
                "artifact_hash": preflight_evidence.get("artifact_hash"),
                "acceptance_artifact_id": acceptance_artifact_id,
                "acceptance_artifact_hash": acceptance_artifact_hash,
                "visual_draft_id": visual_draft_id,
                "compatible_target_page_ids": compatible,
                "isolated_page_ids": isolated,
                "recovery_point_id": preflight_evidence.get("recovery_point_id"),
                "checked_at": checked_at,
            }
            artifact_hash = evidence_values["artifact_hash"]
            if not isinstance(artifact_hash, str) or len(artifact_hash) != 64 or any(
                character not in "0123456789abcdef" for character in artifact_hash
            ):
                raise ValueError("Developer global frame preflight artifact hash must be SHA-256")
            evidence_hash = _preflight_evidence_hash(evidence_values)
            evidence_record = (
                await self.db.execute(
                    select(DeveloperGlobalFramePreflightEvidence).where(
                        DeveloperGlobalFramePreflightEvidence.template_id == template.template_id,
                        DeveloperGlobalFramePreflightEvidence.artifact_hash == artifact_hash,
                        DeveloperGlobalFramePreflightEvidence.saved_draft_hash == saved_draft_hash,
                    )
                )
            ).scalar_one_or_none()
            if evidence_record:
                if evidence_record.evidence_hash != evidence_hash or evidence_record.base_draft_hash != current_hash:
                    raise ValueError("Developer global frame preflight artifact was already bound to different evidence")
            else:
                evidence_record = DeveloperGlobalFramePreflightEvidence(
                    id=str(uuid4()),
                    template_id=template.template_id,
                    source_scope=template.owner_scope,
                    base_draft_hash=current_hash,
                    saved_draft_hash=saved_draft_hash,
                    artifact_hash=artifact_hash,
                    acceptance_artifact_id=acceptance_artifact_id,
                    acceptance_artifact_hash=acceptance_artifact_hash,
                    visual_draft_id=visual_draft_id,
                    compatible_target_page_ids_json=json.dumps(compatible, ensure_ascii=False, separators=(",", ":")),
                    isolated_page_ids_json=json.dumps(isolated, ensure_ascii=False, separators=(",", ":")),
                    recovery_point_id=str(evidence_values["recovery_point_id"]),
                    checked_at=checked_at,
                    evidence_hash=evidence_hash,
                    created_by=created_by,
                )
                self.db.add(evidence_record)

        template.draft_config_json = _dump_json(next_document)
        template.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(template)
        if evidence_record:
            await self.db.refresh(evidence_record)
        next_document = _load_template_authoring_document(template.draft_config_json)
        return {
            "template_id": template.template_id,
            "owner_scope": template.owner_scope,
            "base_template_version": template.latest_version,
            "draft_config_hash": _template_document_hash(next_document),
            "developer_global_frame": next_document[DEVELOPER_GLOBAL_FRAME_SECTION],
            "preserved_sibling_keys": sorted(sibling_snapshot),
            "write_scope": "draft-only",
            "publish_performed": False,
            "batch_created": False,
            "preflight_evidence": (
                self._preflight_evidence_to_dict(evidence_record, valid=True)
                if evidence_record
                else None
            ),
        }

    async def list_template_versions(self, template_id: str) -> list[dict[str, Any]]:
        """Return immutable published versions, newest first, for an authorized template."""
        template = await self._get_template(template_id)
        if not template:
            raise KeyError(f"Template {template_id} not found")
        versions = (
            await self.db.execute(
                select(TemplateSnapshotVersion)
                .where(TemplateSnapshotVersion.template_id == template_id)
                .order_by(TemplateSnapshotVersion.published_at.desc(), TemplateSnapshotVersion.id.desc())
            )
        ).scalars().all()
        return [self._version_to_dict(version) for version in versions]

    async def list_review_queue(self, *, limit: int = 100) -> list[dict[str, Any]]:
        queued = (
            await self.db.execute(
                select(TemplateSnapshotVersion)
                .where(TemplateSnapshotVersion.review_status.in_(("pending_review", "pending_second_review")))
                .order_by(TemplateSnapshotVersion.published_at.asc(), TemplateSnapshotVersion.id.asc())
                .limit(limit)
            )
        ).scalars().all()
        return [self._version_to_dict(item) for item in queued]

    async def get_instance(self, instance_id: str) -> dict[str, Any]:
        instance = await self._get_instance(instance_id)
        if not instance:
            raise KeyError(f"Instance {instance_id} not found")
        return self._instance_to_dict(instance)

    async def upsert_instance(self, payload: dict[str, Any]) -> dict[str, Any]:
        self._assert_instance_payload_allowed(payload)
        snapshot_config = validate_runtime_developer_global_frame_document(
            payload.get("snapshot_config_json") or {},
            runtime_scope=payload["owner_scope"],
        )
        requested_override_config = payload.get("override_config_json") or {}
        if DEVELOPER_GLOBAL_FRAME_SECTION in requested_override_config:
            raise ValueError("Runtime instances cannot override the source-owned developer_global_frame section")
        instance = await self._get_instance(payload["instance_id"])
        if instance:
            self._assert_owner_binding_immutable(instance, payload)
            previous_template = await self._get_template_version_config(
                instance.base_template_id or "",
                instance.base_template_version,
            )
            if previous_template is None and instance.base_template_id:
                template = await self._get_template(instance.base_template_id)
                if template:
                    if template.owner_scope == "client_source":
                        repaired_version, previous_template = await self._resolve_product_market_runtime_default(template)
                    else:
                        repaired_version = template.latest_version
                        previous_template = await self._get_template_version_config(
                            template.template_id,
                            repaired_version,
                        )
                    instance.base_template_version = repaired_version
            if previous_template is not None:
                inferred_changes = _local_change_patch(previous_template, snapshot_config)
                override_config = {} if inferred_changes is _UNCHANGED else inferred_changes
            else:
                override_config = _load_json(instance.override_config_json)
            override_config.pop(DEVELOPER_GLOBAL_FRAME_SECTION, None)
            instance.instance_type = payload["instance_type"]
            instance.owner_scope = payload["owner_scope"]
            # Browser saves may only know the canonical runtime ID.  Never
            # clear a server-provisioned organization/project binding merely
            # because an optional field was omitted from that save request.
            if payload.get("owner_id") is not None:
                instance.owner_id = payload["owner_id"]
            if payload.get("organization_id") is not None:
                instance.organization_id = payload["organization_id"]
            if payload.get("project_id") is not None:
                instance.project_id = payload["project_id"]
            if payload.get("parent_id") is not None:
                instance.parent_id = payload["parent_id"]
            instance.name = payload["name"]
            instance.snapshot_config_json = _dump_json(snapshot_config)
            instance.override_config_json = _dump_json(override_config)
            instance.last_synced_at = payload.get("last_synced_at") or instance.last_synced_at
            instance.updated_at = datetime.now(timezone.utc)
        else:
            override_config = requested_override_config
            instance = TemplateSnapshotInstance(
                instance_id=payload["instance_id"],
                instance_type=payload["instance_type"],
                owner_scope=payload["owner_scope"],
                owner_id=payload.get("owner_id"),
                organization_id=payload.get("organization_id"),
                project_id=payload.get("project_id"),
                parent_id=payload.get("parent_id"),
                name=payload["name"],
                base_template_id=payload.get("base_template_id"),
                base_template_version=payload.get("base_template_version"),
                snapshot_config_json=_dump_json(snapshot_config),
                override_config_json=_dump_json(override_config),
                is_detached=bool(payload.get("is_detached", False)),
                last_synced_at=payload.get("last_synced_at"),
            )
            self.db.add(instance)
        await self.db.commit()
        await self.db.refresh(instance)
        return self._instance_to_dict(instance)

    async def diff_latest(self, instance_id: str) -> dict[str, Any]:
        instance = await self._get_instance(instance_id)
        if not instance:
            raise KeyError(f"Instance {instance_id} not found")
        template = await self._get_template(instance.base_template_id or "")
        if not template:
            return {"instance_id": instance_id, "template_id": instance.base_template_id, "template_version": instance.base_template_version, "entries": []}
        current = _load_json(instance.snapshot_config_json)
        if template.owner_scope == "client_source":
            target_version, target = await self._resolve_product_market_runtime_default(template)
        else:
            target_version = template.latest_version
            target_snapshot = await self._get_template_version_record(template.template_id, target_version)
            if target_version and target_snapshot is None:
                raise ValueError("The runtime template pointer is not backed by immutable history")
            target = _load_json(target_snapshot.config_json if target_snapshot else template.config_json)
        return {
            "instance_id": instance_id,
            "template_id": template.template_id,
            "template_version": target_version,
            "entries": _diff_dict(current, target),
        }

    async def sync_latest(
        self,
        instance_id: str,
        payload: dict[str, Any],
        *,
        commit: bool = True,
    ) -> dict[str, Any]:
        # Full rollouts and tenant resurrection both need the instance baseline
        # check and update to be one serialized operation.  Callers that own a
        # larger transaction can defer the commit until their related status
        # or release-target row is ready as well.
        instance = await self._get_instance(instance_id, for_update=True)
        if not instance:
            raise KeyError(f"Instance {instance_id} not found")
        if instance.is_detached:
            raise ValueError("Detached instances cannot sync from a template; rebind the instance first")
        expected_template_id = payload.get("expected_template_id")
        if expected_template_id and instance.base_template_id != expected_template_id:
            raise ValueError("The rollout target was rebound after the immutable release batch was queued")
        expected_binding = (
            payload.get("expected_owner_scope"),
            payload.get("expected_organization_id"),
            payload.get("expected_project_id"),
        )
        if "expected_owner_scope" in payload and expected_binding != (
            instance.owner_scope,
            instance.organization_id,
            instance.project_id,
        ):
            raise ValueError("The rollout target tenant binding changed after the immutable batch was queued")
        template = await self._get_template(instance.base_template_id or "")
        if not template:
            raise KeyError(f"Template {instance.base_template_id} not found")

        current = _load_json(instance.snapshot_config_json)
        normalized_sections = normalize_developer_global_frame_release_sections(payload.get("sections"))
        requested_version = payload.get("template_version")
        if requested_version:
            requested_snapshot = await self._get_template_version_record(template.template_id, requested_version)
            if requested_snapshot is None:
                raise KeyError(f"Released template version {requested_version} not found")
            current_snapshot = await self._get_template_version_record(
                template.template_id,
                instance.base_template_version,
            )
            if current_snapshot is not None and requested_snapshot.id < current_snapshot.id:
                raise ValueError("A template rollout cannot move an instance back to an older publication")
            version_release_sections = load_template_version_release_sections(requested_snapshot.release_sections_json)
            if version_release_sections and version_release_sections != normalized_sections:
                raise ValueError("A section-only template version may sync only its persisted release sections")
            if not normalized_sections and instance.base_template_version == requested_version:
                # A worker may be redelivered after an uncertain acknowledgement,
                # and a plan created during a rollout may already use its pinned
                # factory version.  Do not rewrite it or create another backup.
                return self._instance_to_dict(instance)
            target = _load_json(requested_snapshot.config_json)
            target_version = requested_version
        else:
            if not normalized_sections and template.owner_scope == "client_source":
                runtime_default_version, target = await self._resolve_product_market_runtime_default(template)
                latest_snapshot = await self._get_template_version_record(
                    template.template_id,
                    runtime_default_version,
                )
            else:
                runtime_default_version = template.latest_version
                latest_snapshot = await self._get_template_version_record(template.template_id, runtime_default_version)
                if runtime_default_version and latest_snapshot is None:
                    raise ValueError("The current runtime template pointer is not backed by immutable history")
                target = _load_json(latest_snapshot.config_json if latest_snapshot else template.config_json)
            latest_release_sections = (
                load_template_version_release_sections(latest_snapshot.release_sections_json)
                if latest_snapshot
                else []
            )
            if latest_release_sections and latest_release_sections != normalized_sections:
                raise ValueError("The latest section-only template version requires its persisted release sections")
            target_version = runtime_default_version
        target = normalize_developer_global_frame_document(target, owner_scope=template.owner_scope)
        validate_runtime_developer_global_frame_document(target, runtime_scope=instance.owner_scope)
        overrides = _load_json(instance.override_config_json)
        previous_template = await self._get_template_version_config(
            template.template_id,
            instance.base_template_version,
        )
        merged, preserved_overrides = _compose_synced_snapshot(
            target,
            current,
            overrides,
            previous_template,
        )
        merged, preserved_overrides = apply_source_owned_developer_global_frame(
            merged,
            preserved_overrides,
            target,
        )
        sections = set(normalized_sections)
        if DEVELOPER_GLOBAL_FRAME_SECTION in sections and DEVELOPER_GLOBAL_FRAME_SECTION not in target:
            raise ValueError("The selected template version does not contain developer_global_frame")
        if sections:
            fully_merged = merged
            merged = deepcopy(current)
            for section in sections:
                if section in target:
                    merged[section] = deepcopy(fully_merged.get(section))
        partial_frame_overrides = deepcopy(overrides)
        partial_frame_overrides.pop(DEVELOPER_GLOBAL_FRAME_SECTION, None)
        if payload.get("create_backup", True):
            await self.create_backup(
                {
                    "target_type": "instance",
                    "target_id": instance.instance_id,
                    "version": instance.base_template_version,
                    "backup_kind": "sync_latest_partial" if sections else "sync_latest",
                    "created_by": payload.get("operator"),
                    "snapshot_config": current,
                    "override_config": overrides,
                    "base_template_id": instance.base_template_id,
                    "base_template_version": instance.base_template_version,
                },
                commit=False,
            )
        instance.snapshot_config_json = _dump_json(merged)
        # A template update must never clear downstream modifications. The
        # legacy "overwrite" input is accepted for compatibility but uses the
        # same safe merge contract; destructive reset is available only through
        # the explicit restore action with its backup.
        if not sections:
            instance.override_config_json = _dump_json(preserved_overrides)
        elif DEVELOPER_GLOBAL_FRAME_SECTION in sections:
            # A frame-only rollout must not copy page/business values into the
            # override document merely because they differ from an old full
            # template.  It removes only a legacy frame override.
            instance.override_config_json = _dump_json(partial_frame_overrides)
        if not sections:
            instance.base_template_version = target_version
        instance.last_synced_at = datetime.now(timezone.utc)
        if commit:
            await self.db.commit()
            await self.db.refresh(instance)
        else:
            await self.db.flush()
        return self._instance_to_dict(instance)

    async def restore_template(self, instance_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        instance = await self._get_instance(instance_id)
        if not instance:
            raise KeyError(f"Instance {instance_id} not found")
        template = await self._get_template(instance.base_template_id or "")
        if not template:
            raise KeyError(f"Template {instance.base_template_id} not found")

        target = payload.get("target", "all")
        current = _load_json(instance.snapshot_config_json)
        overrides = _load_json(instance.override_config_json)
        previous_template = await self._get_template_version_config(
            template.template_id,
            instance.base_template_version,
        )
        requested_version = payload.get("template_version")
        if requested_version:
            requested_snapshot = await self._get_template_version_record(template.template_id, requested_version)
            if requested_snapshot is None:
                raise KeyError(f"Template version {requested_version} not found")
            version_release_sections = load_template_version_release_sections(requested_snapshot.release_sections_json)
            if version_release_sections and version_release_sections != [target]:
                raise ValueError("A section-only template version may restore only its persisted release section")
            source = _load_json(requested_snapshot.config_json)
            selected_version = requested_version
        else:
            if target != DEVELOPER_GLOBAL_FRAME_SECTION and template.owner_scope == "client_source":
                runtime_default_version, source = await self._resolve_product_market_runtime_default(template)
                latest_snapshot = await self._get_template_version_record(
                    template.template_id,
                    runtime_default_version,
                )
            else:
                runtime_default_version = template.latest_version
                latest_snapshot = await self._get_template_version_record(template.template_id, runtime_default_version)
                if runtime_default_version and latest_snapshot is None:
                    raise ValueError("The current runtime template pointer is not backed by immutable history")
                source = _load_json(latest_snapshot.config_json if latest_snapshot else template.config_json)
            latest_release_sections = (
                load_template_version_release_sections(latest_snapshot.release_sections_json)
                if latest_snapshot
                else []
            )
            if latest_release_sections and latest_release_sections != [target]:
                raise ValueError("The latest section-only template version may restore only its persisted release section")
            selected_version = runtime_default_version
        source = normalize_developer_global_frame_document(source, owner_scope=template.owner_scope)
        validate_runtime_developer_global_frame_document(source, runtime_scope=instance.owner_scope)
        if target == DEVELOPER_GLOBAL_FRAME_SECTION and DEVELOPER_GLOBAL_FRAME_SECTION not in source:
            raise ValueError("The selected template version does not contain developer_global_frame")
        restored, preserved_overrides = _compose_restored_snapshot(
            source,
            current,
            overrides,
            previous_template,
            target,
        )
        restored, preserved_overrides = apply_source_owned_developer_global_frame(
            restored,
            preserved_overrides,
            source if target in {"all", DEVELOPER_GLOBAL_FRAME_SECTION} else {},
        )
        if payload.get("create_backup", True):
            await self.create_backup(
                {
                    "target_type": "instance",
                    "target_id": instance.instance_id,
                    "version": instance.base_template_version,
                    "backup_kind": f"restore_{target}",
                    "created_by": payload.get("operator"),
                    "snapshot_config": current,
                    "override_config": overrides,
                    "base_template_id": instance.base_template_id,
                    "base_template_version": instance.base_template_version,
                }
            )
        instance.snapshot_config_json = _dump_json(restored)
        instance.override_config_json = _dump_json(preserved_overrides)
        if target == "all":
            instance.base_template_version = selected_version
        instance.last_synced_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(instance)
        return self._instance_to_dict(instance)

    async def detach_instance(self, instance_id: str, operator: str | None = None) -> dict[str, Any]:
        instance = await self._get_instance(instance_id)
        if not instance:
            raise KeyError(f"Instance {instance_id} not found")
        instance.is_detached = True
        instance.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(instance)
        return self._instance_to_dict(instance)

    async def rebind_instance(self, instance_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        instance = await self._get_instance(instance_id)
        if not instance:
            raise KeyError(f"Instance {instance_id} not found")
        template = await self._get_template(payload["template_id"])
        if not template:
            raise KeyError(f"Template {payload['template_id']} not found")
        target_version = await self._get_template_version_record(template.template_id, payload["template_version"])
        if not target_version:
            raise KeyError(f"Template version {payload['template_version']} not found")
        if load_template_version_release_sections(target_version.release_sections_json):
            raise ValueError("A section-only template version cannot become a full instance baseline")
        instance.base_template_id = template.template_id
        instance.base_template_version = payload["template_version"]
        instance.is_detached = False
        instance.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(instance)
        return self._instance_to_dict(instance)

    async def create_backup(self, payload: dict[str, Any], *, commit: bool = True) -> dict[str, Any]:
        backup = TemplateSnapshotBackup(
            backup_id=f"bak_{uuid4().hex[:12]}",
            target_type=payload["target_type"],
            target_id=payload["target_id"],
            version=payload.get("version"),
            backup_kind=payload["backup_kind"],
            program_path=payload.get("program_path"),
            database_path=payload.get("database_path"),
            backup_path=payload.get("backup_path"),
            metadata_json=_dump_json({k: v for k, v in payload.items() if k not in {"target_type", "target_id", "version", "backup_kind"}}),
            created_by=payload.get("created_by"),
        )
        self.db.add(backup)
        if commit:
            await self.db.commit()
            await self.db.refresh(backup)
        else:
            await self.db.flush()
        return self._backup_to_dict(backup)

    async def record_backup_restore_drill(self, backup_id: str, *, operator: str | None, result: str, note: str | None) -> dict[str, Any]:
        result_row = await self.db.execute(select(TemplateSnapshotBackup).where(TemplateSnapshotBackup.backup_id == backup_id))
        backup = result_row.scalar_one_or_none()
        if not backup:
            raise KeyError(f"Backup {backup_id} not found")
        metadata = _load_json(backup.metadata_json)
        metadata["restore_drill"] = {
            "result": result,
            "note": (note or "").strip() or None,
            "operator": operator,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        backup.metadata_json = _dump_json(metadata)
        backup.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(backup)
        return self._backup_to_dict(backup)

    async def list_backups(self, *, limit: int = 100) -> list[dict[str, Any]]:
        backups = (await self.db.execute(select(TemplateSnapshotBackup).order_by(TemplateSnapshotBackup.created_at.desc()).limit(limit))).scalars().all()
        return [self._backup_to_dict(backup) for backup in backups]

    async def upsert_legacy_mapping(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Store an explicit migration mapping; never infer a tenant from a site ID."""
        organization_id = payload.get("organization_id")
        project_id = payload.get("project_id")
        if bool(organization_id) == bool(project_id):
            raise ValueError("Legacy mapping requires exactly one of organization_id or project_id")
        result = await self.db.execute(
            select(TemplateSnapshotLegacyMapping).where(
                TemplateSnapshotLegacyMapping.owner_scope == payload["owner_scope"],
                TemplateSnapshotLegacyMapping.legacy_owner_id == payload["legacy_owner_id"],
            )
        )
        mapping = result.scalar_one_or_none()
        if mapping:
            mapping.organization_id = organization_id
            mapping.project_id = project_id
            mapping.created_by = payload.get("created_by")
        else:
            mapping = TemplateSnapshotLegacyMapping(
                owner_scope=payload["owner_scope"],
                legacy_owner_id=payload["legacy_owner_id"],
                organization_id=organization_id,
                project_id=project_id,
                created_by=payload.get("created_by"),
            )
            self.db.add(mapping)
        await self.db.commit()
        await self.db.refresh(mapping)
        return {
            "owner_scope": mapping.owner_scope,
            "legacy_owner_id": mapping.legacy_owner_id,
            "organization_id": mapping.organization_id,
            "project_id": mapping.project_id,
        }

    async def resolve_legacy_mapping(self, owner_scope: str, legacy_owner_id: str | None) -> TemplateSnapshotLegacyMapping | None:
        if not legacy_owner_id:
            return None
        result = await self.db.execute(
            select(TemplateSnapshotLegacyMapping).where(
                TemplateSnapshotLegacyMapping.owner_scope == owner_scope,
                TemplateSnapshotLegacyMapping.legacy_owner_id == legacy_owner_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_legacy_mappings(self, *, limit: int = 200) -> list[dict[str, Any]]:
        mappings = (
            await self.db.execute(
                select(TemplateSnapshotLegacyMapping)
                .order_by(TemplateSnapshotLegacyMapping.created_at.desc(), TemplateSnapshotLegacyMapping.id.desc())
                .limit(limit)
            )
        ).scalars().all()
        return [
            {
                "owner_scope": mapping.owner_scope,
                "legacy_owner_id": mapping.legacy_owner_id,
                "organization_id": mapping.organization_id,
                "project_id": mapping.project_id,
                "created_at": mapping.created_at,
            }
            for mapping in mappings
        ]

    async def list_unmapped_resources(self, *, limit: int = 200) -> list[dict[str, Any]]:
        """List only records whose tenant binding cannot be established safely."""
        templates = (
            await self.db.execute(
                select(TemplateSnapshotTemplate)
                .where(TemplateSnapshotTemplate.organization_id.is_(None), TemplateSnapshotTemplate.project_id.is_(None))
                .order_by(TemplateSnapshotTemplate.updated_at.desc())
                .limit(limit)
            )
        ).scalars().all()
        instances = (
            await self.db.execute(
                select(TemplateSnapshotInstance)
                .where(TemplateSnapshotInstance.organization_id.is_(None), TemplateSnapshotInstance.project_id.is_(None))
                .order_by(TemplateSnapshotInstance.updated_at.desc())
                .limit(limit)
            )
        ).scalars().all()
        known_mappings = {
            (mapping.owner_scope, mapping.legacy_owner_id)
            for mapping in (await self.db.execute(select(TemplateSnapshotLegacyMapping))).scalars().all()
        }
        resources = [
            {
                "resource_type": "template",
                "resource_id": template.template_id,
                "owner_scope": template.owner_scope,
                "owner_id": template.owner_id,
                "name": template.name,
                "created_at": template.created_at,
            }
            for template in templates
            if not template.owner_id or (template.owner_scope, template.owner_id) not in known_mappings
        ] + [
            {
                "resource_type": "instance",
                "resource_id": instance.instance_id,
                "owner_scope": instance.owner_scope,
                "owner_id": instance.owner_id,
                "name": instance.name,
                "created_at": instance.created_at,
            }
            for instance in instances
            if not instance.owner_id or (instance.owner_scope, instance.owner_id) not in known_mappings
        ]
        return resources[:limit]

    async def bind_unmapped_resource(
        self, *, resource_type: str, resource_id: str, organization_id: int | None, project_id: int | None
    ) -> dict[str, Any]:
        if bool(organization_id) == bool(project_id):
            raise ValueError("Snapshot binding requires exactly one of organization_id or project_id")
        if resource_type == "template":
            resource = await self._get_template(resource_id)
        elif resource_type == "instance":
            resource = await self._get_instance(resource_id)
        else:
            raise ValueError("Unknown snapshot resource type")
        if not resource:
            raise KeyError(f"Snapshot {resource_type} {resource_id} not found")
        if resource.organization_id is not None or resource.project_id is not None:
            raise ValueError("Snapshot already has a tenant binding")
        resource.organization_id = organization_id
        resource.project_id = project_id
        resource.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(resource)
        return {
            "resource_type": resource_type,
            "resource_id": resource_id,
            "organization_id": resource.organization_id,
            "project_id": resource.project_id,
        }

    async def _get_template(self, template_id: str) -> TemplateSnapshotTemplate | None:
        result = await self.db.execute(select(TemplateSnapshotTemplate).where(TemplateSnapshotTemplate.template_id == template_id))
        return result.scalar_one_or_none()

    async def _get_template_version_record(self, template_id: str, version: str | None) -> TemplateSnapshotVersion | None:
        if not version:
            return None
        result = await self.db.execute(
            select(TemplateSnapshotVersion).where(
                TemplateSnapshotVersion.template_id == template_id,
                TemplateSnapshotVersion.version == version,
                TemplateSnapshotVersion.review_status.in_(("published", "archived")),
            )
        )
        return result.scalar_one_or_none()

    async def _get_template_version_config(self, template_id: str, version: str | None) -> dict[str, Any] | None:
        snapshot = await self._get_template_version_record(template_id, version)
        return _load_json(snapshot.config_json) if snapshot else None

    async def _resolve_product_market_runtime_default(
        self,
        template: TemplateSnapshotTemplate,
    ) -> tuple[str | None, dict[str, Any]]:
        """Adapt the shared factory-default resolver to this service's dict form."""
        if template.owner_scope != "client_source":
            snapshot = await self._get_template_version_record(template.template_id, template.latest_version)
            return template.latest_version, _load_json(snapshot.config_json if snapshot else template.config_json)
        version, config_json = await resolve_product_market_runtime_default(self.db, template)
        return version, _load_json(config_json)

    async def _get_instance(
        self,
        instance_id: str,
        *,
        for_update: bool = False,
    ) -> TemplateSnapshotInstance | None:
        query = select(TemplateSnapshotInstance).where(TemplateSnapshotInstance.instance_id == instance_id)
        if for_update:
            query = query.with_for_update()
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    def _template_to_dict(template: TemplateSnapshotTemplate) -> dict[str, Any]:
        authoring_document = _load_template_authoring_document(
            template.draft_config_json or template.config_json
        )
        published_document = _load_template_authoring_document(template.config_json)
        return {
            "template_id": template.template_id,
            "template_type": template.template_type,
            "owner_scope": template.owner_scope,
            "owner_id": template.owner_id,
            "organization_id": template.organization_id,
            "project_id": template.project_id,
            "parent_template_id": template.parent_template_id,
            "name": template.name,
            "latest_version": template.latest_version,
            "factory_default_version": template.factory_default_version,
            "factory_default_release_batch_id": template.factory_default_release_batch_id,
            "factory_default_contract_version": template.factory_default_contract_version,
            "factory_default_promoted_at": template.factory_default_promoted_at,
            "factory_default_promoted_by": template.factory_default_promoted_by,
            "draft_config_json": _load_json(template.draft_config_json) if template.draft_config_json else None,
            "draft_config_hash": _template_document_hash(authoring_document),
            "published_config_hash": _template_document_hash(published_document),
            "config_json": _load_json(template.config_json),
            "is_published": template.is_published,
            "created_at": template.created_at,
            "updated_at": template.updated_at,
        }

    @staticmethod
    def _version_to_dict(version: TemplateSnapshotVersion) -> dict[str, Any]:
        return {
            "template_id": version.template_id,
            "version": version.version,
            "changelog": version.changelog,
            "config_json": _load_json(version.config_json),
            "release_sections": (
                load_template_version_release_sections(getattr(version, "release_sections_json", None)) or None
            ),
            "preflight_evidence_id": getattr(version, "preflight_evidence_id", None),
            "review_status": version.review_status,
            "review_note": version.review_note,
            "review_step": version.review_step,
            "required_review_steps": version.required_review_steps,
            "review_assignee": version.review_assignee,
            "review_due_at": version.review_due_at,
            "approved_by": version.approved_by,
            "approved_at": version.approved_at,
            "published_at": version.published_at,
            "published_by": version.published_by,
        }

    @staticmethod
    def _instance_to_dict(instance: TemplateSnapshotInstance) -> dict[str, Any]:
        return {
            "instance_id": instance.instance_id,
            "instance_type": instance.instance_type,
            "owner_scope": instance.owner_scope,
            "owner_id": instance.owner_id,
            "organization_id": instance.organization_id,
            "project_id": instance.project_id,
            "parent_id": instance.parent_id,
            "name": instance.name,
            "base_template_id": instance.base_template_id,
            "base_template_version": instance.base_template_version,
            "snapshot_config_json": _load_json(instance.snapshot_config_json),
            "override_config_json": _load_json(instance.override_config_json),
            "is_detached": instance.is_detached,
            "last_synced_at": instance.last_synced_at,
        }

    @staticmethod
    def _backup_to_dict(backup: TemplateSnapshotBackup) -> dict[str, Any]:
        return {
            "backup_id": backup.backup_id,
            "target_type": backup.target_type,
            "target_id": backup.target_id,
            "version": backup.version,
            "backup_kind": backup.backup_kind,
            "program_path": backup.program_path,
            "database_path": backup.database_path,
            "backup_path": backup.backup_path,
            "metadata_json": _load_json(backup.metadata_json),
            "created_by": backup.created_by,
            "created_at": backup.created_at,
            "updated_at": backup.updated_at,
        }
