import asyncio

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from services.factory_knowledge_graph import FactoryKnowledgeGraphService
from services.factory_structured_data import FactoryStructuredDataService, SCHEMA_SOURCES
from tests.test_factory_knowledge_graph import complete_entities, context, sources


async def published_graph(db, project_id=64):
    ctx = context(project_id)
    masters = await sources(db, ctx, project_id)
    graph_service = FactoryKnowledgeGraphService(db)
    graph, entities = await complete_entities(graph_service, ctx, masters, project_id)
    for index, (left, predicate, right) in enumerate(((0, "offers", 1), (1, "has-capability", 2), (1, "certified-by", 3), (1, "proven-by", 4), (5, "demands", 1))):
        relation = await graph_service.add_relation(graph["id"], project_id=project_id, context=ctx, actor="architect", subject_entity_id=entities[left]["id"], predicate=predicate, object_entity_id=entities[right]["id"], evidence_reference=f"REL-{index}")
        await graph_service.verify_relation(relation["id"], project_id=project_id, actor="relation-reviewer", expected_revision=1, reference=f"VERIFY-REL-{index}")
    published = await graph_service.publish_graph(graph["id"], project_id=project_id, context=ctx, actor="graph-publisher", expected_revision=1, consumer="schema", delivery_reference="SCHEMA-HANDOFF")
    return ctx, entities, published


def mapping_spec(schema_type):
    target = {"Organization": "name", "Product": "name", "FAQPage": "mainEntity", "Review": "itemReviewed", "Article": "headline"}[schema_type]
    return {"field_map": {target: "canonical_name", "identifier": "entity_number"}, "required_fields": [target]}


def test_structured_data_publishes_five_verified_schema_types_and_acknowledges():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            ctx, entities, graph = await published_graph(db)
            service = FactoryStructuredDataService(db)
            bundle = await service.create_bundle(project_id=64, context=ctx, actor="schema-author", bundle_code="GLOBAL-SCHEMA", bundle_name="Global schema bundle", target_site_reference="SITE-GLOBAL", default_locale="en-US", graph_version_id=graph["version"]["id"])
            by_type = {item["entity_type"]: item for item in entities}
            for schema_type, entity_type in SCHEMA_SOURCES.items():
                mapping = await service.add_mapping(bundle["id"], project_id=64, context=ctx, actor="schema-author", schema_type=schema_type, source_entity_id=by_type[entity_type]["id"], **mapping_spec(schema_type))
                await service.verify_mapping(mapping["id"], project_id=64, actor="schema-reviewer", expected_revision=1, reference=f"VERIFY-{schema_type}")
            validation = await service.run_validation(bundle["id"], project_id=64, context=ctx, actor="validator", expected_revision=1, validation_reference="SCHEMA-VALIDATOR-RESULT")
            with pytest.raises(ValueError, match="independent publisher"):
                await service.publish_bundle(bundle["id"], project_id=64, context=ctx, actor="schema-author", expected_revision=1, validation_id=validation["id"], consumer="website", deployment_reference="SELF")
            published = await service.publish_bundle(bundle["id"], project_id=64, context=ctx, actor="publisher", expected_revision=1, validation_id=validation["id"], consumer="website", deployment_reference="SITE-DEPLOY-V1")
            publication = await service.acknowledge_publication(published["publication"]["id"], project_id=64, actor="site-owner", expected_revision=1, reference="SITE-ACK")
            workspace = await service.list_workspace(project_id=64)
            assert workspace["metrics"] == {"verified_mappings": 5, "schema_coverage_percent": 100.0, "passed_validations": 1, "validation_pass_percent": 100.0, "published_releases": 1, "publication_acknowledgement_percent": 100.0}
            assert publication["status"] == "acknowledged"
            assert published["publication"]["consumer_mutated"] is False
            assert set(published["release"]["schema_types_json"]) == set(SCHEMA_SOURCES)
            assert (await service.list_workspace(project_id=65))["bundles"] == []
        await engine.dispose()

    asyncio.run(scenario())


def test_structured_data_blocks_self_verification_incomplete_validation_and_source_drift():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            ctx, entities, graph = await published_graph(db, 65)
            service = FactoryStructuredDataService(db)
            bundle = await service.create_bundle(project_id=65, context=ctx, actor="author", bundle_code="DRIFT", bundle_name="Drift bundle", target_site_reference="SITE", default_locale="en-US", graph_version_id=graph["version"]["id"])
            organization = next(item for item in entities if item["entity_type"] == "organization")
            mapping = await service.add_mapping(bundle["id"], project_id=65, context=ctx, actor="author", schema_type="Organization", source_entity_id=organization["id"], **mapping_spec("Organization"))
            with pytest.raises(ValueError, match="independent"):
                await service.verify_mapping(mapping["id"], project_id=65, actor="author", expected_revision=1, reference="SELF")
            await service.verify_mapping(mapping["id"], project_id=65, actor="reviewer", expected_revision=1, reference="VERIFIED")
            with pytest.raises(ValueError, match="five verified"):
                await service.run_validation(bundle["id"], project_id=65, context=ctx, actor="validator", expected_revision=1, validation_reference="INCOMPLETE")
            entity = await service._get(__import__("models.factory_knowledge_graph", fromlist=["FactoryKnowledgeEntity"]).FactoryKnowledgeEntity, organization["id"], 65, "Knowledge entity")
            entity.revision += 1
            await db.flush()
            stored_mapping = await service._get(__import__("models.factory_structured_data", fromlist=["FactoryStructuredDataMapping"]).FactoryStructuredDataMapping, mapping["id"], 65, "Mapping")
            with pytest.raises(ValueError, match="changed"):
                await service._validate_mapping(stored_mapping)
        await engine.dispose()

    asyncio.run(scenario())
