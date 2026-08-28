"""Governed Schema.org mapping, validation and immutable JSON-LD publication."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_knowledge_graph import FactoryKnowledgeEntity, FactoryKnowledgeGraph, FactoryKnowledgeGraphVersion
from models.factory_structured_data import (
    FactoryStructuredDataBundle,
    FactoryStructuredDataEvidence,
    FactoryStructuredDataMapping,
    FactoryStructuredDataPublication,
    FactoryStructuredDataRelease,
    FactoryStructuredDataValidation,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


SCHEMA_SOURCES = {"Organization": "organization", "Product": "product", "FAQPage": "capability", "Review": "case", "Article": "market"}
CONSUMERS = {"website", "search", "commerce", "geo"}
BUNDLE = ("id", "bundle_number", "bundle_code", "bundle_name", "target_site_reference", "default_locale", "graph_id", "graph_number", "graph_version_id", "graph_version_number", "graph_manifest_hash", "status", "authored_by", "published_by", "revision")
MAPPING = ("id", "mapping_number", "bundle_id", "bundle_number", "schema_type", "source_entity_type", "source_entity_id", "source_entity_number", "source_entity_revision", "source_entity_fingerprint", "field_map_json", "required_fields_json", "status", "created_by", "verified_by", "revision")
VALIDATION = ("id", "validation_number", "bundle_id", "bundle_number", "graph_manifest_hash", "mapping_count", "error_count", "warning_count", "report_json", "generated_document_json", "generated_hash", "status", "executed_by")
RELEASE = ("id", "release_number", "bundle_id", "bundle_number", "validation_id", "validation_number", "version_number", "document_json", "document_hash", "schema_types_json", "status", "published_by")
PUBLICATION = ("id", "publication_number", "bundle_id", "release_id", "release_number", "document_hash", "consumer", "deployment_reference", "consumer_mutated", "status", "created_by", "acknowledged_by", "revision")


def _id(kind: str) -> str:
    return f"{kind}-{secrets.token_urlsafe(18)}"


def _number(prefix: str, project_id: int) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    return f"{prefix}-{project_id}-{stamp}-{secrets.token_hex(3).upper()}"


def _context(context: TenantContext, project_id: int) -> dict:
    return {"project_id": project_id, "agent_path": context.agent_path, "tenant_id": context.tenant_id, "client_id": context.client_id, "plan_id": context.plan_id or f"plan-{project_id}"}


def _same(item) -> dict:
    return {key: getattr(item, key) for key in ("project_id", "agent_path", "tenant_id", "client_id", "plan_id")}


def _hash(payload) -> str:
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def _serialize(item, fields: tuple[str, ...]) -> dict:
    return {field: getattr(item, field) for field in fields}


class FactoryStructuredDataService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_workspace(self, *, project_id: int) -> dict:
        async def rows(model, order):
            result = await self.db.execute(select(model).where(model.project_id == project_id).order_by(order.desc()).limit(500))
            return result.scalars().all()

        bundles = await rows(FactoryStructuredDataBundle, FactoryStructuredDataBundle.created_at)
        mappings = await rows(FactoryStructuredDataMapping, FactoryStructuredDataMapping.created_at)
        validations = await rows(FactoryStructuredDataValidation, FactoryStructuredDataValidation.executed_at)
        releases = await rows(FactoryStructuredDataRelease, FactoryStructuredDataRelease.published_at)
        publications = await rows(FactoryStructuredDataPublication, FactoryStructuredDataPublication.created_at)
        evidence = await rows(FactoryStructuredDataEvidence, FactoryStructuredDataEvidence.recorded_at)
        verified = [item for item in mappings if item.status == "verified"]
        passed = [item for item in validations if item.status == "passed"]
        acknowledged = [item for item in publications if item.status == "acknowledged"]
        graph_versions = await self._graph_versions(project_id)
        graph_entities = (await self.db.execute(select(FactoryKnowledgeEntity).where(FactoryKnowledgeEntity.project_id == project_id, FactoryKnowledgeEntity.status == "verified").order_by(FactoryKnowledgeEntity.created_at.desc()))).scalars().all()
        return {
            "bundles": [_serialize(item, BUNDLE) for item in bundles],
            "mappings": [_serialize(item, MAPPING) for item in mappings],
            "validations": [_serialize(item, VALIDATION) for item in validations],
            "releases": [_serialize(item, RELEASE) for item in releases],
            "publications": [_serialize(item, PUBLICATION) for item in publications],
            "evidence": [{"id": item.id, "subject_type": item.subject_type, "subject_id": item.subject_id, "evidence_type": item.evidence_type, "evidence_reference": item.evidence_reference, "recorded_by": item.recorded_by} for item in evidence],
            "graph_versions": graph_versions,
            "graph_entities": [{"id": item.id, "entity_number": item.entity_number, "graph_id": item.graph_id, "entity_type": item.entity_type, "canonical_name": item.canonical_name, "source_fingerprint": item.source_fingerprint} for item in graph_entities],
            "metrics": {
                "verified_mappings": len(verified),
                "schema_coverage_percent": round(len({item.schema_type for item in verified} & set(SCHEMA_SOURCES)) * 100 / len(SCHEMA_SOURCES), 2),
                "passed_validations": len(passed),
                "validation_pass_percent": round(len(passed) * 100 / max(1, len(validations)), 2),
                "published_releases": len(releases),
                "publication_acknowledgement_percent": round(len(acknowledged) * 100 / max(1, len(publications)), 2),
            },
            "contract": {
                "knowledge_graph_master_copied": False,
                "graph_version_pinned": True,
                "entity_source_fingerprint_pinned": True,
                "mapping_self_verification": False,
                "invalid_document_publishable": False,
                "bundle_author_self_publish": False,
                "published_release_mutable": False,
                "consumer_system_mutated": False,
                "publication_acknowledgement_required": True,
            },
        }

    async def create_bundle(self, *, project_id: int, context: TenantContext, actor: str, bundle_code: str, bundle_name: str, target_site_reference: str, default_locale: str, graph_version_id: str) -> dict:
        version = await self._get(FactoryKnowledgeGraphVersion, graph_version_id, project_id, "Knowledge graph version")
        graph = await self._get(FactoryKnowledgeGraph, version.graph_id, project_id, "Knowledge graph")
        if version.status != "published" or graph.status != "published" or version.manifest_hash != graph_versions_hash(graph, version):
            raise ValueError("Structured-data bundle requires an exact published graph version")
        now = datetime.now(timezone.utc)
        item = FactoryStructuredDataBundle(id=_id("structured-bundle"), **_context(context, project_id), bundle_number=_number("SDB", project_id), bundle_code=bundle_code.strip()[:64], bundle_name=bundle_name.strip()[:180], target_site_reference=target_site_reference.strip()[:180], default_locale=default_locale.strip()[:16], graph_id=graph.id, graph_number=graph.graph_number, graph_version_id=version.id, graph_version_number=version.version_number, graph_manifest_hash=version.manifest_hash, status="draft", authored_by=str(actor), revision=1, created_at=now, updated_at=now)
        self.db.add(item)
        await self._event(item, "bundle", "bundle-created", f"graph:{version.version_reference}", "Pinned published knowledge-graph version without copying master data", actor)
        await self.db.flush()
        return _serialize(item, BUNDLE)

    async def add_mapping(self, bundle_id: str, *, project_id: int, context: TenantContext, actor: str, schema_type: str, source_entity_id: str, field_map: dict, required_fields: list[str]) -> dict:
        bundle = await self._get(FactoryStructuredDataBundle, bundle_id, project_id, "Structured-data bundle")
        entity = await self._get(FactoryKnowledgeEntity, source_entity_id, project_id, "Knowledge entity")
        if bundle.status != "draft" or schema_type not in SCHEMA_SOURCES or entity.graph_id != bundle.graph_id or entity.entity_type != SCHEMA_SOURCES[schema_type] or entity.status != "verified":
            raise ValueError("Mapping requires a verified entity of the schema's authoritative type in the pinned graph")
        if not field_map or not required_fields or not set(required_fields).issubset(field_map):
            raise ValueError("Mapping must map every required Schema.org field")
        item = FactoryStructuredDataMapping(id=_id("structured-mapping"), **_context(context, project_id), mapping_number=_number("SDM", project_id), bundle_id=bundle.id, bundle_number=bundle.bundle_number, schema_type=schema_type, source_entity_type=entity.entity_type, source_entity_id=entity.id, source_entity_number=entity.entity_number, source_entity_revision=entity.revision, source_entity_fingerprint=entity.source_fingerprint, field_map_json=field_map, required_fields_json=sorted(set(required_fields)), status="pending", created_by=str(actor), revision=1, created_at=datetime.now(timezone.utc))
        self.db.add(item)
        await self._event(item, "mapping", "mapping-created", entity.entity_number, "Created source-pinned Schema.org mapping", actor)
        await self.db.flush()
        return _serialize(item, MAPPING)

    async def verify_mapping(self, mapping_id: str, *, project_id: int, actor: str, expected_revision: int, reference: str) -> dict:
        item = await self._get(FactoryStructuredDataMapping, mapping_id, project_id, "Structured-data mapping")
        self._revision(item, expected_revision)
        if item.status != "pending" or item.created_by == str(actor) or not reference.strip():
            raise ValueError("Schema mapping requires independent verification evidence")
        await self._validate_mapping(item)
        item.status = "verified"
        item.verified_by = str(actor)
        item.verified_at = datetime.now(timezone.utc)
        item.verification_reference = reference.strip()[:255]
        item.revision += 1
        await self._event(item, "mapping", "mapping-verified", reference, "Independently verified Schema.org mapping and source pin", actor)
        await self.db.flush()
        return _serialize(item, MAPPING)

    async def run_validation(self, bundle_id: str, *, project_id: int, context: TenantContext, actor: str, expected_revision: int, validation_reference: str) -> dict:
        bundle = await self._get(FactoryStructuredDataBundle, bundle_id, project_id, "Structured-data bundle")
        self._revision(bundle, expected_revision)
        if bundle.status != "draft" or bundle.authored_by == str(actor) or not validation_reference.strip():
            raise ValueError("Structured-data validation requires an independent operator and evidence")
        await self._validate_bundle_graph(bundle)
        mappings = (await self.db.execute(select(FactoryStructuredDataMapping).where(FactoryStructuredDataMapping.bundle_id == bundle.id, FactoryStructuredDataMapping.status == "verified"))).scalars().all()
        if {item.schema_type for item in mappings} != set(SCHEMA_SOURCES):
            raise ValueError("Validation requires all five verified schema types")
        nodes = []
        report = {"validation_reference": validation_reference, "checks": []}
        errors: list[str] = []
        for mapping in sorted(mappings, key=lambda item: item.schema_type):
            entity = await self._validate_mapping(mapping)
            node = {"@type": mapping.schema_type}
            for target, source in mapping.field_map_json.items():
                value = self._read_entity(entity, str(source))
                if target in mapping.required_fields_json and (value is None or value == ""):
                    errors.append(f"{mapping.schema_type}.{target}")
                node[target] = value
            nodes.append(node)
            report["checks"].append({"schema_type": mapping.schema_type, "mapping_number": mapping.mapping_number, "source_entity_number": entity.entity_number, "required_fields": mapping.required_fields_json})
        document = {"@context": "https://schema.org", "@graph": nodes, "inLanguage": bundle.default_locale}
        status = "passed" if not errors else "failed"
        now = datetime.now(timezone.utc)
        item = FactoryStructuredDataValidation(id=_id("structured-validation"), **_context(context, project_id), validation_number=_number("SDV", project_id), bundle_id=bundle.id, bundle_number=bundle.bundle_number, graph_manifest_hash=bundle.graph_manifest_hash, mapping_count=len(mappings), error_count=len(errors), warning_count=0, report_json={**report, "errors": errors}, generated_document_json=document, generated_hash=_hash(document), status=status, executed_by=str(actor), executed_at=now)
        self.db.add(item)
        await self._event(item, "validation", f"validation-{status}", validation_reference, "Validated generated JSON-LD against five governed schema mappings", actor)
        await self.db.flush()
        return _serialize(item, VALIDATION)

    async def publish_bundle(self, bundle_id: str, *, project_id: int, context: TenantContext, actor: str, expected_revision: int, validation_id: str, consumer: str, deployment_reference: str) -> dict:
        bundle = await self._get(FactoryStructuredDataBundle, bundle_id, project_id, "Structured-data bundle")
        validation = await self._get(FactoryStructuredDataValidation, validation_id, project_id, "Structured-data validation")
        self._revision(bundle, expected_revision)
        if bundle.status != "draft" or bundle.authored_by == str(actor) or consumer not in CONSUMERS or not deployment_reference.strip():
            raise ValueError("Structured-data release requires an independent publisher, supported consumer and deployment evidence")
        if validation.bundle_id != bundle.id or validation.status != "passed" or validation.error_count != 0 or validation.graph_manifest_hash != bundle.graph_manifest_hash or validation.generated_hash != _hash(validation.generated_document_json):
            raise ValueError("Only an unchanged passing validation can be published")
        await self._validate_bundle_graph(bundle)
        current = await self.db.scalar(select(FactoryStructuredDataRelease.version_number).where(FactoryStructuredDataRelease.bundle_id == bundle.id).order_by(FactoryStructuredDataRelease.version_number.desc()).limit(1)) or 0
        now = datetime.now(timezone.utc)
        release = FactoryStructuredDataRelease(id=_id("structured-release"), **_context(context, project_id), release_number=_number("SDR", project_id), bundle_id=bundle.id, bundle_number=bundle.bundle_number, validation_id=validation.id, validation_number=validation.validation_number, version_number=int(current) + 1, document_json=validation.generated_document_json, document_hash=validation.generated_hash, schema_types_json=sorted(SCHEMA_SOURCES), status="published", published_by=str(actor), published_at=now)
        publication = FactoryStructuredDataPublication(id=_id("structured-publication"), **_context(context, project_id), publication_number=_number("SDP", project_id), bundle_id=bundle.id, release_id=release.id, release_number=release.release_number, document_hash=release.document_hash, consumer=consumer, deployment_reference=deployment_reference.strip()[:255], consumer_mutated=False, status="pending", created_by=str(actor), created_at=now, revision=1)
        bundle.status = "published"
        bundle.published_by = str(actor)
        bundle.published_at = now
        bundle.revision += 1
        bundle.updated_at = now
        self.db.add_all([release, publication])
        await self._event(bundle, "bundle", "bundle-published", deployment_reference, "Published immutable JSON-LD release without mutating the consumer", actor)
        await self._event(publication, "publication", "publication-created", deployment_reference, "Created explicit consumer acknowledgement", actor)
        await self.db.flush()
        return {"bundle": _serialize(bundle, BUNDLE), "release": _serialize(release, RELEASE), "publication": _serialize(publication, PUBLICATION)}

    async def acknowledge_publication(self, publication_id: str, *, project_id: int, actor: str, expected_revision: int, reference: str) -> dict:
        item = await self._get(FactoryStructuredDataPublication, publication_id, project_id, "Structured-data publication")
        self._revision(item, expected_revision)
        if item.status != "pending" or item.created_by == str(actor) or not reference.strip():
            raise ValueError("Structured-data publication acknowledgement must be independent and evidenced")
        release = await self._get(FactoryStructuredDataRelease, item.release_id, project_id, "Structured-data release")
        if release.status != "published" or release.document_hash != item.document_hash or _hash(release.document_json) != item.document_hash:
            raise ValueError("Published JSON-LD release changed")
        item.status = "acknowledged"
        item.acknowledged_by = str(actor)
        item.acknowledged_at = datetime.now(timezone.utc)
        item.acknowledgement_reference = reference.strip()[:255]
        item.revision += 1
        await self._event(item, "publication", "publication-acknowledged", reference, "Consumer acknowledged the exact immutable JSON-LD hash", actor)
        await self.db.flush()
        return _serialize(item, PUBLICATION)

    async def _graph_versions(self, project_id: int) -> list[dict]:
        rows = (await self.db.execute(select(FactoryKnowledgeGraphVersion).where(FactoryKnowledgeGraphVersion.project_id == project_id, FactoryKnowledgeGraphVersion.status == "published").order_by(FactoryKnowledgeGraphVersion.published_at.desc()))).scalars().all()
        return [{"id": item.id, "version_reference": item.version_reference, "graph_id": item.graph_id, "graph_number": item.graph_number, "version_number": item.version_number, "manifest_hash": item.manifest_hash, "entity_type_coverage": item.entity_type_coverage_json} for item in rows]

    async def _validate_bundle_graph(self, bundle: FactoryStructuredDataBundle) -> FactoryKnowledgeGraphVersion:
        version = await self._get(FactoryKnowledgeGraphVersion, bundle.graph_version_id, bundle.project_id, "Knowledge graph version")
        if version.status != "published" or version.graph_id != bundle.graph_id or version.version_number != bundle.graph_version_number or version.manifest_hash != bundle.graph_manifest_hash:
            raise ValueError("Pinned knowledge-graph version changed")
        return version

    async def _validate_mapping(self, item: FactoryStructuredDataMapping) -> FactoryKnowledgeEntity:
        entity = await self._get(FactoryKnowledgeEntity, item.source_entity_id, item.project_id, "Knowledge entity")
        if entity.status != "verified" or entity.graph_id != (await self._get(FactoryStructuredDataBundle, item.bundle_id, item.project_id, "Structured-data bundle")).graph_id or entity.entity_type != item.source_entity_type or entity.revision != item.source_entity_revision or entity.source_fingerprint != item.source_entity_fingerprint:
            raise ValueError("Pinned knowledge entity changed; remapping is required")
        return entity

    @staticmethod
    def _read_entity(entity: FactoryKnowledgeEntity, source: str):
        if source == "canonical_name":
            return entity.canonical_name
        if source == "entity_number":
            return entity.entity_number
        if source == "evidence_reference":
            return entity.evidence_reference
        if source.startswith("properties."):
            return entity.properties_json.get(source.split(".", 1)[1])
        return None

    async def _get(self, model, item_id: str, project_id: int, label: str):
        item = await self.db.scalar(select(model).where(model.id == item_id, model.project_id == project_id))
        if not item:
            raise KeyError(f"{label} not found")
        return item

    @staticmethod
    def _revision(item, expected: int) -> None:
        if int(item.revision) != int(expected):
            raise ValueError("Revision conflict")

    async def _event(self, item, subject_type: str, evidence_type: str, reference: str, note: str, actor: str) -> None:
        number = next((getattr(item, key, None) for key in ("bundle_number", "mapping_number", "validation_number", "release_number", "publication_number") if getattr(item, key, None)), str(item.id))
        self.db.add(FactoryStructuredDataEvidence(id=_id("structured-evidence"), **_same(item), evidence_number=_number("SDX", item.project_id), subject_type=subject_type, subject_id=item.id, subject_number=number, evidence_type=evidence_type, evidence_reference=str(reference)[:255], note=note, recorded_by=str(actor), recorded_at=datetime.now(timezone.utc)))


def graph_versions_hash(graph: FactoryKnowledgeGraph, version: FactoryKnowledgeGraphVersion) -> str:
    """Keep the bundle boundary explicit while tolerating historical published graphs."""
    return version.manifest_hash if graph.id == version.graph_id and graph.current_version >= version.version_number else ""
