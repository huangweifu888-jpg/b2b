import pytest

from services.template_snapshot import build_release_preflight_report


def test_preflight_is_downstream_only_and_preserves_local_paths():
    report = build_release_preflight_report(
        source_scope="client_source",
        target_scope="client",
        previous_template={"layout": {"spacing": "normal"}},
        next_template={"layout": {"spacing": "comfortable"}, "modules": {"news": {"enabled": True}}},
        current_snapshot={"layout": {"spacing": "tenant-custom"}, "local-tool": {"enabled": True}},
        explicit_overrides={},
    )

    assert report["mode"] == "preflight"
    assert report["write_performed"] is False
    assert report["direction"] == "client_source->client"
    assert "layout.spacing" in report["preserved_downstream_paths"]
    assert "local-tool.enabled" in report["preserved_downstream_paths"]
    assert report["excluded_categories"] == ["business-data", "downstream-custom-data", "downstream-new-data", "uploaded-assets"]


def test_preflight_rejects_reverse_or_sideways_release():
    with pytest.raises(ValueError, match="Invalid downstream release direction"):
        build_release_preflight_report(
            source_scope="client",
            target_scope="hq",
            previous_template={},
            next_template={},
            current_snapshot={},
            explicit_overrides={},
        )
