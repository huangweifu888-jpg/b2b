"""Durable, server-side template rollout batches with per-instance outcomes."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import math
from typing import Any
from uuid import uuid4

from models.platform import AuditLog, Organization, PlanRuntimeConfig, Project
from models.template_snapshot import (
    TemplateSnapshotInstance,
    TemplateSnapshotReleaseBatch,
    TemplateSnapshotReleaseTarget,
    TemplateSnapshotTemplate,
    TemplateSnapshotVersion,
)
from services.developer_global_frame import (
    normalize_developer_global_frame_release_sections,
    require_developer_global_frame_release,
)
from services.audit import record_audit_event
from services.product_market_factory_default import (
    PRODUCT_MARKET_FACTORY_DEFAULT_CONTRACT_VERSION,
    validate_product_market_config_shape,
    validate_product_market_factory_default,
)
from services.template_instance_identity import is_canonical_client_plan_runtime_instance_id
from services.template_snapshot import TemplateSnapshotService, load_template_version_release_sections
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_release_sections(sections: list[str] | None) -> list[str]:
    return normalize_developer_global_frame_release_sections(sections)


def _load_persisted_release_sections(value: str | None) -> list[str]:
    try:
        sections = json.loads(value or "[]")
    except (TypeError, ValueError) as exc:
        raise ValueError("Release batch sections_json is corrupted") from exc
    if sections == []:
        return []
    return _normalize_release_sections(sections)


TARGET_LEASE_SECONDS = 300
MAX_TARGET_SET_RECONCILIATIONS = 3


class ReleaseTargetSetChangedError(ValueError):
    """The active client-plan set changed after a rollout batch was queued."""


class TemplateReleaseBatchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _select_all_eligible_instances(
        self,
        template: TemplateSnapshotTemplate,
    ) -> list[TemplateSnapshotInstance]:
        instances = (
            await self.db.execute(
                select(TemplateSnapshotInstance)
                .where(
                    TemplateSnapshotInstance.base_template_id == template.template_id,
                    TemplateSnapshotInstance.is_detached.is_(False),
                )
                .order_by(TemplateSnapshotInstance.id)
            )
        ).scalars().all()
        if template.owner_scope != "client_source":
            return list(instances)

        active_plans = (
            await self.db.execute(
                select(Project, Organization)
                .join(Organization, Organization.id == Project.client_org_id)
                .where(
                    Project.status == "active",
                    Organization.status == "active",
                    Organization.org_type == "client",
                )
                .order_by(Project.id)
            )
        ).all()
        if not active_plans:
            return []

        instances_by_project: dict[int, list[TemplateSnapshotInstance]] = {}
        for instance in instances:
            if instance.project_id is not None:
                instances_by_project.setdefault(instance.project_id, []).append(instance)

        eligible: list[TemplateSnapshotInstance] = []
        missing_or_invalid: list[int] = []
        for project, client in active_plans:
            candidates = instances_by_project.get(project.id, [])
            if len(candidates) != 1:
                missing_or_invalid.append(project.id)
                continue
            instance = candidates[0]
            if (
                not is_canonical_client_plan_runtime_instance_id(
                    instance.instance_id,
                    plan_code=project.code,
                    organization_id=client.id,
                    project_id=project.id,
                )
                or instance.instance_type != "client-plan"
                or instance.owner_scope != "client"
                or instance.owner_id != project.code
                or instance.organization_id != client.id
                or instance.project_id != project.id
            ):
                missing_or_invalid.append(project.id)
                continue
            eligible.append(instance)
        if missing_or_invalid:
            raise ValueError(
                f"{len(missing_or_invalid)} active client plans are missing canonical template instances"
            )
        return eligible

    async def create(
        self,
        *,
        template_id: str,
        instance_ids: list[str] | None,
        expected_version: str | None = None,
        sections: list[str] | None = None,
        created_by: str | None = None,
    ) -> dict[str, Any]:
        release_sections = _normalize_release_sections(sections)
        template = await self.db.scalar(
            select(TemplateSnapshotTemplate).where(
                TemplateSnapshotTemplate.template_id == template_id,
                TemplateSnapshotTemplate.is_published.is_(True),
            ).with_for_update()
        )
        if not template or not template.latest_version:
            raise ValueError("A published template version is required before rollout")
        if expected_version and template.latest_version != expected_version:
            raise ValueError("The published template version changed before the rollout batch was created")
        pinned_version = await self.db.scalar(
            select(TemplateSnapshotVersion).where(
                TemplateSnapshotVersion.template_id == template.template_id,
                TemplateSnapshotVersion.version == template.latest_version,
                TemplateSnapshotVersion.review_status == "published",
            )
        )
        if not pinned_version:
            raise ValueError("The current template pointer is not backed by an immutable published version")
        pinned_release_sections = load_template_version_release_sections(pinned_version.release_sections_json)
        if pinned_release_sections != release_sections and (pinned_release_sections or release_sections):
            raise ValueError("A section-only template version requires the exact persisted release sections")
        if (
            template.owner_scope == "client_source"
            and not release_sections
            and PRODUCT_MARKET_FACTORY_DEFAULT_CONTRACT_VERSION in (pinned_version.changelog or "")
        ):
            # A permanent contract-shape error must fail before a durable batch
            # is inserted; otherwise the oldest-running DB fallback would keep
            # retrying the same impossible promotion and starve later work.
            validate_product_market_config_shape(pinned_version.config_json)
        if release_sections and (
            pinned_version.required_review_steps != 2
            or pinned_version.review_step != 2
            or not pinned_version.approved_by
            or pinned_version.approved_at is None
        ):
            raise ValueError("A developer_global_frame rollout requires an exact two-review published version")
        if release_sections:
            await TemplateSnapshotService(self.db).validate_developer_global_frame_version_attestation(
                template,
                pinned_version,
                require_fresh=False,
            )
        if not release_sections:
            unresolved_full_batches = (
                await self.db.execute(
                    select(TemplateSnapshotReleaseBatch).where(
                        TemplateSnapshotReleaseBatch.template_id == template.template_id,
                        TemplateSnapshotReleaseBatch.template_version != template.latest_version,
                        TemplateSnapshotReleaseBatch.status.in_(
                            {"queued", "running", "paused", "partial_failed"}
                        ),
                    )
                )
            ).scalars().all()
            if any(
                _load_persisted_release_sections(item.sections_json) == []
                and not (item.status == "partial_failed" and item.failed_targets == 0)
                for item in unresolved_full_batches
            ):
                raise ValueError(
                    "An unresolved full rollout batch already exists for another template version"
                )
        if instance_ids:
            query = select(TemplateSnapshotInstance).where(
                TemplateSnapshotInstance.base_template_id == template.template_id,
                TemplateSnapshotInstance.is_detached.is_(False),
            )
            normalized = {item.strip() for item in instance_ids if item and item.strip()}
            if not normalized:
                raise ValueError("At least one target instance is required")
            query = query.where(TemplateSnapshotInstance.instance_id.in_(normalized))
            instances = (await self.db.execute(query.order_by(TemplateSnapshotInstance.id))).scalars().all()
        else:
            instances = await self._select_all_eligible_instances(template)
        allow_empty_client_bootstrap = (
            not instances
            and instance_ids is None
            and template.owner_scope == "client_source"
        )
        if not instances and not allow_empty_client_bootstrap:
            raise ValueError("No eligible runtime instances were found for this template")
        if instance_ids and len({item.instance_id for item in instances}) != len({item.strip() for item in instance_ids if item.strip()}):
            raise ValueError("One or more targets do not belong to the published template")

        if template.owner_scope == "client_source" and instances:
            baseline_versions = {instance.base_template_version for instance in instances}
            if None in baseline_versions or "" in baseline_versions:
                raise ValueError("One or more active client plans have no immutable template baseline")
            baseline_records = (
                await self.db.execute(
                    select(TemplateSnapshotVersion).where(
                        TemplateSnapshotVersion.template_id == template.template_id,
                        TemplateSnapshotVersion.version.in_(baseline_versions),
                        TemplateSnapshotVersion.review_status.in_(("published", "archived")),
                    )
                )
            ).scalars().all()
            if {record.version for record in baseline_records} != baseline_versions or any(
                load_template_version_release_sections(record.release_sections_json)
                for record in baseline_records
            ):
                raise ValueError("One or more active client plans have an invalid immutable template baseline")

        scopes = {instance.owner_scope for instance in instances}
        if len(scopes) > 1:
            raise ValueError("A rollout batch must contain one runtime scope")
        runtime_scope = next(iter(scopes)) if scopes else "client"
        if template.owner_scope == "client_source" and (
            runtime_scope != "client"
            or any(instance.instance_type != "client-plan" for instance in instances)
        ):
            raise ValueError("A client-source rollout can target only client-plan runtime instances")
        if template.owner_scope == "agency_source" and (
            runtime_scope != "agency"
            or any(instance.instance_type not in {"agency", "sub-agency", "third-agency"} for instance in instances)
        ):
            raise ValueError("An agency-source rollout can target only agency runtime instances")
        if release_sections:
            require_developer_global_frame_release(
                json.loads(pinned_version.config_json or "{}"),
                owner_scope=template.owner_scope,
                runtime_scope=runtime_scope,
            )

        # Treat an exact template/version/section/target set as one durable
        # rollout operation.  The template row lock serializes concurrent
        # browser clicks on databases that support row locks; the target-set
        # comparison also lets a client safely resume a queued, failed or
        # already-completed batch after a timeout without syncing successful
        # plans a second time.
        requested_target_ids = {instance.instance_id for instance in instances}
        reusable_batches = (
            await self.db.execute(
                select(TemplateSnapshotReleaseBatch)
                .where(
                    TemplateSnapshotReleaseBatch.template_id == template.template_id,
                    TemplateSnapshotReleaseBatch.template_version == template.latest_version,
                    TemplateSnapshotReleaseBatch.owner_scope == runtime_scope,
                    TemplateSnapshotReleaseBatch.status.in_(
                        {"queued", "running", "completed", "partial_failed", "paused"}
                    ),
                )
                .order_by(TemplateSnapshotReleaseBatch.created_at.desc())
            )
        ).scalars().all()
        for reusable in reusable_batches:
            # A zero-failure partial batch is the explicit terminal state for
            # a target set that kept changing during the bounded reconciliation
            # window.  A later publish request must be allowed to start fresh.
            if reusable.status == "partial_failed" and reusable.failed_targets == 0:
                continue
            if _load_persisted_release_sections(reusable.sections_json) != release_sections:
                continue
            reusable_target_ids = set(
                (
                    await self.db.execute(
                        select(TemplateSnapshotReleaseTarget.instance_id).where(
                            TemplateSnapshotReleaseTarget.batch_id == reusable.id,
                            TemplateSnapshotReleaseTarget.status != "superseded",
                        )
                    )
                ).scalars().all()
            )
            if reusable_target_ids == requested_target_ids:
                return await self.get(reusable.id)

        batch = TemplateSnapshotReleaseBatch(
            id=str(uuid4()),
            template_id=template.template_id,
            template_version=template.latest_version,
            owner_scope=runtime_scope,
            sections_json=json.dumps(release_sections, ensure_ascii=False),
            status="queued",
            total_targets=len(instances),
            completed_at=None,
            created_by=created_by,
        )
        self.db.add(batch)
        for instance in instances:
            self.db.add(
                TemplateSnapshotReleaseTarget(
                    batch_id=batch.id,
                    instance_id=instance.instance_id,
                    organization_id=instance.organization_id,
                    project_id=instance.project_id,
                    status="pending",
                )
            )
        await self.db.commit()
        return await self.get(batch.id)

    async def process(self, batch_id: str) -> dict[str, Any]:
        batch = await self._batch(batch_id)
        if batch.status == "cancelled":
            raise ValueError("A cancelled release batch cannot be processed")
        if batch.status == "partial_failed":
            return await self.get(batch.id)
        if batch.status == "completed":
            try:
                product_market_contract = await self._auto_promote_contract_release(batch)
                if not product_market_contract:
                    await self._repair_completed_client_plan_runtime_versions(batch)
                await self.db.commit()
            except ReleaseTargetSetChangedError:
                await self.db.rollback()
                if await self._reconcile_full_client_batch_targets(batch_id):
                    return await self.process(batch_id)
                return await self.get(batch_id)
            return await self.get(batch.id)
        if batch.status == "paused":
            return await self.get(batch.id)
        batch.status, batch.started_at = "running", batch.started_at or _now()
        await self.db.commit()
        release_sections = _load_persisted_release_sections(batch.sections_json)
        claimable = or_(
            TemplateSnapshotReleaseTarget.status == "pending",
            and_(
                TemplateSnapshotReleaseTarget.status == "running",
                or_(
                    TemplateSnapshotReleaseTarget.lease_expires_at.is_(None),
                    TemplateSnapshotReleaseTarget.lease_expires_at <= _now(),
                ),
            ),
        )
        targets = (
            await self.db.execute(
                select(TemplateSnapshotReleaseTarget)
                .where(TemplateSnapshotReleaseTarget.batch_id == batch.id, claimable)
                .order_by(TemplateSnapshotReleaseTarget.id)
            )
        ).scalars().all()
        target_ids = [target.id for target in targets]
        for target_id in target_ids:
            target = await self.db.scalar(
                select(TemplateSnapshotReleaseTarget).where(
                    TemplateSnapshotReleaseTarget.id == target_id
                )
            )
            if not target:
                continue
            await self.db.refresh(batch)
            if batch.status == "paused":
                break
            claim_time = _now()
            claimable_now = or_(
                TemplateSnapshotReleaseTarget.status == "pending",
                and_(
                    TemplateSnapshotReleaseTarget.status == "running",
                    or_(
                        TemplateSnapshotReleaseTarget.lease_expires_at.is_(None),
                        TemplateSnapshotReleaseTarget.lease_expires_at <= claim_time,
                    ),
                ),
            )
            claim = await self.db.execute(
                update(TemplateSnapshotReleaseTarget)
                .where(TemplateSnapshotReleaseTarget.id == target.id, claimable_now)
                .values(
                    status="running",
                    started_at=claim_time,
                    completed_at=None,
                    error_message=None,
                    lease_expires_at=claim_time + timedelta(seconds=TARGET_LEASE_SECONDS),
                    attempt_count=TemplateSnapshotReleaseTarget.attempt_count + 1,
                )
            )
            await self.db.commit()
            if claim.rowcount != 1:
                continue
            await self.db.refresh(target)
            try:
                instance = await self.db.scalar(
                    select(TemplateSnapshotInstance).where(
                        TemplateSnapshotInstance.instance_id == target.instance_id
                    ).with_for_update()
                )
                if not instance:
                    raise ValueError("Release target instance no longer exists")
                if (
                    instance.base_template_id != batch.template_id
                    or instance.owner_scope != batch.owner_scope
                    or instance.organization_id != target.organization_id
                    or instance.project_id != target.project_id
                ):
                    raise ValueError("Release target tenant binding changed after the batch was queued")
                result = await TemplateSnapshotService(self.db).sync_latest(
                    target.instance_id,
                    {
                        "sync_mode": "merge",
                        "create_backup": True,
                        "operator": batch.created_by,
                        "sections": release_sections or None,
                        "template_version": batch.template_version,
                        "expected_template_id": batch.template_id,
                        "expected_owner_scope": batch.owner_scope,
                        "expected_organization_id": target.organization_id,
                        "expected_project_id": target.project_id,
                    },
                    commit=False,
                )
                plan_runtime_version: str | None = None
                if batch.owner_scope == "client" and not release_sections and target.project_id is not None:
                    plan_runtime = await self.db.scalar(
                        select(PlanRuntimeConfig)
                        .where(PlanRuntimeConfig.project_id == target.project_id)
                        .with_for_update()
                    )
                    if not plan_runtime:
                        raise ValueError("Release target client plan has no runtime configuration")
                    if plan_runtime.status != "active":
                        raise ValueError("Release target client plan runtime configuration is not active")
                    plan_runtime.template_version = batch.template_version
                    plan_runtime_version = plan_runtime.template_version
            except Exception as exc:  # preserve the batch and allow a later retry of failed targets
                # The instance mutation and its backup belong to the same
                # transaction as the durable target outcome.  A worker crash
                # or sync error must not leave a rewritten instance behind a
                # still-retryable target.
                await self.db.rollback()
                batch = await self._batch(batch_id)
                target = await self.db.scalar(
                    select(TemplateSnapshotReleaseTarget)
                    .where(TemplateSnapshotReleaseTarget.id == target_id)
                    .with_for_update()
                )
                if not target:
                    continue
                target.status, target.error_message, target.completed_at, target.lease_expires_at = (
                    "failed",
                    f"{type(exc).__name__}: {exc}"[:2000],
                    _now(),
                    None,
                )
            else:
                target.status = "succeeded"
                target.error_message = None
                target.lease_expires_at = None
                target.result_json = json.dumps(
                    {
                        "template_version": batch.template_version,
                        "base_template_version": result.get("base_template_version"),
                        "plan_runtime_template_version": plan_runtime_version,
                        "sections": release_sections,
                    },
                    ensure_ascii=False,
                )
                target.completed_at = _now()
            await self.db.commit()

        # Keep the final batch state, Product Market default pointer and its
        # audit record in one transaction.  If promotion fails or the worker
        # exits, the previously committed running batch stays discoverable.
        await self._refresh_counts(batch)
        if batch.status == "completed":
            try:
                await self._auto_promote_contract_release(batch)
            except ReleaseTargetSetChangedError:
                await self.db.rollback()
                if await self._reconcile_full_client_batch_targets(batch_id):
                    return await self.process(batch_id)
                return await self.get(batch_id)
        await self.db.commit()
        return await self.get(batch.id)

    async def _reconcile_full_client_batch_targets(
        self,
        batch_id: str,
    ) -> bool:
        """Align a full client rollout after rechecking state under durable locks."""
        batch = await self.db.scalar(
            select(TemplateSnapshotReleaseBatch)
            .where(TemplateSnapshotReleaseBatch.id == batch_id)
            .with_for_update()
        )
        if not batch:
            raise KeyError("Template release batch not found")
        if batch.owner_scope != "client" or _load_persisted_release_sections(batch.sections_json) != []:
            raise ReleaseTargetSetChangedError(
                "Only a full client-source rollout can reconcile its active plan targets"
            )
        if batch.status in {"cancelled", "partial_failed", "paused"}:
            await self.db.commit()
            return False

        template = await self.db.scalar(
            select(TemplateSnapshotTemplate)
            .where(
                TemplateSnapshotTemplate.template_id == batch.template_id,
                TemplateSnapshotTemplate.owner_scope == "client_source",
            )
            .with_for_update()
        )
        if not template:
            raise ReleaseTargetSetChangedError(
                "The client-source template disappeared while reconciling rollout targets"
            )
        version = await self.db.scalar(
            select(TemplateSnapshotVersion).where(
                TemplateSnapshotVersion.template_id == batch.template_id,
                TemplateSnapshotVersion.version == batch.template_version,
            )
        )
        if (
            batch.status == "completed"
            and template.factory_default_release_batch_id == batch.id
        ):
            # A second worker may arrive with an exception observed before the
            # first worker committed promotion.  Certified evidence is
            # immutable once the pointer references this completed batch.
            await validate_product_market_factory_default(self.db, template)
            await self.db.commit()
            return False
        if (
            batch.status == "completed"
            and version is not None
            and await self._current_factory_default_supersedes_batch(template, batch, version)
        ):
            await self.db.commit()
            return False

        current_instances = await self._select_all_eligible_instances(template)
        current_by_id = {instance.instance_id: instance for instance in current_instances}
        current_project_ids = {
            int(instance.project_id)
            for instance in current_instances
            if instance.project_id is not None
        }
        current_runtimes = (
            await self.db.execute(
                select(PlanRuntimeConfig)
                .where(PlanRuntimeConfig.project_id.in_(current_project_ids))
                .with_for_update()
            )
        ).scalars().all() if current_project_ids else []
        runtime_by_project = {runtime.project_id: runtime for runtime in current_runtimes}
        targets = (
            await self.db.execute(
                select(TemplateSnapshotReleaseTarget)
                .where(TemplateSnapshotReleaseTarget.batch_id == batch.id)
                .with_for_update()
            )
        ).scalars().all()
        target_by_id = {target.instance_id: target for target in targets}
        active_target_by_id = {
            target.instance_id: target for target in targets if target.status != "superseded"
        }
        now = _now()

        def target_state_matches(
            instance: TemplateSnapshotInstance,
            target: TemplateSnapshotReleaseTarget,
        ) -> bool:
            if (
                target.organization_id != instance.organization_id
                or target.project_id != instance.project_id
            ):
                return False
            if target.status != "succeeded":
                return True
            runtime = runtime_by_project.get(instance.project_id)
            return (
                instance.base_template_version == batch.template_version
                and runtime is not None
                and runtime.status == "active"
                and runtime.template_version == batch.template_version
            )

        reconciliation_required = (
            set(active_target_by_id) != set(current_by_id)
            or any(
                not target_state_matches(instance, active_target_by_id[instance_id])
                for instance_id, instance in current_by_id.items()
                if instance_id in active_target_by_id
            )
        )
        if not reconciliation_required:
            # Another worker already reconciled this same observation.  Do not
            # consume another bounded attempt or rewrite its pending/succeeded
            # targets.  Return to the worker loop instead of recursively
            # re-entering promotion on the same stale/spurious exception.
            await self.db.commit()
            return False

        reconciliation_attempts = int(
            await self.db.scalar(
                select(func.count(AuditLog.id)).where(
                    AuditLog.action == "product_market_factory_default_target_set_reconciled",
                    AuditLog.target_type == "template_snapshot_release_batch",
                    AuditLog.target_id == batch.id,
                )
            )
            or 0
        )
        if reconciliation_attempts >= MAX_TARGET_SET_RECONCILIATIONS:
            batch.status = "partial_failed"
            batch.failed_targets = 0
            batch.completed_at = _now()
            record_audit_event(
                self.db,
                action="product_market_factory_default_target_set_unstable",
                actor_user_id=batch.created_by,
                target_type="template_snapshot_release_batch",
                target_id=batch.id,
                detail={
                    "template_id": batch.template_id,
                    "template_version": batch.template_version,
                    "reconciliation_attempts": reconciliation_attempts,
                },
            )
            await self.db.commit()
            return False

        for target in targets:
            if target.instance_id not in current_by_id and target.status != "superseded":
                target.status = "superseded"
                target.error_message = "Client plan left the active rollout target set"
                target.lease_expires_at = None
                target.completed_at = now

        for instance_id, instance in current_by_id.items():
            target = target_by_id.get(instance_id)
            if target is None:
                self.db.add(
                    TemplateSnapshotReleaseTarget(
                        batch_id=batch.id,
                        instance_id=instance.instance_id,
                        organization_id=instance.organization_id,
                        project_id=instance.project_id,
                        status="pending",
                    )
                )
                continue
            runtime = runtime_by_project.get(instance.project_id)
            binding_changed = (
                target.organization_id != instance.organization_id
                or target.project_id != instance.project_id
            )
            runtime_changed = (
                instance.base_template_version != batch.template_version
                or runtime is None
                or runtime.status != "active"
                or runtime.template_version != batch.template_version
            )
            if (
                target.status == "superseded"
                or binding_changed
                or (target.status == "succeeded" and runtime_changed)
            ):
                target.status = "pending"
                target.organization_id = instance.organization_id
                target.project_id = instance.project_id
                target.error_message = None
                target.result_json = None
                target.started_at = None
                target.completed_at = None
                target.lease_expires_at = None

        active_targets = [
            target for target in targets
            if target.instance_id in current_by_id and target.status != "superseded"
        ]
        batch.total_targets = len(current_instances)
        batch.succeeded_targets = sum(target.status == "succeeded" for target in active_targets)
        batch.failed_targets = sum(target.status == "failed" for target in active_targets)
        batch.status = "queued"
        batch.completed_at = None
        record_audit_event(
            self.db,
            action="product_market_factory_default_target_set_reconciled",
            actor_user_id=batch.created_by,
            target_type="template_snapshot_release_batch",
            target_id=batch.id,
            detail={
                "template_id": batch.template_id,
                "template_version": batch.template_version,
                "reconciliation_attempt": reconciliation_attempts + 1,
                "active_targets": len(current_instances),
            },
        )
        await self.db.commit()
        return True

    async def _repair_completed_client_plan_runtime_versions(
        self,
        batch: TemplateSnapshotReleaseBatch,
    ) -> None:
        """Repair legacy completed batches that predate atomic runtime-version writes."""
        if (
            batch.status != "completed"
            or batch.owner_scope != "client"
            or _load_persisted_release_sections(batch.sections_json) != []
            or batch.total_targets == 0
        ):
            return
        targets = (
            await self.db.execute(
                select(TemplateSnapshotReleaseTarget).where(
                    TemplateSnapshotReleaseTarget.batch_id == batch.id,
                    TemplateSnapshotReleaseTarget.status == "succeeded",
                )
            )
        ).scalars().all()
        if len(targets) != batch.total_targets:
            raise ValueError("Completed client rollout runtime evidence is incomplete")
        project_targets = [target for target in targets if target.project_id is not None]
        if not project_targets:
            # Older generic client-scope batches can own detached test or
            # compatibility instances without a canonical client plan.
            return
        if len(project_targets) != len(targets):
            raise ValueError("Completed client rollout runtime evidence is incomplete")
        target_by_instance_id = {target.instance_id: target for target in project_targets}
        instance_ids = {target.instance_id for target in targets}
        instances = (
            await self.db.execute(
                select(TemplateSnapshotInstance)
                .where(TemplateSnapshotInstance.instance_id.in_(instance_ids))
                .with_for_update()
            )
        ).scalars().all()
        if (
            len(instances) != len(instance_ids)
            or any(
                instance.base_template_id != batch.template_id
                or instance.base_template_version != batch.template_version
                or instance.owner_scope != "client"
                or instance.organization_id != target_by_instance_id[instance.instance_id].organization_id
                or instance.project_id != target_by_instance_id[instance.instance_id].project_id
                for instance in instances
            )
        ):
            raise ValueError("Completed client rollout instances no longer match the published version")
        project_ids = {int(target.project_id) for target in targets if target.project_id is not None}
        runtimes = (
            await self.db.execute(
                select(PlanRuntimeConfig)
                .where(PlanRuntimeConfig.project_id.in_(project_ids))
                .with_for_update()
            )
        ).scalars().all()
        if len(runtimes) != len(project_ids) or any(runtime.status != "active" for runtime in runtimes):
            raise ValueError("Completed client rollout has a missing or inactive runtime configuration")
        changed = False
        for runtime in runtimes:
            if runtime.template_version != batch.template_version:
                runtime.template_version = batch.template_version
                changed = True
        if changed:
            await self.db.commit()

    async def _auto_promote_contract_release(self, batch: TemplateSnapshotReleaseBatch) -> bool:
        """Finish the durable Product Market workflow without a live browser."""
        if (
            batch.status != "completed"
            or batch.owner_scope != "client"
            or _load_persisted_release_sections(batch.sections_json) != []
        ):
            return False
        template = await self.db.scalar(
            select(TemplateSnapshotTemplate).where(
                TemplateSnapshotTemplate.template_id == batch.template_id,
                TemplateSnapshotTemplate.owner_scope == "client_source",
            )
        )
        version = await self.db.scalar(
            select(TemplateSnapshotVersion).where(
                TemplateSnapshotVersion.template_id == batch.template_id,
                TemplateSnapshotVersion.version == batch.template_version,
            )
        )
        if (
            not template
            or not version
            or PRODUCT_MARKET_FACTORY_DEFAULT_CONTRACT_VERSION not in (version.changelog or "")
        ):
            return False
        if (
            template.factory_default_release_batch_id == batch.id
            and template.factory_default_version == batch.template_version
            and template.factory_default_contract_version
                == PRODUCT_MARKET_FACTORY_DEFAULT_CONTRACT_VERSION
        ):
            await validate_product_market_factory_default(self.db, template)
            return True
        if await self._current_factory_default_supersedes_batch(template, batch, version):
            return True
        await self.promote_product_market_factory_default(
            template_id=batch.template_id,
            release_batch_id=batch.id,
            contract_version=PRODUCT_MARKET_FACTORY_DEFAULT_CONTRACT_VERSION,
            promoted_by=batch.created_by,
        )
        return True

    async def _current_factory_default_supersedes_batch(
        self,
        template: TemplateSnapshotTemplate,
        batch: TemplateSnapshotReleaseBatch,
        version: TemplateSnapshotVersion,
    ) -> bool:
        current_batch_id = template.factory_default_release_batch_id
        if not current_batch_id or current_batch_id == batch.id:
            return False
        current_version = await self.db.scalar(
            select(TemplateSnapshotVersion).where(
                TemplateSnapshotVersion.template_id == template.template_id,
                TemplateSnapshotVersion.version == template.factory_default_version,
            )
        )
        if not current_version:
            return False
        if current_version.id > version.id:
            return True
        if current_version.id < version.id:
            return False
        current_batch = await self.db.scalar(
            select(TemplateSnapshotReleaseBatch).where(
                TemplateSnapshotReleaseBatch.id == current_batch_id,
                TemplateSnapshotReleaseBatch.template_id == template.template_id,
            )
        )
        if not current_batch:
            return False
        if current_batch.created_at and batch.created_at:
            if current_batch.created_at != batch.created_at:
                return current_batch.created_at > batch.created_at
        return current_batch.id >= batch.id

    async def pause(self, batch_id: str) -> dict[str, Any]:
        batch = await self._batch(batch_id)
        if batch.status not in {"queued", "running"}:
            raise ValueError("Only an active batch can be paused")
        batch.status = "paused"
        await self.db.commit()
        return await self.get(batch.id)

    async def cancel(self, batch_id: str) -> dict[str, Any]:
        batch = await self._batch(batch_id)
        if batch.status not in {"queued", "paused", "partial_failed"}:
            raise ValueError("Only a queued, paused, or partial-failed release batch can be cancelled")
        now = _now()
        active_lease = await self.db.scalar(
            select(TemplateSnapshotReleaseTarget.id).where(
                TemplateSnapshotReleaseTarget.batch_id == batch.id,
                TemplateSnapshotReleaseTarget.status == "running",
                TemplateSnapshotReleaseTarget.lease_expires_at > now,
            ).limit(1)
        )
        if active_lease is not None:
            raise ValueError("A release batch with an active target lease cannot be cancelled")
        cancellable_targets = (
            await self.db.execute(
                select(TemplateSnapshotReleaseTarget).where(
                    TemplateSnapshotReleaseTarget.batch_id == batch.id,
                    TemplateSnapshotReleaseTarget.status.in_({"pending", "running", "failed"}),
                )
            )
        ).scalars().all()
        for target in cancellable_targets:
            target.status = "cancelled"
            target.lease_expires_at = None
            target.completed_at = now
        batch.status = "cancelled"
        batch.completed_at = now
        await self.db.commit()
        return await self.get(batch.id)

    async def retry_failed(self, batch_id: str) -> dict[str, Any]:
        batch = await self._batch(batch_id)
        if batch.status == "cancelled":
            raise ValueError("A cancelled release batch cannot be retried")
        failed = (
            await self.db.execute(
                select(TemplateSnapshotReleaseTarget).where(
                    TemplateSnapshotReleaseTarget.batch_id == batch.id,
                    TemplateSnapshotReleaseTarget.status == "failed",
                )
            )
        ).scalars().all()
        if not failed:
            raise ValueError("This batch has no failed targets to retry")
        for target in failed:
            target.status, target.error_message, target.started_at, target.completed_at, target.lease_expires_at = (
                "pending", None, None, None, None
            )
        batch.status, batch.completed_at = "queued", None
        await self.db.commit()
        return await self.get(batch.id)

    async def resume(self, batch_id: str) -> dict[str, Any]:
        batch = await self._batch(batch_id)
        if batch.status != "paused":
            raise ValueError("Only a paused release batch can be resumed")
        now = _now()
        active = await self.db.scalar(
            select(TemplateSnapshotReleaseTarget.id).where(
                TemplateSnapshotReleaseTarget.batch_id == batch.id,
                TemplateSnapshotReleaseTarget.status == "running",
                TemplateSnapshotReleaseTarget.lease_expires_at > now,
            ).limit(1)
        )
        if active is not None:
            raise ValueError("The paused batch still has an active target lease; retry after it settles")
        await self.db.execute(
            update(TemplateSnapshotReleaseTarget)
            .where(
                TemplateSnapshotReleaseTarget.batch_id == batch.id,
                TemplateSnapshotReleaseTarget.status == "running",
            )
            .values(status="pending", lease_expires_at=None, started_at=None)
        )
        batch.status, batch.completed_at = "queued", None
        await self.db.commit()
        return await self.get(batch.id)

    async def list(self, *, template_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        query = select(TemplateSnapshotReleaseBatch)
        if template_id:
            query = query.where(TemplateSnapshotReleaseBatch.template_id == template_id)
        query = query.order_by(TemplateSnapshotReleaseBatch.created_at.desc()).limit(limit)
        batches = (await self.db.execute(query)).scalars().all()
        return [await self._serialize(batch) for batch in batches]

    async def get(self, batch_id: str) -> dict[str, Any]:
        return await self._serialize(await self._batch(batch_id))

    async def promote_product_market_factory_default(
        self,
        *,
        template_id: str,
        release_batch_id: str,
        contract_version: str,
        promoted_by: str | None,
    ) -> dict[str, Any]:
        template = (
            await self.db.execute(
                select(TemplateSnapshotTemplate)
                .where(TemplateSnapshotTemplate.template_id == template_id)
                .with_for_update()
            )
        ).scalar_one_or_none()
        if not template:
            raise KeyError("Template not found")
        if template.owner_scope != "client_source":
            raise ValueError("Only a client-source Product Market template can become this factory default")
        if contract_version != PRODUCT_MARKET_FACTORY_DEFAULT_CONTRACT_VERSION:
            raise ValueError("Unsupported Product Market factory-default contract version")
        batch = await self._batch(release_batch_id)
        if (
            batch.template_id != template.template_id
            or batch.owner_scope != "client"
            or _load_persisted_release_sections(batch.sections_json) != []
        ):
            raise ValueError("Factory-default promotion requires a full client-source release batch")
        if (
            batch.status != "completed"
            or batch.succeeded_targets != batch.total_targets
            or batch.failed_targets != 0
        ):
            raise ValueError("Factory-default promotion requires every client-plan target to succeed")
        version = await self.db.scalar(
            select(TemplateSnapshotVersion).where(
                TemplateSnapshotVersion.template_id == template.template_id,
                TemplateSnapshotVersion.version == batch.template_version,
                TemplateSnapshotVersion.review_status.in_(("published", "archived")),
            )
        )
        if not version:
            raise ValueError("Factory-default promotion requires an immutable published version")
        if PRODUCT_MARKET_FACTORY_DEFAULT_CONTRACT_VERSION not in (version.changelog or ""):
            raise ValueError("Factory-default promotion requires exact Product Market lifecycle evidence")
        validate_product_market_config_shape(version.config_json)
        if (
            template.factory_default_release_batch_id == batch.id
            and template.factory_default_version == batch.template_version
            and template.factory_default_contract_version
            and template.factory_default_contract_version != contract_version
        ):
            raise ValueError("A completed rollout batch cannot be re-certified under a different contract")
        if await self._current_factory_default_supersedes_batch(template, batch, version):
            raise ValueError(
                "A factory-default rollout cannot replace a newer publication or release batch"
            )
        targets = (
            await self.db.execute(
                select(TemplateSnapshotReleaseTarget).where(
                    TemplateSnapshotReleaseTarget.batch_id == batch.id
                )
            )
        ).scalars().all()
        current_instances = await self._select_all_eligible_instances(template)
        current_target_ids = {instance.instance_id for instance in current_instances}
        batch_target_ids = {
            target.instance_id for target in targets if target.status != "superseded"
        }
        if current_target_ids != batch_target_ids:
            raise ReleaseTargetSetChangedError(
                "Factory-default rollout does not cover every currently active client plan"
            )
        active_targets = [
            target for target in targets if target.instance_id in current_target_ids
        ]
        if (
            len(active_targets) != batch.total_targets
            or any(target.status != "succeeded" for target in active_targets)
        ):
            raise ValueError("Factory-default promotion target evidence is incomplete")
        if any(
            instance.owner_scope != "client"
            or instance.instance_type != "client-plan"
            or instance.base_template_version != batch.template_version
            for instance in current_instances
        ):
            raise ReleaseTargetSetChangedError(
                "Factory-default rollout contains a stale or non-client-plan runtime target"
            )
        current_project_ids = {
            int(instance.project_id)
            for instance in current_instances
            if instance.project_id is not None
        }
        current_runtimes = (
            await self.db.execute(
                select(PlanRuntimeConfig)
                .where(PlanRuntimeConfig.project_id.in_(current_project_ids))
                .with_for_update()
            )
        ).scalars().all() if current_project_ids else []
        if (
            len(current_project_ids) != len(current_instances)
            or len(current_runtimes) != len(current_project_ids)
            or any(
                runtime.status != "active"
                or runtime.template_version != batch.template_version
                for runtime in current_runtimes
            )
        ):
            raise ReleaseTargetSetChangedError(
                "Factory-default rollout contains a missing, inactive, or stale client-plan runtime configuration"
            )

        if (
            template.factory_default_version != batch.template_version
            or template.factory_default_release_batch_id != batch.id
            or template.factory_default_contract_version != contract_version
        ):
            template.factory_default_version = batch.template_version
            template.factory_default_release_batch_id = batch.id
            template.factory_default_contract_version = contract_version
            template.factory_default_promoted_at = _now()
            template.factory_default_promoted_by = promoted_by
            template.updated_at = _now()
            record_audit_event(
                self.db,
                action="product_market_factory_default_promoted",
                actor_user_id=promoted_by,
                target_type="template_snapshot_template",
                target_id=template_id,
                detail={
                    "factory_default_version": batch.template_version,
                    "release_batch_id": batch.id,
                    "contract_version": contract_version,
                    "targets": batch.total_targets,
                    "source": "template_release_batch_service",
                },
            )
            await self.db.commit()
            await self.db.refresh(template)
        return await self._serialize_product_market_factory_default(template, batch, version)

    async def get_product_market_factory_default(self, template_id: str) -> dict[str, Any]:
        template = await self.db.scalar(
            select(TemplateSnapshotTemplate).where(
                TemplateSnapshotTemplate.template_id == template_id
            )
        )
        if not template:
            raise KeyError("Template not found")
        if template.owner_scope != "client_source":
            raise ValueError("Only a client-source template owns this Product Market factory default")
        validated = await validate_product_market_factory_default(self.db, template)
        if not validated:
            raise KeyError("The template has no confirmed Product Market factory default")
        version, batch = validated
        return await self._serialize_product_market_factory_default(template, batch, version)

    async def _serialize_product_market_factory_default(
        self,
        template: TemplateSnapshotTemplate,
        batch: TemplateSnapshotReleaseBatch,
        version: TemplateSnapshotVersion,
    ) -> dict[str, Any]:
        if (
            batch.id != template.factory_default_release_batch_id
            or batch.template_id != template.template_id
            or batch.template_version != template.factory_default_version
            or batch.status != "completed"
            or batch.succeeded_targets != batch.total_targets
            or batch.failed_targets != 0
            or _load_persisted_release_sections(batch.sections_json) != []
            or not template.factory_default_promoted_at
            or not template.factory_default_contract_version
        ):
            raise ValueError("The Product Market factory-default pointer failed integrity validation")
        covered_areas = validate_product_market_config_shape(version.config_json)
        return {
            "template_id": template.template_id,
            "source_scope": "client_source",
            "rollout_owner_scope": "client",
            "factory_default_version": version.version,
            "factory_default_config_json": json.loads(version.config_json or "{}"),
            "factory_default_release_batch_id": batch.id,
            "factory_default_contract_version": template.factory_default_contract_version,
            "total_targets": batch.total_targets,
            "succeeded_targets": batch.succeeded_targets,
            "failed_targets": 0,
            "promoted_at": template.factory_default_promoted_at,
            "promoted_by": template.factory_default_promoted_by,
            "covered_areas": covered_areas,
            "valid": True,
        }

    async def _batch(self, batch_id: str) -> TemplateSnapshotReleaseBatch:
        batch = await self.db.scalar(select(TemplateSnapshotReleaseBatch).where(TemplateSnapshotReleaseBatch.id == batch_id))
        if not batch:
            raise KeyError("Template release batch not found")
        return batch

    async def _refresh_counts(self, batch: TemplateSnapshotReleaseBatch) -> None:
        targets = (
            await self.db.execute(select(TemplateSnapshotReleaseTarget).where(TemplateSnapshotReleaseTarget.batch_id == batch.id))
        ).scalars().all()
        active_targets = [target for target in targets if target.status != "superseded"]
        batch.total_targets = len(active_targets)
        batch.succeeded_targets = sum(target.status == "succeeded" for target in active_targets)
        batch.failed_targets = sum(target.status == "failed" for target in active_targets)
        pending = any(target.status in {"pending", "running"} for target in active_targets)
        if batch.status != "paused" and not pending:
            batch.status = "partial_failed" if batch.failed_targets else "completed"
            batch.completed_at = _now()

    async def _serialize(self, batch: TemplateSnapshotReleaseBatch) -> dict[str, Any]:
        targets = (
            await self.db.execute(
                select(TemplateSnapshotReleaseTarget)
                .where(TemplateSnapshotReleaseTarget.batch_id == batch.id)
                .order_by(TemplateSnapshotReleaseTarget.id)
            )
        ).scalars().all()
        running_targets = [target for target in targets if target.status == "running"]
        retry_after_seconds: int | None = None
        if batch.status == "running" and running_targets:
            now = _now()
            waits: list[int] = []
            for target in running_targets:
                lease = target.lease_expires_at
                if lease is None:
                    waits.append(1)
                    continue
                if lease.tzinfo is None:
                    lease = lease.replace(tzinfo=timezone.utc)
                waits.append(max(1, math.ceil((lease - now).total_seconds())))
            retry_after_seconds = min(waits) if waits else 1
        return {
            "id": batch.id,
            "template_id": batch.template_id,
            "template_version": batch.template_version,
            "owner_scope": batch.owner_scope,
            "sections": _load_persisted_release_sections(batch.sections_json),
            "status": batch.status,
            "total_targets": batch.total_targets,
            "succeeded_targets": batch.succeeded_targets,
            "failed_targets": batch.failed_targets,
            "created_at": batch.created_at,
            "started_at": batch.started_at,
            "completed_at": batch.completed_at,
            "retry_after_seconds": retry_after_seconds,
            "targets": [
                {
                    "instance_id": target.instance_id,
                    "organization_id": target.organization_id,
                    "project_id": target.project_id,
                    "status": target.status,
                    "attempt_count": target.attempt_count,
                    "lease_expires_at": target.lease_expires_at,
                    "error_message": target.error_message,
                    "result": json.loads(target.result_json) if target.result_json else None,
                }
                for target in targets
            ],
        }
