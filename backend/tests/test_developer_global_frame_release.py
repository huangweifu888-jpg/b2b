from __future__ import annotations

import asyncio
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import importlib.util
import json
import os
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from models.template_snapshot import (
    DeveloperGlobalFrameAcceptanceArtifact,
    DeveloperGlobalFrameAcceptanceJob,
    DeveloperGlobalFrameAcceptanceJobEvent,
    DeveloperGlobalFrameAcceptanceWorkerNonce,
    DeveloperGlobalFrameFactoryDefaultReceipt,
    DeveloperGlobalFramePreflightEvidence,
    TemplateSnapshotBackup,
    TemplateSnapshotInstance,
    TemplateSnapshotReleaseBatch,
    TemplateSnapshotReleaseTarget,
    TemplateSnapshotTemplate,
    TemplateSnapshotVersion,
)
from schemas.developer_global_frame import (
    CANONICAL_REGIONS,
    PILOT_CHECKS,
    PROTECTED_OWNERSHIP,
)
from schemas.template_snapshot import (
    DeveloperGlobalFrameAcceptanceArtifactCreateRequest,
    DeveloperGlobalFrameAcceptanceJobResponse,
    DeveloperGlobalFrameAcceptanceWorkerClaimNextRequest,
    DeveloperGlobalFrameDraftMergeRequest,
    DeveloperGlobalFrameFactoryDefaultReceiptRequest,
    DeveloperGlobalFramePreflightEvidenceInput,
    InstanceSyncLatestRequest,
    TemplatePublishRequest,
)
from services.developer_global_frame import (
    assert_developer_global_frame_publish_version,
    normalize_developer_global_frame_document,
)
from services.template_release_batches import TemplateReleaseBatchService, _normalize_release_sections
from services.template_snapshot import (
    TemplateSnapshotService,
    _acceptance_report_hash,
    _acceptance_signature,
    _acceptance_worker_action_hash,
    _acceptance_worker_claim_next_hash,
    _factory_default_receipt_hash,
    _preflight_evidence_hash,
    _template_document_hash,
)


def _frame(profile_version: str, *, workspace_background: str = "#ffffff") -> dict:
    reference = "product-market:operations"
    pilot = "client-source:social:marketing-playbook"
    consumer = "client-source:product-analysis:overview"
    return {
        "contract_version": "1.0.0",
        "profile_version": profile_version,
        "scope": "appearance-only",
        "source_scope": "client_source",
        "reference_page_id": reference,
        "regions": list(CANONICAL_REGIONS),
        "region_tokens": {
            "workspace": {
                "background_color": workspace_background,
                "padding_right": "0px",
                "scrollbar_gutter": "auto",
                "annotation_visible": True,
            },
            "table-shell": {
                "padding_right": "12px",
                "scrollbar_gutter": "stable",
                "annotation_visible": True,
            },
        },
        "protected_ownership": list(PROTECTED_OWNERSHIP),
        "adapters": [
            {
                "page_id": reference,
                "role": "reference",
                "reads_profile_version": profile_version,
                "owns_structure": True,
                "allowed_overrides": [],
            },
            {
                "page_id": pilot,
                "role": "pilot",
                "reads_profile_version": profile_version,
                "owns_structure": True,
                "allowed_overrides": [],
            },
            {
                "page_id": consumer,
                "role": "consumer",
                "reads_profile_version": profile_version,
                "owns_structure": True,
                "allowed_overrides": [],
            },
        ],
        "target_matrix_complete": True,
        "target_matrix": [
            {
                "page_id": reference,
                "source_scope": "client_source",
                "adapter_role": "reference",
                "reads_profile_version": profile_version,
                "compatibility": "compatible",
            },
            {
                "page_id": pilot,
                "source_scope": "client_source",
                "adapter_role": "pilot",
                "reads_profile_version": profile_version,
                "compatibility": "compatible",
            },
            {
                "page_id": consumer,
                "source_scope": "client_source",
                "adapter_role": "consumer",
                "reads_profile_version": profile_version,
                "compatibility": "compatible",
            },
        ],
        "recovery": {
            "draft_id": f"draft-{profile_version}",
            "recovery_point_id": f"recovery-{profile_version}",
            "visual_audit_id": f"audit-{profile_version}",
        },
        "pilot": {
            "page_id": pilot,
            "status": "passed",
            "checks": list(PILOT_CHECKS),
            "verification_id": f"verify-{profile_version}",
            "verified_at": "2026-08-21T08:00:00Z",
        },
    }


_ACCEPTANCE_DEPLOYMENT_HASHES = {
    "page_registry_hash": "1" * 64,
    "adapter_registry_hash": "2" * 64,
    "isolation_policy_hash": "3" * 64,
    "test_spec_hash": "4" * 64,
    "source_build_digest": "5" * 64,
}
_ACCEPTANCE_KEY_ID = "test-ci-key"
_ACCEPTANCE_ISSUER = "test-ci"
_ACCEPTANCE_SECRET = "test-only-trusted-runner-secret-32-bytes"


def _configure_acceptance_environment() -> None:
    os.environ["DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_HMAC_KEYS"] = json.dumps(
        {_ACCEPTANCE_KEY_ID: {"issuer": _ACCEPTANCE_ISSUER, "secret": _ACCEPTANCE_SECRET}}
    )
    environment_by_field = {
        "page_registry_hash": "DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_PAGE_REGISTRY_HASH",
        "adapter_registry_hash": "DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_ADAPTER_REGISTRY_HASH",
        "isolation_policy_hash": "DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_ISOLATION_POLICY_HASH",
        "test_spec_hash": "DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_TEST_SPEC_HASH",
        "source_build_digest": "DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_SOURCE_BUILD_DIGEST",
    }
    for field, environment_name in environment_by_field.items():
        os.environ[environment_name] = _ACCEPTANCE_DEPLOYMENT_HASHES[field]


def _global_frame(profile_version: str, *, workspace_background: str = "#ffffff") -> dict:
    frame = _frame(profile_version, workspace_background=workspace_background)
    reference = frame["reference_page_id"]
    pilot = frame["pilot"]["page_id"]
    hq_pages = [f"hq:acceptance:{index:03d}" for index in range(66)]
    agency_pages = [f"agency-source:acceptance:{index:03d}" for index in range(33)]
    client_compatible = [reference, pilot, "client-source:product-analysis:overview"] + [
        f"client-source:acceptance:{index:03d}" for index in range(94)
    ]
    client_isolated = [f"client-source:acceptance:isolated:{index:03d}" for index in range(5)]
    page_scopes = (
        [(page_id, "hq", "compatible") for page_id in hq_pages]
        + [(page_id, "agency_source", "compatible") for page_id in agency_pages]
        + [(page_id, "client_source", "compatible") for page_id in client_compatible]
        + [(page_id, "client_source", "isolated") for page_id in client_isolated]
    )
    frame["adapters"] = [
        {
            "page_id": page_id,
            "role": "reference" if page_id == reference else "pilot" if page_id == pilot else "consumer",
            "reads_profile_version": profile_version,
            "owns_structure": True,
            "allowed_overrides": [],
        }
        for page_id, _source_scope, _compatibility in page_scopes
    ]
    frame["target_matrix"] = [
        {
            "page_id": page_id,
            "source_scope": source_scope,
            "adapter_role": "reference" if page_id == reference else "pilot" if page_id == pilot else "consumer",
            "reads_profile_version": profile_version,
            "compatibility": compatibility,
        }
        for page_id, source_scope, compatibility in page_scopes
    ]
    return frame


def _acceptance_payload(
    template_id: str,
    base_draft_hash: str,
    frame: dict,
    acceptance_job_id: str,
    *,
    issued_at: datetime | None = None,
) -> dict:
    _configure_acceptance_environment()
    issued_at = issued_at or datetime.now(timezone.utc)
    compatible = [
        target["page_id"] for target in frame["target_matrix"] if target["compatibility"] == "compatible"
    ]
    isolated = [
        target["page_id"] for target in frame["target_matrix"] if target["compatibility"] == "isolated"
    ]
    cases = [
        {
            "page_id": target["page_id"],
            "source_scope": target["source_scope"],
            "viewport": viewport,
            "outcome": "passed" if target["compatibility"] == "compatible" else "isolated",
        }
        for target in frame["target_matrix"]
        for viewport in (1440, 1024, 390)
    ]
    payload = {
        "schema_version": 1,
        "run_id": f"run-{template_id}-{frame['profile_version']}-{base_draft_hash[:12]}",
        "issuer": _ACCEPTANCE_ISSUER,
        "key_id": _ACCEPTANCE_KEY_ID,
        "template_id": template_id,
        "source_scope": "client_source",
        "acceptance_job_id": acceptance_job_id,
        "base_draft_hash": base_draft_hash,
        "frame_section_hash": _template_document_hash(frame),
        "visual_draft_id": frame["recovery"]["draft_id"],
        "recovery_point_id": frame["recovery"]["recovery_point_id"],
        **_ACCEPTANCE_DEPLOYMENT_HASHES,
        "issued_at": issued_at,
        "expires_at": issued_at + timedelta(minutes=20),
        "viewports": [1440, 1024, 390],
        "compatible_target_page_ids": compatible,
        "isolated_page_ids": isolated,
        "case_results": cases,
        "failure_count": 0,
        "flaky_count": 0,
        "skipped_count": 0,
    }
    payload["report_hash"] = _acceptance_report_hash(payload)
    payload["signature"] = _acceptance_signature(payload["report_hash"], _ACCEPTANCE_SECRET)
    return payload


def _acceptance_worker_proof(
    action: str,
    template_id: str,
    acceptance_job_id: str,
    *,
    issued_at: datetime | None = None,
    nonce: str | None = None,
    error_code: str | None = None,
    error_message: str | None = None,
    issuer: str = _ACCEPTANCE_ISSUER,
    key_id: str = _ACCEPTANCE_KEY_ID,
    secret: str = _ACCEPTANCE_SECRET,
) -> dict:
    _configure_acceptance_environment()
    payload = {
        "issuer": issuer,
        "key_id": key_id,
        "issued_at": issued_at or datetime.now(timezone.utc),
        "nonce": nonce or f"worker-{uuid4()}",
    }
    if action == "fail":
        payload["error_code"] = error_code or "runner.failed"
        payload["error_message"] = error_message or "trusted runner failed"
    action_hash = _acceptance_worker_action_hash(action, template_id, acceptance_job_id, payload)
    payload["signature"] = _acceptance_signature(action_hash, secret)
    return payload


def _acceptance_worker_claim_next_proof(
    *,
    issued_at: datetime | None = None,
    nonce: str | None = None,
    issuer: str = _ACCEPTANCE_ISSUER,
    key_id: str = _ACCEPTANCE_KEY_ID,
    secret: str = _ACCEPTANCE_SECRET,
) -> dict:
    _configure_acceptance_environment()
    payload = {
        "source_scope": "client_source",
        "issuer": issuer,
        "key_id": key_id,
        "issued_at": issued_at or datetime.now(timezone.utc),
        "nonce": nonce or f"worker-next-{uuid4()}",
    }
    action_hash = _acceptance_worker_claim_next_hash(payload)
    payload["signature"] = _acceptance_signature(action_hash, secret)
    return payload


def test_trusted_acceptance_wire_models_parse_canonical_json_datetimes():
    """Strict trusted payloads must still be usable over a real JSON transport."""

    issued_at = datetime(2026, 8, 23, 8, 0, tzinfo=timezone.utc)
    claim_payload = _acceptance_worker_claim_next_proof(issued_at=issued_at)
    parsed_claim = DeveloperGlobalFrameAcceptanceWorkerClaimNextRequest.model_validate_json(
        json.dumps(claim_payload, default=lambda value: value.isoformat().replace("+00:00", "Z"))
    )
    assert parsed_claim.issued_at == issued_at

    frame = _global_frame("wire-json")
    acceptance_payload = _acceptance_payload(
        "client-source-wire-json",
        "a" * 64,
        frame,
        str(uuid4()),
        issued_at=issued_at,
    )
    parsed_acceptance = DeveloperGlobalFrameAcceptanceArtifactCreateRequest.model_validate_json(
        json.dumps(
            acceptance_payload,
            default=lambda value: value.isoformat().replace("+00:00", "Z"),
        )
    )
    assert parsed_acceptance.issued_at == issued_at
    assert parsed_acceptance.expires_at == issued_at + timedelta(minutes=20)

    preflight_payload = _preflight_payload(frame, "b" * 64)
    parsed_preflight = DeveloperGlobalFramePreflightEvidenceInput.model_validate_json(
        json.dumps(preflight_payload)
    )
    assert parsed_preflight.checked_at == issued_at


def test_acceptance_job_response_preserves_the_exact_frozen_section_when_excluding_unset():
    frame = _global_frame("1.2.3-response-exact")
    now = datetime(2026, 8, 23, 8, 0, tzinfo=timezone.utc)
    response = DeveloperGlobalFrameAcceptanceJobResponse.model_validate(
        {
            "acceptance_job_id": str(uuid4()),
            "schema_version": 1,
            "template_id": "client-source-response-exact",
            "source_scope": "client_source",
            "base_draft_hash": "a" * 64,
            "frame_section_hash": _template_document_hash(frame),
            "visual_draft_id": frame["recovery"]["draft_id"],
            "recovery_point_id": frame["recovery"]["recovery_point_id"],
            "developer_global_frame": frame,
            **_ACCEPTANCE_DEPLOYMENT_HASHES,
            "status": "pending",
            "attempt_count": 0,
            "max_attempts": 3,
            "expires_at": now + timedelta(hours=2),
            "created_at": now,
            "updated_at": now,
        }
    )

    serialized = response.model_dump(mode="json", exclude_unset=True)
    assert serialized["developer_global_frame"] == frame
    assert _template_document_hash(serialized["developer_global_frame"]) == _template_document_hash(frame)


def test_acceptance_job_wire_times_restore_utc_after_sqlite_drops_timezone():
    frame = _global_frame("1.2.3-wire-utc")
    naive_utc = datetime(2026, 8, 23, 8, 0)
    job = SimpleNamespace(
        id=str(uuid4()),
        schema_version=1,
        template_id="client-source-wire-utc",
        source_scope="client_source",
        base_draft_hash="a" * 64,
        frame_section_hash=_template_document_hash(frame),
        visual_draft_id=frame["recovery"]["draft_id"],
        recovery_point_id=frame["recovery"]["recovery_point_id"],
        frame_section_json=json.dumps(frame, ensure_ascii=False),
        **_ACCEPTANCE_DEPLOYMENT_HASHES,
        status="running",
        attempt_count=1,
        max_attempts=3,
        worker_issuer="trusted-worker",
        worker_key_id="trusted-key",
        claimed_at=naive_utc,
        lease_expires_at=naive_utc + timedelta(minutes=10),
        acceptance_artifact_id=None,
        report_hash=None,
        last_error_code=None,
        last_error_message=None,
        expires_at=naive_utc + timedelta(hours=2),
        completed_at=None,
        created_at=naive_utc,
        updated_at=naive_utc,
    )

    wire = TemplateSnapshotService._acceptance_job_to_dict(job)
    for field in ("claimed_at", "lease_expires_at", "expires_at", "created_at", "updated_at"):
        assert wire[field].tzinfo == timezone.utc
        assert wire[field].utcoffset() == timedelta(0)


async def _create_claimed_acceptance_job(
    service: TemplateSnapshotService,
    template_id: str,
    base_draft_hash: str,
    frame: dict,
    *,
    requested_by: str = "test-user",
) -> dict:
    _configure_acceptance_environment()
    job = await service.create_developer_global_frame_acceptance_job(
        template_id,
        {
            "base_draft_hash": base_draft_hash,
            "frame_section_hash": _template_document_hash(frame),
            "visual_draft_id": frame["recovery"]["draft_id"],
            "recovery_point_id": frame["recovery"]["recovery_point_id"],
            "developer_global_frame": frame,
        },
        requested_by=requested_by,
    )
    return await service.claim_developer_global_frame_acceptance_job(
        template_id,
        job["acceptance_job_id"],
        _acceptance_worker_proof("claim", template_id, job["acceptance_job_id"]),
    )


async def _trusted_preflight_payload(
    service: TemplateSnapshotService,
    template_id: str,
    base_draft_hash: str,
    frame: dict,
    artifact_hash: str,
) -> dict:
    job = await _create_claimed_acceptance_job(service, template_id, base_draft_hash, frame)
    acceptance = await service.register_developer_global_frame_acceptance_artifact(
        _acceptance_payload(
            template_id,
            base_draft_hash,
            frame,
            job["acceptance_job_id"],
        )
    )
    return {
        "artifact_hash": artifact_hash,
        "acceptance_artifact_id": acceptance["acceptance_artifact_id"],
        "acceptance_artifact_hash": acceptance["report_hash"],
        "visual_draft_id": acceptance["visual_draft_id"],
        "compatible_target_page_ids": acceptance["compatible_target_page_ids"],
        "isolated_page_ids": acceptance["isolated_page_ids"],
        "recovery_point_id": acceptance["recovery_point_id"],
        "checked_at": acceptance["issued_at"],
    }


async def _attach_trusted_version_attestation(
    db,
    service: TemplateSnapshotService,
    template: TemplateSnapshotTemplate,
    version: TemplateSnapshotVersion,
    frame: dict,
    *,
    base_draft_hash: str,
    saved_draft_hash: str,
    artifact_hash: str,
) -> DeveloperGlobalFramePreflightEvidence:
    preflight = await _trusted_preflight_payload(
        service,
        template.template_id,
        base_draft_hash,
        frame,
        artifact_hash,
    )
    evidence_values = {
        "template_id": template.template_id,
        "source_scope": template.owner_scope,
        "base_draft_hash": base_draft_hash,
        "saved_draft_hash": saved_draft_hash,
        **preflight,
    }
    evidence = DeveloperGlobalFramePreflightEvidence(
        id=f"evidence-{artifact_hash[:12]}-{version.version}",
        template_id=template.template_id,
        source_scope=template.owner_scope,
        base_draft_hash=base_draft_hash,
        saved_draft_hash=saved_draft_hash,
        artifact_hash=artifact_hash,
        acceptance_artifact_id=preflight["acceptance_artifact_id"],
        acceptance_artifact_hash=preflight["acceptance_artifact_hash"],
        visual_draft_id=preflight["visual_draft_id"],
        compatible_target_page_ids_json=json.dumps(preflight["compatible_target_page_ids"]),
        isolated_page_ids_json=json.dumps(preflight["isolated_page_ids"]),
        recovery_point_id=preflight["recovery_point_id"],
        checked_at=preflight["checked_at"],
        evidence_hash=_preflight_evidence_hash(evidence_values),
        created_at=preflight["checked_at"],
    )
    db.add(evidence)
    version.preflight_evidence_id = evidence.id
    await db.commit()
    return evidence


def _preflight_payload(frame: dict, artifact_hash: str) -> dict:
    return {
        "artifact_hash": artifact_hash,
        "compatible_target_page_ids": [
            target["page_id"]
            for target in frame["target_matrix"]
            if target["compatibility"] == "compatible"
        ],
        "isolated_page_ids": [
            target["page_id"]
            for target in frame["target_matrix"]
            if target["compatibility"] == "isolated"
        ],
        "recovery_point_id": frame["recovery"]["recovery_point_id"],
        "checked_at": "2026-08-23T08:00:00Z",
    }


def _load_template_version_release_sections_migration():
    path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "c28f7d5a9e31_template_version_release_sections.py"
    )
    spec = importlib.util.spec_from_file_location("template_version_release_sections", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_developer_global_frame_preflight_evidence_migration():
    path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "e31a7c9d4b20_developer_global_frame_preflight_evidence.py"
    )
    spec = importlib.util.spec_from_file_location("developer_global_frame_preflight_evidence", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_developer_global_frame_factory_default_migration():
    path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "f42b8d6a0c31_developer_global_frame_factory_default_receipts.py"
    )
    spec = importlib.util.spec_from_file_location("developer_global_frame_factory_default_receipts", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_developer_global_frame_acceptance_artifact_migration():
    path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "a71d9e4c2f60_developer_global_frame_acceptance_artifacts.py"
    )
    spec = importlib.util.spec_from_file_location("developer_global_frame_acceptance_artifacts", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_developer_global_frame_acceptance_job_migration():
    path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "b82e0f5d3a71_developer_global_frame_acceptance_jobs.py"
    )
    spec = importlib.util.spec_from_file_location("developer_global_frame_acceptance_jobs", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _resign_acceptance_payload(payload: dict) -> dict:
    payload["report_hash"] = _acceptance_report_hash(payload)
    payload["signature"] = _acceptance_signature(payload["report_hash"], _ACCEPTANCE_SECRET)
    return payload


def test_developer_global_frame_normalizes_only_the_appearance_section():
    config = {
        "developer_global_frame": _frame("1.0.0"),
        "business_owned_peer": {"orders": ["must remain outside the shared section"]},
    }

    normalized = normalize_developer_global_frame_document(config, owner_scope="client_source")

    assert normalized["developer_global_frame"]["scope"] == "appearance-only"
    assert normalized["developer_global_frame"]["target_matrix_complete"] is True
    assert normalized["business_owned_peer"] == config["business_owned_peer"]


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda value: value.update({"plugins": ["unsafe"]}), "Extra inputs are not permitted"),
        (lambda value: value.update({"dom": "<main />"}), "Extra inputs are not permitted"),
        (
            lambda value: value["region_tokens"]["workspace"].update({"background_color": "url(https://asset.invalid/x.png)"}),
            "URLs, markup, selectors, or executable CSS",
        ),
        (
            lambda value: value["target_matrix"][1].update({"source_scope": "agency_source"}),
            "cannot cross source scopes",
        ),
        (
            lambda value: value["target_matrix"][0].update({"compatibility": "isolated"}),
            "foundation targets must remain compatible",
        ),
        (
            lambda value: value["target_matrix"][1].update({"compatibility": "isolated"}),
            "foundation targets must remain compatible",
        ),
        (lambda value: value["pilot"].update({"checks": list(PILOT_CHECKS[:-1])}), "at least 4 items"),
    ],
)
def test_developer_global_frame_rejects_non_appearance_or_incomplete_contracts(mutate, message):
    frame = _frame("1.0.0")
    mutate(frame)

    with pytest.raises(ValueError, match=message):
        normalize_developer_global_frame_document(
            {"developer_global_frame": frame},
            owner_scope="client_source",
        )


def test_developer_global_frame_is_source_scoped_and_version_bound():
    config = {"developer_global_frame": _frame("1.0.0")}

    with pytest.raises(ValueError, match="does not match template owner_scope"):
        normalize_developer_global_frame_document(config, owner_scope="agency_source")
    with pytest.raises(ValueError, match="must equal the immutable template publish version"):
        assert_developer_global_frame_publish_version(config, version="1.0.1")


def test_release_batch_allows_only_the_global_frame_as_a_partial_section():
    assert _normalize_release_sections(None) == []
    assert _normalize_release_sections(["developer_global_frame"]) == ["developer_global_frame"]
    for unsafe in ([], [""], ["layout"], ["transactions"], ["developer_global_frame", "layout"], ["developer_global_frame", "developer_global_frame"]):
        with pytest.raises(ValueError, match="developer_global_frame"):
            _normalize_release_sections(unsafe)


def test_direct_sync_schema_rejects_arbitrary_or_empty_partial_sections():
    assert InstanceSyncLatestRequest(sections=["developer_global_frame"]).sections == ["developer_global_frame"]
    for unsafe in ([], ["layout"], ["transactions"], ["developer_global_frame", "layout"]):
        with pytest.raises(ValueError):
            InstanceSyncLatestRequest(sections=unsafe)


def test_publish_schema_accepts_only_the_global_frame_required_section():
    payload = TemplatePublishRequest(
        version="1.1.0",
        requires_approval=True,
        required_sections=["developer_global_frame"],
        expected_draft_config_hash="a" * 64,
        expected_preflight_artifact_hash="b" * 64,
    )
    assert payload.required_sections == ["developer_global_frame"]
    assert payload.expected_draft_config_hash == "a" * 64
    assert payload.expected_preflight_artifact_hash == "b" * 64
    for unsafe in (
        [],
        [""],
        ["layout"],
        ["developer_global_frame", "layout"],
        ["developer_global_frame", "developer_global_frame"],
    ):
        with pytest.raises(ValidationError):
            TemplatePublishRequest(
                version="1.1.0",
                requires_approval=True,
                required_sections=unsafe,
            )
    for unsafe_hash in ("", "not-a-hash", "A" * 64, "0" * 63):
        with pytest.raises(ValidationError):
            TemplatePublishRequest(
                version="1.1.0",
                requires_approval=True,
                required_sections=["developer_global_frame"],
                expected_draft_config_hash=unsafe_hash,
            )


def test_template_version_release_sections_migration_downgrade_is_fail_closed(monkeypatch):
    module = _load_template_version_release_sections_migration()
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE template_snapshot_versions (release_sections_json TEXT)"))
        connection.execute(
            text(
                "INSERT INTO template_snapshot_versions(release_sections_json) "
                "VALUES ('[\"developer_global_frame\"]')"
            )
        )
        monkeypatch.setattr(module.op, "get_bind", lambda: connection)
        dropped: list[tuple] = []
        monkeypatch.setattr(module.op, "drop_column", lambda *args, **kwargs: dropped.append((args, kwargs)))

        with pytest.raises(RuntimeError, match="section-only history exists"):
            module.downgrade()
        assert dropped == []

        connection.execute(text("UPDATE template_snapshot_versions SET release_sections_json = NULL"))
        module.downgrade()
        assert dropped == [(('template_snapshot_versions', 'release_sections_json'), {})]
    engine.dispose()


def test_required_global_frame_publish_is_review_only_version_bound_and_never_batches():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            published = {
                "developer_global_frame": _global_frame("1.0.0", workspace_background="#ffffff"),
                "layout": {"title": "published title"},
            }
            authoring_draft = {
                "developer_global_frame": _global_frame("1.1.0", workspace_background="#f5e7ee"),
                "layout": {"title": "preserved draft sibling"},
            }
            template = TemplateSnapshotTemplate(
                template_id="client-source-global",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source global",
                latest_version="1.0.0",
                is_published=True,
                config_json=json.dumps(published),
                draft_config_json=json.dumps(authoring_draft),
            )
            missing_section = TemplateSnapshotTemplate(
                template_id="client-source-missing-frame",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source missing frame",
                latest_version="1.0.0",
                is_published=True,
                config_json=json.dumps({"layout": {"title": "published"}}),
                draft_config_json=json.dumps({"layout": {"title": "draft"}}),
            )
            db.add_all(
                [
                    template,
                    missing_section,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="1.0.0",
                        config_json=json.dumps(published),
                        review_status="published",
                    ),
                ]
            )
            await db.commit()

            service = TemplateSnapshotService(db)
            current_draft_hash = (await service.get_template(template.template_id))["draft_config_hash"]
            missing_section_draft_hash = (await service.get_template(missing_section.template_id))["draft_config_hash"]
            artifact_hash = "a" * 64
            sealed = await service.merge_developer_global_frame_draft(
                template.template_id,
                expected_binding=("client_source", None, None, None),
                base_draft_hash=current_draft_hash,
                developer_global_frame=authoring_draft["developer_global_frame"],
                preflight_evidence=await _trusted_preflight_payload(
                    service,
                    template.template_id,
                    current_draft_hash,
                    authoring_draft["developer_global_frame"],
                    artifact_hash,
                ),
            )
            current_draft_hash = sealed["draft_config_hash"]
            sealed_template = await service.get_template(template.template_id)
            assert sealed_template["published_config_hash"] != current_draft_hash

            with pytest.raises(ValueError, match="requires exactly two independent reviews"):
                await service.publish_template(
                    template.template_id,
                    {
                        "version": "1.1.0",
                        "requires_approval": True,
                        "required_review_steps": 1,
                        "required_sections": ["developer_global_frame"],
                        "expected_draft_config_hash": current_draft_hash,
                        "expected_preflight_artifact_hash": artifact_hash,
                    },
                )
            submitted = await service.publish_template(
                template.template_id,
                {
                    "version": "1.1.0",
                    "changelog": "developer_global_frame 1.1.0",
                    "requires_approval": True,
                    "required_review_steps": 2,
                    "required_sections": ["developer_global_frame"],
                    "expected_draft_config_hash": current_draft_hash,
                    "expected_preflight_artifact_hash": artifact_hash,
                },
            )

            await db.refresh(template)
            assert submitted["version"] == authoring_draft["developer_global_frame"]["profile_version"]
            assert submitted["release_sections"] == ["developer_global_frame"]
            assert submitted["review_status"] == "pending_review"
            assert submitted["required_review_steps"] == 2
            assert template.latest_version == "1.0.0"
            assert template.is_published is True
            assert json.loads(template.config_json) == published
            assert json.loads(template.draft_config_json) == authoring_draft
            version_rows = (await db.execute(select(TemplateSnapshotVersion))).scalars().all()
            assert len(version_rows) == 2
            pending_row = next(item for item in version_rows if item.version == "1.1.0")
            assert json.loads(pending_row.release_sections_json) == ["developer_global_frame"]
            assert (await db.execute(select(TemplateSnapshotReleaseBatch))).scalars().all() == []

            with pytest.raises(ValueError, match="must be submitted for approval"):
                await service.publish_template(
                    template.template_id,
                    {
                        "version": "1.1.0",
                        "requires_approval": False,
                        "required_sections": ["developer_global_frame"],
                    },
                )
            with pytest.raises(ValueError, match="requires expected_draft_config_hash"):
                await service.publish_template(
                    template.template_id,
                    {
                        "version": "1.1.0",
                        "requires_approval": True,
                        "required_review_steps": 2,
                        "required_sections": ["developer_global_frame"],
                    },
                )
            with pytest.raises(ValueError, match="requires expected_preflight_artifact_hash"):
                await service.publish_template(
                    template.template_id,
                    {
                        "version": "1.1.0",
                        "requires_approval": True,
                        "required_review_steps": 2,
                        "required_sections": ["developer_global_frame"],
                        "expected_draft_config_hash": current_draft_hash,
                    },
                )
            with pytest.raises(ValueError, match="no durable preflight evidence"):
                await service.publish_template(
                    template.template_id,
                    {
                        "version": "1.1.0",
                        "requires_approval": True,
                        "required_review_steps": 2,
                        "required_sections": ["developer_global_frame"],
                        "expected_draft_config_hash": current_draft_hash,
                        "expected_preflight_artifact_hash": "f" * 64,
                    },
                )
            with pytest.raises(ValueError, match="draft changed before developer_global_frame review submission"):
                await service.publish_template(
                    template.template_id,
                    {
                        "version": "1.1.0",
                        "requires_approval": True,
                        "required_review_steps": 2,
                        "required_sections": ["developer_global_frame"],
                        "expected_draft_config_hash": "0" * 64,
                    },
                )
            with pytest.raises(ValueError, match="does not contain required developer_global_frame"):
                await service.publish_template(
                    missing_section.template_id,
                    {
                        "version": "1.1.0",
                        "requires_approval": True,
                        "required_review_steps": 2,
                        "required_sections": ["developer_global_frame"],
                        "expected_draft_config_hash": missing_section_draft_hash,
                    },
                )
            with pytest.raises(ValueError, match="must equal the immutable template publish version"):
                await service.publish_template(
                    template.template_id,
                    {
                        "version": "1.2.0",
                        "requires_approval": True,
                        "required_review_steps": 2,
                        "required_sections": ["developer_global_frame"],
                        "expected_draft_config_hash": current_draft_hash,
                        "expected_preflight_artifact_hash": artifact_hash,
                    },
                )

            assert len((await db.execute(select(TemplateSnapshotVersion))).scalars().all()) == 2
            assert (await db.execute(select(TemplateSnapshotReleaseBatch))).scalars().all() == []
        await engine.dispose()

    asyncio.run(scenario())


def test_two_reviews_promote_only_the_frame_and_preserve_live_and_concurrent_draft_siblings():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            live = {
                "developer_global_frame": _global_frame("1.0.0", workspace_background="#ffffff"),
                "layout": {"title": "released sibling must stay"},
                "live_only": {"value": "must stay live"},
            }
            submitted_draft = {
                "developer_global_frame": _global_frame("1.1.0", workspace_background="#f5e7ee"),
                "layout": {"title": "unrelated draft must not publish"},
                "draft_only": {"value": "must remain a draft"},
            }
            template = TemplateSnapshotTemplate(
                template_id="client-source-two-review-frame",
                template_type="hq-client",
                owner_scope="client_source",
                name="two review frame",
                latest_version="1.0.0",
                is_published=True,
                config_json=json.dumps(live),
                draft_config_json=json.dumps(submitted_draft),
            )
            instance = TemplateSnapshotInstance(
                instance_id="client-plan-two-review-frame",
                instance_type="client-plan",
                owner_scope="client",
                name="two review runtime",
                base_template_id=template.template_id,
                base_template_version="1.0.0",
                snapshot_config_json=json.dumps(live),
                override_config_json="{}",
            )
            db.add_all(
                [
                    template,
                    instance,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="1.0.0",
                        config_json=json.dumps(live),
                        review_status="published",
                    ),
                ]
            )
            await db.commit()

            service = TemplateSnapshotService(db)
            draft_hash = (await service.get_template(template.template_id))["draft_config_hash"]
            first_artifact_hash = "b" * 64
            first_sealed = await service.merge_developer_global_frame_draft(
                template.template_id,
                expected_binding=("client_source", None, None, None),
                base_draft_hash=draft_hash,
                developer_global_frame=submitted_draft["developer_global_frame"],
                preflight_evidence=await _trusted_preflight_payload(
                    service,
                    template.template_id,
                    draft_hash,
                    submitted_draft["developer_global_frame"],
                    first_artifact_hash,
                ),
            )
            draft_hash = first_sealed["draft_config_hash"]
            submitted = await service.publish_template(
                template.template_id,
                {
                    "version": "1.1.0",
                    "requires_approval": True,
                    "required_review_steps": 2,
                    "required_sections": ["developer_global_frame"],
                    "expected_draft_config_hash": draft_hash,
                    "expected_preflight_artifact_hash": first_artifact_hash,
                },
            )
            assert submitted["release_sections"] == ["developer_global_frame"]
            assert submitted["config_json"]["developer_global_frame"]["profile_version"] == "1.1.0"
            assert submitted["config_json"]["layout"] == live["layout"]
            assert submitted["config_json"]["live_only"] == live["live_only"]
            assert "draft_only" not in submitted["config_json"]

            first_review = await service.review_template_version(
                template.template_id,
                "1.1.0",
                action="approve",
                reviewer="reviewer:first",
            )
            await db.refresh(template)
            assert first_review["review_status"] == "pending_second_review"
            assert first_review["release_sections"] == ["developer_global_frame"]
            assert json.loads(template.config_json) == live
            assert json.loads(template.draft_config_json) == submitted_draft

            concurrent_draft = {
                "developer_global_frame": _global_frame("1.2.0", workspace_background="#dbeafe"),
                "layout": {"title": "concurrent unrelated draft"},
                "draft_only": {"value": "newer draft must survive"},
            }
            template.draft_config_json = json.dumps(concurrent_draft)
            await db.commit()

            second_review = await service.review_template_version(
                template.template_id,
                "1.1.0",
                action="approve",
                reviewer="reviewer:second",
            )
            await db.refresh(template)
            promoted_live = json.loads(template.config_json)
            preserved_draft = json.loads(template.draft_config_json)
            assert second_review["review_status"] == "published"
            assert second_review["release_sections"] == ["developer_global_frame"]
            assert promoted_live["developer_global_frame"]["profile_version"] == "1.1.0"
            assert promoted_live["developer_global_frame"]["region_tokens"]["workspace"]["background_color"] == "#f5e7ee"
            assert promoted_live["layout"] == live["layout"]
            assert promoted_live["live_only"] == live["live_only"]
            assert "draft_only" not in promoted_live
            assert preserved_draft == concurrent_draft
            assert template.latest_version == "1.1.0"
            assert template.is_published is True

            versions = (await db.execute(select(TemplateSnapshotVersion))).scalars().all()
            initial = next(item for item in versions if item.version == "1.0.0")
            partial = next(item for item in versions if item.version == "1.1.0")
            assert initial.review_status == "archived"
            assert partial.review_status == "published"
            assert json.loads(partial.release_sections_json) == ["developer_global_frame"]
            assert (await db.execute(select(TemplateSnapshotReleaseBatch))).scalars().all() == []

            with pytest.raises(ValueError, match="no longer reviewable"):
                await service.review_template_version(
                    template.template_id,
                    "1.1.0",
                    action="approve",
                    reviewer="reviewer:retry",
                )
            await db.refresh(template)
            assert json.loads(template.config_json) == promoted_live
            assert json.loads(template.draft_config_json) == concurrent_draft

            with pytest.raises(ValueError, match="may sync only its persisted release sections"):
                await service.sync_latest(
                    instance.instance_id,
                    {"template_version": "1.1.0", "create_backup": False},
                )
            with pytest.raises(ValueError, match="latest section-only template version requires"):
                await service.sync_latest(instance.instance_id, {"create_backup": False})
            with pytest.raises(ValueError, match="may restore only its persisted release section"):
                await service.restore_template(
                    instance.instance_id,
                    {"template_version": "1.1.0", "target": "all", "create_backup": False},
                )
            with pytest.raises(ValueError, match="latest section-only template version may restore only"):
                await service.restore_template(
                    instance.instance_id,
                    {"target": "all", "create_backup": False},
                )

            frame_sync = await service.sync_latest(
                instance.instance_id,
                {"sections": ["developer_global_frame"], "create_backup": False},
            )
            assert frame_sync["snapshot_config_json"]["developer_global_frame"]["profile_version"] == "1.1.0"
            assert frame_sync["snapshot_config_json"]["layout"] == live["layout"]
            frame_restore = await service.restore_template(
                instance.instance_id,
                {"template_version": "1.1.0", "target": "developer_global_frame", "create_backup": False},
            )
            assert frame_restore["snapshot_config_json"]["developer_global_frame"]["profile_version"] == "1.1.0"
            assert frame_restore["snapshot_config_json"]["layout"] == live["layout"]

            with pytest.raises(ValueError, match="requires the exact persisted release sections"):
                await TemplateReleaseBatchService(db).create(
                    template_id=template.template_id,
                    instance_ids=[instance.instance_id],
                    sections=None,
                    created_by="hq-test",
                )
            assert (await db.execute(select(TemplateSnapshotReleaseBatch))).scalars().all() == []

            next_hash = (await service.get_template(template.template_id))["draft_config_hash"]
            second_artifact_hash = "c" * 64
            second_sealed = await service.merge_developer_global_frame_draft(
                template.template_id,
                expected_binding=("client_source", None, None, None),
                base_draft_hash=next_hash,
                developer_global_frame=concurrent_draft["developer_global_frame"],
                preflight_evidence=await _trusted_preflight_payload(
                    service,
                    template.template_id,
                    next_hash,
                    concurrent_draft["developer_global_frame"],
                    second_artifact_hash,
                ),
            )
            next_hash = second_sealed["draft_config_hash"]
            await service.publish_template(
                template.template_id,
                {
                    "version": "1.2.0",
                    "requires_approval": True,
                    "required_review_steps": 2,
                    "required_sections": ["developer_global_frame"],
                    "expected_draft_config_hash": next_hash,
                    "expected_preflight_artifact_hash": second_artifact_hash,
                },
            )
            rejected = await service.review_template_version(
                template.template_id,
                "1.2.0",
                action="reject",
                reviewer="reviewer:reject",
                note="keep the newer draft unpublished",
            )
            await db.refresh(template)
            assert rejected["review_status"] == "rejected"
            assert rejected["release_sections"] == ["developer_global_frame"]
            assert json.loads(template.config_json) == promoted_live
            assert json.loads(template.draft_config_json) == concurrent_draft
            assert template.latest_version == "1.1.0"
            assert (await db.execute(select(TemplateSnapshotReleaseBatch))).scalars().all() == []

            history = await service.list_template_versions(template.template_id)
            assert next(item for item in history if item["version"] == "1.1.0")["release_sections"] == ["developer_global_frame"]
            assert next(item for item in history if item["version"] == "1.2.0")["release_sections"] == ["developer_global_frame"]
            assert next(item for item in history if item["version"] == "1.0.0")["release_sections"] is None
        await engine.dispose()

    asyncio.run(scenario())


def test_section_only_batch_is_version_pinned_and_preserves_business_sections():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            v1 = {
                "developer_global_frame": _global_frame("1.0.0", workspace_background="#fff"),
                "layout": {"title": "source-v1"},
            }
            v2 = {
                "developer_global_frame": _global_frame("2.0.0", workspace_background="#f5e7ee"),
                "layout": {"title": "source-v2-must-not-apply"},
            }
            v3 = {
                "developer_global_frame": _global_frame("3.0.0", workspace_background="#000"),
                "layout": {"title": "source-v3-must-not-apply"},
            }
            template = TemplateSnapshotTemplate(
                template_id="client-source-frame",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source frame",
                latest_version="2.0.0",
                is_published=True,
                config_json=json.dumps(v2),
            )
            instance = TemplateSnapshotInstance(
                instance_id="client-plan-frame",
                instance_type="client-plan",
                owner_scope="client",
                name="client plan",
                base_template_id=template.template_id,
                base_template_version="1.0.0",
                snapshot_config_json=json.dumps(
                    {
                        "developer_global_frame": v1["developer_global_frame"],
                        "layout": {"title": "tenant-owned-title"},
                        "orders": [{"id": "business-record-must-stay"}],
                    }
                ),
                override_config_json=json.dumps({"layout": {"title": "tenant-owned-title"}}),
            )
            published_v2 = TemplateSnapshotVersion(
                template_id=template.template_id,
                version="2.0.0",
                config_json=json.dumps(v2),
                release_sections_json='["developer_global_frame"]',
                review_status="published",
                review_step=2,
                required_review_steps=2,
                approved_by="reviewer-two",
                approved_at=datetime.now(timezone.utc),
            )
            db.add_all(
                [
                    template,
                    instance,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="1.0.0",
                        config_json=json.dumps(v1),
                        review_status="archived",
                    ),
                    published_v2,
                ]
            )
            await db.commit()

            service = TemplateReleaseBatchService(db)
            published_v2.required_review_steps = 1
            published_v2.review_step = 1
            await db.commit()
            with pytest.raises(ValueError, match="requires an exact two-review published version"):
                await service.create(
                    template_id=template.template_id,
                    instance_ids=[instance.instance_id],
                    sections=["developer_global_frame"],
                    created_by=None,
                )
            published_v2.required_review_steps = 2
            published_v2.review_step = 2
            await db.commit()
            await _attach_trusted_version_attestation(
                db,
                TemplateSnapshotService(db),
                template,
                published_v2,
                v2["developer_global_frame"],
                base_draft_hash=_template_document_hash(v2),
                saved_draft_hash=_template_document_hash(v2),
                artifact_hash="c" * 64,
            )
            created = await service.create(
                template_id=template.template_id,
                instance_ids=[instance.instance_id],
                sections=["developer_global_frame"],
                created_by=None,
            )
            assert created["template_version"] == "2.0.0"
            assert created["sections"] == ["developer_global_frame"]

            # A newer release may appear while this durable batch is queued.
            # Processing must still use the immutable version pinned above.
            template.latest_version = "3.0.0"
            template.config_json = json.dumps(v3)
            db.add(
                TemplateSnapshotVersion(
                    template_id=template.template_id,
                    version="3.0.0",
                    config_json=json.dumps(v3),
                    review_status="published",
                )
            )
            await db.commit()

            result = await service.process(created["id"])
            await db.refresh(instance)
            snapshot = json.loads(instance.snapshot_config_json)

            assert result["status"] == "completed"
            assert result["sections"] == ["developer_global_frame"]
            assert result["targets"][0]["result"]["template_version"] == "2.0.0"
            assert snapshot["developer_global_frame"]["profile_version"] == "2.0.0"
            assert snapshot["developer_global_frame"]["region_tokens"]["workspace"]["background_color"] == "#f5e7ee"
            assert snapshot["layout"]["title"] == "tenant-owned-title"
            assert snapshot["orders"] == [{"id": "business-record-must-stay"}]
            assert json.loads(instance.override_config_json) == {"layout": {"title": "tenant-owned-title"}}
            assert instance.base_template_version == "1.0.0"
            backups = (await db.execute(select(TemplateSnapshotBackup))).scalars().all()
            assert len(backups) == 1
            assert backups[0].backup_kind == "sync_latest_partial"
        await engine.dispose()

    asyncio.run(scenario())


def test_global_frame_restore_rolls_back_one_section_and_keeps_page_owned_state():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            v1 = {"developer_global_frame": _frame("1.0.0", workspace_background="#fff")}
            v2 = {"developer_global_frame": _frame("2.0.0", workspace_background="#f5e7ee")}
            template = TemplateSnapshotTemplate(
                template_id="client-source-frame-restore",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source frame",
                latest_version="2.0.0",
                is_published=True,
                config_json=json.dumps(v2),
            )
            instance = TemplateSnapshotInstance(
                instance_id="client-plan-frame-restore",
                instance_type="client-plan",
                owner_scope="client",
                name="client plan",
                base_template_id=template.template_id,
                base_template_version="2.0.0",
                snapshot_config_json=json.dumps(
                    {
                        "developer_global_frame": v2["developer_global_frame"],
                        "layout": {"title": "tenant-title"},
                        "navigation": {"items": ["tenant-owned"]},
                    }
                ),
                override_config_json=json.dumps({"layout": {"title": "tenant-title"}}),
            )
            db.add_all(
                [
                    template,
                    instance,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="1.0.0",
                        config_json=json.dumps(v1),
                        release_sections_json='["developer_global_frame"]',
                        review_status="archived",
                    ),
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="2.0.0",
                        config_json=json.dumps(v2),
                        review_status="published",
                    ),
                ]
            )
            await db.commit()

            result = await TemplateSnapshotService(db).restore_template(
                instance.instance_id,
                {
                    "target": "developer_global_frame",
                    "template_version": "1.0.0",
                    "create_backup": True,
                    "operator": None,
                },
            )

            assert result["snapshot_config_json"]["developer_global_frame"]["profile_version"] == "1.0.0"
            assert result["snapshot_config_json"]["layout"] == {"title": "tenant-title"}
            assert result["snapshot_config_json"]["navigation"] == {"items": ["tenant-owned"]}
            assert result["base_template_version"] == "2.0.0"
            backups = (await db.execute(select(TemplateSnapshotBackup))).scalars().all()
            assert len(backups) == 1
            assert backups[0].backup_kind == "restore_developer_global_frame"
        await engine.dispose()

    asyncio.run(scenario())


def test_runtime_instance_cannot_store_a_local_global_frame_override():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            with pytest.raises(ValueError, match="cannot override"):
                await TemplateSnapshotService(db).upsert_instance(
                    {
                        "instance_id": "local-frame-override",
                        "instance_type": "client-plan",
                        "owner_scope": "client",
                        "name": "client plan",
                        "snapshot_config_json": {"developer_global_frame": _frame("1.0.0")},
                        "override_config_json": {"developer_global_frame": deepcopy(_frame("1.0.0"))},
                    }
                )
        await engine.dispose()

    asyncio.run(scenario())


def test_global_frame_draft_merge_preserves_siblings_and_never_publishes_or_queues():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            published = {
                "developer_global_frame": _frame("1.0.0", workspace_background="#ffffff"),
                "layout": {"title": "published title"},
                "modules": [{"id": "published-module"}],
            }
            authoring_draft = {
                "developer_global_frame": _frame("1.0.0", workspace_background="#fafafa"),
                "layout": {"title": "unsaved sibling draft"},
                "modules": [{"id": "draft-module", "settings": {"dense": True}}],
            }
            template = TemplateSnapshotTemplate(
                template_id="client-source-frame-draft",
                template_type="hq-client",
                owner_scope="client_source",
                organization_id=42,
                name="client source frame draft",
                latest_version="1.0.0",
                is_published=True,
                config_json=json.dumps(published),
                draft_config_json=json.dumps(authoring_draft),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="1.0.0",
                        config_json=json.dumps(published),
                        review_status="published",
                    ),
                ]
            )
            await db.commit()

            service = TemplateSnapshotService(db)
            before = await service.get_template(template.template_id)
            result = await service.merge_developer_global_frame_draft(
                template.template_id,
                expected_binding=("client_source", None, 42, None),
                base_draft_hash=before["draft_config_hash"],
                developer_global_frame=_frame("1.1.0", workspace_background="#f5e7ee"),
            )

            await db.refresh(template)
            merged_draft = json.loads(template.draft_config_json)
            assert json.loads(template.config_json) == published
            assert merged_draft["layout"] == authoring_draft["layout"]
            assert merged_draft["modules"] == authoring_draft["modules"]
            assert merged_draft["developer_global_frame"]["profile_version"] == "1.1.0"
            assert template.latest_version == "1.0.0"
            assert template.is_published is True
            assert result["preserved_sibling_keys"] == ["layout", "modules"]
            assert result["write_scope"] == "draft-only"
            assert result["publish_performed"] is False
            assert result["batch_created"] is False
            assert len((await db.execute(select(TemplateSnapshotVersion))).scalars().all()) == 1
            assert (await db.execute(select(TemplateSnapshotReleaseBatch))).scalars().all() == []
        await engine.dispose()

    asyncio.run(scenario())


def test_global_frame_draft_merge_rejects_a_stale_full_document_hash():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            template = TemplateSnapshotTemplate(
                template_id="client-source-frame-concurrency",
                template_type="hq-client",
                owner_scope="client_source",
                name="client source frame concurrency",
                latest_version="1.0.0",
                is_published=True,
                config_json=json.dumps(
                    {
                        "developer_global_frame": _frame("1.0.0"),
                        "layout": {"title": "must survive"},
                    }
                ),
            )
            db.add(template)
            await db.commit()

            service = TemplateSnapshotService(db)
            stale_hash = (await service.get_template(template.template_id))["draft_config_hash"]
            with pytest.raises(ValueError, match="tenant binding changed"):
                await service.merge_developer_global_frame_draft(
                    template.template_id,
                    expected_binding=("client_source", None, 999, None),
                    base_draft_hash=stale_hash,
                    developer_global_frame=_frame("1.1.0"),
                )
            first = await service.merge_developer_global_frame_draft(
                template.template_id,
                expected_binding=("client_source", None, None, None),
                base_draft_hash=stale_hash,
                developer_global_frame=_frame("1.1.0", workspace_background="#f5e7ee"),
            )
            with pytest.raises(ValueError, match="draft changed"):
                await service.merge_developer_global_frame_draft(
                    template.template_id,
                    expected_binding=("client_source", None, None, None),
                    base_draft_hash=stale_hash,
                    developer_global_frame=_frame("1.2.0", workspace_background="#000000"),
                )

            await db.refresh(template)
            persisted = json.loads(template.draft_config_json)
            assert persisted["developer_global_frame"]["profile_version"] == "1.1.0"
            assert persisted["layout"] == {"title": "must survive"}
            assert first["draft_config_hash"] != stale_hash
        await engine.dispose()

    asyncio.run(scenario())


def test_global_frame_draft_merge_request_rejects_sibling_and_forbidden_payloads():
    valid = _frame("1.1.0")
    forbidden = deepcopy(valid)
    forbidden["business_data"] = {"orders": ["must-not-enter-template"]}

    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        DeveloperGlobalFrameDraftMergeRequest(
            base_draft_hash="0" * 64,
            developer_global_frame=forbidden,
        )
    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        DeveloperGlobalFrameDraftMergeRequest(
            base_draft_hash="0" * 64,
            developer_global_frame=valid,
            config_json={"layout": {"title": "attempted sibling overwrite"}},
        )


def test_preflight_schema_accepts_cross_source_matrix_and_rejects_overlapping_lists():
    frame = _frame("1.1.0")
    frame["target_matrix"][0]["source_scope"] = "hq"
    frame["target_matrix"][1]["source_scope"] = "client_source"
    frame["target_matrix"][2]["source_scope"] = "agency_source"
    frame["target_matrix"][2]["compatibility"] = "isolated"
    request = DeveloperGlobalFrameDraftMergeRequest(
        base_draft_hash="0" * 64,
        developer_global_frame=frame,
        preflight_evidence=DeveloperGlobalFramePreflightEvidenceInput(
            artifact_hash="a" * 64,
            compatible_target_page_ids=[
                frame["target_matrix"][0]["page_id"],
                frame["target_matrix"][1]["page_id"],
            ],
            isolated_page_ids=[frame["target_matrix"][2]["page_id"]],
            recovery_point_id=frame["recovery"]["recovery_point_id"],
            checked_at=datetime.now(timezone.utc),
        ),
    )
    assert [target.source_scope for target in request.developer_global_frame.target_matrix] == [
        "hq",
        "client_source",
        "agency_source",
    ]
    with pytest.raises(ValidationError, match="must be disjoint"):
        DeveloperGlobalFramePreflightEvidenceInput(
            artifact_hash="a" * 64,
            compatible_target_page_ids=["client-source:page"],
            isolated_page_ids=["client-source:page"],
            recovery_point_id="recovery",
            checked_at=datetime.now(timezone.utc),
        )


def test_global_frame_preflight_evidence_is_atomic_fetchable_and_publish_bound():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            published_frame = _global_frame("1.0.0")
            next_frame = _global_frame("1.1.0", workspace_background="#f5e7ee")
            template = TemplateSnapshotTemplate(
                template_id="client-source-atomic-preflight",
                template_type="hq-client",
                owner_scope="client_source",
                name="atomic preflight",
                latest_version="1.0.0",
                is_published=True,
                config_json=json.dumps(
                    {
                        "developer_global_frame": published_frame,
                        "layout": {"title": "must survive"},
                    }
                ),
            )
            db.add_all(
                [
                    template,
                    TemplateSnapshotVersion(
                        template_id=template.template_id,
                        version="1.0.0",
                        config_json=template.config_json,
                        review_status="published",
                    ),
                ]
            )
            await db.commit()

            service = TemplateSnapshotService(db)
            base_hash = (await service.get_template(template.template_id))["draft_config_hash"]
            artifact_hash = "d" * 64
            merged = await service.merge_developer_global_frame_draft(
                template.template_id,
                expected_binding=("client_source", None, None, None),
                base_draft_hash=base_hash,
                developer_global_frame=next_frame,
                preflight_evidence=await _trusted_preflight_payload(
                    service,
                    template.template_id,
                    base_hash,
                    next_frame,
                    artifact_hash,
                ),
            )
            evidence = merged["preflight_evidence"]
            assert evidence["valid"] is True
            assert evidence["base_draft_hash"] == base_hash
            assert evidence["saved_draft_hash"] == merged["draft_config_hash"]
            assert evidence["artifact_hash"] == artifact_hash
            assert evidence["compatible_target_page_ids"] == [
                target["page_id"] for target in next_frame["target_matrix"] if target["compatibility"] == "compatible"
            ]
            assert evidence["isolated_page_ids"] == [
                target["page_id"] for target in next_frame["target_matrix"] if target["compatibility"] == "isolated"
            ]
            assert len(evidence["evidence_hash"]) == 64
            rows = (await db.execute(select(DeveloperGlobalFramePreflightEvidence))).scalars().all()
            assert len(rows) == 1

            latest = await service.get_latest_developer_global_frame_preflight_evidence(template.template_id)
            assert latest["evidence_id"] == evidence["evidence_id"]
            validated = await service.validate_developer_global_frame_preflight_evidence(
                template.template_id,
                evidence["evidence_id"],
                expected_saved_draft_hash=merged["draft_config_hash"],
                expected_artifact_hash=artifact_hash,
            )
            assert validated["evidence_hash"] == evidence["evidence_hash"]

            submitted = await service.publish_template(
                template.template_id,
                {
                    "version": "1.1.0",
                    "requires_approval": True,
                    "required_review_steps": 2,
                    "required_sections": ["developer_global_frame"],
                    "expected_draft_config_hash": merged["draft_config_hash"],
                    "expected_preflight_artifact_hash": artifact_hash,
                },
            )
            assert submitted["preflight_evidence_id"] == evidence["evidence_id"]

            persisted = json.loads(template.draft_config_json)
            persisted["layout"]["title"] = "concurrent change invalidates old evidence"
            template.draft_config_json = json.dumps(persisted)
            await db.commit()
            with pytest.raises(ValueError, match="draft changed after developer global frame preflight"):
                await service.validate_developer_global_frame_preflight_evidence(
                    template.template_id,
                    evidence["evidence_id"],
                    expected_saved_draft_hash=merged["draft_config_hash"],
                    expected_artifact_hash=artifact_hash,
                )
        await engine.dispose()

    asyncio.run(scenario())


def test_global_frame_preflight_matrix_mismatch_rolls_back_both_draft_and_evidence():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            initial = {"developer_global_frame": _frame("1.0.0"), "layout": {"safe": True}}
            template = TemplateSnapshotTemplate(
                template_id="client-source-preflight-rollback",
                template_type="hq-client",
                owner_scope="client_source",
                name="preflight rollback",
                latest_version="1.0.0",
                is_published=True,
                config_json=json.dumps(initial),
            )
            db.add(template)
            await db.commit()
            service = TemplateSnapshotService(db)
            base_hash = (await service.get_template(template.template_id))["draft_config_hash"]
            next_frame = _frame("1.1.0")
            mismatched = _preflight_payload(next_frame, "e" * 64)
            mismatched["compatible_target_page_ids"] = mismatched["compatible_target_page_ids"][:-1]
            with pytest.raises(ValueError, match="do not exactly match"):
                await service.merge_developer_global_frame_draft(
                    template.template_id,
                    expected_binding=("client_source", None, None, None),
                    base_draft_hash=base_hash,
                    developer_global_frame=next_frame,
                    preflight_evidence=mismatched,
                )
            await db.refresh(template)
            assert template.draft_config_json is None
            assert json.loads(template.config_json) == initial
            assert (await db.execute(select(DeveloperGlobalFramePreflightEvidence))).scalars().all() == []
        await engine.dispose()

    asyncio.run(scenario())


def test_preflight_evidence_migration_downgrade_is_fail_closed(monkeypatch):
    module = _load_developer_global_frame_preflight_evidence_migration()
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE template_snapshot_versions (preflight_evidence_id TEXT)"))
        connection.execute(text("CREATE TABLE developer_global_frame_preflight_evidence (id TEXT)"))
        connection.execute(
            text("INSERT INTO template_snapshot_versions(preflight_evidence_id) VALUES ('evidence-1')")
        )
        connection.execute(
            text("INSERT INTO developer_global_frame_preflight_evidence(id) VALUES ('evidence-1')")
        )
        monkeypatch.setattr(module.op, "get_bind", lambda: connection)
        destructive_calls: list[tuple[str, tuple, dict]] = []
        for name in ("drop_index", "drop_column", "drop_table"):
            monkeypatch.setattr(
                module.op,
                name,
                lambda *args, _name=name, **kwargs: destructive_calls.append((_name, args, kwargs)),
            )
        with pytest.raises(RuntimeError, match="evidence or linked release history exists"):
            module.downgrade()
        assert destructive_calls == []
    engine.dispose()


def test_factory_default_receipt_is_server_validated_idempotent_and_restores_only_the_frame():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            template_id = "client-source-global"
            version = "1.0.0"
            frame = _global_frame(version, workspace_background="#f5e7ee")
            compatible = [
                item["page_id"] for item in frame["target_matrix"] if item["compatibility"] == "compatible"
            ]
            isolated = [
                item["page_id"] for item in frame["target_matrix"] if item["compatibility"] == "isolated"
            ]
            recorded_at = datetime.now(timezone.utc)
            completed_at = recorded_at - timedelta(minutes=1)
            checked_at = completed_at - timedelta(minutes=30)
            artifact_hash = "a" * 64
            draft_hash = _template_document_hash({"developer_global_frame": frame})
            template = TemplateSnapshotTemplate(
                template_id=template_id,
                template_type="hq-client",
                owner_scope="client_source",
                name="client source global",
                latest_version=version,
                is_published=True,
                config_json=json.dumps({"developer_global_frame": frame}),
            )
            immutable_version = TemplateSnapshotVersion(
                template_id=template_id,
                version=version,
                config_json=json.dumps({"developer_global_frame": frame}),
                release_sections_json='["developer_global_frame"]',
                review_status="published",
                review_step=2,
                required_review_steps=2,
                approved_by="reviewer-two",
                approved_at=completed_at,
                published_at=checked_at,
            )
            instance = TemplateSnapshotInstance(
                instance_id="factory-default-client",
                instance_type="client-plan",
                owner_scope="client",
                name="factory default client",
                base_template_id=template_id,
                base_template_version=version,
                snapshot_config_json=json.dumps(
                    {
                        "developer_global_frame": _frame("2.0.0", workspace_background="#000000"),
                        "orders": [{"id": "business-data-must-stay"}],
                        "layout": {"title": "tenant-owned"},
                    }
                ),
                override_config_json=json.dumps({"layout": {"title": "tenant-owned"}}),
            )
            batch = TemplateSnapshotReleaseBatch(
                id="batch-factory-default-0000000000001",
                template_id=template_id,
                template_version=version,
                owner_scope="client",
                sections_json='["developer_global_frame"]',
                status="completed",
                total_targets=1,
                succeeded_targets=1,
                failed_targets=0,
                started_at=checked_at,
                completed_at=completed_at,
            )
            target = TemplateSnapshotReleaseTarget(
                batch_id=batch.id,
                instance_id=instance.instance_id,
                status="succeeded",
                result_json=json.dumps(
                    {
                        "template_version": version,
                        "base_template_version": version,
                        "sections": ["developer_global_frame"],
                    }
                ),
                completed_at=completed_at,
            )
            db.add_all([template, immutable_version, instance, batch, target])
            await db.commit()
            evidence = await _attach_trusted_version_attestation(
                db,
                TemplateSnapshotService(db),
                template,
                immutable_version,
                frame,
                base_draft_hash=draft_hash,
                saved_draft_hash=draft_hash,
                artifact_hash=artifact_hash,
            )
            evidence_hash = evidence.evidence_hash

            receipt_payload = {
                "schema_version": 1,
                "template_id": template_id,
                "published_version": version,
                "artifact_hash": artifact_hash,
                "draft_hash": draft_hash,
                "preflight_evidence_hash": evidence_hash,
                "compatible_target_page_ids": compatible,
                "isolated_page_ids": isolated,
                "recovery_point_id": frame["recovery"]["recovery_point_id"],
                "rollout_batch_id": batch.id,
                "recorded_at": recorded_at,
            }
            receipt_payload["receipt_hash"] = _factory_default_receipt_hash(receipt_payload)
            service = TemplateSnapshotService(db)

            batch.status = "running"
            with pytest.raises(ValueError, match="not an exact successful frame release"):
                await service.record_developer_global_frame_factory_default_receipt(
                    template_id,
                    receipt_payload,
                    recorded_by=None,
                )
            batch.status = "completed"

            immutable_version.required_review_steps = 1
            immutable_version.review_step = 1
            with pytest.raises(ValueError, match="two-review published version"):
                await service.record_developer_global_frame_factory_default_receipt(
                    template_id,
                    receipt_payload,
                    recorded_by=None,
                )
            immutable_version.required_review_steps = 2
            immutable_version.review_step = 2

            template.latest_version = "0.9.0"
            with pytest.raises(ValueError, match="not the template's current published version"):
                await service.record_developer_global_frame_factory_default_receipt(
                    template_id,
                    receipt_payload,
                    recorded_by=None,
                )
            template.latest_version = version

            recorded = await service.record_developer_global_frame_factory_default_receipt(
                template_id,
                receipt_payload,
                recorded_by=None,
            )
            repeated = await service.record_developer_global_frame_factory_default_receipt(
                template_id,
                receipt_payload,
                recorded_by=None,
            )
            latest = await service.get_latest_developer_global_frame_factory_default_receipt(template_id)
            history = await service.list_developer_global_frame_factory_default_receipts(
                template_id,
                limit=100,
            )
            rows = (await db.execute(select(DeveloperGlobalFrameFactoryDefaultReceipt))).scalars().all()
            assert recorded["receipt_hash"] == receipt_payload["receipt_hash"]
            assert repeated["receipt_id"] == recorded["receipt_id"]
            assert latest["receipt_id"] == recorded["receipt_id"]
            assert [item["receipt_id"] for item in history] == [recorded["receipt_id"]]
            assert latest["recorded_at"] == recorded_at.isoformat(timespec="milliseconds").replace("+00:00", "Z")
            assert len(rows) == 1

            future_receipt = dict(
                receipt_payload,
                recorded_at=datetime.now(timezone.utc) + timedelta(minutes=6),
            )
            future_receipt["receipt_hash"] = _factory_default_receipt_hash(future_receipt)
            with pytest.raises(ValueError, match="recorded_at is too far in the future"):
                await service.record_developer_global_frame_factory_default_receipt(
                    template_id,
                    future_receipt,
                    recorded_by=None,
                )

            invalid_hash = dict(receipt_payload, receipt_hash="f" * 64)
            with pytest.raises(ValueError, match="receipt hash is invalid"):
                await service.record_developer_global_frame_factory_default_receipt(
                    template_id,
                    invalid_hash,
                    recorded_by=None,
                )

            invalid_matrix = dict(
                receipt_payload,
                compatible_target_page_ids=list(reversed(compatible)),
                recorded_at=recorded_at + timedelta(seconds=1),
            )
            invalid_matrix["receipt_hash"] = _factory_default_receipt_hash(invalid_matrix)
            with pytest.raises(ValueError, match="does not exactly match its durable preflight evidence"):
                await service.record_developer_global_frame_factory_default_receipt(
                    template_id,
                    invalid_matrix,
                    recorded_by=None,
                )

            wrong_scope_instance = TemplateSnapshotInstance(
                instance_id="factory-default-wrong-scope",
                instance_type="agency",
                owner_scope="agency",
                name="wrong scope",
                base_template_id=template_id,
                base_template_version=version,
                snapshot_config_json=json.dumps(
                    {"developer_global_frame": _frame("2.0.0", workspace_background="#000000")}
                ),
                override_config_json="{}",
            )
            db.add(wrong_scope_instance)
            immutable_version.review_status = "archived"
            template.latest_version = "2.0.0"
            template.config_json = json.dumps(
                {"developer_global_frame": _frame("2.0.0", workspace_background="#000000")}
            )
            db.add(
                TemplateSnapshotVersion(
                    template_id=template_id,
                    version="2.0.0",
                    config_json=template.config_json,
                    release_sections_json='["developer_global_frame"]',
                    review_status="published",
                    review_step=2,
                    required_review_steps=2,
                    approved_by="new-reviewer-two",
                    approved_at=datetime(2026, 8, 23, 10, 0, tzinfo=timezone.utc),
                )
            )
            await db.commit()

            with pytest.raises(ValueError, match="different runtime owner scope"):
                await service.restore_developer_global_frame_factory_default(
                    wrong_scope_instance.instance_id,
                    receipt_hash=recorded["receipt_hash"],
                    operator=None,
                )

            restored = await service.restore_developer_global_frame_factory_default(
                instance.instance_id,
                receipt_hash=None,
                operator=None,
            )
            restored_config = restored["instance"]["snapshot_config_json"]
            assert restored["receipt"]["receipt_hash"] == receipt_payload["receipt_hash"]
            assert restored_config["developer_global_frame"]["profile_version"] == version
            assert restored_config["developer_global_frame"]["region_tokens"]["workspace"]["background_color"] == "#f5e7ee"
            assert restored_config["orders"] == [{"id": "business-data-must-stay"}]
            assert restored_config["layout"] == {"title": "tenant-owned"}
            backups = (await db.execute(select(TemplateSnapshotBackup))).scalars().all()
            assert len(backups) == 1
            assert backups[0].backup_kind == "restore_developer_global_frame"
        await engine.dispose()

    asyncio.run(scenario())


def test_factory_default_receipt_hash_matches_browser_toisostring_milliseconds():
    wire = {
        "schema_version": 1,
        "template_id": "client-source-global",
        "published_version": "1.0.0",
        "artifact_hash": "a" * 64,
        "draft_hash": "b" * 64,
        "preflight_evidence_hash": "c" * 64,
        "compatible_target_page_ids": ["page-a", "page-b"],
        "isolated_page_ids": ["page-c"],
        "recovery_point_id": "recovery-1.0.0",
        "rollout_batch_id": "batch-1",
        "recorded_at": "2026-08-23T09:00:00.123Z",
        "receipt_hash": "fabbfdc01a0467a896a144ca7d89002ad3f1b58dd75b32f534318bcd36f133dd",
    }
    parsed = DeveloperGlobalFrameFactoryDefaultReceiptRequest.model_validate_json(
        json.dumps(wire)
    )
    assert _factory_default_receipt_hash(parsed.model_dump(mode="python")) == wire["receipt_hash"]


def test_factory_default_receipt_migration_downgrade_is_fail_closed(monkeypatch):
    module = _load_developer_global_frame_factory_default_migration()
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE developer_global_frame_factory_default_receipts (id TEXT)")
        )
        connection.execute(
            text("INSERT INTO developer_global_frame_factory_default_receipts(id) VALUES ('receipt-1')")
        )
        monkeypatch.setattr(module.op, "get_bind", lambda: connection)
        destructive_calls: list[tuple[str, tuple, dict]] = []
        for name in ("drop_index", "drop_table"):
            monkeypatch.setattr(
                module.op,
                name,
                lambda *args, _name=name, **kwargs: destructive_calls.append((_name, args, kwargs)),
            )
        with pytest.raises(RuntimeError, match="receipt history exists"):
            module.downgrade()
        assert destructive_calls == []
    engine.dispose()


def test_factory_default_receipt_migration_upgrades_and_empty_downgrade_is_safe(monkeypatch):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    module = _load_developer_global_frame_factory_default_migration()
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id TEXT PRIMARY KEY)"))
        connection.execute(
            text("CREATE TABLE template_snapshot_templates (template_id TEXT PRIMARY KEY)")
        )
        connection.execute(
            text("CREATE TABLE developer_global_frame_preflight_evidence (id TEXT PRIMARY KEY)")
        )
        connection.execute(
            text("CREATE TABLE template_snapshot_release_batches (id TEXT PRIMARY KEY)")
        )
        operations = Operations(MigrationContext.configure(connection))
        monkeypatch.setattr(module, "op", operations)
        module.upgrade()
        assert inspect(connection).has_table("developer_global_frame_factory_default_receipts")
        module.downgrade()
        assert not inspect(connection).has_table("developer_global_frame_factory_default_receipts")
    engine.dispose()


def test_trusted_acceptance_artifact_rejects_browser_forgery_bad_matrix_wrong_build_and_time():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            frame = _global_frame("1.1.0")
            template = TemplateSnapshotTemplate(
                template_id="client-source-acceptance-security",
                template_type="hq-client",
                owner_scope="client_source",
                name="trusted acceptance security",
                config_json=json.dumps({"developer_global_frame": _global_frame("1.0.0")}),
                draft_config_json=json.dumps({"developer_global_frame": frame}),
            )
            db.add(template)
            await db.commit()
            service = TemplateSnapshotService(db)
            base_hash = (await service.get_template(template.template_id))["draft_config_hash"]
            job = await _create_claimed_acceptance_job(service, template.template_id, base_hash, frame)
            valid = _acceptance_payload(
                template.template_id,
                base_hash,
                frame,
                job["acceptance_job_id"],
            )

            unsigned = deepcopy(valid)
            unsigned["signature"] = "0" * 64
            with pytest.raises(ValueError, match="signature is invalid"):
                await service.register_developer_global_frame_acceptance_artifact(unsigned)

            local = deepcopy(valid)
            local["issuer"] = "browser-local"
            _resign_acceptance_payload(local)
            with pytest.raises(ValueError, match="issuer or key is not trusted"):
                await service.register_developer_global_frame_acceptance_artifact(local)

            missing_viewport = deepcopy(valid)
            missing_viewport["case_results"] = missing_viewport["case_results"][:-1]
            _resign_acceptance_payload(missing_viewport)
            with pytest.raises(ValueError, match="exactly 603 cases"):
                await service.register_developer_global_frame_acceptance_artifact(missing_viewport)

            duplicate_viewport = deepcopy(valid)
            duplicate_viewport["case_results"][-1] = deepcopy(duplicate_viewport["case_results"][0])
            _resign_acceptance_payload(duplicate_viewport)
            with pytest.raises(ValueError, match="unique by page, source and viewport"):
                await service.register_developer_global_frame_acceptance_artifact(duplicate_viewport)

            wrong_registry = deepcopy(valid)
            wrong_registry["page_registry_hash"] = "9" * 64
            _resign_acceptance_payload(wrong_registry)
            with pytest.raises(ValueError, match="deployed build allowlist"):
                await service.register_developer_global_frame_acceptance_artifact(wrong_registry)

            future = _acceptance_payload(
                template.template_id,
                base_hash,
                frame,
                job["acceptance_job_id"],
                issued_at=datetime.now(timezone.utc) + timedelta(minutes=1),
            )
            with pytest.raises(ValueError, match="issued_at is in the future"):
                await service.register_developer_global_frame_acceptance_artifact(future)

            stale = _acceptance_payload(
                template.template_id,
                base_hash,
                frame,
                job["acceptance_job_id"],
                issued_at=datetime.now(timezone.utc) - timedelta(minutes=31),
            )
            with pytest.raises(ValueError, match="stale or expired"):
                await service.register_developer_global_frame_acceptance_artifact(stale)

            registered = await service.register_developer_global_frame_acceptance_artifact(valid)
            exact = await service.get_latest_developer_global_frame_acceptance_artifact(
                template.template_id,
                base_draft_hash=base_hash,
                frame_section_hash=valid["frame_section_hash"],
                visual_draft_id=frame["recovery"]["draft_id"],
                recovery_point_id=frame["recovery"]["recovery_point_id"],
            )
            assert exact["acceptance_artifact_id"] == registered["acceptance_artifact_id"]
            assert len(exact["case_results"]) == 603
            assert len(exact["compatible_target_page_ids"]) == 196
            assert len(exact["isolated_page_ids"]) == 5
            with pytest.raises(KeyError, match="No exact"):
                await service.get_latest_developer_global_frame_acceptance_artifact(
                    template.template_id,
                    base_draft_hash="f" * 64,
                    frame_section_hash=valid["frame_section_hash"],
                    visual_draft_id=frame["recovery"]["draft_id"],
                    recovery_point_id=frame["recovery"]["recovery_point_id"],
                )
            with pytest.raises(KeyError, match="No exact"):
                await service.get_latest_developer_global_frame_acceptance_artifact(
                    template.template_id,
                    base_draft_hash=base_hash,
                    frame_section_hash="e" * 64,
                    visual_draft_id=frame["recovery"]["draft_id"],
                    recovery_point_id=frame["recovery"]["recovery_point_id"],
                )
        await engine.dispose()

    asyncio.run(scenario())


def test_section_batch_fails_closed_for_missing_corrupt_or_wrong_template_preflight():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            frame = _global_frame("1.0.0")
            document = {"developer_global_frame": frame}
            template = TemplateSnapshotTemplate(
                template_id="client-source-batch-attestation",
                template_type="hq-client",
                owner_scope="client_source",
                name="batch attestation",
                latest_version="1.0.0",
                is_published=True,
                config_json=json.dumps(document),
            )
            version = TemplateSnapshotVersion(
                template_id=template.template_id,
                version="1.0.0",
                config_json=json.dumps(document),
                release_sections_json='["developer_global_frame"]',
                review_status="published",
                review_step=2,
                required_review_steps=2,
                approved_by="reviewer-two",
                approved_at=datetime.now(timezone.utc),
            )
            instance = TemplateSnapshotInstance(
                instance_id="client-batch-attestation",
                instance_type="client-plan",
                owner_scope="client",
                name="batch target",
                base_template_id=template.template_id,
                base_template_version="1.0.0",
                snapshot_config_json=json.dumps(document),
                override_config_json="{}",
            )
            db.add_all([template, version, instance])
            await db.commit()
            batch_service = TemplateReleaseBatchService(db)
            with pytest.raises(ValueError, match="no durable preflight evidence"):
                await batch_service.create(
                    template_id=template.template_id,
                    instance_ids=[instance.instance_id],
                    sections=["developer_global_frame"],
                )

            evidence = await _attach_trusted_version_attestation(
                db,
                TemplateSnapshotService(db),
                template,
                version,
                frame,
                base_draft_hash=_template_document_hash(document),
                saved_draft_hash=_template_document_hash(document),
                artifact_hash="6" * 64,
            )
            original_evidence_hash = evidence.evidence_hash
            evidence.evidence_hash = "f" * 64
            await db.commit()
            with pytest.raises(ValueError, match="integrity check failed"):
                await batch_service.create(
                    template_id=template.template_id,
                    instance_ids=[instance.instance_id],
                    sections=["developer_global_frame"],
                )
            evidence.evidence_hash = original_evidence_hash
            await db.commit()

            other_frame = _global_frame("1.0.0", workspace_background="#dbeafe")
            other_document = {"developer_global_frame": other_frame}
            other_template = TemplateSnapshotTemplate(
                template_id="client-source-other-attestation",
                template_type="hq-client",
                owner_scope="client_source",
                name="other attestation",
                latest_version="1.0.0",
                is_published=True,
                config_json=json.dumps(other_document),
            )
            other_version = TemplateSnapshotVersion(
                template_id=other_template.template_id,
                version="1.0.0",
                config_json=json.dumps(other_document),
                release_sections_json='["developer_global_frame"]',
                review_status="published",
                review_step=2,
                required_review_steps=2,
                approved_by="reviewer-two",
                approved_at=datetime.now(timezone.utc),
            )
            db.add_all([other_template, other_version])
            await db.commit()
            other_evidence = await _attach_trusted_version_attestation(
                db,
                TemplateSnapshotService(db),
                other_template,
                other_version,
                other_frame,
                base_draft_hash=_template_document_hash(other_document),
                saved_draft_hash=_template_document_hash(other_document),
                artifact_hash="7" * 64,
            )
            version.preflight_evidence_id = other_evidence.id
            await db.commit()
            with pytest.raises(ValueError, match="preflight evidence does not exist"):
                await batch_service.create(
                    template_id=template.template_id,
                    instance_ids=[instance.instance_id],
                    sections=["developer_global_frame"],
                )
        await engine.dispose()

    asyncio.run(scenario())


def test_acceptance_artifact_migration_downgrade_is_fail_closed(monkeypatch):
    module = _load_developer_global_frame_acceptance_artifact_migration()
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE developer_global_frame_acceptance_artifacts (id TEXT)"))
        connection.execute(
            text("INSERT INTO developer_global_frame_acceptance_artifacts(id) VALUES ('artifact-1')")
        )
        connection.execute(
            text(
                "CREATE TABLE developer_global_frame_preflight_evidence "
                "(acceptance_artifact_id TEXT, acceptance_artifact_hash TEXT, visual_draft_id TEXT)"
            )
        )
        monkeypatch.setattr(module.op, "get_bind", lambda: connection)
        destructive_calls: list[tuple[str, tuple, dict]] = []
        monkeypatch.setattr(
            module.op,
            "drop_table",
            lambda *args, **kwargs: destructive_calls.append(("drop_table", args, kwargs)),
        )
        with pytest.raises(RuntimeError, match="artifact or linked preflight history exists"):
            module.downgrade()
        assert destructive_calls == []
    engine.dispose()


def test_acceptance_artifact_migration_upgrades_and_empty_downgrade_is_safe(monkeypatch):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    module = _load_developer_global_frame_acceptance_artifact_migration()
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE template_snapshot_templates (template_id TEXT PRIMARY KEY)")
        )
        connection.execute(
            text("CREATE TABLE developer_global_frame_preflight_evidence (id TEXT PRIMARY KEY)")
        )
        operations = Operations(MigrationContext.configure(connection))
        monkeypatch.setattr(module, "op", operations)
        module.upgrade()
        inspector = inspect(connection)
        assert inspector.has_table("developer_global_frame_acceptance_artifacts")
        preflight_columns = {
            column["name"] for column in inspector.get_columns("developer_global_frame_preflight_evidence")
        }
        assert {"acceptance_artifact_id", "acceptance_artifact_hash", "visual_draft_id"} <= preflight_columns
        module.downgrade()
        inspector = inspect(connection)
        assert not inspector.has_table("developer_global_frame_acceptance_artifacts")
        preflight_columns = {
            column["name"] for column in inspector.get_columns("developer_global_frame_preflight_evidence")
        }
        assert not ({"acceptance_artifact_id", "acceptance_artifact_hash", "visual_draft_id"} & preflight_columns)
    engine.dispose()


def test_acceptance_job_enforces_worker_lease_binding_retry_replay_and_expiry():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            _configure_acceptance_environment()
            frame_a = _global_frame("2.0.0")
            frame_b = _global_frame("2.0.1", workspace_background="#eeeeee")
            template_a = TemplateSnapshotTemplate(
                template_id="client-source-acceptance-job-a",
                template_type="hq-client",
                owner_scope="client_source",
                name="acceptance job A",
                config_json=json.dumps({"developer_global_frame": _global_frame("1.0.0")}),
            )
            template_b = TemplateSnapshotTemplate(
                template_id="client-source-acceptance-job-b",
                template_type="hq-client",
                owner_scope="client_source",
                name="acceptance job B",
                config_json=json.dumps({"developer_global_frame": _global_frame("1.0.0")}),
            )
            db.add_all([template_a, template_b])
            await db.commit()
            service = TemplateSnapshotService(db)
            base_hash = (await service.get_template(template_a.template_id))["draft_config_hash"]
            request_a = {
                "base_draft_hash": base_hash,
                "frame_section_hash": _template_document_hash(frame_a),
                "visual_draft_id": frame_a["recovery"]["draft_id"],
                "recovery_point_id": frame_a["recovery"]["recovery_point_id"],
                "developer_global_frame": frame_a,
            }
            with pytest.raises(ValueError, match="frame section hash is invalid"):
                await service.create_developer_global_frame_acceptance_job(
                    template_a.template_id,
                    {**request_a, "frame_section_hash": "f" * 64},
                    requested_by="requester-a",
                )

            job_a = await service.create_developer_global_frame_acceptance_job(
                template_a.template_id,
                request_a,
                requested_by="requester-a",
            )
            reused = await service.create_developer_global_frame_acceptance_job(
                template_a.template_id,
                request_a,
                requested_by="requester-a",
            )
            assert reused["acceptance_job_id"] == job_a["acceptance_job_id"]
            with pytest.raises(KeyError, match="not found"):
                await service.get_developer_global_frame_acceptance_job(
                    template_b.template_id,
                    job_a["acceptance_job_id"],
                    requested_by="requester-a",
                )
            with pytest.raises(KeyError, match="not found"):
                await service.get_developer_global_frame_acceptance_job(
                    template_a.template_id,
                    job_a["acceptance_job_id"],
                    requested_by="another-user",
                )

            invalid_claim = _acceptance_worker_proof(
                "claim", template_a.template_id, job_a["acceptance_job_id"]
            )
            invalid_claim["signature"] = "0" * 64
            with pytest.raises(ValueError, match="signature is invalid"):
                await service.claim_developer_global_frame_acceptance_job(
                    template_a.template_id,
                    job_a["acceptance_job_id"],
                    invalid_claim,
                )
            claim_a = _acceptance_worker_proof(
                "claim", template_a.template_id, job_a["acceptance_job_id"]
            )
            running_a = await service.claim_developer_global_frame_acceptance_job(
                template_a.template_id,
                job_a["acceptance_job_id"],
                claim_a,
            )
            assert running_a["status"] == "running"
            assert running_a["attempt_count"] == 1
            with pytest.raises(ValueError, match="nonce was already used"):
                await service.claim_developer_global_frame_acceptance_job(
                    template_a.template_id,
                    job_a["acceptance_job_id"],
                    claim_a,
                )

            job_b = await service.create_developer_global_frame_acceptance_job(
                template_a.template_id,
                {
                    **request_a,
                    "frame_section_hash": _template_document_hash(frame_b),
                    "visual_draft_id": frame_b["recovery"]["draft_id"],
                    "recovery_point_id": frame_b["recovery"]["recovery_point_id"],
                    "developer_global_frame": frame_b,
                },
                requested_by="requester-b",
            )
            await service.claim_developer_global_frame_acceptance_job(
                template_a.template_id,
                job_b["acceptance_job_id"],
                _acceptance_worker_proof("claim", template_a.template_id, job_b["acceptance_job_id"]),
            )
            mixed = _acceptance_payload(
                template_a.template_id,
                base_hash,
                frame_a,
                job_b["acceptance_job_id"],
            )
            with pytest.raises(ValueError, match="frozen job binding"):
                await service.register_developer_global_frame_acceptance_artifact(mixed)

            valid = _acceptance_payload(
                template_a.template_id,
                base_hash,
                frame_a,
                job_a["acceptance_job_id"],
            )
            succeeded = await service.register_developer_global_frame_acceptance_artifact(valid)
            replayed = await service.register_developer_global_frame_acceptance_artifact(valid)
            assert replayed["acceptance_artifact_id"] == succeeded["acceptance_artifact_id"]
            altered_replay = deepcopy(valid)
            altered_replay["run_id"] = "another-signed-run"
            _resign_acceptance_payload(altered_replay)
            with pytest.raises(ValueError, match="cannot be replayed with another report"):
                await service.register_developer_global_frame_acceptance_artifact(altered_replay)

            failed_once = await service.fail_developer_global_frame_acceptance_job(
                template_a.template_id,
                job_b["acceptance_job_id"],
                _acceptance_worker_proof(
                    "fail",
                    template_a.template_id,
                    job_b["acceptance_job_id"],
                    error_code="runner.timeout",
                    error_message="browser matrix timed out",
                ),
            )
            assert failed_once["status"] == "pending"
            retried = await service.claim_developer_global_frame_acceptance_job(
                template_a.template_id,
                job_b["acceptance_job_id"],
                _acceptance_worker_proof("claim", template_a.template_id, job_b["acceptance_job_id"]),
            )
            assert retried["status"] == "running"
            assert retried["attempt_count"] == 2
            terminal = await service.fail_developer_global_frame_acceptance_job(
                template_a.template_id,
                job_b["acceptance_job_id"],
                _acceptance_worker_proof(
                    "fail",
                    template_a.template_id,
                    job_b["acceptance_job_id"],
                    error_code="acceptance.source-drift",
                    error_message="tested source bundle changed during acceptance",
                ),
            )
            assert terminal["status"] == "failed"
            assert terminal["attempt_count"] == 2

            fixed_now = datetime(2026, 8, 23, 8, 0, tzinfo=timezone.utc)
            expiry_frame = _global_frame("2.0.2", workspace_background="#dddddd")
            expiring = await service.create_developer_global_frame_acceptance_job(
                template_a.template_id,
                {
                    "base_draft_hash": base_hash,
                    "frame_section_hash": _template_document_hash(expiry_frame),
                    "visual_draft_id": expiry_frame["recovery"]["draft_id"],
                    "recovery_point_id": expiry_frame["recovery"]["recovery_point_id"],
                    "developer_global_frame": expiry_frame,
                },
                requested_by="expiry-user",
                now=fixed_now,
            )
            expired = await service.get_developer_global_frame_acceptance_job(
                template_a.template_id,
                expiring["acceptance_job_id"],
                requested_by="expiry-user",
                now=fixed_now + timedelta(minutes=241),
            )
            assert expired["status"] == "expired"

            window_frame = _global_frame("2.0.3", workspace_background="#cccccc")
            window_job = await service.create_developer_global_frame_acceptance_job(
                template_a.template_id,
                {
                    "base_draft_hash": base_hash,
                    "frame_section_hash": _template_document_hash(window_frame),
                    "visual_draft_id": window_frame["recovery"]["draft_id"],
                    "recovery_point_id": window_frame["recovery"]["recovery_point_id"],
                    "developer_global_frame": window_frame,
                },
                requested_by="window-user",
                now=fixed_now,
            )
            insufficient_at = fixed_now + timedelta(minutes=181)
            with pytest.raises(ValueError, match="execution window is insufficient"):
                await service.claim_developer_global_frame_acceptance_job(
                    template_a.template_id,
                    window_job["acceptance_job_id"],
                    _acceptance_worker_proof(
                        "claim",
                        template_a.template_id,
                        window_job["acceptance_job_id"],
                        issued_at=insufficient_at,
                    ),
                    now=insufficient_at,
                )
            insufficient = await service.get_developer_global_frame_acceptance_job(
                template_a.template_id,
                window_job["acceptance_job_id"],
                requested_by="window-user",
                now=insufficient_at,
            )
            assert insufficient["status"] == "failed"
            assert insufficient["attempt_count"] == 0
            assert insufficient["last_error_code"] == "acceptance.job-ttl-insufficient"

            succeeded_job = await db.scalar(
                select(DeveloperGlobalFrameAcceptanceJob).where(
                    DeveloperGlobalFrameAcceptanceJob.id == job_a["acceptance_job_id"]
                )
            )
            assert succeeded_job.status == "succeeded"
            assert succeeded_job.acceptance_artifact_id == succeeded["acceptance_artifact_id"]
            events = (
                await db.execute(
                    select(DeveloperGlobalFrameAcceptanceJobEvent).where(
                        DeveloperGlobalFrameAcceptanceJobEvent.job_id == job_a["acceptance_job_id"]
                    )
                )
            ).scalars().all()
            assert [event.event_type for event in events] == ["requested", "claimed", "succeeded"]
        await engine.dispose()

    asyncio.run(scenario())


def test_acceptance_claim_next_consumes_nonce_and_heartbeat_respects_absolute_ttl():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            _configure_acceptance_environment()
            service = TemplateSnapshotService(db)
            fixed_now = datetime(2026, 8, 23, 8, 0, tzinfo=timezone.utc)
            empty_proof = _acceptance_worker_claim_next_proof(issued_at=fixed_now)
            assert await service.claim_next_developer_global_frame_acceptance_job(
                empty_proof,
                now=fixed_now,
            ) is None
            with pytest.raises(ValueError, match="nonce was already used"):
                await service.claim_next_developer_global_frame_acceptance_job(
                    empty_proof,
                    now=fixed_now + timedelta(seconds=1),
                )
            stale_proof = _acceptance_worker_claim_next_proof(
                issued_at=fixed_now - timedelta(minutes=6)
            )
            with pytest.raises(ValueError, match="future or stale"):
                await service.claim_next_developer_global_frame_acceptance_job(
                    stale_proof,
                    now=fixed_now,
                )

            frame = _global_frame("3.0.0")
            document = {"developer_global_frame": _global_frame("1.0.0")}
            template = TemplateSnapshotTemplate(
                template_id="client-source-heartbeat-job",
                template_type="hq-client",
                owner_scope="client_source",
                name="heartbeat job",
                config_json=json.dumps(document),
            )
            db.add(template)
            await db.commit()
            base_hash = (await service.get_template(template.template_id))["draft_config_hash"]
            job = await service.create_developer_global_frame_acceptance_job(
                template.template_id,
                {
                    "base_draft_hash": base_hash,
                    "frame_section_hash": _template_document_hash(frame),
                    "visual_draft_id": frame["recovery"]["draft_id"],
                    "recovery_point_id": frame["recovery"]["recovery_point_id"],
                    "developer_global_frame": frame,
                },
                requested_by="heartbeat-requester",
                now=fixed_now,
            )
            claimed = await service.claim_next_developer_global_frame_acceptance_job(
                _acceptance_worker_claim_next_proof(issued_at=fixed_now + timedelta(seconds=1)),
                now=fixed_now + timedelta(seconds=1),
            )
            assert claimed and claimed["acceptance_job_id"] == job["acceptance_job_id"]
            first_heartbeat = _acceptance_worker_proof(
                "heartbeat",
                template.template_id,
                job["acceptance_job_id"],
                issued_at=fixed_now + timedelta(minutes=2),
            )
            renewed = await service.heartbeat_developer_global_frame_acceptance_job(
                template.template_id,
                job["acceptance_job_id"],
                first_heartbeat,
                now=fixed_now + timedelta(minutes=2),
            )
            assert renewed["lease_expires_at"].replace(tzinfo=timezone.utc) == fixed_now + timedelta(minutes=12)
            with pytest.raises(ValueError, match="nonce was already used"):
                await service.heartbeat_developer_global_frame_acceptance_job(
                    template.template_id,
                    job["acceptance_job_id"],
                    first_heartbeat,
                    now=fixed_now + timedelta(minutes=2, seconds=1),
                )

            alt_secret = "alternate-trusted-worker-secret-32-bytes"
            alt_proof = _acceptance_worker_proof(
                "heartbeat",
                template.template_id,
                job["acceptance_job_id"],
                issued_at=fixed_now + timedelta(minutes=3),
                issuer="test-ci-alt",
                key_id="test-ci-alt-key",
                secret=alt_secret,
            )
            os.environ["DEVELOPER_GLOBAL_FRAME_ACCEPTANCE_HMAC_KEYS"] = json.dumps(
                {
                    _ACCEPTANCE_KEY_ID: {
                        "issuer": _ACCEPTANCE_ISSUER,
                        "secret": _ACCEPTANCE_SECRET,
                    },
                    "test-ci-alt-key": {
                        "issuer": "test-ci-alt",
                        "secret": alt_secret,
                    },
                }
            )
            with pytest.raises(ValueError, match="active worker lease"):
                await service.heartbeat_developer_global_frame_acceptance_job(
                    template.template_id,
                    job["acceptance_job_id"],
                    alt_proof,
                    now=fixed_now + timedelta(minutes=3),
                )

            for minute in range(9, 238, 9):
                heartbeat_at = fixed_now + timedelta(minutes=minute)
                await service.heartbeat_developer_global_frame_acceptance_job(
                    template.template_id,
                    job["acceptance_job_id"],
                    _acceptance_worker_proof(
                        "heartbeat",
                        template.template_id,
                        job["acceptance_job_id"],
                        issued_at=heartbeat_at,
                    ),
                    now=heartbeat_at,
                )
            final_heartbeat_at = fixed_now + timedelta(minutes=239)
            final_renewal = await service.heartbeat_developer_global_frame_acceptance_job(
                template.template_id,
                job["acceptance_job_id"],
                _acceptance_worker_proof(
                    "heartbeat",
                    template.template_id,
                    job["acceptance_job_id"],
                    issued_at=final_heartbeat_at,
                ),
                now=final_heartbeat_at,
            )
            assert final_renewal["lease_expires_at"].replace(tzinfo=timezone.utc) == fixed_now + timedelta(minutes=240)
            expired_at = fixed_now + timedelta(minutes=241)
            with pytest.raises(ValueError, match="job is expired"):
                await service.heartbeat_developer_global_frame_acceptance_job(
                    template.template_id,
                    job["acceptance_job_id"],
                    _acceptance_worker_proof(
                        "heartbeat",
                        template.template_id,
                        job["acceptance_job_id"],
                        issued_at=expired_at,
                    ),
                    now=expired_at,
                )
            expired = await service.get_developer_global_frame_acceptance_job(
                template.template_id,
                job["acceptance_job_id"],
                requested_by="heartbeat-requester",
                now=expired_at,
            )
            assert expired["status"] == "expired"
            miss_nonce = await db.scalar(
                select(DeveloperGlobalFrameAcceptanceWorkerNonce).where(
                    DeveloperGlobalFrameAcceptanceWorkerNonce.nonce == empty_proof["nonce"]
                )
            )
            assert miss_nonce and miss_nonce.action == "claim-next" and miss_nonce.job_id is None
        await engine.dispose()

    asyncio.run(scenario())


def test_acceptance_claim_next_two_workers_atomically_claim_one_job(tmp_path):
    async def scenario():
        database_path = (tmp_path / "acceptance-queue.sqlite3").as_posix()
        engine = create_async_engine(
            f"sqlite+aiosqlite:///{database_path}",
            connect_args={"timeout": 30},
        )
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        _configure_acceptance_environment()
        fixed_now = datetime(2026, 8, 23, 9, 0, tzinfo=timezone.utc)
        frame = _global_frame("4.0.0")
        template_id = "client-source-concurrent-queue"
        async with session_factory() as db:
            template = TemplateSnapshotTemplate(
                template_id=template_id,
                template_type="hq-client",
                owner_scope="client_source",
                name="concurrent queue",
                config_json=json.dumps({"developer_global_frame": _global_frame("1.0.0")}),
            )
            db.add(template)
            await db.commit()
            service = TemplateSnapshotService(db)
            base_hash = (await service.get_template(template_id))["draft_config_hash"]
            job = await service.create_developer_global_frame_acceptance_job(
                template_id,
                {
                    "base_draft_hash": base_hash,
                    "frame_section_hash": _template_document_hash(frame),
                    "visual_draft_id": frame["recovery"]["draft_id"],
                    "recovery_point_id": frame["recovery"]["recovery_point_id"],
                    "developer_global_frame": frame,
                },
                requested_by="concurrency-requester",
                now=fixed_now,
            )

        proofs = [
            _acceptance_worker_claim_next_proof(issued_at=fixed_now, nonce=f"concurrent-worker-{index:02d}")
            for index in (1, 2)
        ]

        async def claim(proof: dict):
            async with session_factory() as worker_db:
                return await TemplateSnapshotService(
                    worker_db
                ).claim_next_developer_global_frame_acceptance_job(proof, now=fixed_now)

        results = await asyncio.gather(*(claim(proof) for proof in proofs))
        claimed = [result for result in results if result is not None]
        assert len(claimed) == 1
        assert claimed[0]["acceptance_job_id"] == job["acceptance_job_id"]
        async with session_factory() as db:
            stored = await db.scalar(
                select(DeveloperGlobalFrameAcceptanceJob).where(
                    DeveloperGlobalFrameAcceptanceJob.id == job["acceptance_job_id"]
                )
            )
            assert stored.status == "running"
            assert stored.attempt_count == 1
            reservations = (
                await db.execute(select(DeveloperGlobalFrameAcceptanceWorkerNonce))
            ).scalars().all()
            assert len(reservations) == 2
            assert sum(reservation.job_id == job["acceptance_job_id"] for reservation in reservations) == 1
        await engine.dispose()

    asyncio.run(scenario())


def test_acceptance_job_migration_upgrade_rejects_unbound_legacy_artifacts(monkeypatch):
    module = _load_developer_global_frame_acceptance_job_migration()
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE developer_global_frame_acceptance_artifacts (id TEXT PRIMARY KEY)")
        )
        connection.execute(
            text("INSERT INTO developer_global_frame_acceptance_artifacts(id) VALUES ('legacy-artifact')")
        )
        monkeypatch.setattr(module.op, "get_bind", lambda: connection)
        with pytest.raises(RuntimeError, match="unbound acceptance artifacts exist"):
            module.upgrade()
        assert not inspect(connection).has_table("developer_global_frame_acceptance_jobs")
    engine.dispose()


def test_acceptance_job_migration_downgrade_is_fail_closed(monkeypatch):
    module = _load_developer_global_frame_acceptance_job_migration()
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE developer_global_frame_acceptance_jobs (id TEXT)"))
        connection.execute(text("INSERT INTO developer_global_frame_acceptance_jobs(id) VALUES ('job-1')"))
        connection.execute(text("CREATE TABLE developer_global_frame_acceptance_job_events (id TEXT)"))
        connection.execute(text("CREATE TABLE developer_global_frame_acceptance_worker_nonces (nonce TEXT)"))
        connection.execute(
            text("CREATE TABLE developer_global_frame_acceptance_artifacts (acceptance_job_id TEXT)")
        )
        monkeypatch.setattr(module.op, "get_bind", lambda: connection)
        with pytest.raises(RuntimeError, match="trusted job, event, or linked artifact history exists"):
            module.downgrade()
    engine.dispose()


def test_acceptance_job_migration_empty_roundtrip(monkeypatch):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    module = _load_developer_global_frame_acceptance_job_migration()
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id TEXT PRIMARY KEY)"))
        connection.execute(
            text("CREATE TABLE template_snapshot_templates (template_id TEXT PRIMARY KEY)")
        )
        connection.execute(
            text("CREATE TABLE developer_global_frame_acceptance_artifacts (id TEXT PRIMARY KEY)")
        )
        operations = Operations(MigrationContext.configure(connection))
        monkeypatch.setattr(module, "op", operations)
        module.upgrade()
        inspector = inspect(connection)
        assert inspector.has_table("developer_global_frame_acceptance_jobs")
        assert inspector.has_table("developer_global_frame_acceptance_job_events")
        assert inspector.has_table("developer_global_frame_acceptance_worker_nonces")
        artifact_columns = {
            column["name"] for column in inspector.get_columns("developer_global_frame_acceptance_artifacts")
        }
        assert "acceptance_job_id" in artifact_columns
        module.downgrade()
        inspector = inspect(connection)
        assert not inspector.has_table("developer_global_frame_acceptance_jobs")
        assert not inspector.has_table("developer_global_frame_acceptance_job_events")
        assert not inspector.has_table("developer_global_frame_acceptance_worker_nonces")
        artifact_columns = {
            column["name"] for column in inspector.get_columns("developer_global_frame_acceptance_artifacts")
        }
        assert "acceptance_job_id" not in artifact_columns
    engine.dispose()
