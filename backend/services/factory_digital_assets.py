"""Digital-asset workflow: AI suggests, people review and approve, never auto-publish."""

from datetime import datetime, timezone
import hashlib
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from models.factory_digital_assets import (
    FactoryDigitalAssetEvidence,
    FactoryDigitalAssetHandoff,
    FactoryDigitalAssetPlan,
    FactoryDigitalAssetRegister,
    FactoryDigitalAssetSuggestion,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

APPLICATION_ID = "identity.digital-assets"
EVIDENCE_FIELDS = (
    "customer_trial_reference", "role_training_reference", "issue_closure_reference",
    "monitoring_reference", "rollback_reference",
)
PLAN_FIELDS = ("id", "plan_number", "business_goal", "target_market", "target_audience", "site_scope", "status", "authored_by", "approved_by", "revision")
SUGGESTION_FIELDS = ("id", "suggestion_number", "source_plan_id", "plan_number", "suggestion_type", "recommendation_json", "source_reference", "suggestion_hash", "status", "generated_by", "reviewed_by", "revision")
ASSET_FIELDS = ("id", "asset_number", "source_plan_id", "plan_number", "asset_kind", "asset_identifier", "ownership_reference", "rights_scope", "registrar_secret_stored", "status", "registered_by", "approved_by", "revision")
HANDOFF_FIELDS = ("id", "handoff_number", "source_plan_id", "plan_number", "release_version", "manifest_hash", "support_until", *EVIDENCE_FIELDS, "status", "available", "prepared_by", "approved_by", "revision")


def _id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_urlsafe(18)}"


def _number(prefix: str, project_id: int) -> str:
    return f"{prefix}-{project_id}-{datetime.now(timezone.utc):%Y%m%d%H%M%S%f}-{secrets.token_hex(3).upper()}"


def _hash(value: object) -> str:
    body = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(body.encode()).hexdigest()


def _context(context: TenantContext, project_id: int) -> dict[str, object]:
    return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id, "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}


def _same(record: object) -> dict[str, object]:
    return {field: getattr(record, field) for field in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id")}


def _serialize(record: object, fields: tuple[str, ...]) -> dict[str, object]:
    return {field: getattr(record, field) for field in fields}


class FactoryDigitalAssetService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def workspace(self, *, project_id: int) -> dict[str, object]:
        async def rows(model: object, order: object) -> list[object]:
            result = await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500))
            return list(result.scalars().all())

        plans = await rows(FactoryDigitalAssetPlan, FactoryDigitalAssetPlan.created_at)
        suggestions = await rows(FactoryDigitalAssetSuggestion, FactoryDigitalAssetSuggestion.generated_at)
        assets = await rows(FactoryDigitalAssetRegister, FactoryDigitalAssetRegister.registered_at)
        handoffs = await rows(FactoryDigitalAssetHandoff, FactoryDigitalAssetHandoff.prepared_at)
        evidence = await rows(FactoryDigitalAssetEvidence, FactoryDigitalAssetEvidence.recorded_at)
        available = [item for item in handoffs if item.status == "available" and item.available and self._utc(item.support_until) > datetime.now(timezone.utc)]
        return {
            "plans": [_serialize(item, PLAN_FIELDS) for item in plans],
            "suggestions": [_serialize(item, SUGGESTION_FIELDS) for item in suggestions],
            "assets": [_serialize(item, ASSET_FIELDS) for item in assets],
            "handoffs": [_serialize(item, HANDOFF_FIELDS) for item in handoffs],
            "evidence": [{"id": item.id, "subject_type": item.subject_type, "evidence_type": item.evidence_type, "evidence_reference": item.evidence_reference} for item in evidence],
            "metrics": {
                "site_plans": len(plans), "reviewed_suggestions": len([item for item in suggestions if item.status == "reviewed"]),
                "rights_approved_assets": len([item for item in assets if item.status == "rights-approved"]), "available_handoffs": len(available),
            },
            "availability": {"application_id": APPLICATION_ID, "status": "available" if available else "pilot", "release_version": available[0].release_version if available else None, "support_until": available[0].support_until if available else None},
            "contract": {"ai_can_approve": False, "registrar_secret_stored": False, "domain_purchase_or_transfer_automated": False, "website_published": False, "protected_site_configuration_overwritten": False, "suggestion_self_review": False, "asset_self_approval": False, "plan_self_approval": False, "handoff_self_approval": False},
        }

    async def create_plan(self, *, project_id: int, context: TenantContext, actor: str, business_goal: str, target_market: str, target_audience: str, site_scope: str) -> dict[str, object]:
        if not all(value.strip() for value in (business_goal, target_market, target_audience, site_scope)):
            raise ValueError("Digital asset plan requires business goal, market, audience and scope")
        now = datetime.now(timezone.utc)
        plan = FactoryDigitalAssetPlan(id=_id("digital-plan"), **_context(context, project_id), plan_number=_number("DAP", project_id), business_goal=business_goal.strip(), target_market=target_market.strip(), target_audience=target_audience.strip(), site_scope=site_scope.strip(), status="draft", authored_by=str(actor), created_at=now, updated_at=now, revision=1)
        self.db.add(plan)
        await self._event(plan, "plan", "plan-drafted", plan.plan_number, "AI site plan drafted; no website has been created or published", actor)
        await self.db.flush()
        return _serialize(plan, PLAN_FIELDS)

    async def generate_suggestion(self, plan_id: str, *, project_id: int, context: TenantContext, actor: str, suggestion_type: str, recommendation: dict[str, object], source_reference: str) -> dict[str, object]:
        plan = await self._get(FactoryDigitalAssetPlan, plan_id, project_id, "Digital asset plan")
        if plan.status != "draft" or not suggestion_type.strip() or not recommendation or not source_reference.strip():
            raise ValueError("AI suggestion requires a draft plan, payload and source reference")
        payload = {"plan_number": plan.plan_number, "suggestion_type": suggestion_type.strip(), "recommendation": recommendation, "source_reference": source_reference.strip()}
        suggestion = FactoryDigitalAssetSuggestion(id=_id("digital-suggestion"), **_same(plan), suggestion_number=_number("DAS", project_id), source_plan_id=plan.id, plan_number=plan.plan_number, suggestion_type=suggestion_type.strip(), recommendation_json=recommendation, source_reference=source_reference.strip()[:255], suggestion_hash=_hash(payload), status="pending-review", generated_by=str(actor), generated_at=datetime.now(timezone.utc), revision=1)
        self.db.add(suggestion)
        await self._event(suggestion, "suggestion", "ai-suggestion-generated", suggestion.suggestion_hash, "AI output is advisory only and requires human review", actor)
        await self.db.flush()
        return _serialize(suggestion, SUGGESTION_FIELDS)

    async def review_suggestion(self, suggestion_id: str, *, project_id: int, actor: str, expected_revision: int, review_reference: str) -> dict[str, object]:
        item = await self._get(FactoryDigitalAssetSuggestion, suggestion_id, project_id, "Digital asset suggestion")
        self._revision(item, expected_revision)
        payload = {"plan_number": item.plan_number, "suggestion_type": item.suggestion_type, "recommendation": item.recommendation_json, "source_reference": item.source_reference}
        if item.status != "pending-review" or item.generated_by == str(actor) or item.suggestion_hash != _hash(payload) or not review_reference.strip():
            raise ValueError("AI suggestion requires independent review of unchanged output")
        item.status = "reviewed"; item.reviewed_by = str(actor); item.reviewed_at = datetime.now(timezone.utc); item.review_reference = review_reference.strip()[:255]; item.revision += 1
        await self._event(item, "suggestion", "ai-suggestion-reviewed", item.review_reference, "Human reviewer accepted advisory output without creating a site", actor)
        await self.db.flush()
        return _serialize(item, SUGGESTION_FIELDS)

    async def register_asset(self, plan_id: str, *, project_id: int, context: TenantContext, actor: str, asset_kind: str, asset_identifier: str, ownership_reference: str, rights_scope: str) -> dict[str, object]:
        plan = await self._get(FactoryDigitalAssetPlan, plan_id, project_id, "Digital asset plan")
        allowed = {"domain", "trademark", "authorization"}
        if plan.status != "draft" or asset_kind not in allowed or not all(value.strip() for value in (asset_identifier, ownership_reference, rights_scope)):
            raise ValueError("Asset register requires a draft plan, allowed asset type, rights reference and scope")
        asset = FactoryDigitalAssetRegister(id=_id("digital-asset"), **_context(context, project_id), asset_number=_number("DAR", project_id), source_plan_id=plan.id, plan_number=plan.plan_number, asset_kind=asset_kind, asset_identifier=asset_identifier.strip().lower() if asset_kind == "domain" else asset_identifier.strip(), ownership_reference=ownership_reference.strip()[:255], rights_scope=rights_scope.strip(), registrar_secret_stored=False, status="pending-approval", registered_by=str(actor), registered_at=datetime.now(timezone.utc), revision=1)
        self.db.add(asset)
        await self._event(asset, "asset", "asset-registered", asset.ownership_reference, "Reference only; registrar credentials, purchase, binding and transfer are excluded", actor)
        await self.db.flush()
        return _serialize(asset, ASSET_FIELDS)

    async def approve_asset(self, asset_id: str, *, project_id: int, actor: str, expected_revision: int, approval_reference: str) -> dict[str, object]:
        asset = await self._get(FactoryDigitalAssetRegister, asset_id, project_id, "Digital asset")
        self._revision(asset, expected_revision)
        if asset.status != "pending-approval" or asset.registered_by == str(actor) or asset.registrar_secret_stored or not approval_reference.strip():
            raise ValueError("Asset rights require independent approval and no registrar secret")
        asset.status = "rights-approved"; asset.approved_by = str(actor); asset.approved_at = datetime.now(timezone.utc); asset.approval_reference = approval_reference.strip()[:255]; asset.revision += 1
        await self._event(asset, "asset", "asset-rights-approved", asset.approval_reference, "Rights approved without purchasing, binding or transferring the asset", actor)
        await self.db.flush()
        return _serialize(asset, ASSET_FIELDS)

    async def approve_plan(self, plan_id: str, *, project_id: int, actor: str, expected_revision: int, approval_reference: str) -> dict[str, object]:
        plan = await self._get(FactoryDigitalAssetPlan, plan_id, project_id, "Digital asset plan")
        self._revision(plan, expected_revision)
        suggestions = await self._suggestions(plan.id, project_id); assets = await self._assets(plan.id, project_id)
        if plan.status != "draft" or plan.authored_by == str(actor) or not review_reference(approval_reference) or not any(item.status == "reviewed" for item in suggestions) or not any(item.status == "rights-approved" for item in assets):
            raise ValueError("Plan approval requires reviewed AI advice, approved rights and an independent approver")
        plan.status = "approved"; plan.approved_by = str(actor); plan.approved_at = datetime.now(timezone.utc); plan.approval_reference = approval_reference.strip()[:255]; plan.updated_at = datetime.now(timezone.utc); plan.revision += 1
        await self._event(plan, "plan", "plan-approved", plan.approval_reference, "Approved plan remains a controlled handoff and does not publish a website", actor)
        await self.db.flush()
        return _serialize(plan, PLAN_FIELDS)

    async def prepare_handoff(self, plan_id: str, *, project_id: int, context: TenantContext, actor: str, release_version: str, support_owner: str, support_until: datetime, **evidence: str) -> dict[str, object]:
        plan = await self._get(FactoryDigitalAssetPlan, plan_id, project_id, "Digital asset plan")
        assets = await self._assets(plan.id, project_id); clean = {key: str(evidence.get(key, "")).strip()[:255] for key in EVIDENCE_FIELDS}
        until = self._utc(support_until)
        if plan.status != "approved" or not any(item.status == "rights-approved" for item in assets) or not release_version.strip() or not support_owner.strip() or not all(clean.values()) or until <= datetime.now(timezone.utc):
            raise ValueError("Controlled handoff requires approved plan, approved rights, evidence and future support")
        manifest = {"application_id": APPLICATION_ID, "plan_number": plan.plan_number, "release_version": release_version.strip(), "approved_assets": [item.asset_number for item in assets if item.status == "rights-approved"], "support_owner": support_owner.strip(), "support_until": until.isoformat(), "evidence": clean, "ai_can_approve": False, "registrar_secret_stored": False, "domain_purchase_or_transfer_automated": False, "website_published": False, "protected_site_configuration_overwritten": False}
        handoff = FactoryDigitalAssetHandoff(id=_id("digital-handoff"), **_context(context, project_id), handoff_number=_number("DAH", project_id), application_id=APPLICATION_ID, source_plan_id=plan.id, plan_number=plan.plan_number, release_version=manifest["release_version"], manifest_json=manifest, manifest_hash=_hash(manifest), support_owner=manifest["support_owner"], support_until=until, **clean, status="pending-approval", available=False, prepared_by=str(actor), prepared_at=datetime.now(timezone.utc), revision=1)
        self.db.add(handoff)
        await self._event(handoff, "handoff", "availability-prepared", handoff.manifest_hash, "Controlled handoff evidence pinned; no domain action or site publish", actor)
        await self.db.flush()
        return _serialize(handoff, HANDOFF_FIELDS)

    async def approve_handoff(self, handoff_id: str, *, project_id: int, actor: str, expected_revision: int, approval_reference: str) -> dict[str, object]:
        handoff = await self._get(FactoryDigitalAssetHandoff, handoff_id, project_id, "Digital asset handoff")
        self._revision(handoff, expected_revision)
        plan = await self._get(FactoryDigitalAssetPlan, handoff.source_plan_id, project_id, "Digital asset plan")
        object_contract = await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id == "digital-asset-plan", FactoryCoreObjectContract.lifecycle_status == "frozen"))
        event_contract = await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id == "digital-assets-released", FactoryCoreEventContract.lifecycle_status == "frozen"))
        if handoff.status != "pending-approval" or handoff.prepared_by == str(actor) or not review_reference(approval_reference) or handoff.manifest_hash != _hash(handoff.manifest_json) or self._utc(handoff.support_until) <= datetime.now(timezone.utc) or plan.status != "approved" or not object_contract or not event_contract:
            raise ValueError("Availability requires independent approval, frozen contracts, unchanged evidence and support")
        handoff.status = "available"; handoff.available = True; handoff.approved_by = str(actor); handoff.approved_at = datetime.now(timezone.utc); handoff.approval_reference = approval_reference.strip()[:255]; handoff.revision += 1
        await self._event(handoff, "handoff", "digital-assets-released", handoff.approval_reference, "Commercial digital-asset workflow approved without publishing a website", actor)
        await self.db.flush()
        return _serialize(handoff, HANDOFF_FIELDS)

    async def _get(self, model: object, record_id: str, project_id: int, label: str) -> object:
        record = await self.db.scalar(select(model).where(model.id == record_id, model.project_id == project_id))
        if not record:
            raise KeyError(f"{label} not found in this tenant plan")
        return record

    async def _suggestions(self, plan_id: str, project_id: int) -> list[FactoryDigitalAssetSuggestion]:
        result = await self.db.execute(select(FactoryDigitalAssetSuggestion).where(FactoryDigitalAssetSuggestion.source_plan_id == plan_id, FactoryDigitalAssetSuggestion.project_id == project_id))
        return list(result.scalars().all())

    async def _assets(self, plan_id: str, project_id: int) -> list[FactoryDigitalAssetRegister]:
        result = await self.db.execute(select(FactoryDigitalAssetRegister).where(FactoryDigitalAssetRegister.source_plan_id == plan_id, FactoryDigitalAssetRegister.project_id == project_id))
        return list(result.scalars().all())

    @staticmethod
    def _revision(record: object, expected_revision: int) -> None:
        if int(getattr(record, "revision")) != int(expected_revision):
            raise ValueError("Revision conflict")

    @staticmethod
    def _utc(value: datetime) -> datetime:
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)

    async def _event(self, record: object, subject_type: str, evidence_type: str, reference: str, note: str, actor: str) -> None:
        number = next((getattr(record, name, None) for name in ("plan_number", "suggestion_number", "asset_number", "handoff_number") if getattr(record, name, None)), str(getattr(record, "id")))
        self.db.add(FactoryDigitalAssetEvidence(id=_id("digital-evidence"), **_same(record), evidence_number=_number("DAE", getattr(record, "project_id")), subject_type=subject_type, subject_id=getattr(record, "id"), subject_number=number, evidence_type=evidence_type, evidence_reference=str(reference)[:255], note=note, recorded_by=str(actor), recorded_at=datetime.now(timezone.utc)))


def review_reference(value: str) -> bool:
    return bool(value and value.strip())
