"""Customer-success review, independent approval and renewal handoff boundary."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_contract import FactoryCoreEventContract
from models.factory_customer_asset import FactoryCustomerAsset
from models.factory_customer_success import FactoryCustomerSuccessEvidence, FactoryCustomerSuccessHandoff, FactoryCustomerSuccessReview
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _fingerprint(value: object) -> str:
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, default=str, separators=(",", ":")).encode()).hexdigest()


def _review(item: FactoryCustomerSuccessReview) -> dict[str, object]:
    return {key: getattr(item, key) for key in ("id", "project_id", "tenant_id", "client_id", "plan_id", "review_number", "asset_id", "asset_number", "asset_revision", "source_fingerprint", "health_score", "risk_level", "success_summary", "lifecycle_status", "created_by", "reviewed_by", "review_reference", "approved_by", "approval_reference", "revision", "created_at", "updated_at")}


def _handoff(item: FactoryCustomerSuccessHandoff) -> dict[str, object]:
    return {key: getattr(item, key) for key in ("id", "project_id", "tenant_id", "client_id", "plan_id", "handoff_number", "review_id", "review_number", "consumer", "payload_fingerprint", "status", "released_by", "release_reference", "acknowledged_by", "receipt_reference", "revision", "created_at", "acknowledged_at")}


class FactoryCustomerSuccessService:
    def __init__(self, db: AsyncSession): self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        reviews = (await self.db.execute(select(FactoryCustomerSuccessReview).where(FactoryCustomerSuccessReview.project_id == project_id).order_by(FactoryCustomerSuccessReview.created_at.desc()))).scalars().all()
        handoffs = (await self.db.execute(select(FactoryCustomerSuccessHandoff).where(FactoryCustomerSuccessHandoff.project_id == project_id).order_by(FactoryCustomerSuccessHandoff.created_at.desc()))).scalars().all()
        evidence = (await self.db.execute(select(FactoryCustomerSuccessEvidence).where(FactoryCustomerSuccessEvidence.project_id == project_id).order_by(FactoryCustomerSuccessEvidence.recorded_at))).scalars().all()
        return {"reviews": [_review(row) for row in reviews], "handoffs": [_handoff(row) for row in handoffs], "evidence": [{"review_id": row.review_id, "event_type": row.event_type, "reference": row.reference, "recorded_by": row.recorded_by, "recorded_at": row.recorded_at} for row in evidence]}

    async def create(self, *, project_id: int, context: TenantContext, actor: str, asset_id: str, success_summary: str) -> dict[str, object]:
        asset = await self._asset(asset_id, project_id)
        if asset.status != "active" or asset.renewal_status != "action-required":
            raise ValueError("Customer-success review requires an active asset with a governed renewal action")
        if await self.db.scalar(select(FactoryCustomerSuccessReview.id).where(FactoryCustomerSuccessReview.project_id == project_id, FactoryCustomerSuccessReview.asset_id == asset.id)):
            raise ValueError("Customer-success review already exists for this asset")
        summary = success_summary.strip()
        if len(summary) < 12: raise ValueError("Customer-success review requires a meaningful success summary")
        source = {"assetId": asset.id, "assetRevision": asset.revision, "serial": asset.serial_number, "renewalOwner": asset.renewal_owner, "renewalAction": asset.renewal_action, "serviceCount": asset.service_count, "warrantyUntil": asset.warranty_until}
        score = max(0, min(100, 100 - asset.service_count * 12 - (18 if asset.renewal_status == "action-required" else 0)))
        risk = "high" if score < 60 else "medium" if score < 80 else "low"
        now = datetime.now(timezone.utc)
        item = FactoryCustomerSuccessReview(id=f"success-{secrets.token_urlsafe(18)}", project_id=project_id, agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id, plan_id=context.plan_id or f"plan-{project_id}", review_number=f"CS-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}", asset_id=asset.id, asset_number=asset.asset_number, asset_revision=asset.revision, source_fingerprint=_fingerprint(source), health_score=score, risk_level=risk, success_summary=summary, created_by=actor)
        self.db.add(item); await self.db.flush(); await self._evidence(item, "success-review-created", f"asset:{asset.asset_number}", "Authoritative asset snapshot pinned", actor)
        return _review(item)

    async def review(self, review_id: str, *, project_id: int, expected_revision: int, actor: str, review_reference: str, note: str) -> dict[str, object]:
        item = await self._get(review_id, project_id); self._guard(item, expected_revision, "draft", "review")
        if item.created_by == actor: raise ValueError("Customer-success reviewer must be independent from the author")
        ref = self._required(review_reference, "Review reference"); detail = self._note(note, "Review note")
        item.lifecycle_status = "reviewed"; item.reviewed_by = actor; item.review_reference = ref; item.revision += 1
        await self._evidence(item, "success-review-reviewed", ref, detail, actor); return _review(item)

    async def approve(self, review_id: str, *, project_id: int, expected_revision: int, actor: str, approval_reference: str, note: str) -> dict[str, object]:
        item = await self._get(review_id, project_id); self._guard(item, expected_revision, "reviewed", "approval")
        if actor in {item.created_by, item.reviewed_by}: raise ValueError("Customer-success approver must be independent from author and reviewer")
        ref = self._required(approval_reference, "Approval reference"); detail = self._note(note, "Approval note")
        item.lifecycle_status = "approved"; item.approved_by = actor; item.approval_reference = ref; item.revision += 1
        await self._evidence(item, "success-review-approved", ref, detail, actor); return _review(item)

    async def handoff(self, review_id: str, *, project_id: int, expected_revision: int, actor: str, release_reference: str) -> dict[str, object]:
        item = await self._get(review_id, project_id); self._guard(item, expected_revision, "approved", "handoff")
        if actor in {item.created_by, item.reviewed_by}: raise ValueError("Customer-success handoff must be released by the independent approver or a different owner")
        contract = await self._contract("customer-success-handoff-released"); ref = self._required(release_reference, "Handoff reference")
        now = datetime.now(timezone.utc); payload = _fingerprint({"review": item.id, "source": item.source_fingerprint, "health": item.health_score, "approval": item.approval_reference, "contract": contract.schema_version})
        handoff = FactoryCustomerSuccessHandoff(id=f"success-handoff-{secrets.token_urlsafe(18)}", project_id=item.project_id, agent_path=item.agent_path, tenant_id=item.tenant_id, client_id=item.client_id, plan_id=item.plan_id, handoff_number=f"CSH-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}", review_id=item.id, review_number=item.review_number, payload_fingerprint=payload, released_by=actor, release_reference=ref)
        item.lifecycle_status = "handed-off"; item.revision += 1; self.db.add(handoff); await self.db.flush(); await self._evidence(item, "customer-success-handoff-released", ref, "Frozen renewal-growth handoff package released", actor)
        return {"review": _review(item), "handoff": _handoff(handoff)}

    async def acknowledge(self, handoff_id: str, *, project_id: int, expected_revision: int, actor: str, receipt_reference: str) -> dict[str, object]:
        item = await self.db.scalar(select(FactoryCustomerSuccessHandoff).where(FactoryCustomerSuccessHandoff.id == handoff_id, FactoryCustomerSuccessHandoff.project_id == project_id))
        if not item: raise KeyError("Customer-success handoff not found in this tenant plan")
        if item.revision != expected_revision or item.status != "pending": raise ValueError("Customer-success handoff changed; refresh before acknowledging")
        if item.released_by == actor: raise ValueError("Customer-success handoff receipt must be independent from release")
        item.status = "acknowledged"; item.acknowledged_by = actor; item.receipt_reference = self._required(receipt_reference, "Receipt reference"); item.acknowledged_at = datetime.now(timezone.utc); item.revision += 1; await self.db.flush(); return _handoff(item)

    async def _asset(self, asset_id: str, project_id: int) -> FactoryCustomerAsset:
        item = await self.db.scalar(select(FactoryCustomerAsset).where(FactoryCustomerAsset.id == asset_id, FactoryCustomerAsset.project_id == project_id))
        if not item: raise KeyError("Customer asset not found in this tenant plan")
        return item
    async def _get(self, review_id: str, project_id: int) -> FactoryCustomerSuccessReview:
        item = await self.db.scalar(select(FactoryCustomerSuccessReview).where(FactoryCustomerSuccessReview.id == review_id, FactoryCustomerSuccessReview.project_id == project_id))
        if not item: raise KeyError("Customer-success review not found in this tenant plan")
        return item
    async def _contract(self, event_id: str) -> FactoryCoreEventContract:
        item = await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id == event_id, FactoryCoreEventContract.lifecycle_status == "frozen"))
        if not item: raise ValueError(f"The frozen {event_id} contract is required")
        return item
    async def _evidence(self, item: FactoryCustomerSuccessReview, event_type: str, reference: str, note: str, actor: str) -> None:
        now = datetime.now(timezone.utc); self.db.add(FactoryCustomerSuccessEvidence(id=f"success-evidence-{secrets.token_urlsafe(18)}", project_id=item.project_id, agent_path=item.agent_path, tenant_id=item.tenant_id, client_id=item.client_id, plan_id=item.plan_id, evidence_number=f"CSE-{item.project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}", review_id=item.id, event_type=event_type, reference=reference, note=note[:4000], recorded_by=actor)); await self.db.flush()
    @staticmethod
    def _required(value: str, label: str) -> str:
        item = value.strip()
        if not item: raise ValueError(f"{label} is required")
        return item
    @staticmethod
    def _note(value: str, label: str) -> str:
        item = value.strip()
        if len(item) < 8: raise ValueError(f"{label} requires a meaningful note")
        return item
    @staticmethod
    def _guard(item: FactoryCustomerSuccessReview, revision: int, status: str, action: str) -> None:
        if item.revision != revision: raise ValueError("Customer-success review changed; refresh before continuing")
        if item.lifecycle_status != status: raise ValueError(f"Customer-success {action} requires {status} status")
