import pytest
from types import SimpleNamespace

import asyncio
import json

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from models.template_snapshot import TemplateSnapshotTemplate, TemplateSnapshotVersion
from services.template_snapshot import TemplateSnapshotService, _compose_synced_snapshot, _strip_protected_template_fields


def test_sync_applies_template_updates_without_overwriting_downstream_changes():
    previous_template = {
        "layout": {"title": "old", "body": "white"},
        "modules": {"catalog": {"enabled": True}},
    }
    latest_template = {
        "layout": {"title": "new", "body": "cream"},
        "modules": {"catalog": {"enabled": False}, "news": {"enabled": True}},
    }
    current_snapshot = {
        "layout": {"title": "old", "body": "white"},
        "modules": {
            "catalog": {"enabled": True, "label": "客户自定义名称"},
            "local-tool": {"enabled": True},
        },
    }
    explicit_overrides = {"layout": {"body": "客户自定义底色"}}

    snapshot, overrides = _compose_synced_snapshot(
        latest_template,
        current_snapshot,
        explicit_overrides,
        previous_template,
    )

    assert snapshot["layout"]["title"] == "new"
    assert snapshot["layout"]["body"] == "客户自定义底色"
    assert snapshot["modules"]["catalog"]["enabled"] is False
    assert snapshot["modules"]["catalog"]["label"] == "客户自定义名称"
    assert snapshot["modules"]["local-tool"] == {"enabled": True}
    assert snapshot["modules"]["news"] == {"enabled": True}
    assert overrides["layout"]["body"] == "客户自定义底色"
    assert overrides["modules"]["local-tool"] == {"enabled": True}


def test_sync_without_a_previous_template_version_uses_the_safe_preservation_path():
    latest_template = {"layout": {"title": "new"}, "news": {"enabled": True}}
    current_snapshot = {"layout": {"title": "downstream"}, "custom": {"enabled": True}}

    snapshot, overrides = _compose_synced_snapshot(latest_template, current_snapshot, {}, None)

    assert snapshot["layout"]["title"] == "downstream"
    assert snapshot["custom"] == {"enabled": True}
    assert snapshot["news"] == {"enabled": True}
    assert overrides == current_snapshot


def test_legacy_overwrite_mode_still_uses_the_non_destructive_merge_contract():
    previous_template = {"title": "old", "modules": {"catalog": {"enabled": True}}}
    latest_template = {"title": "new", "modules": {"catalog": {"enabled": False}, "news": {"enabled": True}}}
    downstream_snapshot = {"title": "old", "modules": {"catalog": {"enabled": True, "label": "本地名称"}, "local": {"enabled": True}}}

    snapshot, overrides = _compose_synced_snapshot(latest_template, downstream_snapshot, {}, previous_template)

    assert snapshot["title"] == "new"
    assert snapshot["modules"]["catalog"]["label"] == "本地名称"
    assert snapshot["modules"]["local"] == {"enabled": True}
    assert overrides["modules"]["local"] == {"enabled": True}


@pytest.mark.parametrize("owner_scope", ["client", "agency", "client_plan", "runtime"])
def test_downstream_scope_cannot_write_a_template_source(owner_scope: str):
    with pytest.raises(ValueError, match="Template writes are only allowed"):
        TemplateSnapshotService._assert_template_payload_allowed({"owner_scope": owner_scope})


def test_template_export_strips_tenant_identity_and_commercial_records():
    snapshot = _strip_protected_template_fields({
        "products": [{"path": "/news"}],
        "companyShortName": "private identity",
        "customers": [{"name": "private customer"}],
        "layout": {"title": "shared", "orders": [{"id": "private"}]},
    })

    assert snapshot == {"products": [{"path": "/news"}], "layout": {"title": "shared"}}


def test_template_version_response_keeps_review_assignment_and_progress():
    version = SimpleNamespace(
        template_id="agency-source-global",
        version="v1.2.0",
        changelog="Review handoff",
        config_json='{"layout": {"title": "Shared"}}',
        review_status="pending_second_review",
        review_note="Initial review completed",
        review_step=1,
        required_review_steps=2,
        review_assignee="user:reviewer",
        review_due_at="2026-07-30T08:00:00Z",
        approved_by="user:first-reviewer",
        approved_at="2026-07-29T08:00:00Z",
        published_at="2026-07-29T07:00:00Z",
        published_by="user:publisher",
    )

    response = TemplateSnapshotService._version_to_dict(version)

    assert response["review_note"] == "Initial review completed"
    assert response["review_step"] == 1
    assert response["required_review_steps"] == 2
    assert response["review_assignee"] == "user:reviewer"
    assert response["review_due_at"] == "2026-07-30T08:00:00Z"


def test_draft_save_never_replaces_the_released_template_before_approval():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with session_factory() as db:
            db.add_all([
                TemplateSnapshotTemplate(
                    template_id="source", template_type="hq-client", owner_scope="client_source", name="Source",
                    latest_version="v1", is_published=True, config_json=json.dumps({"title": "released"}),
                ),
                TemplateSnapshotVersion(
                    template_id="source", version="v1", config_json=json.dumps({"title": "released"}), review_status="published",
                ),
            ])
            await db.commit()
            service = TemplateSnapshotService(db)
            await service.upsert_template({
                "template_id": "source", "template_type": "hq-client", "owner_scope": "client_source",
                "name": "Source", "config_json": {"title": "draft"}, "is_published": True,
            })
            current = await service.get_template("source")
            assert current["latest_version"] == "v1"
            assert current["config_json"] == {"title": "released"}
            assert current["draft_config_json"] == {"title": "draft"}

            await service.publish_template("source", {"version": "v2", "requires_approval": True})
            pending = await service.get_template("source")
            assert pending["config_json"] == {"title": "released"}
            await service.review_template_version("source", "v2", action="approve", reviewer="reviewer")
            released = await service.get_template("source")
            assert released["latest_version"] == "v2"
            assert released["config_json"] == {"title": "draft"}
            assert released["draft_config_json"] is None
        await engine.dispose()

    asyncio.run(scenario())
