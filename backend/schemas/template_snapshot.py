from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from schemas.developer_global_frame import DeveloperGlobalFrameSection


TemplateType = Literal["hq-agent", "hq-client", "agency-agent", "agency-client"]
InstanceType = Literal["agency", "sub-agency", "third-agency", "client-plan"]
RestoreTarget = Literal["all", "modules", "layout", "service", "developer_global_frame"]
SyncMode = Literal["overwrite", "merge"]


class TemplateCreateRequest(BaseModel):
    template_id: str | None = None
    template_type: TemplateType
    owner_scope: str
    owner_id: str | None = None
    organization_id: int | None = None
    project_id: int | None = None
    parent_template_id: str | None = Field(default=None, max_length=100)
    name: str
    config_json: dict[str, Any] = Field(default_factory=dict)
    latest_version: str | None = None
    is_published: bool = False


class TemplateUpsertRequest(TemplateCreateRequest):
    template_id: str


class TemplatePublishRequest(BaseModel):
    version: str
    changelog: str | None = None
    published_by: str | None = None
    requires_approval: bool = False
    required_review_steps: int = Field(default=1, ge=1, le=2)
    required_sections: list[Literal["developer_global_frame"]] | None = Field(
        default=None,
        min_length=1,
        max_length=1,
    )
    expected_draft_config_hash: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    expected_preflight_artifact_hash: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    review_assignee: str | None = Field(default=None, max_length=100)
    review_due_at: datetime | None = None


class TemplateVersionReviewRequest(BaseModel):
    action: Literal["approve", "reject"]
    note: str | None = Field(default=None, max_length=1000)


class DeveloperGlobalFrameAcceptanceCaseResult(BaseModel):
    """One signed page/viewport outcome emitted by the trusted acceptance runner."""

    model_config = ConfigDict(extra="forbid", strict=True)

    page_id: str = Field(min_length=3, max_length=300)
    source_scope: Literal["hq", "agency_source", "client_source"]
    viewport: Literal[1440, 1024, 390]
    outcome: Literal["passed", "isolated"]


class DeveloperGlobalFrameAcceptanceJobCreateRequest(BaseModel):
    """Browser request for a server-bound trusted acceptance execution."""

    model_config = ConfigDict(extra="forbid", strict=True)

    base_draft_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    frame_section_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    visual_draft_id: str = Field(min_length=1, max_length=200)
    recovery_point_id: str = Field(min_length=1, max_length=200)
    developer_global_frame: DeveloperGlobalFrameSection


class DeveloperGlobalFrameAcceptanceWorkerClaimRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    issuer: str = Field(min_length=1, max_length=100)
    key_id: str = Field(min_length=1, max_length=100)
    # JSON has no native datetime scalar. Keep the request model strict for every
    # other field while accepting the canonical ISO-8601 string emitted on the
    # trusted worker wire.
    issued_at: datetime = Field(strict=False)
    nonce: str = Field(min_length=16, max_length=100)
    signature: str = Field(pattern=r"^[0-9a-f]{64}$")


class DeveloperGlobalFrameAcceptanceWorkerClaimNextRequest(
    DeveloperGlobalFrameAcceptanceWorkerClaimRequest
):
    """Queue claim proof signed before the server selects an exact job."""

    source_scope: Literal["client_source"]


class DeveloperGlobalFrameAcceptanceWorkerFailureRequest(DeveloperGlobalFrameAcceptanceWorkerClaimRequest):
    error_code: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9._-]+$")
    error_message: str = Field(min_length=1, max_length=1000)


class DeveloperGlobalFrameAcceptanceJobResponse(BaseModel):
    acceptance_job_id: str
    schema_version: Literal[1]
    template_id: str
    source_scope: Literal["client_source"]
    base_draft_hash: str
    frame_section_hash: str
    visual_draft_id: str
    recovery_point_id: str
    developer_global_frame: DeveloperGlobalFrameSection
    page_registry_hash: str
    adapter_registry_hash: str
    isolation_policy_hash: str
    test_spec_hash: str
    source_build_digest: str
    status: Literal["pending", "running", "succeeded", "failed", "expired"]
    attempt_count: int
    max_attempts: int
    worker_issuer: str | None = None
    worker_key_id: str | None = None
    claimed_at: datetime | None = None
    lease_expires_at: datetime | None = None
    acceptance_artifact_id: str | None = None
    report_hash: str | None = None
    last_error_code: str | None = None
    last_error_message: str | None = None
    expires_at: datetime
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class DeveloperGlobalFrameAcceptanceArtifactCreateRequest(BaseModel):
    """HMAC-sealed 201-page x 3-viewport acceptance result from trusted CI."""

    model_config = ConfigDict(extra="forbid", strict=True)

    schema_version: Literal[1]
    run_id: str = Field(min_length=1, max_length=100)
    issuer: str = Field(min_length=1, max_length=100)
    key_id: str = Field(min_length=1, max_length=100)
    template_id: str = Field(min_length=1, max_length=100)
    source_scope: Literal["client_source"]
    acceptance_job_id: str = Field(min_length=1, max_length=36)
    base_draft_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    frame_section_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    visual_draft_id: str = Field(min_length=1, max_length=200)
    recovery_point_id: str = Field(min_length=1, max_length=200)
    page_registry_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    adapter_registry_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    isolation_policy_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    test_spec_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    source_build_digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    issued_at: datetime = Field(strict=False)
    expires_at: datetime = Field(strict=False)
    viewports: list[Literal[1440, 1024, 390]] = Field(min_length=3, max_length=3)
    compatible_target_page_ids: list[str] = Field(min_length=196, max_length=196)
    isolated_page_ids: list[str] = Field(min_length=5, max_length=5)
    case_results: list[DeveloperGlobalFrameAcceptanceCaseResult] = Field(min_length=603, max_length=603)
    failure_count: Literal[0]
    flaky_count: Literal[0]
    skipped_count: Literal[0]
    report_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    signature: str = Field(pattern=r"^[0-9a-f]{64}$")


class DeveloperGlobalFrameAcceptanceArtifactResponse(BaseModel):
    acceptance_artifact_id: str
    schema_version: Literal[1]
    run_id: str
    issuer: str
    key_id: str
    template_id: str
    source_scope: Literal["client_source"]
    acceptance_job_id: str
    base_draft_hash: str
    frame_section_hash: str
    visual_draft_id: str
    recovery_point_id: str
    page_registry_hash: str
    adapter_registry_hash: str
    isolation_policy_hash: str
    test_spec_hash: str
    source_build_digest: str
    issued_at: datetime
    expires_at: datetime
    viewports: list[Literal[1440, 1024, 390]]
    compatible_target_page_ids: list[str]
    isolated_page_ids: list[str]
    case_results: list[DeveloperGlobalFrameAcceptanceCaseResult]
    failure_count: Literal[0]
    flaky_count: Literal[0]
    skipped_count: Literal[0]
    report_hash: str
    signature: str
    valid: Literal[True]
    created_at: datetime | None = None


class DeveloperGlobalFramePreflightEvidenceInput(BaseModel):
    """Preflight manifest sealed in the same transaction as the draft merge."""

    model_config = ConfigDict(extra="forbid", strict=True)

    artifact_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    acceptance_artifact_id: str | None = Field(default=None, min_length=1, max_length=36)
    acceptance_artifact_hash: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")
    visual_draft_id: str | None = Field(default=None, min_length=1, max_length=200)
    compatible_target_page_ids: list[str] = Field(min_length=1, max_length=5000)
    isolated_page_ids: list[str] = Field(default_factory=list, max_length=5000)
    recovery_point_id: str = Field(min_length=1, max_length=200)
    checked_at: datetime = Field(strict=False)

    @model_validator(mode="after")
    def require_unique_disjoint_targets(self):
        compatible = set(self.compatible_target_page_ids)
        isolated = set(self.isolated_page_ids)
        if len(compatible) != len(self.compatible_target_page_ids):
            raise ValueError("Compatible preflight target IDs must be unique")
        if len(isolated) != len(self.isolated_page_ids):
            raise ValueError("Isolated preflight target IDs must be unique")
        if compatible & isolated:
            raise ValueError("Compatible and isolated preflight target IDs must be disjoint")
        return self


class DeveloperGlobalFramePreflightEvidenceValidateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    expected_saved_draft_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    expected_artifact_hash: str = Field(pattern=r"^[0-9a-f]{64}$")


class DeveloperGlobalFramePreflightEvidenceResponse(BaseModel):
    evidence_id: str
    template_id: str
    source_scope: str
    base_draft_hash: str
    saved_draft_hash: str
    artifact_hash: str
    acceptance_artifact_id: str | None = None
    acceptance_artifact_hash: str | None = None
    visual_draft_id: str | None = None
    compatible_target_page_ids: list[str]
    isolated_page_ids: list[str]
    recovery_point_id: str
    checked_at: datetime
    evidence_hash: str
    valid: Literal[True]
    created_at: datetime | None = None


class DeveloperGlobalFrameFactoryDefaultReceiptRequest(BaseModel):
    """Client receipt whose hash is re-derived and attested by the server."""

    model_config = ConfigDict(extra="forbid", strict=True)

    schema_version: Literal[1]
    template_id: str = Field(min_length=1, max_length=100)
    published_version: str = Field(min_length=1, max_length=50)
    artifact_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    draft_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    preflight_evidence_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    compatible_target_page_ids: list[str] = Field(min_length=1, max_length=5000)
    isolated_page_ids: list[str] = Field(default_factory=list, max_length=5000)
    recovery_point_id: str = Field(min_length=1, max_length=200)
    rollout_batch_id: str = Field(min_length=1, max_length=36)
    recorded_at: datetime
    receipt_hash: str = Field(pattern=r"^[0-9a-f]{64}$")

    @model_validator(mode="after")
    def require_unique_disjoint_targets(self):
        compatible = set(self.compatible_target_page_ids)
        isolated = set(self.isolated_page_ids)
        if len(compatible) != len(self.compatible_target_page_ids):
            raise ValueError("Compatible factory-default target IDs must be unique")
        if len(isolated) != len(self.isolated_page_ids):
            raise ValueError("Isolated factory-default target IDs must be unique")
        if compatible & isolated:
            raise ValueError("Compatible and isolated factory-default target IDs must be disjoint")
        if any(not item or len(item) > 300 for item in compatible | isolated):
            raise ValueError("Factory-default target IDs must be non-empty and at most 300 characters")
        return self


class DeveloperGlobalFrameFactoryDefaultReceiptResponse(BaseModel):
    receipt_id: str
    schema_version: Literal[1]
    template_id: str
    source_scope: str
    rollout_owner_scope: str
    published_version: str
    preflight_evidence_id: str
    artifact_hash: str
    draft_hash: str
    preflight_evidence_hash: str
    compatible_target_page_ids: list[str]
    isolated_page_ids: list[str]
    recovery_point_id: str
    rollout_batch_id: str
    recorded_at: str
    receipt_hash: str
    recorded_by: str | None = None
    created_at: datetime | None = None
    valid: Literal[True]


class DeveloperGlobalFrameFactoryDefaultRestoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    receipt_hash: str | None = Field(default=None, pattern=r"^[0-9a-f]{64}$")


class DeveloperGlobalFrameDraftMergeRequest(BaseModel):
    """Optimistic, section-only update of a source template authoring draft."""

    model_config = ConfigDict(extra="forbid", strict=True)

    base_draft_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    developer_global_frame: DeveloperGlobalFrameSection
    preflight_evidence: DeveloperGlobalFramePreflightEvidenceInput | None = None


class DeveloperGlobalFrameDraftMergeResponse(BaseModel):
    template_id: str
    owner_scope: str
    base_template_version: str | None = None
    draft_config_hash: str
    developer_global_frame: DeveloperGlobalFrameSection
    preserved_sibling_keys: list[str]
    write_scope: Literal["draft-only"]
    publish_performed: Literal[False]
    batch_created: Literal[False]
    preflight_evidence: DeveloperGlobalFramePreflightEvidenceResponse | None = None


class TemplateVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    template_id: str
    version: str
    changelog: str | None = None
    config_json: dict[str, Any]
    release_sections: list[Literal["developer_global_frame"]] | None = None
    preflight_evidence_id: str | None = None
    review_status: str = "published"
    review_note: str | None = None
    review_step: int = 0
    required_review_steps: int = 1
    review_assignee: str | None = None
    review_due_at: datetime | None = None
    approved_by: str | None = None
    approved_at: datetime | None = None
    published_at: datetime | None = None
    published_by: str | None = None


class TemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    template_id: str
    template_type: TemplateType
    owner_scope: str
    owner_id: str | None = None
    organization_id: int | None = None
    project_id: int | None = None
    parent_template_id: str | None = None
    name: str
    latest_version: str | None = None
    factory_default_version: str | None = None
    factory_default_release_batch_id: str | None = None
    factory_default_contract_version: str | None = None
    factory_default_promoted_at: datetime | None = None
    factory_default_promoted_by: str | None = None
    draft_config_json: dict[str, Any] | None = None
    draft_config_hash: str | None = None
    published_config_hash: str | None = None
    config_json: dict[str, Any] = Field(default_factory=dict)
    is_published: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProductMarketFactoryDefaultPromoteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    release_batch_id: str = Field(min_length=1, max_length=36)
    contract_version: str = Field(min_length=1, max_length=50)


class ProductMarketFactoryDefaultResponse(BaseModel):
    template_id: str
    source_scope: Literal["client_source"]
    rollout_owner_scope: Literal["client"]
    factory_default_version: str
    factory_default_config_json: dict[str, Any]
    factory_default_release_batch_id: str
    factory_default_contract_version: str
    total_targets: int
    succeeded_targets: int
    failed_targets: Literal[0]
    promoted_at: datetime
    promoted_by: str | None = None
    covered_areas: list[Literal["operations", "modules", "layout", "service"]]
    valid: Literal[True]


class InstanceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    instance_id: str
    instance_type: InstanceType
    owner_scope: str
    owner_id: str | None = None
    organization_id: int | None = None
    project_id: int | None = None
    parent_id: str | None = None
    name: str
    base_template_id: str | None = None
    base_template_version: str | None = None
    snapshot_config_json: dict[str, Any]
    override_config_json: dict[str, Any] = Field(default_factory=dict)
    is_detached: bool = False
    last_synced_at: datetime | None = None


class InstanceUpsertRequest(BaseModel):
    instance_id: str
    instance_type: InstanceType
    owner_scope: str
    owner_id: str | None = None
    organization_id: int | None = None
    project_id: int | None = None
    parent_id: str | None = None
    name: str
    base_template_id: str | None = None
    base_template_version: str | None = None
    snapshot_config_json: dict[str, Any] = Field(default_factory=dict)
    override_config_json: dict[str, Any] = Field(default_factory=dict)
    is_detached: bool = False
    last_synced_at: datetime | None = None


class InstanceSyncLatestRequest(BaseModel):
    sync_mode: SyncMode = "merge"
    create_backup: bool = True
    operator: str | None = None
    sections: list[Literal["developer_global_frame"]] | None = Field(
        default=None,
        min_length=1,
        max_length=1,
    )


class TemplateReleaseBatchCreateRequest(BaseModel):
    """One durable release pinned to the template's current immutable version.

    An omitted ``sections`` value keeps the legacy full-template rollout.
    The only permitted partial batch is the source-owned appearance contract.
    """

    template_id: str = Field(min_length=1, max_length=100)
    expected_template_version: str | None = Field(default=None, min_length=1, max_length=50)
    instance_ids: list[str] | None = Field(default=None, max_length=10000)
    sections: list[Literal["developer_global_frame"]] | None = Field(default=None, min_length=1, max_length=1)


class InstanceRestoreTemplateRequest(BaseModel):
    target: RestoreTarget = "all"
    template_version: str | None = Field(default=None, min_length=1, max_length=50)
    create_backup: bool = True
    operator: str | None = None


class InstanceDetachRequest(BaseModel):
    operator: str | None = None


class InstanceRebindTemplateRequest(BaseModel):
    template_id: str
    template_version: str
    operator: str | None = None


class DiffEntry(BaseModel):
    path: str
    current_value: Any = None
    target_value: Any = None
    change_type: Literal["added", "removed", "updated"]


class DiffResponse(BaseModel):
    instance_id: str
    template_id: str
    template_version: str
    entries: list[DiffEntry]


class BackupCreateRequest(BaseModel):
    target_type: str
    target_id: str
    version: str | None = None
    backup_kind: str
    created_by: str | None = None


class BackupRestoreDrillRequest(BaseModel):
    result: Literal["passed", "failed"]
    note: str | None = Field(default=None, max_length=1000)


class LegacyOwnerMappingRequest(BaseModel):
    owner_scope: str = Field(min_length=1, max_length=50)
    legacy_owner_id: str = Field(min_length=1, max_length=100)
    organization_id: int | None = None
    project_id: int | None = None


class SnapshotBindingRequest(BaseModel):
    organization_id: int | None = None
    project_id: int | None = None


class BackupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    backup_id: str
    target_type: str
    target_id: str
    version: str | None = None
    backup_kind: str
    program_path: str | None = None
    database_path: str | None = None
    backup_path: str | None = None
    metadata_json: dict[str, Any] = Field(default_factory=dict)
    created_by: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
