"""Governed ICP definitions, evidence-backed fit scoring and activation handoffs."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_cpq import FactoryCpqQuote
from models.factory_customer_asset import FactoryCustomerAsset
from models.factory_fulfillment import FactoryFulfillmentOrder
from models.factory_icp import (
    FactoryIcpAccountEvidence,
    FactoryIcpActivation,
    FactoryIcpBuyingRole,
    FactoryIcpEvidence,
    FactoryIcpFitAssessment,
    FactoryIcpProfile,
    FactoryIcpScenario,
    FactoryIcpVersion,
)
from models.factory_partner_voice import FactoryVoiceOfCustomerCase
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


WEIGHT_KEYS = {"country", "industry", "company_size", "product", "role", "trigger", "value"}
MARKET_MODES = {"domestic", "overseas", "global"}
CUSTOMER_TYPES = {"b2b", "b2c", "hybrid"}
CONSUMERS = {"lead-routing", "abm", "content-personalization", "sales-playbook"}
FIT_ORDER = {"A": 4, "B": 3, "C": 2, "D": 1}


def _number(prefix: str, project_id: int) -> str:
    now = datetime.now(timezone.utc)
    return f"{prefix}-{project_id}-{now.strftime('%Y%m%d%H%M%S%f')}-{secrets.token_hex(3).upper()}"


def _id(kind: str) -> str:
    return f"{kind}-{secrets.token_urlsafe(18)}"


def _context(context: TenantContext, project_id: int) -> dict[str, object]:
    return {
        "project_id": project_id,
        "agent_path": context.agent_path,
        "tenant_id": context.tenant_id,
        "client_id": context.client_id,
        "plan_id": context.plan_id or f"plan-{project_id}",
    }


def _same_context(item) -> dict[str, object]:
    return {key: getattr(item, key) for key in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id")}


def _definition_hash(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def _serialize(item, fields: tuple[str, ...]) -> dict:
    result = {field: getattr(item, field) for field in fields}
    for key, value in list(result.items()):
        if isinstance(value, Decimal):
            result[key] = str(value)
    return result


PROFILE = ("id", "profile_number", "profile_code", "profile_name", "market_mode", "customer_type", "objective", "current_version", "status", "authored_by", "approved_by", "revision")
VERSION = ("id", "version_reference", "profile_id", "profile_number", "version_number", "countries_json", "industries_json", "company_size_bands_json", "product_references_json", "required_roles_json", "buying_triggers_json", "minimum_potential_value", "currency", "scoring_weights_json", "definition_hash", "status", "created_by", "activated_by")
ROLE = ("id", "role_number", "profile_id", "profile_number", "role_code", "role_name", "influence_type", "pains_json", "proof_requirements_json", "preferred_channels_json", "created_by")
SCENARIO = ("id", "scenario_number", "profile_id", "profile_number", "scenario_code", "scenario_name", "job_to_be_done", "buying_trigger", "product_references_json", "success_outcomes_json", "disqualifiers_json", "created_by")
ACCOUNT_EVIDENCE = ("id", "evidence_number", "profile_id", "profile_number", "account_reference", "source_type", "source_id", "source_number", "source_revision", "source_status", "source_snapshot_json", "firmographic_country", "firmographic_industry", "firmographic_company_size", "firmographic_evidence_reference", "observed_roles_json", "observed_triggers_json", "observed_products_json", "potential_value", "currency", "verification_status", "captured_by", "verified_by", "revision")
ASSESSMENT = ("id", "assessment_number", "profile_id", "profile_number", "profile_version", "definition_hash", "account_evidence_id", "account_evidence_number", "account_reference", "score_components_json", "total_score", "fit_tier", "explanation", "disqualified", "status", "assessed_by", "verified_by", "revision")
ACTIVATION = ("id", "activation_number", "profile_id", "profile_number", "profile_version", "definition_hash", "consumer", "minimum_fit_tier", "delivery_reference", "status", "created_by", "acknowledged_by", "revision")


class FactoryIcpService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict:
        async def rows(model, order):
            return (await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500))).scalars().all()

        profiles = await rows(FactoryIcpProfile, FactoryIcpProfile.created_at)
        versions = await rows(FactoryIcpVersion, FactoryIcpVersion.created_at)
        roles = await rows(FactoryIcpBuyingRole, FactoryIcpBuyingRole.created_at)
        scenarios = await rows(FactoryIcpScenario, FactoryIcpScenario.created_at)
        account_evidence = await rows(FactoryIcpAccountEvidence, FactoryIcpAccountEvidence.captured_at)
        assessments = await rows(FactoryIcpFitAssessment, FactoryIcpFitAssessment.assessed_at)
        activations = await rows(FactoryIcpActivation, FactoryIcpActivation.created_at)
        events = await rows(FactoryIcpEvidence, FactoryIcpEvidence.recorded_at)
        verified = [x for x in account_evidence if x.verification_status == "verified"]
        verified_assessments = [x for x in assessments if x.status == "verified"]
        activated = [x for x in activations if x.status == "acknowledged"]
        assessed_accounts = {x.account_reference for x in verified_assessments}
        high_fit = [x for x in verified_assessments if x.fit_tier in {"A", "B"}]
        active_ids = {x.id for x in profiles if x.status == "active"}
        active_roles = [x for x in roles if x.profile_id in active_ids]
        captured_sources = {(x.profile_id, x.source_type, x.source_id) for x in account_evidence}
        authoritative_sources = []
        for model, source_type, order in (
            (FactoryCpqQuote, "cpq-quote", FactoryCpqQuote.created_at),
            (FactoryFulfillmentOrder, "fulfillment-order", FactoryFulfillmentOrder.created_at),
            (FactoryCustomerAsset, "customer-asset", FactoryCustomerAsset.created_at),
            (FactoryVoiceOfCustomerCase, "voice-of-customer", FactoryVoiceOfCustomerCase.created_at),
        ):
            source_rows = (await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(100))).scalars().all()
            for source in source_rows:
                _, snapshot = await self._source(source_type, str(source.id), project_id)
                authoritative_sources.append({"source_type": source_type, "source_id": str(source.id), "source_number": snapshot["number"],
                    "account_reference": snapshot["account_reference"], "status": snapshot["status"], "revision": source.revision,
                    "currency": snapshot["currency"], "value": snapshot["value"], "products": snapshot["products"],
                    "captured_profile_ids": [profile_id for profile_id, kind, source_id in captured_sources if kind == source_type and source_id == str(source.id)]})
        return {
            "profiles": [_serialize(x, PROFILE) for x in profiles],
            "versions": [_serialize(x, VERSION) for x in versions],
            "buying_roles": [_serialize(x, ROLE) for x in roles],
            "scenarios": [_serialize(x, SCENARIO) for x in scenarios],
            "account_evidence": [_serialize(x, ACCOUNT_EVIDENCE) for x in account_evidence],
            "fit_assessments": [_serialize(x, ASSESSMENT) for x in assessments],
            "activations": [_serialize(x, ACTIVATION) for x in activations],
            "evidence": [{"id": x.id, "subject_type": x.subject_type, "subject_id": x.subject_id, "evidence_type": x.evidence_type, "reference": x.reference, "recorded_by": x.recorded_by} for x in events],
            "authoritative_sources": authoritative_sources,
            "metrics": {
                "active_icps": len(active_ids),
                "assessed_accounts": len(assessed_accounts),
                "high_fit_rate_percent": round(len(high_fit) * 100 / max(1, len(verified_assessments)), 2),
                "verified_evidence_coverage_percent": round(len(verified) * 100 / max(1, len(account_evidence)), 2),
                "buying_role_coverage": len(active_roles),
                "activation_acknowledgement_percent": round(len(activated) * 100 / max(1, len(activations)), 2),
            },
            "contract": {
                "account_system_of_record": False,
                "product_system_of_record": False,
                "raw_personal_contact_data_stored": False,
                "source_revision_pinned": True,
                "manual_firmographics_require_evidence": True,
                "fit_score_explainable": True,
                "ai_autonomous_qualification": False,
                "author_self_approval": False,
                "assessor_self_verification": False,
                "activation_mutates_consumer": False,
                "activation_acknowledgement_required": True,
            },
        }

    async def create_profile(self, *, project_id: int, context: TenantContext, actor: str, profile_code: str,
                             profile_name: str, market_mode: str, customer_type: str, objective: str,
                             countries: list[str], industries: list[str], company_size_bands: list[str],
                             product_references: list[str], required_roles: list[str], buying_triggers: list[str],
                             minimum_potential_value: Decimal, currency: str, scoring_weights: dict[str, int]):
        if market_mode not in MARKET_MODES or customer_type not in CUSTOMER_TYPES:
            raise ValueError("ICP market mode or customer type is invalid")
        required = [profile_code, profile_name, objective, currency]
        if any(not str(value).strip() for value in required):
            raise ValueError("ICP code, name, objective and currency are required")
        if not countries or not industries or not company_size_bands or not product_references or not required_roles or not buying_triggers:
            raise ValueError("ICP definition requires geography, industry, size, product, role and trigger criteria")
        normalized_weights = {str(key): int(value) for key, value in scoring_weights.items()}
        if set(normalized_weights) != WEIGHT_KEYS or sum(normalized_weights.values()) != 100 or any(value < 0 for value in normalized_weights.values()):
            raise ValueError("ICP scoring weights must contain all seven components and total 100")
        now = datetime.now(timezone.utc)
        profile = FactoryIcpProfile(
            id=_id("icp-profile"), **_context(context, project_id), profile_number=_number("ICP", project_id),
            profile_code=profile_code.strip()[:64], profile_name=profile_name.strip()[:180], market_mode=market_mode,
            customer_type=customer_type, objective=objective.strip(), current_version=1, status="draft",
            authored_by=str(actor), updated_by=str(actor), revision=1, created_at=now, updated_at=now,
        )
        definition = {
            "countries": sorted(set(x.strip() for x in countries if x.strip())),
            "industries": sorted(set(x.strip() for x in industries if x.strip())),
            "company_size_bands": sorted(set(x.strip() for x in company_size_bands if x.strip())),
            "product_references": sorted(set(x.strip() for x in product_references if x.strip())),
            "required_roles": sorted(set(x.strip() for x in required_roles if x.strip())),
            "buying_triggers": sorted(set(x.strip() for x in buying_triggers if x.strip())),
            "minimum_potential_value": str(minimum_potential_value), "currency": currency.upper(), "scoring_weights": normalized_weights,
        }
        version = FactoryIcpVersion(
            id=_id("icp-version"), **_context(context, project_id), version_reference=_number("ICPV", project_id),
            profile_id=profile.id, profile_number=profile.profile_number, version_number=1,
            countries_json=definition["countries"], industries_json=definition["industries"],
            company_size_bands_json=definition["company_size_bands"], product_references_json=definition["product_references"],
            required_roles_json=definition["required_roles"], buying_triggers_json=definition["buying_triggers"],
            minimum_potential_value=minimum_potential_value, currency=currency.upper()[:8], scoring_weights_json=normalized_weights,
            definition_hash=_definition_hash(definition), status="draft", created_by=str(actor), created_at=now,
        )
        self.db.add_all([profile, version])
        await self._event(profile, "profile", "profile-authored", f"definition:{version.definition_hash}", "Created immutable ICP version 1", actor)
        await self.db.flush()
        return {"profile": _serialize(profile, PROFILE), "version": _serialize(version, VERSION)}

    async def add_role(self, profile_id: str, *, project_id: int, context: TenantContext, actor: str, role_code: str,
                       role_name: str, influence_type: str, pains: list[str], proof_requirements: list[str], preferred_channels: list[str]):
        profile = await self._get(FactoryIcpProfile, profile_id, project_id, "ICP profile")
        if profile.status != "draft":
            raise ValueError("Buying roles can only be added to draft ICP profiles")
        if influence_type not in {"economic-buyer", "technical-buyer", "champion", "user", "blocker"} or not pains or not proof_requirements:
            raise ValueError("Buying role requires supported influence, pains and proof requirements")
        now = datetime.now(timezone.utc)
        item = FactoryIcpBuyingRole(
            id=_id("icp-role"), **_same_context(profile), role_number=_number("ICPR", project_id), profile_id=profile.id,
            profile_number=profile.profile_number, role_code=role_code.strip()[:64], role_name=role_name.strip()[:128],
            influence_type=influence_type, pains_json=pains, proof_requirements_json=proof_requirements,
            preferred_channels_json=preferred_channels, created_by=str(actor), created_at=now,
        )
        self.db.add(item)
        await self._event(item, "buying-role", "role-defined", f"role:{item.role_code}", "Added governed buying role", actor)
        await self.db.flush()
        return _serialize(item, ROLE)

    async def add_scenario(self, profile_id: str, *, project_id: int, context: TenantContext, actor: str, scenario_code: str,
                           scenario_name: str, job_to_be_done: str, buying_trigger: str, product_references: list[str],
                           success_outcomes: list[str], disqualifiers: list[str]):
        profile = await self._get(FactoryIcpProfile, profile_id, project_id, "ICP profile")
        if profile.status != "draft":
            raise ValueError("Buying scenarios can only be added to draft ICP profiles")
        if len(job_to_be_done.strip()) < 8 or not buying_trigger.strip() or not product_references or not success_outcomes:
            raise ValueError("Buying scenario requires job, trigger, products and outcomes")
        now = datetime.now(timezone.utc)
        item = FactoryIcpScenario(
            id=_id("icp-scenario"), **_same_context(profile), scenario_number=_number("ICPS", project_id), profile_id=profile.id,
            profile_number=profile.profile_number, scenario_code=scenario_code.strip()[:64], scenario_name=scenario_name.strip()[:128],
            job_to_be_done=job_to_be_done.strip(), buying_trigger=buying_trigger.strip()[:255], product_references_json=product_references,
            success_outcomes_json=success_outcomes, disqualifiers_json=disqualifiers, created_by=str(actor), created_at=now,
        )
        self.db.add(item)
        await self._event(item, "scenario", "scenario-defined", f"scenario:{item.scenario_code}", "Added governed buying scenario", actor)
        await self.db.flush()
        return _serialize(item, SCENARIO)

    async def approve_profile(self, profile_id: str, *, project_id: int, actor: str, expected_revision: int, approval_reference: str):
        profile = await self._get(FactoryIcpProfile, profile_id, project_id, "ICP profile")
        self._revision(profile, expected_revision)
        if profile.status != "draft" or profile.authored_by == str(actor):
            raise ValueError("Only an independent approver can activate a draft ICP profile")
        if not approval_reference.strip():
            raise ValueError("ICP activation requires approval evidence")
        roles = (await self.db.execute(select(FactoryIcpBuyingRole).where(FactoryIcpBuyingRole.profile_id == profile.id))).scalars().all()
        scenarios = (await self.db.execute(select(FactoryIcpScenario).where(FactoryIcpScenario.profile_id == profile.id))).scalars().all()
        role_types = {x.influence_type for x in roles}
        if len(roles) < 3 or not {"economic-buyer", "technical-buyer", "champion"}.issubset(role_types) or len(scenarios) < 2:
            raise ValueError("ICP activation requires economic, technical and champion roles plus at least two scenarios")
        version = await self._version(profile)
        now = datetime.now(timezone.utc)
        profile.status = "active"; profile.approved_by = str(actor); profile.approved_at = now
        profile.approval_reference = approval_reference.strip()[:255]; profile.updated_by = str(actor); profile.updated_at = now; profile.revision += 1
        version.status = "active"; version.activated_by = str(actor); version.activated_at = now
        await self._event(profile, "profile", "profile-activated", approval_reference, "Independently activated immutable ICP definition", actor)
        await self.db.flush()
        return _serialize(profile, PROFILE)

    async def capture_account_evidence(self, profile_id: str, *, project_id: int, context: TenantContext, actor: str,
                                       source_type: str, source_id: str, firmographic_country: str | None,
                                       firmographic_industry: str | None, firmographic_company_size: str | None,
                                       firmographic_evidence_reference: str | None, observed_roles: list[str],
                                       observed_triggers: list[str], observed_products: list[str]):
        profile = await self._get(FactoryIcpProfile, profile_id, project_id, "ICP profile")
        if profile.status != "active":
            raise ValueError("Account evidence requires an active ICP profile")
        duplicate = await self.db.scalar(select(FactoryIcpAccountEvidence.id).where(
            FactoryIcpAccountEvidence.profile_id == profile.id,
            FactoryIcpAccountEvidence.source_type == source_type,
            FactoryIcpAccountEvidence.source_id == source_id,
        ))
        if duplicate:
            raise ValueError("Authoritative source evidence already exists for this ICP profile")
        if any((firmographic_country, firmographic_industry, firmographic_company_size)) and not str(firmographic_evidence_reference or "").strip():
            raise ValueError("Manual firmographics require an evidence reference")
        source, snapshot = await self._source(source_type, source_id, project_id)
        now = datetime.now(timezone.utc)
        item = FactoryIcpAccountEvidence(
            id=_id("icp-account-evidence"), **_context(context, project_id), evidence_number=_number("ICPE", project_id),
            profile_id=profile.id, profile_number=profile.profile_number, account_reference=snapshot["account_reference"],
            source_type=source_type, source_id=str(source.id), source_number=snapshot["number"], source_revision=int(source.revision),
            source_status=snapshot["status"], source_snapshot_json=snapshot, firmographic_country=(firmographic_country or "").strip() or None,
            firmographic_industry=(firmographic_industry or "").strip() or None,
            firmographic_company_size=(firmographic_company_size or "").strip() or None,
            firmographic_evidence_reference=(firmographic_evidence_reference or "").strip() or None,
            observed_roles_json=observed_roles, observed_triggers_json=observed_triggers,
            observed_products_json=observed_products or snapshot.get("products", []), potential_value=Decimal(str(snapshot.get("value", 0))),
            currency=snapshot.get("currency", "CNY"), verification_status="pending", captured_by=str(actor), captured_at=now, revision=1,
        )
        self.db.add(item)
        await self._event(item, "account-evidence", "evidence-captured", f"{source_type}:{source.id}@{source.revision}", "Pinned authoritative source without mutating it", actor)
        await self.db.flush()
        return _serialize(item, ACCOUNT_EVIDENCE)

    async def verify_account_evidence(self, evidence_id: str, *, project_id: int, actor: str, expected_revision: int, verification_reference: str):
        item = await self._get(FactoryIcpAccountEvidence, evidence_id, project_id, "ICP account evidence")
        self._revision(item, expected_revision)
        if item.verification_status != "pending" or item.captured_by == str(actor):
            raise ValueError("Account evidence requires independent verification")
        if not verification_reference.strip():
            raise ValueError("Account evidence verification requires evidence")
        source, _ = await self._source(item.source_type, item.source_id, project_id)
        if int(source.revision) != int(item.source_revision):
            raise ValueError("Authoritative source revision changed; recapture evidence")
        now = datetime.now(timezone.utc)
        item.verification_status = "verified"; item.verified_by = str(actor); item.verified_at = now
        item.verification_reference = verification_reference.strip()[:255]; item.revision += 1
        await self._event(item, "account-evidence", "evidence-verified", verification_reference, "Independently verified source and firmographic evidence", actor)
        await self.db.flush()
        return _serialize(item, ACCOUNT_EVIDENCE)

    async def assess_fit(self, profile_id: str, *, project_id: int, context: TenantContext, actor: str, account_evidence_id: str):
        profile = await self._get(FactoryIcpProfile, profile_id, project_id, "ICP profile")
        evidence = await self._get(FactoryIcpAccountEvidence, account_evidence_id, project_id, "ICP account evidence")
        if profile.status != "active" or evidence.profile_id != profile.id or evidence.verification_status != "verified":
            raise ValueError("Fit assessment requires active ICP and verified evidence for the same profile")
        source, _ = await self._source(evidence.source_type, evidence.source_id, project_id)
        if int(source.revision) != int(evidence.source_revision):
            raise ValueError("Authoritative evidence revision changed; assessment is blocked")
        version = await self._version(profile)
        weights = version.scoring_weights_json
        values = {
            "country": bool(evidence.firmographic_country and evidence.firmographic_country in version.countries_json),
            "industry": bool(evidence.firmographic_industry and evidence.firmographic_industry in version.industries_json),
            "company_size": bool(evidence.firmographic_company_size and evidence.firmographic_company_size in version.company_size_bands_json),
            "product": bool(set(evidence.observed_products_json) & set(version.product_references_json)),
            "role": bool(set(evidence.observed_roles_json) & set(version.required_roles_json)),
            "trigger": bool(set(evidence.observed_triggers_json) & set(version.buying_triggers_json)),
            "value": evidence.currency == version.currency and Decimal(evidence.potential_value) >= Decimal(version.minimum_potential_value),
        }
        components = {key: {"matched": values[key], "weight": weights[key], "score": weights[key] if values[key] else 0} for key in sorted(WEIGHT_KEYS)}
        score = sum(value["score"] for value in components.values())
        tier = "A" if score >= 80 else "B" if score >= 65 else "C" if score >= 50 else "D"
        matched = ", ".join(key for key, value in values.items() if value) or "none"
        explanation = f"Pinned ICP v{version.version_number} ({version.definition_hash[:12]}): score {score}/100; matched {matched}."
        now = datetime.now(timezone.utc)
        item = FactoryIcpFitAssessment(
            id=_id("icp-assessment"), **_context(context, project_id), assessment_number=_number("ICPA", project_id),
            profile_id=profile.id, profile_number=profile.profile_number, profile_version=version.version_number,
            definition_hash=version.definition_hash, account_evidence_id=evidence.id, account_evidence_number=evidence.evidence_number,
            account_reference=evidence.account_reference, score_components_json=components, total_score=Decimal(score).quantize(Decimal("0.01")), fit_tier=tier,
            explanation=explanation, disqualified=False, status="pending", assessed_by=str(actor), assessed_at=now, revision=1,
        )
        self.db.add(item)
        await self._event(item, "assessment", "fit-assessed", f"profile:{profile.profile_number}@{version.version_number}", explanation, actor)
        await self.db.flush()
        return _serialize(item, ASSESSMENT)

    async def verify_assessment(self, assessment_id: str, *, project_id: int, actor: str, expected_revision: int, verification_reference: str):
        item = await self._get(FactoryIcpFitAssessment, assessment_id, project_id, "ICP fit assessment")
        self._revision(item, expected_revision)
        if item.status != "pending" or item.assessed_by == str(actor):
            raise ValueError("Fit assessment requires independent verification")
        if not verification_reference.strip():
            raise ValueError("Fit verification requires evidence")
        profile = await self._get(FactoryIcpProfile, item.profile_id, project_id, "ICP profile")
        version = await self._version(profile)
        evidence = await self._get(FactoryIcpAccountEvidence, item.account_evidence_id, project_id, "ICP account evidence")
        source, _ = await self._source(evidence.source_type, evidence.source_id, project_id)
        if version.version_number != item.profile_version or version.definition_hash != item.definition_hash or int(source.revision) != int(evidence.source_revision):
            raise ValueError("ICP definition or authoritative evidence changed; reassessment is required")
        now = datetime.now(timezone.utc)
        item.status = "verified"; item.verified_by = str(actor); item.verified_at = now
        item.verification_reference = verification_reference.strip()[:255]; item.revision += 1
        await self._event(item, "assessment", "fit-verified", verification_reference, "Independently verified explainable fit score", actor)
        await self.db.flush()
        return _serialize(item, ASSESSMENT)

    async def create_activation(self, profile_id: str, *, project_id: int, context: TenantContext, actor: str,
                                consumer: str, minimum_fit_tier: str, delivery_reference: str):
        profile = await self._get(FactoryIcpProfile, profile_id, project_id, "ICP profile")
        if profile.status != "active" or consumer not in CONSUMERS or minimum_fit_tier not in FIT_ORDER or not delivery_reference.strip():
            raise ValueError("ICP activation requires active profile, supported consumer, fit tier and delivery reference")
        version = await self._version(profile)
        now = datetime.now(timezone.utc)
        item = FactoryIcpActivation(
            id=_id("icp-activation"), **_context(context, project_id), activation_number=_number("ICPH", project_id),
            profile_id=profile.id, profile_number=profile.profile_number, profile_version=version.version_number,
            definition_hash=version.definition_hash, consumer=consumer, minimum_fit_tier=minimum_fit_tier,
            delivery_reference=delivery_reference.strip()[:255], status="pending", created_by=str(actor), created_at=now, revision=1,
        )
        self.db.add(item)
        await self._event(item, "activation", "activation-created", delivery_reference, "Published immutable contract payload without mutating consumer", actor)
        await self.db.flush()
        return _serialize(item, ACTIVATION)

    async def acknowledge_activation(self, activation_id: str, *, project_id: int, actor: str, expected_revision: int, acknowledgement_reference: str):
        item = await self._get(FactoryIcpActivation, activation_id, project_id, "ICP activation")
        self._revision(item, expected_revision)
        if item.status != "pending" or item.created_by == str(actor):
            raise ValueError("ICP activation acknowledgement must come from an independent consumer")
        if not acknowledgement_reference.strip():
            raise ValueError("ICP activation acknowledgement requires consumer evidence")
        now = datetime.now(timezone.utc)
        item.status = "acknowledged"; item.acknowledged_by = str(actor); item.acknowledged_at = now
        item.acknowledgement_reference = acknowledgement_reference.strip()[:255]; item.revision += 1
        await self._event(item, "activation", "activation-acknowledged", acknowledgement_reference, "Consumer acknowledged immutable ICP contract", actor)
        await self.db.flush()
        return _serialize(item, ACTIVATION)

    async def retire_profile(self, profile_id: str, *, project_id: int, actor: str, expected_revision: int, retirement_reference: str):
        profile = await self._get(FactoryIcpProfile, profile_id, project_id, "ICP profile")
        self._revision(profile, expected_revision)
        if profile.status != "active" or profile.authored_by == str(actor) or not retirement_reference.strip():
            raise ValueError("Active ICP retirement requires independent authorization evidence")
        now = datetime.now(timezone.utc)
        profile.status = "retired"; profile.retired_by = str(actor); profile.retired_at = now
        profile.retirement_reference = retirement_reference.strip()[:255]; profile.updated_by = str(actor); profile.updated_at = now; profile.revision += 1
        await self._event(profile, "profile", "profile-retired", retirement_reference, "Retired ICP while retaining versions, evidence and assessments", actor)
        await self.db.flush()
        return _serialize(profile, PROFILE)

    async def _source(self, source_type: str, source_id: str, project_id: int):
        if source_type == "cpq-quote":
            source = await self.db.scalar(select(FactoryCpqQuote).where(FactoryCpqQuote.id == source_id, FactoryCpqQuote.project_id == project_id))
            if not source: raise KeyError("CPQ quote not found")
            lines = json.loads(source.lines_json or "[]")
            products = [str(x.get("product_reference") or x.get("sku_reference") or "") for x in lines if isinstance(x, dict)]
            return source, {"number": source.quote_number, "account_reference": source.account_reference, "status": source.status, "currency": source.currency, "value": str(source.subtotal), "products": [x for x in products if x], "revision": source.revision}
        if source_type == "fulfillment-order":
            source = await self.db.scalar(select(FactoryFulfillmentOrder).where(FactoryFulfillmentOrder.id == source_id, FactoryFulfillmentOrder.project_id == project_id))
            if not source: raise KeyError("Fulfillment order not found")
            lines = json.loads(source.lines_json or "[]")
            products = [str(x.get("product_reference") or x.get("sku_reference") or "") for x in lines if isinstance(x, dict)]
            return source, {"number": source.order_number, "account_reference": source.account_reference, "status": source.status, "currency": source.currency, "value": str(source.order_total), "products": [x for x in products if x], "revision": source.revision}
        if source_type == "customer-asset":
            source = await self.db.scalar(select(FactoryCustomerAsset).where(FactoryCustomerAsset.id == source_id, FactoryCustomerAsset.project_id == project_id))
            if not source: raise KeyError("Customer asset not found")
            return source, {"number": source.asset_number, "account_reference": source.account_reference, "status": source.status, "currency": "CNY", "value": "0", "products": [source.product_reference], "revision": source.revision}
        if source_type == "voice-of-customer":
            source = await self.db.scalar(select(FactoryVoiceOfCustomerCase).where(FactoryVoiceOfCustomerCase.id == source_id, FactoryVoiceOfCustomerCase.project_id == project_id))
            if not source: raise KeyError("Voice-of-customer case not found")
            return source, {"number": source.voice_number, "account_reference": source.account_reference, "status": source.lifecycle_status, "currency": "CNY", "value": "0", "products": [], "revision": source.revision}
        raise ValueError("Unsupported authoritative ICP evidence source")

    async def _version(self, profile: FactoryIcpProfile):
        item = await self.db.scalar(select(FactoryIcpVersion).where(FactoryIcpVersion.profile_id == profile.id, FactoryIcpVersion.version_number == profile.current_version))
        if not item:
            raise ValueError("ICP definition version is missing")
        return item

    async def _get(self, model, item_id: str, project_id: int, label: str):
        item = await self.db.scalar(select(model).where(model.id == item_id, model.project_id == project_id))
        if not item:
            raise KeyError(f"{label} not found")
        return item

    @staticmethod
    def _revision(item, expected_revision: int):
        if int(item.revision) != int(expected_revision):
            raise ValueError("Revision conflict")

    async def _event(self, item, subject_type: str, evidence_type: str, reference: str, note: str, actor: str):
        number = next((getattr(item, key, None) for key in ("profile_number", "role_number", "scenario_number", "evidence_number", "assessment_number", "activation_number") if getattr(item, key, None)), str(item.id))
        event = FactoryIcpEvidence(
            id=_id("icp-event"), **_same_context(item), event_number=_number("ICPX", item.project_id), subject_type=subject_type,
            subject_id=str(item.id), subject_number=number, evidence_type=evidence_type, reference=str(reference)[:255],
            note=note, recorded_by=str(actor), recorded_at=datetime.now(timezone.utc),
        )
        self.db.add(event)
