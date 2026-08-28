from services.template_snapshot import _compose_restored_snapshot


def test_restore_preserves_downstream_customisations_and_new_data():
    previous_template = {
        "layout": {"title": "old", "body": "white"},
        "modules": {"catalog": {"enabled": True}},
    }
    restored_template = {
        "layout": {"title": "restored", "body": "cream"},
        "modules": {"catalog": {"enabled": False}, "news": {"enabled": True}},
    }
    current_snapshot = {
        "layout": {"title": "old", "body": "tenant-blue"},
        "modules": {"catalog": {"enabled": True, "label": "客户自定义名称"}, "local-tool": {"enabled": True}},
    }

    restored, overrides = _compose_restored_snapshot(
        restored_template,
        current_snapshot,
        {},
        previous_template,
        "all",
    )

    assert restored["layout"] == {"title": "restored", "body": "tenant-blue"}
    assert restored["modules"]["catalog"] == {"enabled": False, "label": "客户自定义名称"}
    assert restored["modules"]["local-tool"] == {"enabled": True}
    assert restored["modules"]["news"] == {"enabled": True}
    assert overrides["layout"]["body"] == "tenant-blue"


def test_scoped_restore_changes_only_the_selected_template_section():
    previous_template = {"layout": {"title": "old"}, "modules": {"catalog": {"enabled": True}}}
    source_template = {"layout": {"title": "restored"}, "modules": {"catalog": {"enabled": False}}}
    current_snapshot = {"layout": {"title": "old"}, "modules": {"catalog": {"enabled": True}, "local": {"enabled": True}}}

    restored, _overrides = _compose_restored_snapshot(source_template, current_snapshot, {}, previous_template, "modules")

    assert restored["layout"] == {"title": "old"}
    assert restored["modules"]["catalog"] == {"enabled": False}
    assert restored["modules"]["local"] == {"enabled": True}
