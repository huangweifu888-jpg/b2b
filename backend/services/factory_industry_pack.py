"""Governed configuration and release rules for tenant industry packs."""

from __future__ import annotations

from collections.abc import Mapping
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_implementation import FactoryImplementationProgram
from models.factory_industry_pack import FactoryIndustryPackInstallation
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


MACHINERY_SEGMENTS = {"industrial-pump-valve"}
REQUIRED_CONFIGURATION = {"object-mapping", "product-parameters", "selection-rules", "rfq-template", "serial-asset", "spare-parts-service"}
REQUIRED_EVIDENCE = {"industry-object-map", "quote-sample", "installed-service-chain"}
REQUIRED_CORE_OBJECTS = {"product", "sku", "inquiry", "quote", "order", "customer-asset", "service-ticket"}


def _json_dict(value: str | None) -> dict[str, str]:
    try:
        parsed = json.loads(value or "{}")
    except (TypeError, ValueError):
        return {}
    return {str(key): str(item) for key, item in parsed.items() if str(item).strip()} if isinstance(parsed, dict) else {}


def _clean_mapping(values: Mapping[str, str], allowed: set[str]) -> dict[str, str]:
    unknown = set(values) - allowed
    if unknown:
        raise ValueError(f"Unsupported industry-pack field: {sorted(unknown)[0]}")
    return {str(key): str(value).strip()[:8000] for key, value in values.items() if str(value).strip()}


def serialize_installation(item: FactoryIndustryPackInstallation) -> dict[str, object]:
    return {
        "id": item.id, "project_id": item.project_id, "tenant_id": item.tenant_id, "client_id": item.client_id,
        "plan_id": item.plan_id, "pack_id": item.pack_id, "segment": item.segment, "package_version": item.package_version,
        "configuration": _json_dict(item.configuration_json), "evidence": _json_dict(item.evidence_json),
        "required_configuration": sorted(REQUIRED_CONFIGURATION), "required_evidence": sorted(REQUIRED_EVIDENCE),
        "status": item.status, "revision": item.revision, "updated_by": item.updated_by,
        "created_at": item.created_at, "updated_at": item.updated_at,
    }


class FactoryIndustryPackService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, *, project_id: int) -> list[dict[str, object]]:
        items = (await self.db.execute(select(FactoryIndustryPackInstallation).where(FactoryIndustryPackInstallation.project_id == project_id).order_by(FactoryIndustryPackInstallation.created_at.desc()))).scalars().all()
        return [serialize_installation(item) for item in items]

    async def create(self, *, project_id: int, context: TenantContext, actor: str, segment: str) -> dict[str, object]:
        if segment not in MACHINERY_SEGMENTS:
            raise ValueError("The first machinery pack supports only industrial-pump-valve")
        active = await self.db.scalar(select(FactoryIndustryPackInstallation.id).where(FactoryIndustryPackInstallation.project_id == project_id, FactoryIndustryPackInstallation.pack_id == "machinery", FactoryIndustryPackInstallation.status != "published"))
        if active:
            raise ValueError("This tenant plan already has an unpublished machinery pack")
        version = len((await self.db.execute(select(FactoryIndustryPackInstallation.id).where(FactoryIndustryPackInstallation.project_id == project_id, FactoryIndustryPackInstallation.pack_id == "machinery"))).scalars().all()) + 1
        item = FactoryIndustryPackInstallation(
            id=f"industry-pack-{secrets.token_urlsafe(18)}", project_id=project_id, agent_path=context.agent_path,
            tenant_id=context.tenant_id, client_id=context.client_id, plan_id=context.plan_id or f"plan-{project_id}",
            pack_id="machinery", segment=segment, package_version=version, updated_by=actor,
        )
        self.db.add(item); await self.db.flush(); return serialize_installation(item)

    async def update(self, installation_id: str, *, project_id: int, expected_revision: int, actor: str, configuration: Mapping[str, str], evidence: Mapping[str, str]) -> dict[str, object]:
        item = await self._get(installation_id, project_id=project_id)
        if item.revision != expected_revision:
            raise ValueError("Industry pack changed; refresh before saving")
        if item.status == "published":
            raise ValueError("Published industry packs are read-only; create a new version")
        item.configuration_json = json.dumps(_clean_mapping(configuration, REQUIRED_CONFIGURATION), ensure_ascii=False, separators=(",", ":"))
        item.evidence_json = json.dumps(_clean_mapping(evidence, REQUIRED_EVIDENCE), ensure_ascii=False, separators=(",", ":"))
        item.status = "draft"; item.revision += 1; item.updated_by = actor
        await self.db.flush(); return serialize_installation(item)

    async def validate(self, installation_id: str, *, project_id: int, expected_revision: int, actor: str) -> dict[str, object]:
        item = await self._get(installation_id, project_id=project_id)
        if item.revision != expected_revision:
            raise ValueError("Industry pack changed; refresh before validation")
        if item.status == "published":
            raise ValueError("Published industry pack is already immutable")
        configuration = _json_dict(item.configuration_json); evidence = _json_dict(item.evidence_json)
        missing_configuration = sorted(REQUIRED_CONFIGURATION - set(configuration))
        missing_evidence = sorted(REQUIRED_EVIDENCE - set(evidence))
        if missing_configuration or missing_evidence:
            missing = missing_configuration + missing_evidence
            raise ValueError(f"Industry pack evidence is incomplete; missing {', '.join(missing)}")
        mapping_tokens = {token.strip() for token in configuration["object-mapping"].replace("，", ",").split(",") if token.strip()}
        if not REQUIRED_CORE_OBJECTS.issubset(mapping_tokens):
            raise ValueError("Industry object mapping must retain the governed core object IDs")
        completed_implementation = await self.db.scalar(select(FactoryImplementationProgram.id).where(FactoryImplementationProgram.project_id == project_id, FactoryImplementationProgram.status == "completed"))
        if not completed_implementation:
            raise ValueError("Complete a tenant implementation program before validating an industry pack")
        item.status = "validated"; item.revision += 1; item.updated_by = actor
        await self.db.flush(); return serialize_installation(item)

    async def publish(self, installation_id: str, *, project_id: int, expected_revision: int, actor: str) -> dict[str, object]:
        item = await self._get(installation_id, project_id=project_id)
        if item.revision != expected_revision:
            raise ValueError("Industry pack changed; refresh before publishing")
        if item.status != "validated":
            raise ValueError("Only a validated industry pack may be published")
        item.status = "published"; item.revision += 1; item.updated_by = actor
        await self.db.flush(); return serialize_installation(item)

    async def _get(self, installation_id: str, *, project_id: int) -> FactoryIndustryPackInstallation:
        item = await self.db.scalar(select(FactoryIndustryPackInstallation).where(FactoryIndustryPackInstallation.id == installation_id, FactoryIndustryPackInstallation.project_id == project_id))
        if not item:
            raise KeyError("Industry pack installation not found in this tenant plan")
        return item
