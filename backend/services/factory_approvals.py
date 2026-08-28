"""Cross-domain approval control plane with immutable evidence and explicit handoffs."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_approvals import (
    FactoryApprovalAction, FactoryApprovalDelegation, FactoryApprovalEvidence,
    FactoryApprovalHandoff, FactoryApprovalRequest, FactoryApprovalStep,
    FactoryApprovalWorkflow, FactoryApprovalWorkflowVersion,
)
from models.factory_cpq import FactoryCpqQuote
from models.factory_erp import FactoryErpPosting
from models.factory_finance import FactoryFinanceDocument
from models.factory_people import FactoryPeopleContract
from models.factory_procurement import FactoryPurchaseOrder
from models.factory_recruiting import FactoryRecruitingOffer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


SUBJECTS = {
    "cpq-quote": (FactoryCpqQuote, "quote_number", "status", {"draft"}),
    "purchase-order": (FactoryPurchaseOrder, "purchase_order_number", "lifecycle_status", {"draft"}),
    "finance-document": (FactoryFinanceDocument, "document_number", "status", {"draft"}),
    "people-contract": (FactoryPeopleContract, "contract_number", "status", {"pending-approval"}),
    "recruiting-offer": (FactoryRecruitingOffer, "offer_number", "status", {"draft"}),
    "erp-posting": (FactoryErpPosting, "posting_number", "status", {"submitted"}),
}
CHANNELS = {"web", "mobile", "api"}


def _number(prefix: str, project_id: int) -> str:
    now = datetime.now(timezone.utc)
    return f"{prefix}-{project_id}-{now.strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"


def _context(context: TenantContext, project_id: int) -> dict[str, object]:
    return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id,
            "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}


def _serialize(item, fields):
    return {field: getattr(item, field) for field in fields}


WORKFLOW = ("id", "workflow_number", "workflow_code", "workflow_name", "subject_type", "status", "current_version", "authored_by", "approved_by", "approved_at", "revision")
VERSION = ("id", "version_number_ref", "workflow_id", "workflow_number", "version_number", "steps_json", "sla_hours", "allow_delegation", "require_source_revision", "status", "created_by", "activated_by", "activated_at")
REQUEST = ("id", "request_number", "request_reference", "workflow_id", "workflow_number", "workflow_version_id", "workflow_version", "subject_type", "subject_id", "subject_number", "subject_revision", "subject_status_snapshot", "subject_snapshot_json", "business_reason", "evidence_reference", "status", "current_sequence", "requested_by", "requested_at", "due_at", "decided_at", "revision")
STEP = ("id", "step_number", "request_id", "request_number", "sequence", "step_name", "assignee_reference", "status", "due_at", "acted_by", "acted_as_delegate", "acted_at", "revision")
ACTION = ("id", "action_number", "request_id", "request_number", "step_id", "sequence", "action", "reason", "evidence_reference", "actor_reference", "acting_for_reference", "channel", "source_revision_verified", "created_at")
DELEGATION = ("id", "delegation_number", "workflow_id", "subject_type", "delegator_reference", "delegate_reference", "starts_at", "ends_at", "reason", "evidence_reference", "status", "created_by", "revision")
HANDOFF = ("id", "handoff_number", "request_id", "request_number", "subject_type", "subject_id", "subject_number", "subject_revision", "status", "created_by", "acknowledged_by", "acknowledged_at", "acknowledgement_reference", "revision")


class FactoryApprovalService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        async def rows(model, order):
            return (await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500))).scalars().all()
        workflows = await rows(FactoryApprovalWorkflow, FactoryApprovalWorkflow.created_at)
        versions = await rows(FactoryApprovalWorkflowVersion, FactoryApprovalWorkflowVersion.created_at)
        requests = await rows(FactoryApprovalRequest, FactoryApprovalRequest.requested_at)
        steps = await rows(FactoryApprovalStep, FactoryApprovalStep.due_at)
        actions = await rows(FactoryApprovalAction, FactoryApprovalAction.created_at)
        delegations = await rows(FactoryApprovalDelegation, FactoryApprovalDelegation.created_at)
        handoffs = await rows(FactoryApprovalHandoff, FactoryApprovalHandoff.created_at)
        evidence = await rows(FactoryApprovalEvidence, FactoryApprovalEvidence.created_at)
        eligible_sources = []
        for subject_type, (model, number_field, status_field, eligible_statuses) in SUBJECTS.items():
            source_rows = (await self.db.execute(select(model).where(model.project_id == project_id))).scalars().all()
            eligible_sources.extend({"subject_type": subject_type, "id": source.id,
                "number": str(getattr(source, number_field)), "status": str(getattr(source, status_field)),
                "revision": int(source.revision)} for source in source_rows if str(getattr(source, status_field)) in eligible_statuses)
        now = datetime.now(timezone.utc)
        decided = [x for x in requests if x.decided_at]
        durations = sorted((self._aware(x.decided_at) - self._aware(x.requested_at)).total_seconds() / 3600 for x in decided)
        median = 0 if not durations else durations[len(durations) // 2]
        overdue = [x for x in requests if x.status == "in-review" and self._aware(x.due_at) < now]
        return {
            "workflows": [_serialize(x, WORKFLOW) for x in workflows],
            "workflow_versions": [_serialize(x, VERSION) for x in versions],
            "requests": [_serialize(x, REQUEST) for x in requests],
            "steps": [_serialize(x, STEP) for x in steps],
            "actions": [_serialize(x, ACTION) for x in actions],
            "delegations": [_serialize(x, DELEGATION) for x in delegations],
            "handoffs": [_serialize(x, HANDOFF) for x in handoffs],
            "evidence": [{"id": x.id, "subject_type": x.subject_type, "subject_id": x.subject_id,
                          "evidence_type": x.evidence_type, "evidence_reference": x.evidence_reference,
                          "recorded_by": x.recorded_by} for x in evidence],
            "eligible_sources": eligible_sources,
            "metrics": {"active_workflows": sum(x.status == "active" for x in workflows),
                        "pending_requests": sum(x.status == "in-review" for x in requests),
                        "median_approval_hours": round(median, 2),
                        "overdue_rate_percent": round(len(overdue) * 100 / max(1, len([x for x in requests if x.status == "in-review"])), 2)},
            "contract": {"domain_records_remain_authoritative": True, "source_revision_pinned": True,
                         "requester_self_approval": False, "ordered_steps": True,
                         "delegation_expands_permission": False, "mobile_approval_lowers_assurance": False,
                         "final_approval_mutates_domain_record": False, "domain_handoff_acknowledgement_required": True,
                         "supported_subject_types": sorted(SUBJECTS)},
        }

    async def create_workflow(self, *, project_id: int, context: TenantContext, actor: str,
                              workflow_code: str, workflow_name: str, subject_type: str,
                              steps: list[dict[str, object]], sla_hours: int, allow_delegation: bool):
        if subject_type not in SUBJECTS:
            raise ValueError("Unsupported approval subject type")
        normalized = self._steps(steps, sla_hours)
        if not workflow_code.strip() or not workflow_name.strip():
            raise ValueError("Workflow code and name are required")
        item = FactoryApprovalWorkflow(id=f"approval-workflow-{secrets.token_urlsafe(18)}", **_context(context, project_id),
            workflow_number=_number("APWF", project_id), workflow_code=workflow_code.strip()[:100],
            workflow_name=workflow_name.strip()[:255], subject_type=subject_type, authored_by=str(actor), updated_by=str(actor))
        version = FactoryApprovalWorkflowVersion(id=f"approval-version-{secrets.token_urlsafe(18)}", **_context(context, project_id),
            version_number_ref=_number("APWV", project_id), workflow_id=item.id, workflow_number=item.workflow_number,
            version_number=1, steps_json=json.dumps(normalized, ensure_ascii=False), sla_hours=sla_hours,
            allow_delegation=bool(allow_delegation), require_source_revision=True, created_by=str(actor))
        self.db.add_all([item, version])
        await self._evidence(item, "workflow", "workflow-authored", f"workflow:{item.workflow_number}", "Authored governed approval workflow version 1", actor)
        await self.db.flush()
        return {"workflow": _serialize(item, WORKFLOW), "version": _serialize(version, VERSION)}

    async def approve_workflow(self, item_id: str, *, project_id: int, actor: str,
                               expected_revision: int, approval_reference: str):
        item = await self._get(FactoryApprovalWorkflow, item_id, project_id, "Approval workflow")
        self._revision(item, expected_revision)
        if item.status != "draft":
            raise ValueError("Only draft approval workflows can be activated")
        if item.authored_by == str(actor):
            raise ValueError("Approval workflow approver must be independent from the author")
        if not approval_reference.strip():
            raise ValueError("Workflow activation requires approval evidence")
        version = await self.db.scalar(select(FactoryApprovalWorkflowVersion).where(
            FactoryApprovalWorkflowVersion.workflow_id == item.id,
            FactoryApprovalWorkflowVersion.version_number == item.current_version))
        if not version:
            raise ValueError("Workflow version is missing")
        now = datetime.now(timezone.utc)
        item.status = "active"; item.approved_by = str(actor); item.approved_at = now
        item.approval_reference = approval_reference.strip()[:500]; item.updated_by = str(actor); item.revision += 1
        version.status = "active"; version.activated_by = str(actor); version.activated_at = now
        await self._evidence(item, "workflow", "workflow-activated", approval_reference, "Independently activated immutable workflow version", actor)
        await self.db.flush()
        return _serialize(item, WORKFLOW)

    async def create_request(self, *, project_id: int, context: TenantContext, actor: str,
                             workflow_id: str, subject_id: str, subject_revision: int,
                             request_reference: str, business_reason: str, evidence_reference: str):
        workflow = await self._get(FactoryApprovalWorkflow, workflow_id, project_id, "Approval workflow")
        if workflow.status != "active":
            raise ValueError("Approval request requires an active workflow")
        source, number, status = await self._source(workflow.subject_type, subject_id, project_id)
        if int(source.revision) != int(subject_revision):
            raise ValueError(f"Approval source revision conflict: expected {subject_revision}, current {source.revision}")
        if len(business_reason.strip()) < 8 or not request_reference.strip() or not evidence_reference.strip():
            raise ValueError("Approval request requires reference, business reason and evidence")
        duplicate = await self.db.scalar(select(FactoryApprovalRequest.id).where(
            FactoryApprovalRequest.project_id == project_id, FactoryApprovalRequest.subject_type == workflow.subject_type,
            FactoryApprovalRequest.subject_id == subject_id, FactoryApprovalRequest.status == "in-review"))
        if duplicate:
            raise ValueError("Source record already has an active approval request")
        version = await self.db.scalar(select(FactoryApprovalWorkflowVersion).where(
            FactoryApprovalWorkflowVersion.workflow_id == workflow.id,
            FactoryApprovalWorkflowVersion.version_number == workflow.current_version,
            FactoryApprovalWorkflowVersion.status == "active"))
        if not version:
            raise ValueError("Active workflow version is missing")
        now = datetime.now(timezone.utc); definitions = json.loads(version.steps_json)
        request = FactoryApprovalRequest(id=f"approval-request-{secrets.token_urlsafe(18)}", **_context(context, project_id),
            request_number=_number("APRQ", project_id), request_reference=request_reference.strip()[:255],
            workflow_id=workflow.id, workflow_number=workflow.workflow_number, workflow_version_id=version.id,
            workflow_version=version.version_number, subject_type=workflow.subject_type, subject_id=source.id,
            subject_number=number, subject_revision=source.revision, subject_status_snapshot=status,
            subject_snapshot_json=json.dumps({"id": source.id, "number": number, "revision": source.revision, "status": status}, ensure_ascii=False),
            business_reason=business_reason.strip(), evidence_reference=evidence_reference.strip()[:500],
            requested_by=str(actor), requested_at=now, due_at=now + timedelta(hours=version.sla_hours), updated_by=str(actor))
        self.db.add(request)
        for definition in definitions:
            sequence = int(definition["sequence"])
            self.db.add(FactoryApprovalStep(id=f"approval-step-{secrets.token_urlsafe(18)}", **_context(context, project_id),
                step_number=_number("APST", project_id), request_id=request.id, request_number=request.request_number,
                sequence=sequence, step_name=str(definition["name"]), assignee_reference=str(definition["assignee_reference"]),
                due_at=now + timedelta(hours=int(definition["due_hours"]))))
        await self._action(request, None, "submitted", business_reason, evidence_reference, actor, None, "api", True)
        await self._evidence(request, "request", "request-submitted", evidence_reference, "Pinned source revision and submitted ordered approval request", actor)
        await self.db.flush()
        return _serialize(request, REQUEST)

    async def review_step(self, item_id: str, *, project_id: int, actor: str, expected_revision: int,
                          decision: str, reason: str, evidence_reference: str, channel: str):
        item = await self._get(FactoryApprovalRequest, item_id, project_id, "Approval request")
        self._revision(item, expected_revision)
        if item.status != "in-review" or decision not in {"approve", "reject", "return"}:
            raise ValueError("Only in-review requests accept approve, reject or return")
        if channel not in CHANNELS or len(reason.strip()) < 8 or not evidence_reference.strip():
            raise ValueError("Approval action requires valid channel, reason and evidence")
        source, _, _ = await self._source(item.subject_type, item.subject_id, project_id)
        if int(source.revision) != int(item.subject_revision):
            raise ValueError(f"Approval source revision conflict: pinned {item.subject_revision}, current {source.revision}")
        step = await self.db.scalar(select(FactoryApprovalStep).where(
            FactoryApprovalStep.request_id == item.id, FactoryApprovalStep.sequence == item.current_sequence))
        if not step or step.status != "pending":
            raise ValueError("Current approval step is unavailable")
        acting_for = None
        if step.assignee_reference != str(actor):
            delegation = await self._delegation(item, step.assignee_reference, str(actor))
            if not delegation:
                raise ValueError("Actor is not the assigned approver or an active authorized delegate")
            acting_for = step.assignee_reference
        if str(actor) == item.requested_by:
            raise ValueError("Approval requester cannot approve their own request")
        now = datetime.now(timezone.utc)
        step.status = "approved" if decision == "approve" else decision + "ed"
        step.acted_by = str(actor); step.acted_as_delegate = acting_for is not None; step.acted_at = now; step.revision += 1
        await self._action(item, step, decision, reason, evidence_reference, actor, acting_for, channel, True)
        if decision == "approve":
            next_step = await self.db.scalar(select(FactoryApprovalStep).where(
                FactoryApprovalStep.request_id == item.id, FactoryApprovalStep.sequence == item.current_sequence + 1))
            if next_step:
                item.current_sequence += 1
            else:
                item.status = "approved"; item.decided_at = now
                handoff = FactoryApprovalHandoff(id=f"approval-handoff-{secrets.token_urlsafe(18)}",
                    project_id=item.project_id, agent_path=item.agent_path, tenant_id=item.tenant_id,
                    client_id=item.client_id, plan_id=item.plan_id, handoff_number=_number("APHF", project_id),
                    request_id=item.id, request_number=item.request_number, subject_type=item.subject_type,
                    subject_id=item.subject_id, subject_number=item.subject_number, subject_revision=item.subject_revision,
                    created_by=str(actor))
                self.db.add(handoff)
                await self._evidence(handoff, "handoff", "handoff-ready", evidence_reference,
                    "Final orchestration approval is ready for explicit domain-system acknowledgement; source was not mutated", actor)
        else:
            item.status = "rejected" if decision == "reject" else "returned"; item.decided_at = now
        item.updated_by = str(actor); item.revision += 1
        await self._evidence(item, "request", f"request-{decision}", evidence_reference, f"Recorded {decision} at ordered step {step.sequence}", actor)
        await self.db.flush()
        return _serialize(item, REQUEST)

    async def create_delegation(self, *, project_id: int, context: TenantContext, actor: str,
                                workflow_id: str | None, subject_type: str | None,
                                delegator_reference: str, delegate_reference: str,
                                starts_at: datetime, ends_at: datetime, reason: str, evidence_reference: str):
        if workflow_id:
            workflow = await self._get(FactoryApprovalWorkflow, workflow_id, project_id, "Approval workflow")
            if workflow.status != "active": raise ValueError("Delegation workflow must be active")
            if subject_type and subject_type != workflow.subject_type: raise ValueError("Delegation subject does not match workflow")
        if subject_type and subject_type not in SUBJECTS: raise ValueError("Unsupported delegation subject type")
        if delegator_reference.strip() == delegate_reference.strip(): raise ValueError("Delegator and delegate must be different")
        if self._aware(ends_at) <= self._aware(starts_at) or self._aware(ends_at) <= datetime.now(timezone.utc):
            raise ValueError("Delegation must be time-bound into the future")
        if len(reason.strip()) < 8 or not evidence_reference.strip(): raise ValueError("Delegation requires reason and evidence")
        item = FactoryApprovalDelegation(id=f"approval-delegation-{secrets.token_urlsafe(18)}", **_context(context, project_id),
            delegation_number=_number("APDG", project_id), workflow_id=workflow_id, subject_type=subject_type,
            delegator_reference=delegator_reference.strip()[:255], delegate_reference=delegate_reference.strip()[:255],
            starts_at=self._aware(starts_at), ends_at=self._aware(ends_at), reason=reason.strip(),
            evidence_reference=evidence_reference.strip()[:500], created_by=str(actor))
        self.db.add(item); await self._evidence(item, "delegation", "delegation-created", evidence_reference,
            "Created time-bound scoped delegation; permissions are not expanded", actor)
        await self.db.flush(); return _serialize(item, DELEGATION)

    async def acknowledge_handoff(self, item_id: str, *, project_id: int, actor: str,
                                  expected_revision: int, acknowledgement_reference: str):
        item = await self._get(FactoryApprovalHandoff, item_id, project_id, "Approval handoff")
        self._revision(item, expected_revision)
        if item.status != "ready" or not acknowledgement_reference.strip():
            raise ValueError("Only ready handoffs can be acknowledged with evidence")
        source, _, _ = await self._source(item.subject_type, item.subject_id, project_id)
        if int(source.revision) != int(item.subject_revision):
            raise ValueError("Domain source changed after approval; create a new approval request")
        request = await self._get(FactoryApprovalRequest, item.request_id, project_id, "Approval request")
        if request.requested_by == str(actor):
            raise ValueError("Approval requester cannot acknowledge the domain handoff")
        item.status = "acknowledged"; item.acknowledged_by = str(actor); item.acknowledged_at = datetime.now(timezone.utc)
        item.acknowledgement_reference = acknowledgement_reference.strip()[:500]; item.revision += 1
        await self._evidence(item, "handoff", "handoff-acknowledged", acknowledgement_reference,
            "Domain owner acknowledged receipt without mutating the authoritative source record", actor)
        await self.db.flush(); return _serialize(item, HANDOFF)

    async def _source(self, subject_type: str, subject_id: str, project_id: int):
        spec = SUBJECTS.get(subject_type)
        if not spec: raise ValueError("Unsupported approval subject type")
        model, number_field, status_field, eligible = spec
        item = await self.db.scalar(select(model).where(model.id == subject_id, model.project_id == project_id))
        if not item: raise KeyError("Approval source record not found in this tenant plan")
        status = str(getattr(item, status_field))
        if status not in eligible: raise ValueError(f"Approval source status {status} is not eligible")
        return item, str(getattr(item, number_field)), status

    async def _delegation(self, request, delegator: str, delegate: str):
        now = datetime.now(timezone.utc)
        rows = (await self.db.execute(select(FactoryApprovalDelegation).where(
            FactoryApprovalDelegation.project_id == request.project_id,
            FactoryApprovalDelegation.delegator_reference == delegator,
            FactoryApprovalDelegation.delegate_reference == delegate,
            FactoryApprovalDelegation.status == "active"))).scalars().all()
        for item in rows:
            if self._aware(item.starts_at) <= now <= self._aware(item.ends_at) and (not item.workflow_id or item.workflow_id == request.workflow_id) and (not item.subject_type or item.subject_type == request.subject_type):
                return item
        return None

    async def _action(self, request, step, action, reason, evidence_reference, actor, acting_for, channel, verified):
        self.db.add(FactoryApprovalAction(id=f"approval-action-{secrets.token_urlsafe(18)}",
            project_id=request.project_id, agent_path=request.agent_path, tenant_id=request.tenant_id,
            client_id=request.client_id, plan_id=request.plan_id, action_number=_number("APAC", request.project_id),
            request_id=request.id, request_number=request.request_number, step_id=step.id if step else None,
            sequence=step.sequence if step else None, action=action, reason=str(reason).strip(),
            evidence_reference=str(evidence_reference).strip()[:500], actor_reference=str(actor),
            acting_for_reference=acting_for, channel=channel, source_revision_verified=bool(verified)))

    async def _evidence(self, subject, subject_type, evidence_type, reference, note, actor):
        number = next((getattr(subject, key, None) for key in ("workflow_number", "request_number", "handoff_number", "delegation_number") if getattr(subject, key, None)), subject.id)
        self.db.add(FactoryApprovalEvidence(id=f"approval-evidence-{secrets.token_urlsafe(18)}",
            project_id=subject.project_id, agent_path=subject.agent_path, tenant_id=subject.tenant_id,
            client_id=subject.client_id, plan_id=subject.plan_id, evidence_number=_number("APEV", subject.project_id),
            subject_type=subject_type, subject_id=subject.id, subject_number=number, evidence_type=evidence_type,
            evidence_reference=str(reference).strip()[:500], note=note, recorded_by=str(actor)))

    async def _get(self, model, item_id, project_id, label):
        item = await self.db.scalar(select(model).where(model.id == item_id, model.project_id == project_id))
        if not item: raise KeyError(f"{label} not found in this tenant plan")
        return item

    @staticmethod
    def _revision(item, expected):
        if int(item.revision) != int(expected):
            raise ValueError(f"Approval revision conflict: expected {expected}, current {item.revision}")

    @staticmethod
    def _aware(value: datetime) -> datetime:
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)

    @staticmethod
    def _steps(steps: list[dict[str, object]], sla_hours: int) -> list[dict[str, object]]:
        if not 1 <= len(steps) <= 8 or not 1 <= int(sla_hours) <= 24 * 30:
            raise ValueError("Workflow requires 1-8 ordered steps and SLA between 1 and 720 hours")
        result = []; assignees = set(); previous_due = 0
        for sequence, raw in enumerate(steps, 1):
            name = str(raw.get("name", "")).strip(); assignee = str(raw.get("assignee_reference", "")).strip()
            due = int(raw.get("due_hours", 0))
            if not name or not assignee or assignee in assignees or due <= previous_due or due > int(sla_hours):
                raise ValueError("Workflow steps require unique assignees and strictly increasing due hours within SLA")
            result.append({"sequence": sequence, "name": name[:255], "assignee_reference": assignee[:255], "due_hours": due})
            assignees.add(assignee); previous_due = due
        return result
