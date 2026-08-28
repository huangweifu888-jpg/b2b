from __future__ import annotations

from datetime import datetime

from core.database import Base
from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint


class TemplateSnapshotTemplate(Base):
    __tablename__ = "template_snapshot_templates"
    __table_args__ = (
        UniqueConstraint("template_id", name="uq_template_snapshot_templates_template_id"),
        CheckConstraint(
            "(factory_default_version IS NULL AND factory_default_release_batch_id IS NULL "
            "AND factory_default_contract_version IS NULL AND factory_default_promoted_at IS NULL) OR "
            "(factory_default_version IS NOT NULL AND factory_default_release_batch_id IS NOT NULL "
            "AND factory_default_contract_version IS NOT NULL AND factory_default_promoted_at IS NOT NULL)",
            name="ck_template_snapshot_factory_default_pointer_complete",
        ),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    template_id = Column(String(100), nullable=False, index=True)
    template_type = Column(String(50), nullable=False, index=True)
    owner_scope = Column(String(50), nullable=False, index=True)
    owner_id = Column(String(100), nullable=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=True, index=True)
    parent_template_id = Column(String(100), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    latest_version = Column(String(50), nullable=True)
    # Full Product Market releases become the tenant factory default only
    # after one all-client-plan rollout has completed without failures.  The
    # newest immutable publication may be newer while its rollout is pending;
    # runtime provisioning/sync must therefore use this confirmed pointer.
    factory_default_version = Column(String(50), nullable=True, index=True)
    factory_default_release_batch_id = Column(
        String(36),
        ForeignKey("template_snapshot_release_batches.id"),
        nullable=True,
        index=True,
    )
    factory_default_contract_version = Column(String(50), nullable=True)
    factory_default_promoted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    factory_default_promoted_by = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    # The mutable authoring draft is deliberately separate from the immutable
    # configuration currently released to downstream tenant runtimes.
    draft_config_json = Column(Text, nullable=True)
    config_json = Column(Text, nullable=False, default="{}")
    is_published = Column(Boolean, nullable=False, default=False, server_default="0")
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class TemplateSnapshotVersion(Base):
    __tablename__ = "template_snapshot_versions"
    __table_args__ = (
        UniqueConstraint("template_id", "version", name="uq_template_snapshot_versions_template_version"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    template_id = Column(String(100), nullable=False, index=True)
    version = Column(String(50), nullable=False, index=True)
    changelog = Column(String(1000), nullable=True)
    config_json = Column(Text, nullable=False, default="{}")
    # NULL is a legacy/full-template release.  A non-NULL value is immutable
    # metadata declaring the only section this version is authoritative for.
    release_sections_json = Column(Text, nullable=True)
    # Immutable link to the server-attested preflight manifest that admitted
    # this developer_global_frame version into the review chain.
    preflight_evidence_id = Column(String(36), nullable=True, index=True)
    review_status = Column(String(30), nullable=False, default="published", server_default="published", index=True)
    review_note = Column(String(1000), nullable=True)
    review_step = Column(Integer, nullable=False, default=0, server_default="0")
    required_review_steps = Column(Integer, nullable=False, default=1, server_default="1")
    review_assignee = Column(String(100), nullable=True, index=True)
    review_due_at = Column(DateTime(timezone=True), nullable=True, index=True)
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    published_at = Column(DateTime(timezone=True), default=datetime.now)
    published_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class TemplateSnapshotInstance(Base):
    __tablename__ = "template_snapshot_instances"
    __table_args__ = (UniqueConstraint("instance_id", name="uq_template_snapshot_instances_instance_id"), {"extend_existing": True})

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    instance_id = Column(String(100), nullable=False, index=True)
    instance_type = Column(String(50), nullable=False, index=True)
    owner_scope = Column(String(50), nullable=False, index=True)
    owner_id = Column(String(100), nullable=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=True, index=True)
    parent_id = Column(String(100), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    base_template_id = Column(String(100), nullable=True, index=True)
    base_template_version = Column(String(50), nullable=True, index=True)
    snapshot_config_json = Column(Text, nullable=False, default="{}")
    override_config_json = Column(Text, nullable=False, default="{}")
    is_detached = Column(Boolean, nullable=False, default=False, server_default="0")
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class TemplateSnapshotBackup(Base):
    __tablename__ = "template_snapshot_backups"
    __table_args__ = (UniqueConstraint("backup_id", name="uq_template_snapshot_backups_backup_id"), {"extend_existing": True})

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    backup_id = Column(String(100), nullable=False, index=True)
    target_type = Column(String(50), nullable=False, index=True)
    target_id = Column(String(100), nullable=False, index=True)
    version = Column(String(50), nullable=True, index=True)
    backup_kind = Column(String(50), nullable=False, index=True)
    program_path = Column(String(1000), nullable=True)
    database_path = Column(String(1000), nullable=True)
    backup_path = Column(String(1000), nullable=True)
    metadata_json = Column(Text, nullable=False, default="{}")
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class TemplateSnapshotLegacyMapping(Base):
    """Explicit bridge from a legacy browser `siteId` to a tenant-safe owner."""

    __tablename__ = "template_snapshot_legacy_mappings"
    __table_args__ = (
        UniqueConstraint("owner_scope", "legacy_owner_id", name="uq_template_snapshot_legacy_scope_owner"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    owner_scope = Column(String(50), nullable=False, index=True)
    legacy_owner_id = Column(String(100), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=True, index=True)
    created_by = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)


class TemplateSnapshotReleaseBatch(Base):
    """A durable server-side rollout request for one published template version."""

    __tablename__ = "template_snapshot_release_batches"
    __table_args__ = ({"extend_existing": True},)

    id = Column(String(36), primary_key=True)
    template_id = Column(String(100), nullable=False, index=True)
    template_version = Column(String(50), nullable=False, index=True)
    owner_scope = Column(String(50), nullable=False, index=True)
    # Empty means the legacy full-template release.  The only supported
    # section-only batch is the validated developer_global_frame contract.
    sections_json = Column(Text, nullable=False, default="[]", server_default="[]")
    status = Column(String(50), nullable=False, default="queued", server_default="queued", index=True)
    total_targets = Column(Integer, nullable=False, default=0, server_default="0")
    succeeded_targets = Column(Integer, nullable=False, default=0, server_default="0")
    failed_targets = Column(Integer, nullable=False, default=0, server_default="0")
    created_by = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class TemplateSnapshotReleaseTarget(Base):
    """One instance result inside a template release batch."""

    __tablename__ = "template_snapshot_release_targets"
    __table_args__ = (
        UniqueConstraint("batch_id", "instance_id", name="uq_template_snapshot_release_target"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    batch_id = Column(String(36), ForeignKey("template_snapshot_release_batches.id"), nullable=False, index=True)
    instance_id = Column(String(100), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    project_id = Column(Integer, ForeignKey("projects_platform.id"), nullable=True, index=True)
    status = Column(String(50), nullable=False, default="pending", server_default="pending", index=True)
    attempt_count = Column(Integer, nullable=False, default=0, server_default="0")
    lease_expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    result_json = Column(Text, nullable=True)
    error_message = Column(String(2000), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)


class DeveloperGlobalFrameAcceptanceJob(Base):
    """Immutable acceptance binding with a server-controlled execution state."""

    __tablename__ = "developer_global_frame_acceptance_jobs"
    __table_args__ = ({"extend_existing": True},)

    id = Column(String(36), primary_key=True)
    schema_version = Column(Integer, nullable=False, default=1, server_default="1")
    template_id = Column(
        String(100),
        ForeignKey("template_snapshot_templates.template_id"),
        nullable=False,
        index=True,
    )
    source_scope = Column(String(50), nullable=False, index=True)
    base_draft_hash = Column(String(64), nullable=False, index=True)
    frame_section_hash = Column(String(64), nullable=False, index=True)
    visual_draft_id = Column(String(200), nullable=False, index=True)
    recovery_point_id = Column(String(200), nullable=False, index=True)
    frame_section_json = Column(Text, nullable=False)
    page_registry_hash = Column(String(64), nullable=False)
    adapter_registry_hash = Column(String(64), nullable=False)
    isolation_policy_hash = Column(String(64), nullable=False)
    test_spec_hash = Column(String(64), nullable=False)
    source_build_digest = Column(String(64), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="pending", server_default="pending", index=True)
    attempt_count = Column(Integer, nullable=False, default=0, server_default="0")
    max_attempts = Column(Integer, nullable=False, default=3, server_default="3")
    worker_issuer = Column(String(100), nullable=True)
    worker_key_id = Column(String(100), nullable=True)
    claim_nonce = Column(String(100), nullable=True, index=True)
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    lease_expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    acceptance_artifact_id = Column(
        String(36),
        ForeignKey("developer_global_frame_acceptance_artifacts.id"),
        nullable=True,
        unique=True,
        index=True,
    )
    report_hash = Column(String(64), nullable=True, index=True)
    last_error_code = Column(String(100), nullable=True)
    last_error_message = Column(String(1000), nullable=True)
    requested_by = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now, nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now, nullable=False)


class DeveloperGlobalFrameAcceptanceJobEvent(Base):
    """Append-only audit event for every acceptance-job state transition."""

    __tablename__ = "developer_global_frame_acceptance_job_events"
    __table_args__ = (
        UniqueConstraint("worker_nonce", name="uq_developer_global_frame_acceptance_job_event_nonce"),
        {"extend_existing": True},
    )

    id = Column(String(36), primary_key=True)
    job_id = Column(
        String(36),
        ForeignKey("developer_global_frame_acceptance_jobs.id"),
        nullable=False,
        index=True,
    )
    event_type = Column(String(40), nullable=False, index=True)
    from_status = Column(String(30), nullable=True)
    to_status = Column(String(30), nullable=False)
    attempt_count = Column(Integer, nullable=False)
    worker_issuer = Column(String(100), nullable=True)
    worker_key_id = Column(String(100), nullable=True)
    worker_nonce = Column(String(100), nullable=True)
    error_code = Column(String(100), nullable=True)
    error_message = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now, nullable=False, index=True)


class DeveloperGlobalFrameAcceptanceWorkerNonce(Base):
    """Append-only replay barrier for every trusted-worker action, including queue misses."""

    __tablename__ = "developer_global_frame_acceptance_worker_nonces"
    __table_args__ = ({"extend_existing": True},)

    nonce = Column(String(100), primary_key=True)
    action = Column(String(40), nullable=False, index=True)
    issuer = Column(String(100), nullable=False, index=True)
    key_id = Column(String(100), nullable=False, index=True)
    source_scope = Column(String(50), nullable=False, index=True)
    job_id = Column(
        String(36),
        ForeignKey("developer_global_frame_acceptance_jobs.id"),
        nullable=True,
        index=True,
    )
    issued_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now, nullable=False, index=True)


class DeveloperGlobalFrameAcceptanceArtifact(Base):
    """Append-only HMAC-attested acceptance result produced by trusted CI."""

    __tablename__ = "developer_global_frame_acceptance_artifacts"
    __table_args__ = (
        UniqueConstraint("run_id", name="uq_developer_global_frame_acceptance_run"),
        UniqueConstraint("report_hash", name="uq_developer_global_frame_acceptance_report"),
        {"extend_existing": True},
    )

    id = Column(String(36), primary_key=True)
    schema_version = Column(Integer, nullable=False, default=1, server_default="1")
    run_id = Column(String(100), nullable=False, index=True)
    issuer = Column(String(100), nullable=False, index=True)
    key_id = Column(String(100), nullable=False, index=True)
    template_id = Column(
        String(100),
        ForeignKey("template_snapshot_templates.template_id"),
        nullable=False,
        index=True,
    )
    source_scope = Column(String(50), nullable=False, index=True)
    acceptance_job_id = Column(
        String(36),
        ForeignKey("developer_global_frame_acceptance_jobs.id"),
        nullable=False,
        unique=True,
        index=True,
    )
    base_draft_hash = Column(String(64), nullable=False, index=True)
    frame_section_hash = Column(String(64), nullable=False, index=True)
    visual_draft_id = Column(String(200), nullable=False, index=True)
    recovery_point_id = Column(String(200), nullable=False, index=True)
    page_registry_hash = Column(String(64), nullable=False)
    adapter_registry_hash = Column(String(64), nullable=False)
    isolation_policy_hash = Column(String(64), nullable=False)
    test_spec_hash = Column(String(64), nullable=False)
    source_build_digest = Column(String(64), nullable=False, index=True)
    issued_at = Column(DateTime(timezone=True), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    viewports_json = Column(Text, nullable=False)
    compatible_target_page_ids_json = Column(Text, nullable=False)
    isolated_page_ids_json = Column(Text, nullable=False)
    case_results_json = Column(Text, nullable=False)
    failure_count = Column(Integer, nullable=False, default=0, server_default="0")
    flaky_count = Column(Integer, nullable=False, default=0, server_default="0")
    skipped_count = Column(Integer, nullable=False, default=0, server_default="0")
    report_hash = Column(String(64), nullable=False)
    signature = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.now, nullable=False, index=True)


class DeveloperGlobalFramePreflightEvidence(Base):
    """Server-attested page-isolation manifest for one atomic frame draft.

    The record is append-only.  A browser can submit the opaque artifact hash,
    but the server derives the source scope, both draft hashes and the exact
    compatible/isolated target lists from the locked template transaction.
    """

    __tablename__ = "developer_global_frame_preflight_evidence"
    __table_args__ = (
        UniqueConstraint(
            "template_id",
            "artifact_hash",
            "saved_draft_hash",
            name="uq_developer_global_frame_preflight_artifact",
        ),
        {"extend_existing": True},
    )

    id = Column(String(36), primary_key=True)
    template_id = Column(String(100), nullable=False, index=True)
    source_scope = Column(String(50), nullable=False, index=True)
    base_draft_hash = Column(String(64), nullable=False)
    saved_draft_hash = Column(String(64), nullable=False, index=True)
    artifact_hash = Column(String(64), nullable=False, index=True)
    acceptance_artifact_id = Column(
        String(36),
        ForeignKey("developer_global_frame_acceptance_artifacts.id"),
        nullable=True,
        index=True,
    )
    acceptance_artifact_hash = Column(String(64), nullable=True, index=True)
    visual_draft_id = Column(String(200), nullable=True, index=True)
    compatible_target_page_ids_json = Column(Text, nullable=False, default="[]", server_default="[]")
    isolated_page_ids_json = Column(Text, nullable=False, default="[]", server_default="[]")
    recovery_point_id = Column(String(200), nullable=False)
    checked_at = Column(DateTime(timezone=True), nullable=False, index=True)
    evidence_hash = Column(String(64), nullable=False, unique=True, index=True)
    created_by = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now, nullable=False)


class DeveloperGlobalFrameFactoryDefaultReceipt(Base):
    """Append-only, server-validated factory-default pointer for one frame release."""

    __tablename__ = "developer_global_frame_factory_default_receipts"
    __table_args__ = (
        UniqueConstraint("receipt_hash", name="uq_developer_global_frame_factory_default_receipt_hash"),
        {"extend_existing": True},
    )

    id = Column(String(36), primary_key=True)
    schema_version = Column(Integer, nullable=False, default=1, server_default="1")
    template_id = Column(
        String(100),
        ForeignKey("template_snapshot_templates.template_id"),
        nullable=False,
        index=True,
    )
    source_scope = Column(String(50), nullable=False, index=True)
    rollout_owner_scope = Column(String(50), nullable=False, index=True)
    published_version = Column(String(50), nullable=False, index=True)
    preflight_evidence_id = Column(
        String(36),
        ForeignKey("developer_global_frame_preflight_evidence.id"),
        nullable=False,
        index=True,
    )
    artifact_hash = Column(String(64), nullable=False, index=True)
    draft_hash = Column(String(64), nullable=False, index=True)
    preflight_evidence_hash = Column(String(64), nullable=False, index=True)
    compatible_target_page_ids_json = Column(Text, nullable=False, default="[]", server_default="[]")
    isolated_page_ids_json = Column(Text, nullable=False, default="[]", server_default="[]")
    recovery_point_id = Column(String(200), nullable=False)
    rollout_batch_id = Column(
        String(36),
        ForeignKey("template_snapshot_release_batches.id"),
        nullable=False,
        index=True,
    )
    recorded_at = Column(DateTime(timezone=True), nullable=False, index=True)
    receipt_hash = Column(String(64), nullable=False)
    recorded_by = Column(String(255), ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now, nullable=False)
