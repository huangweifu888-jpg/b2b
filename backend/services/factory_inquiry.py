"""Privacy-minimised inquiry intake, qualification and routing with a revenue handoff."""
from __future__ import annotations
from datetime import datetime, timezone
import hashlib, json, secrets
from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract
from models.factory_inquiry import FactoryInquiry, FactoryInquiryAssignment, FactoryInquiryEvidence, FactoryInquiryRoutingRule
from services.factory_revenue import FactoryRevenueService
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

CHANNELS = {"website", "email", "social", "marketplace", "commerce", "manual"}

def _id(prefix: str) -> str: return f"{prefix}-{secrets.token_urlsafe(18)}"
def _num(prefix: str, project_id: int) -> str: return f"{prefix}-{project_id}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"
def _hash(value: object) -> str: return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()
def _ctx(context: TenantContext, project_id: int) -> dict[str, object]: return dict(project_id=project_id, agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id, plan_id=context.plan_id or f"plan-{project_id}")
def _view_inquiry(x: FactoryInquiry) -> dict[str, object]: return {k: getattr(x, k) for k in ("id", "inquiry_number", "source_channel", "account_reference", "product_reference", "country_code", "requested_quantity", "payload_summary", "score", "status", "qualified_by", "qualification_reference", "revenue_flow_id", "created_by", "revision")}
def _view_rule(x: FactoryInquiryRoutingRule) -> dict[str, object]: return {k: getattr(x, k) for k in ("id", "rule_number", "rule_key", "rule_name", "priority", "conditions_json", "assignee_reference", "status", "authored_by", "approved_by", "approval_reference", "activated_by", "revision")}
def _view_assignment(x: FactoryInquiryAssignment) -> dict[str, object]: return {k: getattr(x, k) for k in ("id", "assignment_number", "inquiry_id", "inquiry_number", "rule_id", "rule_number", "assignee_reference", "status", "routed_by", "acknowledged_by", "receipt_reference", "revision")}

class FactoryInquiryService:
    def __init__(self, db: AsyncSession): self.db = db
    async def workspace(self, *, project_id: int) -> dict[str, object]:
        inquiries = (await self.db.execute(select(FactoryInquiry).where(FactoryInquiry.project_id == project_id).order_by(FactoryInquiry.created_at.desc()))).scalars().all()
        rules = (await self.db.execute(select(FactoryInquiryRoutingRule).where(FactoryInquiryRoutingRule.project_id == project_id).order_by(FactoryInquiryRoutingRule.priority, FactoryInquiryRoutingRule.created_at))).scalars().all()
        assignments = (await self.db.execute(select(FactoryInquiryAssignment).where(FactoryInquiryAssignment.project_id == project_id).order_by(FactoryInquiryAssignment.created_at.desc()))).scalars().all()
        evidence = (await self.db.execute(select(FactoryInquiryEvidence).where(FactoryInquiryEvidence.project_id == project_id).order_by(FactoryInquiryEvidence.recorded_at.desc()))).scalars().all()
        acknowledged = [x for x in assignments if x.status == "acknowledged"]
        return {"inquiries": [_view_inquiry(x) for x in inquiries], "rules": [_view_rule(x) for x in rules], "assignments": [_view_assignment(x) for x in assignments], "evidence": [{"id": x.id, "event_type": x.event_type, "reference": x.reference} for x in evidence], "metrics": {"received_inquiries": len(inquiries), "qualified_inquiries": len([x for x in inquiries if x.status in {"qualified", "routed", "handed-off"}]), "routing_receipt_percent": round(len(acknowledged) * 100 / max(1, len(assignments)), 2)}, "contract": {"raw_payload_stored": False, "source_deduped": True, "rule_self_approval": False, "assignment_receipt_required": True, "revenue_handoff_pins_inquiry": True}}
    async def create_inquiry(self, *, project_id: int, context: TenantContext, actor: str, source_channel: str, source_reference: str, account_reference: str, product_reference: str, country_code: str, requested_quantity: int | None, payload_summary: str | None, score: int) -> dict[str, object]:
        if source_channel not in CHANNELS or not source_reference.strip() or not account_reference.strip() or not product_reference.strip() or len(country_code.strip()) != 2 or not 0 <= score <= 100 or requested_quantity is not None and requested_quantity <= 0: raise ValueError("Inquiry requires a supported channel, source reference, account, product, ISO country, valid score and positive quantity")
        contract = await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id == "inquiry-created", FactoryCoreEventContract.lifecycle_status == "frozen"))
        if not contract: raise ValueError("Inquiry requires the frozen inquiry-created event contract")
        fingerprint = _hash({"source_channel": source_channel, "source_reference": source_reference.strip()})
        existing = await self.db.scalar(select(FactoryInquiry).where(FactoryInquiry.project_id == project_id, FactoryInquiry.source_channel == source_channel, FactoryInquiry.source_reference_hash == fingerprint))
        if existing: raise ValueError("This source inquiry is already registered in the tenant plan")
        now = datetime.now(timezone.utc)
        x = FactoryInquiry(id=_id("inquiry"), **_ctx(context, project_id), inquiry_number=_num("INQ", project_id), source_channel=source_channel, source_reference_hash=fingerprint, account_reference=account_reference.strip()[:180], product_reference=product_reference.strip()[:180], country_code=country_code.strip().upper(), requested_quantity=requested_quantity, payload_summary=(payload_summary or "").strip()[:2000] or None, score=score, status="received", created_by=str(actor), revision=1, created_at=now, updated_at=now)
        self.db.add(x); await self._event(x, "inquiry-created", x.inquiry_number, "Stored dedupe fingerprint and payload summary only", actor); await self.db.flush(); return _view_inquiry(x)
    async def qualify_inquiry(self, inquiry_id: str, *, project_id: int, actor: str, expected_revision: int, reference: str) -> dict[str, object]:
        x = await self._get(FactoryInquiry, inquiry_id, project_id, "Inquiry")
        if x.revision != expected_revision or x.status != "received" or x.created_by == str(actor) or not reference.strip(): raise ValueError("Inquiry qualification requires an unchanged received inquiry, independent reviewer and reference")
        x.status = "qualified"; x.qualified_by = str(actor); x.qualification_reference = reference[:255]; x.revision += 1; x.updated_at = datetime.now(timezone.utc); await self._event(x, "inquiry-qualified", reference, "Independently qualified before routing", actor); await self.db.flush(); return _view_inquiry(x)
    async def create_rule(self, *, project_id: int, context: TenantContext, actor: str, rule_key: str, rule_name: str, priority: int, conditions: dict[str, object], assignee_reference: str) -> dict[str, object]:
        if not rule_key.strip() or not rule_name.strip() or priority < 1 or not assignee_reference.strip() or not self._valid_conditions(conditions): raise ValueError("Routing rule requires key, name, positive priority, supported conditions and assignee")
        now = datetime.now(timezone.utc); x = FactoryInquiryRoutingRule(id=_id("inquiry-rule"), **_ctx(context, project_id), rule_number=_num("ROUTE", project_id), rule_key=rule_key.strip()[:96], rule_name=rule_name.strip()[:160], priority=priority, conditions_json=conditions, assignee_reference=assignee_reference.strip()[:128], status="draft", authored_by=str(actor), revision=1, created_at=now, updated_at=now)
        self.db.add(x); await self._event(x, "routing-rule-created", x.rule_number, "Routing condition draft", actor); await self.db.flush(); return _view_rule(x)
    async def approve_rule(self, rule_id: str, *, project_id: int, actor: str, expected_revision: int, reference: str) -> dict[str, object]:
        x = await self._get(FactoryInquiryRoutingRule, rule_id, project_id, "Routing rule")
        if x.revision != expected_revision or x.status != "draft" or x.authored_by == str(actor) or not reference.strip(): raise ValueError("Routing rule requires independent approval")
        x.status = "approved"; x.approved_by = str(actor); x.approval_reference = reference[:255]; x.revision += 1; x.updated_at = datetime.now(timezone.utc); await self._event(x, "routing-rule-approved", reference, "Independent rule approval", actor); await self.db.flush(); return _view_rule(x)
    async def activate_rule(self, rule_id: str, *, project_id: int, actor: str, expected_revision: int) -> dict[str, object]:
        x = await self._get(FactoryInquiryRoutingRule, rule_id, project_id, "Routing rule")
        if x.revision != expected_revision or x.status != "approved" or x.approved_by == str(actor): raise ValueError("Routing rule requires independent activation after approval")
        x.status = "active"; x.activated_by = str(actor); x.revision += 1; x.updated_at = datetime.now(timezone.utc); await self._event(x, "routing-rule-activated", x.rule_number, "Active rule is immutable until replaced", actor); await self.db.flush(); return _view_rule(x)
    async def route_inquiry(self, inquiry_id: str, *, project_id: int, context: TenantContext, actor: str, expected_revision: int) -> dict[str, object]:
        inquiry = await self._get(FactoryInquiry, inquiry_id, project_id, "Inquiry")
        if inquiry.revision != expected_revision or inquiry.status != "qualified": raise ValueError("Only an unchanged qualified inquiry can be routed")
        rules = (await self.db.execute(select(FactoryInquiryRoutingRule).where(FactoryInquiryRoutingRule.project_id == project_id, FactoryInquiryRoutingRule.status == "active").order_by(FactoryInquiryRoutingRule.priority, FactoryInquiryRoutingRule.created_at))).scalars().all()
        rule = next((candidate for candidate in rules if self._matches(candidate.conditions_json, inquiry)), None)
        if not rule: raise ValueError("No active routing rule matches this qualified inquiry")
        now = datetime.now(timezone.utc); assignment = FactoryInquiryAssignment(id=_id("inquiry-assignment"), **_ctx(context, project_id), assignment_number=_num("ASSIGN", project_id), inquiry_id=inquiry.id, inquiry_number=inquiry.inquiry_number, rule_id=rule.id, rule_number=rule.rule_number, assignee_reference=rule.assignee_reference, status="pending", routed_by=str(actor), revision=1, created_at=now)
        self.db.add(assignment); inquiry.status = "routed"; inquiry.revision += 1; inquiry.updated_at = now; await self._event(inquiry, "inquiry-routed", assignment.assignment_number, "Matched active immutable routing rule", actor); await self.db.flush(); return {"inquiry": _view_inquiry(inquiry), "assignment": _view_assignment(assignment)}
    async def acknowledge_assignment(self, assignment_id: str, *, project_id: int, actor: str, expected_revision: int, reference: str) -> dict[str, object]:
        x = await self._get(FactoryInquiryAssignment, assignment_id, project_id, "Inquiry assignment")
        if x.revision != expected_revision or x.status != "pending" or x.routed_by == str(actor) or not reference.strip(): raise ValueError("Assignment receipt must be independent and referenced")
        x.status = "acknowledged"; x.acknowledged_by = str(actor); x.receipt_reference = reference[:255]; x.revision += 1; x.acknowledged_at = datetime.now(timezone.utc); await self._event(x, "inquiry-routing-acknowledged", reference, "Assignee acknowledged routing receipt", actor); await self.db.flush(); return _view_assignment(x)
    async def handoff_to_revenue(self, inquiry_id: str, *, project_id: int, context: TenantContext, actor: str, expected_revision: int, currency: str) -> dict[str, object]:
        inquiry = await self._get(FactoryInquiry, inquiry_id, project_id, "Inquiry")
        assignment = await self.db.scalar(select(FactoryInquiryAssignment).where(FactoryInquiryAssignment.inquiry_id == inquiry.id, FactoryInquiryAssignment.project_id == project_id))
        if inquiry.revision != expected_revision or inquiry.status != "routed" or not assignment or assignment.status != "acknowledged" or inquiry.revenue_flow_id: raise ValueError("Revenue handoff requires unchanged routed inquiry, acknowledged assignment and no prior handoff")
        revenue = FactoryRevenueService(self.db); run = await revenue.create(project_id=project_id, context=context, actor=actor, product_reference=inquiry.product_reference, account_reference=inquiry.account_reference, currency=currency)
        run = await revenue.transition(run["id"], project_id=project_id, expected_revision=int(run["revision"]), actor=actor, event_type="inquiry-created", amount=None)
        inquiry.status = "handed-off"; inquiry.revenue_flow_id = str(run["id"]); inquiry.revision += 1; inquiry.updated_at = datetime.now(timezone.utc); await self._event(inquiry, "inquiry-revenue-handed-off", str(run["correlation_id"]), "Pinned inquiry handoff to the revenue golden flow", actor); await self.db.flush(); return {"inquiry": _view_inquiry(inquiry), "revenue_flow": run}
    async def _get(self, model, item_id: str, project_id: int, label: str):
        item = await self.db.scalar(select(model).where(model.id == item_id, model.project_id == project_id))
        if not item: raise KeyError(f"{label} not found")
        return item
    @staticmethod
    def _valid_conditions(value: object) -> bool:
        if not isinstance(value, dict) or not value or set(value) - {"country_code", "product_reference", "source_channel", "min_score"}: return False
        return (not "country_code" in value or isinstance(value["country_code"], str) and len(value["country_code"].strip()) == 2) and (not "product_reference" in value or isinstance(value["product_reference"], str) and bool(value["product_reference"].strip())) and (not "source_channel" in value or value["source_channel"] in CHANNELS) and (not "min_score" in value or isinstance(value["min_score"], int) and 0 <= value["min_score"] <= 100)
    @staticmethod
    def _matches(conditions: dict[str, object], inquiry: FactoryInquiry) -> bool:
        return (not conditions.get("country_code") or conditions["country_code"] == inquiry.country_code) and (not conditions.get("product_reference") or conditions["product_reference"] == inquiry.product_reference) and (not conditions.get("source_channel") or conditions["source_channel"] == inquiry.source_channel) and (not conditions.get("min_score") or inquiry.score >= int(conditions["min_score"]))
    async def _event(self, source, event_type: str, reference: str, note: str, actor: str) -> None:
        self.db.add(FactoryInquiryEvidence(id=_id("inquiry-evidence"), project_id=source.project_id, agent_path=source.agent_path, tenant_id=source.tenant_id, client_id=source.client_id, plan_id=source.plan_id, evidence_number=_num("INQ-EV", source.project_id), subject_id=source.id, event_type=event_type, reference=str(reference)[:255], note=note, recorded_by=str(actor), recorded_at=datetime.now(timezone.utc)))
