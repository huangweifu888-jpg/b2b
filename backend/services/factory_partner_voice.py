"""Governed partner, academy, voice-of-customer and advocacy workflows."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_customer_asset import FactoryCustomerAsset
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_partner_voice import (
    FactoryPartnerAccount,
    FactoryPartnerAcademyEnrollment,
    FactoryPartnerVoiceEvidence,
    FactoryVoiceOfCustomerCase,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


PARTNER_TYPES = {"distributor", "dealer", "service-partner", "customer"}
VOICE_TYPES = {"nps", "csat", "complaint", "suggestion", "testimonial"}
SEVERITIES = {"low", "medium", "high", "critical"}
ORDER_ACTIVE_STATUSES = {
    "confirmed", "allocated", "in-production", "production-completed",
    "quality-released", "shipped", "delivered",
}


def _json(value: str | None, fallback):
    try:
        parsed = json.loads(value or "")
    except (TypeError, ValueError):
        return fallback
    return parsed if isinstance(parsed, type(fallback)) else fallback


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _score(value: object, field: str) -> Decimal:
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError(f"{field} must be numeric") from exc


def serialize_evidence(item: FactoryPartnerVoiceEvidence) -> dict[str, object]:
    return {
        "id": item.id, "evidence_number": item.evidence_number,
        "subject_type": item.subject_type, "subject_id": item.subject_id,
        "subject_number": item.subject_number, "evidence_type": item.evidence_type,
        "evidence_reference": item.evidence_reference, "note": item.note,
        "recorded_by": item.recorded_by, "created_at": item.created_at,
    }


def serialize_partner(item: FactoryPartnerAccount, evidence=None) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id,
        "client_id": item.client_id, "plan_id": item.plan_id,
        "partner_number": item.partner_number, "external_reference": item.external_reference,
        "legal_name": item.legal_name, "partner_type": item.partner_type,
        "country_code": item.country_code, "territory": item.territory,
        "product_scope": _json(item.product_scope_json, []),
        "account_reference": item.account_reference,
        "primary_contact_reference": item.primary_contact_reference,
        "relationship_evidence_reference": item.relationship_evidence_reference,
        "agreement_reference": item.agreement_reference, "status": item.status,
        "activated_by": item.activated_by, "activated_at": item.activated_at,
        "suspension_reason": item.suspension_reason,
        "evidence": [serialize_evidence(row) for row in evidence or []],
        "revision": item.revision, "updated_by": item.updated_by,
        "created_at": item.created_at, "updated_at": item.updated_at,
    }


def serialize_enrollment(item: FactoryPartnerAcademyEnrollment, evidence=None) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id,
        "enrollment_number": item.enrollment_number,
        "enrollment_reference": item.enrollment_reference,
        "partner_id": item.partner_id, "partner_number": item.partner_number,
        "learner_reference": item.learner_reference, "course_code": item.course_code,
        "course_title": item.course_title, "course_version": item.course_version,
        "passing_score": item.passing_score,
        "planned_completion_at": item.planned_completion_at, "status": item.status,
        "assessment_score": str(item.assessment_score) if item.assessment_score is not None else None,
        "completion_evidence_reference": item.completion_evidence_reference,
        "completed_at": item.completed_at,
        "certification_reference": item.certification_reference,
        "certification_expires_at": item.certification_expires_at,
        "certified_by": item.certified_by, "certified_at": item.certified_at,
        "evidence": [serialize_evidence(row) for row in evidence or []],
        "revision": item.revision, "updated_by": item.updated_by,
        "created_at": item.created_at, "updated_at": item.updated_at,
    }


def serialize_voice(item: FactoryVoiceOfCustomerCase, evidence=None) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id,
        "client_id": item.client_id, "plan_id": item.plan_id,
        "voice_number": item.voice_number, "feedback_reference": item.feedback_reference,
        "source_type": item.source_type, "partner_id": item.partner_id,
        "partner_number": item.partner_number, "account_reference": item.account_reference,
        "related_order_id": item.related_order_id,
        "related_order_number": item.related_order_number,
        "related_asset_id": item.related_asset_id,
        "related_asset_number": item.related_asset_number,
        "category": item.category, "severity": item.severity,
        "score": item.score, "sentiment": item.sentiment, "summary": item.summary,
        "lifecycle_status": item.lifecycle_status,
        "triage_reference": item.triage_reference, "owner": item.owner,
        "due_at": item.due_at, "root_cause": item.root_cause,
        "action_plan": item.action_plan, "action_reference": item.action_reference,
        "resolution_reference": item.resolution_reference,
        "resolution_note": item.resolution_note,
        "escalation_reference": item.escalation_reference,
        "resolved_by": item.resolved_by, "resolved_at": item.resolved_at,
        "customer_confirmation_reference": item.customer_confirmation_reference,
        "customer_confirmed_at": item.customer_confirmed_at,
        "closed_by": item.closed_by, "closed_at": item.closed_at,
        "advocacy_status": item.advocacy_status,
        "advocacy_invitation_reference": item.advocacy_invitation_reference,
        "advocacy_consent_reference": item.advocacy_consent_reference,
        "advocacy_consent_scope": item.advocacy_consent_scope,
        "advocacy_consent_expires_at": item.advocacy_consent_expires_at,
        "case_study_reference": item.case_study_reference,
        "publication_channel": item.publication_channel,
        "published_by": item.published_by, "published_at": item.published_at,
        "milestones": _json(item.milestones_json, []),
        "evidence": [serialize_evidence(row) for row in evidence or []],
        "revision": item.revision, "updated_by": item.updated_by,
        "created_at": item.created_at, "updated_at": item.updated_at,
    }


class FactoryPartnerVoiceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict[str, object]:
        partners = list((await self.db.execute(select(FactoryPartnerAccount).where(
            FactoryPartnerAccount.project_id == project_id,
        ).order_by(FactoryPartnerAccount.created_at.desc()))).scalars().all())
        enrollments = list((await self.db.execute(select(FactoryPartnerAcademyEnrollment).where(
            FactoryPartnerAcademyEnrollment.project_id == project_id,
        ).order_by(FactoryPartnerAcademyEnrollment.created_at.desc()))).scalars().all())
        voices = list((await self.db.execute(select(FactoryVoiceOfCustomerCase).where(
            FactoryVoiceOfCustomerCase.project_id == project_id,
        ).order_by(FactoryVoiceOfCustomerCase.created_at.desc()))).scalars().all())
        evidence = list((await self.db.execute(select(FactoryPartnerVoiceEvidence).where(
            FactoryPartnerVoiceEvidence.project_id == project_id,
        ).order_by(FactoryPartnerVoiceEvidence.created_at))).scalars().all())
        orders = list((await self.db.execute(select(FactoryFulfillmentOrder).where(
            FactoryFulfillmentOrder.project_id == project_id,
            FactoryFulfillmentOrder.status.in_(ORDER_ACTIVE_STATUSES),
        ).order_by(FactoryFulfillmentOrder.created_at.desc()))).scalars().all())
        assets = list((await self.db.execute(select(FactoryCustomerAsset).where(
            FactoryCustomerAsset.project_id == project_id,
            FactoryCustomerAsset.status != "retired",
        ).order_by(FactoryCustomerAsset.created_at.desc()))).scalars().all())
        evidence_map: dict[str, list[FactoryPartnerVoiceEvidence]] = {}
        for row in evidence:
            evidence_map.setdefault(row.subject_id, []).append(row)
        accounts: dict[str, dict[str, object]] = {}
        for order in orders:
            accounts.setdefault(order.account_reference, {
                "account_reference": order.account_reference, "latest_order_id": order.id,
                "latest_order_number": order.order_number, "asset_id": None, "asset_number": None,
            })
        for asset in assets:
            account = accounts.setdefault(asset.account_reference, {
                "account_reference": asset.account_reference, "latest_order_id": asset.order_id,
                "latest_order_number": asset.order_number, "asset_id": None, "asset_number": None,
            })
            account["asset_id"] = asset.id
            account["asset_number"] = asset.asset_number
        nps = [row for row in voices if row.source_type == "nps" and row.score is not None]
        promoters = sum(1 for row in nps if row.score >= 9)
        detractors = sum(1 for row in nps if row.score <= 6)
        nps_score = round((promoters - detractors) / len(nps) * 100) if nps else None
        return {
            "partners": [serialize_partner(row, evidence_map.get(row.id)) for row in partners],
            "enrollments": [serialize_enrollment(row, evidence_map.get(row.id)) for row in enrollments],
            "voices": [serialize_voice(row, evidence_map.get(row.id)) for row in voices],
            "eligible_accounts": list(accounts.values()),
            "metrics": {"nps_responses": len(nps), "promoters": promoters, "detractors": detractors, "nps": nps_score},
        }

    async def create_partner(
        self, *, project_id: int, context: TenantContext, actor: str,
        external_reference: str, legal_name: str, partner_type: str, country_code: str,
        territory: str, product_scope: list[str], primary_contact_reference: str,
        relationship_evidence_reference: str, account_reference: str | None = None,
    ) -> dict[str, object]:
        external = self._required(external_reference, "Partner external reference")[:255]
        name = legal_name.strip()
        kind = partner_type.strip().lower()
        country = country_code.strip().upper()
        clean_territory = territory.strip()
        contact = self._required(primary_contact_reference, "Business contact reference")
        relationship = self._required(relationship_evidence_reference, "Relationship evidence")
        products = list(dict.fromkeys(value.strip()[:255] for value in product_scope if value.strip()))
        account = (account_reference or "").strip()[:255] or None
        if len(name) < 2 or kind not in PARTNER_TYPES or len(country) != 2 or not clean_territory or not products:
            raise ValueError("Partner requires legal name, type, country, territory and product scope")
        if account and not await self._account_exists(account, project_id):
            raise ValueError("Linked customer account is not backed by an order or installed asset in this tenant plan")
        duplicate = await self.db.scalar(select(FactoryPartnerAccount.id).where(
            FactoryPartnerAccount.tenant_id == context.tenant_id,
            FactoryPartnerAccount.external_reference == external,
        ))
        if duplicate:
            raise ValueError("Partner external reference already exists in this tenant")
        now = datetime.now(timezone.utc)
        item = FactoryPartnerAccount(
            id=f"partner-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id,
            client_id=context.client_id, plan_id=context.plan_id or f"plan-{project_id}",
            partner_number=f"PRM-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            external_reference=external, legal_name=name[:500], partner_type=kind,
            country_code=country, territory=clean_territory[:500],
            product_scope_json=json.dumps(products, ensure_ascii=False, separators=(",", ":")),
            account_reference=account, primary_contact_reference=contact,
            relationship_evidence_reference=relationship, updated_by=actor,
        )
        self.db.add(item); await self.db.flush()
        await self._record(item, "partner", item.partner_number, "relationship", relationship, "Verified partner relationship evidence", actor)
        return await self._serialized_partner(item)

    async def activate_partner(
        self, partner_id: str, *, project_id: int, expected_revision: int, actor: str,
        agreement_reference: str, approval_note: str,
    ) -> dict[str, object]:
        item = await self._partner(partner_id, project_id)
        self._guard(item, expected_revision, "draft", "Partner activation")
        agreement = self._required(agreement_reference, "Partner agreement")
        note = approval_note.strip()
        if len(note) < 8:
            raise ValueError("Partner activation requires an approval note")
        item.status = "active"; item.agreement_reference = agreement
        item.activated_by = actor; item.activated_at = datetime.now(timezone.utc)
        item.revision += 1; item.updated_by = actor
        await self._record(item, "partner", item.partner_number, "activation", agreement, note, actor)
        return await self._serialized_partner(item)

    async def enroll_academy(
        self, *, project_id: int, context: TenantContext, actor: str, partner_id: str,
        enrollment_reference: str, learner_reference: str, course_code: str,
        course_title: str, course_version: str, passing_score: int,
        planned_completion_at: datetime,
    ) -> dict[str, object]:
        partner = await self._partner(partner_id, project_id)
        if partner.status != "active":
            raise ValueError("Academy enrollment requires an active approved partner")
        reference = self._required(enrollment_reference, "Enrollment reference")[:255]
        learner = self._required(learner_reference, "Learner reference")
        code = self._required(course_code, "Course code")[:100]
        title = course_title.strip(); version = self._required(course_version, "Course version")[:100]
        if len(title) < 3 or not 1 <= passing_score <= 100 or _utc(planned_completion_at) <= datetime.now(timezone.utc):
            raise ValueError("Enrollment requires course, passing score and future completion date")
        duplicate = await self.db.scalar(select(FactoryPartnerAcademyEnrollment.id).where(
            FactoryPartnerAcademyEnrollment.tenant_id == context.tenant_id,
            ((FactoryPartnerAcademyEnrollment.enrollment_reference == reference) |
             ((FactoryPartnerAcademyEnrollment.partner_id == partner.id) &
              (FactoryPartnerAcademyEnrollment.course_code == code) &
              (FactoryPartnerAcademyEnrollment.course_version == version))),
        ))
        if duplicate:
            raise ValueError("Partner course version or enrollment reference already exists")
        now = datetime.now(timezone.utc)
        item = FactoryPartnerAcademyEnrollment(
            id=f"academy-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id,
            client_id=context.client_id, plan_id=context.plan_id or f"plan-{project_id}",
            enrollment_number=f"ACA-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            enrollment_reference=reference, partner_id=partner.id,
            partner_number=partner.partner_number, learner_reference=learner,
            course_code=code, course_title=title[:500], course_version=version,
            passing_score=passing_score, planned_completion_at=_utc(planned_completion_at),
            updated_by=actor,
        )
        self.db.add(item); await self.db.flush()
        await self._record(item, "academy", item.enrollment_number, "enrollment", reference, f"Enrolled in {code} {version}", actor)
        return await self._serialized_enrollment(item)

    async def complete_academy(
        self, enrollment_id: str, *, project_id: int, expected_revision: int, actor: str,
        assessment_score: object, completion_evidence_reference: str,
    ) -> dict[str, object]:
        item = await self._enrollment(enrollment_id, project_id)
        self._guard(item, expected_revision, "enrolled", "Academy completion")
        score = _score(assessment_score, "Assessment score")
        evidence = self._required(completion_evidence_reference, "Learning completion evidence")
        if score < item.passing_score or score > 100:
            raise ValueError("Assessment score must meet the governed course passing score")
        item.status = "completed"; item.assessment_score = score
        item.completion_evidence_reference = evidence; item.completed_at = datetime.now(timezone.utc)
        item.revision += 1; item.updated_by = actor
        await self._record(item, "academy", item.enrollment_number, "completion", evidence, f"Assessment passed with score {score}", actor)
        return await self._serialized_enrollment(item)

    async def certify_academy(
        self, enrollment_id: str, *, project_id: int, expected_revision: int, actor: str,
        certification_reference: str, certification_expires_at: datetime,
    ) -> dict[str, object]:
        item = await self._enrollment(enrollment_id, project_id)
        self._guard(item, expected_revision, "completed", "Academy certification")
        reference = self._required(certification_reference, "Certification evidence")
        if _utc(certification_expires_at) <= datetime.now(timezone.utc):
            raise ValueError("Partner certification expiry must be in the future")
        item.status = "certified"; item.certification_reference = reference
        item.certification_expires_at = _utc(certification_expires_at)
        item.certified_by = actor; item.certified_at = datetime.now(timezone.utc)
        item.revision += 1; item.updated_by = actor
        await self._record(item, "academy", item.enrollment_number, "certification", reference, "Partner course certification issued", actor)
        return await self._serialized_enrollment(item)

    async def create_voice(
        self, *, project_id: int, context: TenantContext, actor: str,
        feedback_reference: str, source_type: str, account_reference: str,
        category: str, severity: str, summary: str, score: int | None = None,
        partner_id: str | None = None, related_order_id: str | None = None,
        related_asset_id: str | None = None,
    ) -> dict[str, object]:
        source = source_type.strip().lower(); level = severity.strip().lower()
        reference = self._required(feedback_reference, "Feedback reference")[:255]
        account = account_reference.strip()[:255]
        clean_category = category.strip()[:50]; note = summary.strip()
        if source not in VOICE_TYPES or level not in SEVERITIES or not clean_category or len(note) < 8:
            raise ValueError("Voice record requires source, severity, category and detailed summary")
        partner = await self._partner(partner_id, project_id) if partner_id else None
        if partner and partner.status != "active":
            raise ValueError("Partner voice requires an active approved partner")
        if partner and partner.account_reference:
            if account and account != partner.account_reference:
                raise ValueError("Feedback account does not match the approved partner link")
            account = partner.account_reference
        if not account:
            account = partner.external_reference if partner else ""
        if not partner and not await self._account_exists(account, project_id):
            raise ValueError("Direct customer voice requires an order or installed asset in this tenant plan")
        order = None
        if related_order_id:
            order = await self.db.scalar(select(FactoryFulfillmentOrder).where(
                FactoryFulfillmentOrder.id == related_order_id,
                FactoryFulfillmentOrder.project_id == project_id,
                FactoryFulfillmentOrder.account_reference == account,
                FactoryFulfillmentOrder.status.in_(ORDER_ACTIVE_STATUSES),
            ))
            if not order:
                raise ValueError("Related order must be an active authoritative order for the same customer")
        asset = None
        if related_asset_id:
            asset = await self.db.scalar(select(FactoryCustomerAsset).where(
                FactoryCustomerAsset.id == related_asset_id,
                FactoryCustomerAsset.project_id == project_id,
                FactoryCustomerAsset.account_reference == account,
            ))
            if not asset:
                raise ValueError("Related asset must belong to the same customer and tenant plan")
        normalized_score = score
        if source == "nps":
            if score is None or not 0 <= score <= 10:
                raise ValueError("NPS response requires a score from 0 to 10")
            sentiment = "promoter" if score >= 9 else "passive" if score >= 7 else "detractor"
        elif source == "csat":
            if score is None or not 1 <= score <= 5:
                raise ValueError("CSAT response requires a score from 1 to 5")
            sentiment = "positive" if score >= 4 else "neutral" if score == 3 else "negative"
        else:
            if score is not None:
                raise ValueError("Only NPS and CSAT voice records accept numeric scores")
            sentiment = "negative" if source == "complaint" else "positive" if source == "testimonial" else "neutral"
            normalized_score = None
        duplicate = await self.db.scalar(select(FactoryVoiceOfCustomerCase.id).where(
            FactoryVoiceOfCustomerCase.tenant_id == context.tenant_id,
            FactoryVoiceOfCustomerCase.feedback_reference == reference,
        ))
        if duplicate:
            raise ValueError("Feedback reference already exists in this tenant")
        now = datetime.now(timezone.utc)
        item = FactoryVoiceOfCustomerCase(
            id=f"voice-{secrets.token_urlsafe(18)}", project_id=project_id,
            agent_path=context.agent_path, tenant_id=context.tenant_id,
            client_id=context.client_id, plan_id=context.plan_id or f"plan-{project_id}",
            voice_number=f"VOC-{project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            feedback_reference=reference, source_type=source,
            partner_id=partner.id if partner else None,
            partner_number=partner.partner_number if partner else None,
            account_reference=account, related_order_id=order.id if order else None,
            related_order_number=order.order_number if order else None,
            related_asset_id=asset.id if asset else None,
            related_asset_number=asset.asset_number if asset else None,
            category=clean_category, severity=level, score=normalized_score,
            sentiment=sentiment, summary=note[:4000], updated_by=actor,
        )
        self.db.add(item); await self.db.flush()
        await self._record(item, "voice", item.voice_number, "feedback-received", reference, note, actor)
        self._milestone(item, "receive", reference, actor)
        return await self._serialized_voice(item)

    async def triage_voice(
        self, voice_id: str, *, project_id: int, expected_revision: int, actor: str,
        triage_reference: str, owner: str, due_at: datetime,
    ) -> dict[str, object]:
        item = await self._voice(voice_id, project_id)
        self._guard(item, expected_revision, "received", "Voice triage")
        reference = self._required(triage_reference, "Triage evidence")
        clean_owner = self._required(owner, "Voice owner")[:255]
        deadline = _utc(due_at); now = datetime.now(timezone.utc)
        if deadline <= now:
            raise ValueError("Voice action due date must be in the future")
        if (item.severity == "critical" or item.sentiment == "detractor") and deadline > now + timedelta(hours=48):
            raise ValueError("Critical or detractor feedback requires action within 48 hours")
        item.lifecycle_status = "triaged"; item.triage_reference = reference
        item.owner = clean_owner; item.due_at = deadline
        await self._record(item, "voice", item.voice_number, "triage", reference, f"Assigned to {clean_owner}", actor)
        self._advance_voice(item, "triage", reference, actor)
        return await self._serialized_voice(item)

    async def start_action(
        self, voice_id: str, *, project_id: int, expected_revision: int, actor: str,
        root_cause: str, action_plan: str, action_reference: str,
    ) -> dict[str, object]:
        item = await self._voice(voice_id, project_id)
        self._guard(item, expected_revision, "triaged", "Voice action")
        cause = root_cause.strip(); plan = action_plan.strip()
        reference = self._required(action_reference, "Action evidence")
        if len(cause) < 8 or len(plan) < 8:
            raise ValueError("Voice action requires root cause and detailed action plan")
        item.lifecycle_status = "action-in-progress"; item.root_cause = cause[:4000]
        item.action_plan = plan[:4000]; item.action_reference = reference
        await self._record(item, "voice", item.voice_number, "action-started", reference, plan, actor)
        self._advance_voice(item, "start-action", reference, actor)
        return await self._serialized_voice(item)

    async def resolve_voice(
        self, voice_id: str, *, project_id: int, expected_revision: int, actor: str,
        resolution_reference: str, resolution_note: str,
        escalation_reference: str | None = None,
    ) -> dict[str, object]:
        item = await self._voice(voice_id, project_id)
        self._guard(item, expected_revision, "action-in-progress", "Voice resolution")
        reference = self._required(resolution_reference, "Resolution evidence")
        note = resolution_note.strip(); escalation = (escalation_reference or "").strip()[:500] or None
        if len(note) < 8:
            raise ValueError("Voice resolution requires a detailed outcome")
        if (item.severity == "critical" or item.sentiment == "detractor") and not escalation:
            raise ValueError("Critical or detractor resolution requires escalation evidence")
        item.lifecycle_status = "resolved"; item.resolution_reference = reference
        item.resolution_note = note[:4000]; item.escalation_reference = escalation
        item.resolved_by = actor; item.resolved_at = datetime.now(timezone.utc)
        await self._record(item, "voice", item.voice_number, "resolution", reference, note, actor)
        self._advance_voice(item, "resolve", reference, actor)
        return await self._serialized_voice(item)

    async def confirm_voice(
        self, voice_id: str, *, project_id: int, expected_revision: int, actor: str,
        customer_confirmation_reference: str,
    ) -> dict[str, object]:
        item = await self._voice(voice_id, project_id)
        self._guard(item, expected_revision, "resolved", "Customer confirmation")
        reference = self._required(customer_confirmation_reference, "Customer confirmation")
        item.lifecycle_status = "customer-confirmed"
        item.customer_confirmation_reference = reference
        item.customer_confirmed_at = datetime.now(timezone.utc)
        await self._record(item, "voice", item.voice_number, "customer-confirmation", reference, "Customer accepted the documented response", actor)
        self._advance_voice(item, "confirm", reference, actor)
        return await self._serialized_voice(item)

    async def close_voice(
        self, voice_id: str, *, project_id: int, expected_revision: int, actor: str,
        closure_reference: str,
    ) -> dict[str, object]:
        item = await self._voice(voice_id, project_id)
        self._guard(item, expected_revision, "customer-confirmed", "Voice closure")
        reference = self._required(closure_reference, "Closure evidence")
        item.lifecycle_status = "closed"; item.closed_by = actor
        item.closed_at = datetime.now(timezone.utc)
        eligible = (item.source_type == "nps" and item.score is not None and item.score >= 9) or (item.source_type == "csat" and item.score == 5) or item.source_type == "testimonial"
        item.advocacy_status = "eligible" if eligible else "not-eligible"
        await self._record(item, "voice", item.voice_number, "closure", reference, "Customer-confirmed feedback case closed", actor)
        self._advance_voice(item, "close", reference, actor)
        return await self._serialized_voice(item)

    async def invite_advocacy(
        self, voice_id: str, *, project_id: int, expected_revision: int, actor: str,
        invitation_reference: str,
    ) -> dict[str, object]:
        item = await self._voice(voice_id, project_id)
        if item.revision != expected_revision or item.lifecycle_status != "closed" or item.advocacy_status != "eligible":
            raise ValueError("Advocacy invitation requires an eligible closed customer-confirmed voice case")
        reference = self._required(invitation_reference, "Advocacy invitation")
        item.advocacy_status = "invited"; item.advocacy_invitation_reference = reference
        await self._record(item, "voice", item.voice_number, "advocacy-invitation", reference, "Invitation sent without review incentive", actor)
        self._advance_voice(item, "invite-advocacy", reference, actor)
        return await self._serialized_voice(item)

    async def authorize_advocacy(
        self, voice_id: str, *, project_id: int, expected_revision: int, actor: str,
        consent_reference: str, consent_scope: str, consent_expires_at: datetime,
    ) -> dict[str, object]:
        item = await self._voice(voice_id, project_id)
        if item.revision != expected_revision or item.advocacy_status != "invited":
            raise ValueError("Advocacy authorization requires a current invitation")
        reference = self._required(consent_reference, "Advocacy consent")
        scope = consent_scope.strip()
        if len(scope) < 8 or _utc(consent_expires_at) <= datetime.now(timezone.utc):
            raise ValueError("Advocacy consent requires explicit scope and future expiry")
        item.advocacy_status = "authorized"; item.advocacy_consent_reference = reference
        item.advocacy_consent_scope = scope[:4000]
        item.advocacy_consent_expires_at = _utc(consent_expires_at)
        await self._record(item, "voice", item.voice_number, "advocacy-consent", reference, scope, actor)
        self._advance_voice(item, "authorize-advocacy", reference, actor)
        return await self._serialized_voice(item)

    async def publish_advocacy(
        self, voice_id: str, *, project_id: int, expected_revision: int, actor: str,
        case_study_reference: str, publication_channel: str,
    ) -> dict[str, object]:
        item = await self._voice(voice_id, project_id)
        if item.revision != expected_revision or item.advocacy_status != "authorized":
            raise ValueError("Advocacy publication requires current explicit authorization")
        reference = self._required(case_study_reference, "Case study publication evidence")
        channel = publication_channel.strip()
        if not channel or not item.advocacy_consent_expires_at or datetime.now(timezone.utc) >= _utc(item.advocacy_consent_expires_at):
            raise ValueError("Advocacy publication requires an authorized channel within consent validity")
        item.advocacy_status = "published"; item.case_study_reference = reference
        item.publication_channel = channel[:255]; item.published_by = actor
        item.published_at = datetime.now(timezone.utc)
        await self._record(item, "voice", item.voice_number, "advocacy-publication", reference, f"Published to authorized channel {channel}", actor)
        self._advance_voice(item, "publish-advocacy", reference, actor)
        return await self._serialized_voice(item)

    async def _account_exists(self, reference: str, project_id: int) -> bool:
        if not reference:
            return False
        asset = await self.db.scalar(select(FactoryCustomerAsset.id).where(
            FactoryCustomerAsset.project_id == project_id,
            FactoryCustomerAsset.account_reference == reference,
        ))
        if asset:
            return True
        return bool(await self.db.scalar(select(FactoryFulfillmentOrder.id).where(
            FactoryFulfillmentOrder.project_id == project_id,
            FactoryFulfillmentOrder.account_reference == reference,
            FactoryFulfillmentOrder.status.in_(ORDER_ACTIVE_STATUSES),
        )))

    async def _partner(self, item_id: str, project_id: int) -> FactoryPartnerAccount:
        item = await self.db.scalar(select(FactoryPartnerAccount).where(
            FactoryPartnerAccount.id == item_id, FactoryPartnerAccount.project_id == project_id,
        ))
        if not item:
            raise KeyError("Partner not found in this tenant plan")
        return item

    async def _enrollment(self, item_id: str, project_id: int) -> FactoryPartnerAcademyEnrollment:
        item = await self.db.scalar(select(FactoryPartnerAcademyEnrollment).where(
            FactoryPartnerAcademyEnrollment.id == item_id,
            FactoryPartnerAcademyEnrollment.project_id == project_id,
        ))
        if not item:
            raise KeyError("Academy enrollment not found in this tenant plan")
        return item

    async def _voice(self, item_id: str, project_id: int) -> FactoryVoiceOfCustomerCase:
        item = await self.db.scalar(select(FactoryVoiceOfCustomerCase).where(
            FactoryVoiceOfCustomerCase.id == item_id,
            FactoryVoiceOfCustomerCase.project_id == project_id,
        ))
        if not item:
            raise KeyError("Voice case not found in this tenant plan")
        return item

    async def _evidence(self, subject_id: str) -> list[FactoryPartnerVoiceEvidence]:
        return list((await self.db.execute(select(FactoryPartnerVoiceEvidence).where(
            FactoryPartnerVoiceEvidence.subject_id == subject_id,
        ).order_by(FactoryPartnerVoiceEvidence.created_at))).scalars().all())

    async def _serialized_partner(self, item):
        await self.db.flush(); return serialize_partner(item, await self._evidence(item.id))

    async def _serialized_enrollment(self, item):
        await self.db.flush(); return serialize_enrollment(item, await self._evidence(item.id))

    async def _serialized_voice(self, item):
        await self.db.flush(); return serialize_voice(item, await self._evidence(item.id))

    async def _record(self, item, subject_type: str, subject_number: str, evidence_type: str, reference: str, note: str, actor: str) -> None:
        now = datetime.now(timezone.utc)
        self.db.add(FactoryPartnerVoiceEvidence(
            id=f"partner-voice-evidence-{secrets.token_urlsafe(18)}",
            project_id=item.project_id, agent_path=item.agent_path, tenant_id=item.tenant_id,
            client_id=item.client_id, plan_id=item.plan_id,
            evidence_number=f"PVE-{item.project_id}-{now:%Y%m%d%H%M%S}-{secrets.token_hex(3).upper()}",
            subject_type=subject_type, subject_id=item.id, subject_number=subject_number,
            evidence_type=evidence_type, evidence_reference=reference,
            note=note[:4000], recorded_by=actor,
        ))
        await self.db.flush()

    @staticmethod
    def _required(value: str, label: str) -> str:
        cleaned = value.strip()[:500]
        if not cleaned:
            raise ValueError(f"{label} is required")
        return cleaned

    @staticmethod
    def _guard(item, expected_revision: int, status: str, label: str) -> None:
        if item.revision != expected_revision:
            raise ValueError(f"{label} changed; refresh before saving")
        current_status = getattr(item, "status", None) or getattr(item, "lifecycle_status", None)
        if current_status != status:
            raise ValueError(f"{label} requires {status} status")

    @staticmethod
    def _milestone(item: FactoryVoiceOfCustomerCase, action: str, reference: str, actor: str) -> None:
        milestones = _json(item.milestones_json, [])
        milestones.append({"action": action, "status": item.lifecycle_status, "evidenceReference": reference, "recordedBy": actor, "occurredAt": datetime.now(timezone.utc).isoformat()})
        item.milestones_json = json.dumps(milestones, ensure_ascii=False, separators=(",", ":"))

    @classmethod
    def _advance_voice(cls, item: FactoryVoiceOfCustomerCase, action: str, reference: str, actor: str) -> None:
        cls._milestone(item, action, reference, actor)
        item.revision += 1; item.updated_by = actor
