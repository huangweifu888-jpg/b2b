"""Governed multi-touch attribution and management contribution analysis."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import json
import re
import secrets

from core.tenant_context import TenantContext
from models.factory_data_warehouse import (
    FactoryWarehouseFactVersion,
    FactoryWarehouseLineageEdge,
    FactoryWarehouseLoadRun,
)
from models.factory_revenue_profit import (
    FactoryAttributionPolicy,
    FactoryAttributionPolicyVersion,
    FactoryAttributionTouchpoint,
    FactoryRevenueProfitAllocation,
    FactoryRevenueProfitBinding,
    FactoryRevenueProfitEvidence,
    FactoryRevenueProfitRun,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


MONEY = Decimal("0.01")
PERCENT = Decimal("0.0001")
WEIGHT = Decimal("0.000001")
POLICY_CODE = re.compile(r"^[a-z][a-z0-9.-]{2,99}$")
MODEL_TYPES = {"first-touch", "last-touch", "linear"}


def _utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _money(value: object, label: str) -> Decimal:
    try:
        return Decimal(str(value)).quantize(MONEY, rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{label} must be a valid monetary amount") from exc


def _payload(item: FactoryWarehouseFactVersion) -> dict[str, object]:
    try:
        value = json.loads(item.payload_json)
    except (TypeError, ValueError) as exc:
        raise ValueError("Published warehouse fact payload is invalid") from exc
    if not isinstance(value, dict):
        raise ValueError("Published warehouse fact payload must be an object")
    return value


def serialize_policy(item: FactoryAttributionPolicy) -> dict[str, object]:
    return {
        "id": item.id, "policy_number": item.policy_number, "policy_reference": item.policy_reference,
        "policy_code": item.policy_code, "owner": item.owner, "purpose": item.purpose,
        "status": item.status, "current_version_id": item.current_version_id,
        "current_version_number": item.current_version_number, "revision": item.revision,
    }


def serialize_policy_version(item: FactoryAttributionPolicyVersion) -> dict[str, object]:
    return {
        "id": item.id, "version_number_record": item.version_number_record,
        "version_reference": item.version_reference, "policy_id": item.policy_id,
        "policy_number": item.policy_number, "policy_code": item.policy_code,
        "version_number": item.version_number, "label": item.label,
        "model_type": item.model_type, "lookback_days": item.lookback_days,
        "policy_fingerprint": item.policy_fingerprint, "status": item.status,
        "change_reason": item.change_reason, "effective_from": item.effective_from,
        "authored_by": item.authored_by, "submitted_by": item.submitted_by,
        "approved_by": item.approved_by, "revision": item.revision,
    }


def serialize_touchpoint(item: FactoryAttributionTouchpoint) -> dict[str, object]:
    return {
        "id": item.id, "touchpoint_number": item.touchpoint_number,
        "external_event_reference": item.external_event_reference,
        "correlation_id": item.correlation_id, "account_reference": item.account_reference,
        "channel": item.channel, "campaign_reference": item.campaign_reference,
        "content_reference": item.content_reference, "occurred_at": item.occurred_at,
        "spend_amount": str(item.spend_amount), "currency": item.currency,
        "consent_reference": item.consent_reference,
        "evidence_fingerprint": item.evidence_fingerprint, "recorded_by": item.recorded_by,
    }


def serialize_binding(item: FactoryRevenueProfitBinding) -> dict[str, object]:
    return {
        "id": item.id, "binding_number": item.binding_number,
        "binding_reference": item.binding_reference, "correlation_id": item.correlation_id,
        "account_reference": item.account_reference, "currency": item.currency,
        "revenue_load_run_id": item.revenue_load_run_id, "revenue_run_number": item.revenue_run_number,
        "revenue_fact_id": item.revenue_fact_id, "revenue_fact_number": item.revenue_fact_number,
        "revenue_source_revision": item.revenue_source_revision,
        "quote_load_run_id": item.quote_load_run_id, "quote_run_number": item.quote_run_number,
        "quote_fact_id": item.quote_fact_id, "quote_fact_number": item.quote_fact_number,
        "quote_source_revision": item.quote_source_revision, "status": item.status,
        "created_by": item.created_by, "verified_by": item.verified_by, "revision": item.revision,
    }


def serialize_run(item: FactoryRevenueProfitRun) -> dict[str, object]:
    return {
        "id": item.id, "run_number": item.run_number, "analysis_reference": item.analysis_reference,
        "binding_id": item.binding_id, "binding_number": item.binding_number,
        "policy_id": item.policy_id, "policy_version_id": item.policy_version_id,
        "policy_version_number": item.policy_version_number,
        "policy_fingerprint": item.policy_fingerprint, "model_type": item.model_type,
        "correlation_id": item.correlation_id, "account_reference": item.account_reference,
        "currency": item.currency, "recognized_revenue": str(item.recognized_revenue),
        "governed_sales_cost": str(item.governed_sales_cost),
        "marketing_spend": str(item.marketing_spend),
        "contribution_margin": str(item.contribution_margin),
        "contribution_margin_percent": str(item.contribution_margin_percent),
        "touchpoint_count": item.touchpoint_count, "profit_classification": item.profit_classification,
        "status": item.status, "calculated_by": item.calculated_by,
        "verified_by": item.verified_by, "revision": item.revision,
    }


def serialize_allocation(item: FactoryRevenueProfitAllocation) -> dict[str, object]:
    return {
        "id": item.id, "allocation_number": item.allocation_number,
        "analysis_run_id": item.analysis_run_id, "run_number": item.run_number,
        "touchpoint_id": item.touchpoint_id, "touchpoint_number": item.touchpoint_number,
        "channel": item.channel, "campaign_reference": item.campaign_reference,
        "weight": str(item.weight), "attributed_revenue": str(item.attributed_revenue),
        "attributed_sales_cost": str(item.attributed_sales_cost),
        "touchpoint_spend": str(item.touchpoint_spend),
        "attributed_contribution": str(item.attributed_contribution),
    }


class FactoryRevenueProfitService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        async def items(model, limit: int):
            return (await self.db.execute(select(model).where(
                model.project_id == project_id,
            ).order_by(model.created_at.desc()).limit(limit))).scalars().all()

        policies = await items(FactoryAttributionPolicy, 100)
        versions = await items(FactoryAttributionPolicyVersion, 200)
        touchpoints = await items(FactoryAttributionTouchpoint, 500)
        bindings = await items(FactoryRevenueProfitBinding, 200)
        runs = await items(FactoryRevenueProfitRun, 200)
        allocations = await items(FactoryRevenueProfitAllocation, 1000)
        evidence = await items(FactoryRevenueProfitEvidence, 1000)
        warehouse = await self._warehouse_candidates(project_id)
        return {
            "policies": [serialize_policy(item) for item in policies],
            "policy_versions": [serialize_policy_version(item) for item in versions],
            "touchpoints": [serialize_touchpoint(item) for item in touchpoints],
            "bindings": [serialize_binding(item) for item in bindings],
            "analysis_runs": [serialize_run(item) for item in runs],
            "allocations": [serialize_allocation(item) for item in allocations],
            "evidence": [{
                "id": item.id, "subject_type": item.subject_type, "subject_id": item.subject_id,
                "evidence_type": item.evidence_type, "evidence_reference": item.evidence_reference,
                "recorded_by": item.recorded_by,
            } for item in evidence],
            "warehouse_candidates": warehouse,
            "contract": {
                "profit_classification": "management-contribution-estimate",
                "formal_accounting_profit": False,
                "published_warehouse_required": True,
                "touchpoint_evidence_required": True,
                "policy_approval_independent": True,
                "binding_verification_independent": True,
                "analysis_verification_independent": True,
                "historical_recalculation": False,
            },
        }

    async def create_policy(self, *, project_id: int, context: TenantContext, actor: str,
                            policy_reference: str, policy_code: str, owner: str, purpose: str,
                            version_reference: str, label: str, model_type: str,
                            lookback_days: int, effective_from: datetime,
                            change_reason: str) -> dict[str, object]:
        reference, code = policy_reference.strip(), policy_code.strip().lower()
        clean_owner, clean_purpose = owner.strip(), purpose.strip()
        if not reference or not POLICY_CODE.fullmatch(code):
            raise ValueError("Attribution policy requires a reference and stable lowercase code")
        if not clean_owner or len(clean_purpose) < 8:
            raise ValueError("Attribution policy requires owner and explicit business purpose")
        duplicate = await self.db.scalar(select(FactoryAttributionPolicy.id).where(
            FactoryAttributionPolicy.tenant_id == context.tenant_id,
            FactoryAttributionPolicy.policy_code == code,
        ))
        if duplicate:
            raise ValueError("Attribution policy code already exists in this tenant")
        now = datetime.now(timezone.utc)
        policy = FactoryAttributionPolicy(
            id=f"attribution-policy-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", policy_number=self._number("ATP", project_id, now),
            policy_reference=reference[:255], policy_code=code, owner=clean_owner[:255],
            purpose=clean_purpose, updated_by=str(actor),
        )
        self.db.add(policy); await self.db.flush()
        version = await self._create_version(
            policy, version_number=1, actor=str(actor), version_reference=version_reference,
            label=label, model_type=model_type, lookback_days=lookback_days,
            effective_from=self._effective(effective_from, now), change_reason=change_reason,
        )
        await self._evidence(version, "policy-version", "policy-authored", version.version_reference,
                             "Created immutable attribution policy version 1", str(actor))
        await self.db.flush()
        return {"policy": serialize_policy(policy), "version": serialize_policy_version(version)}

    async def create_policy_version(self, policy_id: str, *, project_id: int,
                                    expected_policy_revision: int, actor: str,
                                    version_reference: str, label: str, model_type: str,
                                    lookback_days: int, effective_from: datetime,
                                    change_reason: str) -> dict[str, object]:
        policy = await self._policy(policy_id, project_id); self._revision(policy, expected_policy_revision)
        if policy.status != "active" or not policy.current_version_number:
            raise ValueError("A new attribution version requires an active published policy")
        now = datetime.now(timezone.utc)
        version = await self._create_version(
            policy, version_number=policy.current_version_number + 1, actor=str(actor),
            version_reference=version_reference, label=label, model_type=model_type,
            lookback_days=lookback_days, effective_from=self._effective(effective_from, now),
            change_reason=change_reason,
        )
        policy.revision += 1; policy.updated_by = str(actor)
        await self._evidence(version, "policy-version", "policy-authored", version.version_reference,
                             "Created a new attribution version without recalculating history", str(actor))
        await self.db.flush()
        return {"policy": serialize_policy(policy), "version": serialize_policy_version(version)}

    async def submit_policy_version(self, version_id: str, *, project_id: int,
                                    expected_revision: int, actor: str,
                                    submission_reference: str) -> dict[str, object]:
        version = await self._version(version_id, project_id); self._revision(version, expected_revision)
        if version.status != "draft":
            raise ValueError("Only a draft attribution policy can be submitted")
        reference = submission_reference.strip()
        if not reference:
            raise ValueError("Policy submission requires an evidence reference")
        version.status = "pending-approval"; version.submitted_by = str(actor)
        version.submitted_at = datetime.now(timezone.utc); version.revision += 1; version.updated_by = str(actor)
        await self._evidence(version, "policy-version", "policy-submission", reference,
                             f"Submitted policy fingerprint {version.policy_fingerprint}", str(actor))
        await self.db.flush(); return serialize_policy_version(version)

    async def approve_policy_version(self, version_id: str, *, project_id: int,
                                     expected_revision: int, actor: str,
                                     approval_reference: str) -> dict[str, object]:
        version = await self._version(version_id, project_id); self._revision(version, expected_revision)
        if version.status != "pending-approval":
            raise ValueError("Only a pending attribution policy can be approved")
        if version.authored_by == str(actor):
            raise ValueError("Attribution policy approver must be independent from the author")
        reference = approval_reference.strip()
        if not reference:
            raise ValueError("Policy approval requires an evidence reference")
        policy = await self._policy(version.policy_id, project_id)
        previous = None
        if policy.current_version_id:
            previous = await self._version(policy.current_version_id, project_id)
            if previous.status != "published":
                raise ValueError("Current attribution version is not a published baseline")
            previous.status = "superseded"; previous.revision += 1; previous.updated_by = str(actor)
        now = datetime.now(timezone.utc)
        version.status = "published"; version.approval_reference = reference[:500]
        version.approved_by = str(actor); version.approved_at = now; version.revision += 1; version.updated_by = str(actor)
        policy.status = "active"; policy.current_version_id = version.id
        policy.current_version_number = version.version_number; policy.revision += 1; policy.updated_by = str(actor)
        await self._evidence(version, "policy-version", "policy-publication", reference,
                             "Published attribution policy; prior results remain pinned", str(actor))
        await self.db.flush()
        return {"policy": serialize_policy(policy), "version": serialize_policy_version(version),
                "superseded_version": serialize_policy_version(previous) if previous else None}

    async def record_touchpoint(self, *, project_id: int, context: TenantContext, actor: str,
                                external_event_reference: str, correlation_id: str,
                                account_reference: str, channel: str,
                                campaign_reference: str, content_reference: str | None,
                                occurred_at: datetime, spend_amount: object,
                                currency: str, consent_reference: str) -> dict[str, object]:
        event, correlation = external_event_reference.strip(), correlation_id.strip()
        account, clean_channel = account_reference.strip(), channel.strip().lower()
        campaign, consent = campaign_reference.strip(), consent_reference.strip()
        clean_currency = currency.strip().upper(); occurred = _utc(occurred_at)
        spend = _money(spend_amount, "Touchpoint spend")
        if not all((event, correlation, account, clean_channel, campaign, consent)):
            raise ValueError("Touchpoint requires event, correlation, account, channel, campaign and consent evidence")
        if len(clean_currency) != 3 or spend < 0:
            raise ValueError("Touchpoint requires a three-letter currency and non-negative spend")
        now = datetime.now(timezone.utc)
        if occurred > now + timedelta(minutes=5) or occurred < now - timedelta(days=730):
            raise ValueError("Touchpoint occurrence must be within the retained evidence window")
        fingerprint = hashlib.sha256(json.dumps({
            "event": event, "correlation": correlation, "account": account,
            "channel": clean_channel, "campaign": campaign,
            "content": (content_reference or "").strip(), "occurred_at": occurred.isoformat(),
            "spend": str(spend), "currency": clean_currency, "consent": consent,
        }, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        item = FactoryAttributionTouchpoint(
            id=f"attribution-touchpoint-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", touchpoint_number=self._number("ATT", project_id, now),
            external_event_reference=event[:255], correlation_id=correlation[:100],
            account_reference=account[:255], channel=clean_channel[:100], campaign_reference=campaign[:255],
            content_reference=(content_reference or "").strip()[:255] or None, occurred_at=occurred,
            spend_amount=spend, currency=clean_currency, consent_reference=consent[:500],
            evidence_fingerprint=fingerprint, recorded_by=str(actor),
        )
        self.db.add(item); await self.db.flush()
        await self._evidence(item, "touchpoint", "touchpoint-recorded", event,
                             "Recorded immutable external marketing event and consent evidence", str(actor))
        await self.db.flush(); return serialize_touchpoint(item)

    async def create_binding(self, *, project_id: int, context: TenantContext, actor: str,
                             binding_reference: str, revenue_load_run_id: str,
                             revenue_fact_id: str, quote_load_run_id: str,
                             quote_fact_id: str) -> dict[str, object]:
        reference = binding_reference.strip()
        if not reference:
            raise ValueError("Revenue-profit binding requires an evidence reference")
        revenue_run, revenue_fact = await self._published_fact(
            project_id, revenue_load_run_id, revenue_fact_id, "revenue", context.tenant_id,
        )
        quote_run, quote_fact = await self._published_fact(
            project_id, quote_load_run_id, quote_fact_id, "quotes", context.tenant_id,
        )
        revenue, quote = _payload(revenue_fact), _payload(quote_fact)
        if revenue.get("current_stage") != "payment-received" or _money(revenue.get("paid_amount"), "Paid revenue") <= 0:
            raise ValueError("Attribution requires a fully received revenue fact")
        if quote.get("status") != "accepted":
            raise ValueError("Contribution analysis requires an accepted governed quote fact")
        revenue_account, quote_account = str(revenue.get("account_reference") or ""), str(quote.get("account_reference") or "")
        revenue_currency, quote_currency = str(revenue.get("currency") or "").upper(), str(quote.get("currency") or "").upper()
        if not revenue_account or revenue_account != quote_account or revenue_currency != quote_currency:
            raise ValueError("Revenue and quote facts must share customer account and currency")
        paid, subtotal, cost = _money(revenue.get("paid_amount"), "Paid revenue"), _money(quote.get("subtotal"), "Quote subtotal"), _money(quote.get("cost_total"), "Quote cost")
        if subtotal <= 0 or paid > subtotal or cost < 0 or cost > subtotal:
            raise ValueError("Revenue and quote facts do not form a valid contribution basis")
        now = datetime.now(timezone.utc)
        item = FactoryRevenueProfitBinding(
            id=f"revenue-profit-binding-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id, client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}", binding_number=self._number("RPB", project_id, now),
            binding_reference=reference[:255], correlation_id=str(revenue.get("correlation_id"))[:100],
            account_reference=revenue_account[:255], currency=revenue_currency,
            revenue_load_run_id=revenue_run.id, revenue_run_number=revenue_run.run_number,
            revenue_fact_id=revenue_fact.id, revenue_fact_number=revenue_fact.fact_number,
            revenue_source_revision=revenue_fact.source_revision,
            quote_load_run_id=quote_run.id, quote_run_number=quote_run.run_number,
            quote_fact_id=quote_fact.id, quote_fact_number=quote_fact.fact_number,
            quote_source_revision=quote_fact.source_revision, created_by=str(actor), updated_by=str(actor),
        )
        self.db.add(item); await self.db.flush()
        await self._evidence(item, "binding", "binding-created", reference,
                             "Bound published payment and accepted quote facts without modifying either authority", str(actor))
        await self.db.flush(); return serialize_binding(item)

    async def verify_binding(self, binding_id: str, *, project_id: int, expected_revision: int,
                             actor: str, verification_reference: str) -> dict[str, object]:
        item = await self._binding(binding_id, project_id); self._revision(item, expected_revision)
        if item.status != "pending-verification":
            raise ValueError("Only a pending fact binding can be verified")
        if item.created_by == str(actor):
            raise ValueError("Revenue-profit binding verifier must be independent from its creator")
        reference = verification_reference.strip()
        if not reference:
            raise ValueError("Binding verification requires an evidence reference")
        item.status = "verified"; item.verified_by = str(actor); item.verification_reference = reference[:500]
        item.verified_at = datetime.now(timezone.utc); item.revision += 1; item.updated_by = str(actor)
        await self._evidence(item, "binding", "binding-verification", reference,
                             "Independently verified customer, currency, payment and quote-cost binding", str(actor))
        await self.db.flush(); return serialize_binding(item)

    async def calculate(self, *, project_id: int, actor: str, binding_id: str,
                        policy_version_id: str, analysis_reference: str) -> dict[str, object]:
        binding = await self._binding(binding_id, project_id)
        if binding.status != "verified":
            raise ValueError("Contribution analysis requires an independently verified fact binding")
        version = await self._version(policy_version_id, project_id)
        if version.status != "published":
            raise ValueError("Contribution analysis requires a published attribution policy")
        reference = analysis_reference.strip()
        if not reference:
            raise ValueError("Contribution analysis requires an evidence reference")
        revenue_run, revenue_fact = await self._published_fact(project_id, binding.revenue_load_run_id, binding.revenue_fact_id, "revenue", binding.tenant_id)
        quote_run, quote_fact = await self._published_fact(project_id, binding.quote_load_run_id, binding.quote_fact_id, "quotes", binding.tenant_id)
        if revenue_run.run_number != binding.revenue_run_number or quote_run.run_number != binding.quote_run_number:
            raise ValueError("Bound warehouse run numbers changed unexpectedly")
        revenue, quote = _payload(revenue_fact), _payload(quote_fact)
        recognized = _money(revenue.get("paid_amount"), "Recognized revenue")
        subtotal = _money(quote.get("subtotal"), "Quote subtotal")
        quoted_cost = _money(quote.get("cost_total"), "Quote cost")
        governed_cost = (quoted_cost * recognized / subtotal).quantize(MONEY, rounding=ROUND_HALF_UP)
        conversion_at = _utc(revenue_fact.source_updated_at)
        window_start = conversion_at - timedelta(days=version.lookback_days)
        touchpoints = (await self.db.execute(select(FactoryAttributionTouchpoint).where(
            FactoryAttributionTouchpoint.project_id == project_id,
            FactoryAttributionTouchpoint.correlation_id == binding.correlation_id,
            FactoryAttributionTouchpoint.account_reference == binding.account_reference,
            FactoryAttributionTouchpoint.currency == binding.currency,
            FactoryAttributionTouchpoint.occurred_at >= window_start,
            FactoryAttributionTouchpoint.occurred_at <= conversion_at,
        ).order_by(FactoryAttributionTouchpoint.occurred_at, FactoryAttributionTouchpoint.id))).scalars().all()
        if not touchpoints:
            raise ValueError("No consented touchpoints exist inside the approved attribution window")
        spend = sum((Decimal(item.spend_amount) for item in touchpoints), Decimal(0)).quantize(MONEY)
        contribution = (recognized - governed_cost - spend).quantize(MONEY)
        margin = (contribution * 100 / recognized).quantize(PERCENT, rounding=ROUND_HALF_UP)
        duplicate = await self.db.scalar(select(FactoryRevenueProfitRun.id).where(
            FactoryRevenueProfitRun.binding_id == binding.id,
            FactoryRevenueProfitRun.policy_version_id == version.id,
        ))
        if duplicate:
            raise ValueError("This verified binding already used the selected attribution policy version")
        now = datetime.now(timezone.utc)
        run = FactoryRevenueProfitRun(
            id=f"revenue-profit-run-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=binding.agent_path, tenant_id=binding.tenant_id, client_id=binding.client_id,
            plan_id=binding.plan_id, run_number=self._number("RPR", project_id, now),
            analysis_reference=reference[:255], binding_id=binding.id, binding_number=binding.binding_number,
            policy_id=version.policy_id, policy_version_id=version.id, policy_version_number=version.version_number,
            policy_fingerprint=version.policy_fingerprint, model_type=version.model_type,
            correlation_id=binding.correlation_id, account_reference=binding.account_reference, currency=binding.currency,
            recognized_revenue=recognized, governed_sales_cost=governed_cost, marketing_spend=spend,
            contribution_margin=contribution, contribution_margin_percent=margin,
            touchpoint_count=len(touchpoints), calculated_by=str(actor), calculated_at=now, updated_by=str(actor),
        )
        self.db.add(run); await self.db.flush()
        weights = self._weights(len(touchpoints), version.model_type)
        revenue_left, cost_left = recognized, governed_cost
        for index, (touchpoint, weight) in enumerate(zip(touchpoints, weights, strict=True)):
            last = index == len(touchpoints) - 1
            attributed_revenue = revenue_left if last else (recognized * weight).quantize(MONEY, rounding=ROUND_HALF_UP)
            attributed_cost = cost_left if last else (governed_cost * weight).quantize(MONEY, rounding=ROUND_HALF_UP)
            revenue_left -= attributed_revenue; cost_left -= attributed_cost
            attributed_contribution = (attributed_revenue - attributed_cost - Decimal(touchpoint.spend_amount)).quantize(MONEY)
            self.db.add(FactoryRevenueProfitAllocation(
                id=f"revenue-profit-allocation-{secrets.token_urlsafe(18)}", project_id=project_id,
                agent_path=binding.agent_path, tenant_id=binding.tenant_id, client_id=binding.client_id,
                plan_id=binding.plan_id, allocation_number=self._number("RPA", project_id, now),
                analysis_run_id=run.id, run_number=run.run_number, touchpoint_id=touchpoint.id,
                touchpoint_number=touchpoint.touchpoint_number, channel=touchpoint.channel,
                campaign_reference=touchpoint.campaign_reference, weight=weight,
                attributed_revenue=attributed_revenue, attributed_sales_cost=attributed_cost,
                touchpoint_spend=touchpoint.spend_amount, attributed_contribution=attributed_contribution,
            ))
        await self._evidence(run, "analysis", "analysis-calculated", reference,
                             "Calculated management contribution estimate from pinned warehouse facts and consented touchpoints", str(actor))
        await self.db.flush()
        allocations = (await self.db.execute(select(FactoryRevenueProfitAllocation).where(
            FactoryRevenueProfitAllocation.analysis_run_id == run.id,
        ).order_by(FactoryRevenueProfitAllocation.created_at))).scalars().all()
        return {"run": serialize_run(run), "allocations": [serialize_allocation(item) for item in allocations]}

    async def verify_analysis(self, run_id: str, *, project_id: int, expected_revision: int,
                              actor: str, verification_reference: str,
                              verification_note: str) -> dict[str, object]:
        run = await self._run(run_id, project_id); self._revision(run, expected_revision)
        if run.status != "calculated":
            raise ValueError("Only a calculated contribution analysis can be verified")
        if run.calculated_by == str(actor):
            raise ValueError("Contribution analysis verifier must be independent from the calculator")
        reference, note = verification_reference.strip(), verification_note.strip()
        if not reference or len(note) < 8:
            raise ValueError("Analysis verification requires evidence and an explicit review note")
        run.status = "published"; run.verification_reference = reference[:500]
        run.verification_note = note; run.verified_by = str(actor); run.verified_at = datetime.now(timezone.utc)
        run.revision += 1; run.updated_by = str(actor)
        await self._evidence(run, "analysis", "analysis-publication", reference,
                             f"Published management contribution estimate {run.contribution_margin}; not formal accounting profit", str(actor))
        await self.db.flush(); return serialize_run(run)

    async def _warehouse_candidates(self, project_id: int) -> list[dict[str, object]]:
        runs = (await self.db.execute(select(FactoryWarehouseLoadRun).where(
            FactoryWarehouseLoadRun.project_id == project_id,
            FactoryWarehouseLoadRun.status == "published",
            FactoryWarehouseLoadRun.source_code.in_(("revenue", "quotes")),
        ).order_by(FactoryWarehouseLoadRun.published_at.desc()))).scalars().all()
        result: list[dict[str, object]] = []
        for run in runs:
            edges = (await self.db.execute(select(FactoryWarehouseLineageEdge).where(
                FactoryWarehouseLineageEdge.load_run_id == run.id,
            ))).scalars().all()
            fact_ids = list(dict.fromkeys(edge.fact_id for edge in edges))
            if not fact_ids:
                continue
            facts = (await self.db.execute(select(FactoryWarehouseFactVersion).where(
                FactoryWarehouseFactVersion.id.in_(fact_ids),
            ))).scalars().all()
            for fact in facts:
                result.append({
                    "load_run_id": run.id, "run_number": run.run_number,
                    "source_code": run.source_code, "watermark_to": run.watermark_to,
                    "fact_id": fact.id, "fact_number": fact.fact_number,
                    "source_object_number": fact.source_object_number,
                    "source_revision": fact.source_revision, "source_updated_at": fact.source_updated_at,
                    "payload": _payload(fact),
                })
        return result

    async def _published_fact(self, project_id: int, run_id: str, fact_id: str,
                              source_code: str, tenant_id: str):
        run = await self.db.scalar(select(FactoryWarehouseLoadRun).where(
            FactoryWarehouseLoadRun.id == run_id, FactoryWarehouseLoadRun.project_id == project_id,
            FactoryWarehouseLoadRun.tenant_id == tenant_id, FactoryWarehouseLoadRun.source_code == source_code,
            FactoryWarehouseLoadRun.status == "published",
        ))
        if not run:
            raise ValueError(f"{source_code} binding requires a published warehouse run")
        edge = await self.db.scalar(select(FactoryWarehouseLineageEdge).where(
            FactoryWarehouseLineageEdge.load_run_id == run.id,
            FactoryWarehouseLineageEdge.fact_id == fact_id,
        ))
        fact = await self.db.scalar(select(FactoryWarehouseFactVersion).where(
            FactoryWarehouseFactVersion.id == fact_id, FactoryWarehouseFactVersion.project_id == project_id,
            FactoryWarehouseFactVersion.tenant_id == tenant_id, FactoryWarehouseFactVersion.source_code == source_code,
            FactoryWarehouseFactVersion.quality_status == "accepted",
        ))
        if not edge or not fact or fact.source_id != run.source_id:
            raise ValueError(f"{source_code} fact must be accepted and belong to the published run lineage")
        return run, fact

    async def _create_version(self, policy: FactoryAttributionPolicy, *, version_number: int,
                              actor: str, version_reference: str, label: str,
                              model_type: str, lookback_days: int,
                              effective_from: datetime, change_reason: str):
        reference, clean_label, reason = version_reference.strip(), label.strip(), change_reason.strip()
        model = model_type.strip().lower()
        if not reference or not clean_label or len(reason) < 8:
            raise ValueError("Attribution version requires reference, label and explicit change reason")
        if model not in MODEL_TYPES or not 1 <= lookback_days <= 365:
            raise ValueError("Attribution policy supports first-touch, last-touch or linear with a 1-365 day window")
        fingerprint = hashlib.sha256(json.dumps({
            "policy_code": policy.policy_code, "version": version_number,
            "model_type": model, "lookback_days": lookback_days,
            "effective_from": effective_from.isoformat(),
        }, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        now = datetime.now(timezone.utc)
        item = FactoryAttributionPolicyVersion(
            id=f"attribution-policy-version-{secrets.token_urlsafe(18)}", project_id=policy.project_id,
            agent_path=policy.agent_path, tenant_id=policy.tenant_id, client_id=policy.client_id,
            plan_id=policy.plan_id, version_number_record=self._number("ATV", policy.project_id, now),
            version_reference=reference[:255], policy_id=policy.id, policy_number=policy.policy_number,
            policy_code=policy.policy_code, version_number=version_number, label=clean_label[:255],
            model_type=model, lookback_days=lookback_days, policy_fingerprint=fingerprint,
            change_reason=reason, effective_from=effective_from, authored_by=str(actor), updated_by=str(actor),
        )
        self.db.add(item); await self.db.flush(); return item

    async def _policy(self, item_id: str, project_id: int):
        item = await self.db.scalar(select(FactoryAttributionPolicy).where(
            FactoryAttributionPolicy.id == item_id, FactoryAttributionPolicy.project_id == project_id,
        ))
        if not item: raise KeyError("Attribution policy not found in this tenant plan")
        return item

    async def _version(self, item_id: str, project_id: int):
        item = await self.db.scalar(select(FactoryAttributionPolicyVersion).where(
            FactoryAttributionPolicyVersion.id == item_id,
            FactoryAttributionPolicyVersion.project_id == project_id,
        ))
        if not item: raise KeyError("Attribution policy version not found in this tenant plan")
        return item

    async def _binding(self, item_id: str, project_id: int):
        item = await self.db.scalar(select(FactoryRevenueProfitBinding).where(
            FactoryRevenueProfitBinding.id == item_id, FactoryRevenueProfitBinding.project_id == project_id,
        ))
        if not item: raise KeyError("Revenue-profit binding not found in this tenant plan")
        return item

    async def _run(self, item_id: str, project_id: int):
        item = await self.db.scalar(select(FactoryRevenueProfitRun).where(
            FactoryRevenueProfitRun.id == item_id, FactoryRevenueProfitRun.project_id == project_id,
        ))
        if not item: raise KeyError("Revenue-profit analysis not found in this tenant plan")
        return item

    async def _evidence(self, item, subject_type: str, evidence_type: str,
                        reference: str, note: str, actor: str):
        number = {
            "policy-version": "version_number_record", "touchpoint": "touchpoint_number",
            "binding": "binding_number", "analysis": "run_number",
        }[subject_type]
        now = datetime.now(timezone.utc)
        self.db.add(FactoryRevenueProfitEvidence(
            id=f"revenue-profit-evidence-{secrets.token_urlsafe(18)}", project_id=item.project_id,
            agent_path=item.agent_path, tenant_id=item.tenant_id, client_id=item.client_id,
            plan_id=item.plan_id, evidence_number=self._number("RPE", item.project_id, now),
            subject_type=subject_type, subject_id=item.id, subject_number=getattr(item, number),
            evidence_type=evidence_type, evidence_reference=reference.strip()[:500],
            note=note.strip(), recorded_by=str(actor),
        ))

    @staticmethod
    def _weights(count: int, model_type: str) -> list[Decimal]:
        if model_type == "first-touch": return [Decimal(1), *([Decimal(0)] * (count - 1))]
        if model_type == "last-touch": return [*([Decimal(0)] * (count - 1)), Decimal(1)]
        base = (Decimal(1) / Decimal(count)).quantize(WEIGHT, rounding=ROUND_HALF_UP)
        values = [base] * (count - 1)
        return [*values, Decimal(1) - sum(values, Decimal(0))]

    @staticmethod
    def _effective(value: datetime, now: datetime) -> datetime:
        aware = _utc(value)
        if aware < now - timedelta(minutes=5):
            raise ValueError("Attribution policy cannot become effective retroactively; historical results stay pinned")
        return aware

    @staticmethod
    def _number(prefix: str, project_id: int, now: datetime) -> str:
        return f"{prefix}-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}"

    @staticmethod
    def _revision(item, expected: int):
        if item.revision != expected:
            raise ValueError("Revenue-profit governance record changed; refresh before continuing")
